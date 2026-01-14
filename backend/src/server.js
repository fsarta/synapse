import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pg from 'pg';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
// Importiamo l'SDK di Google
import { GoogleGenerativeAI } from '@google/generative-ai';

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configurazione Database
const db = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 2. Configurazione Redis
const redis = createClient({ 
  url: process.env.REDIS_URL,
  socket: {
    tls: true, // Assicura che usi TLS
    rejectUnauthorized: false, // Evita errori sui certificati SSL interni
    family: 4 // <--- QUESTA È LA CHIAVE: Forza l'uso di IPv4
  }
});

// Gestione errori Redis per evitare crash se Redis cade
redis.on('error', (err) => console.log('Redis Client Error', err));
await redis.connect();

// 3. Configurazione Google Gemini (Gratuita ed Efficiente)
// Assicurati di avere GEMINI_API_KEY nel tuo file .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Usiamo il modello "flash": veloce, economico/gratis, ideale per task semplici
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  // Questa configurazione è FONDAMENTALE: costringe l'AI a rispondere SOLO in JSON.
  // Evita errori di parsing e rimuove la necessità di usare regex complesse.
  generationConfig: { 
    responseMimeType: "application/json",
    temperature: 0.2 // Bassa temperatura per risposte più deterministiche e precise
  }
});

// Middleware di base
app.use(helmet());
app.use(cors({ 
  origin: process.env.FRONTEND_URL || '*' 
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// --- ROUTES AUTENTICAZIONE ---

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1', 
      [email]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, subscription_tier, created_at) 
       VALUES ($1, $2, 'free', NOW()) 
       RETURNING id, email, subscription_tier`,
      [email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT id, email, password_hash, subscription_tier FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        subscription_tier: user.subscription_tier 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- MIDDLEWARE AUTH ---

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query(
      'SELECT id, email, subscription_tier, daily_actions_used FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- ROUTES AI (Parse) ---

app.post('/api/v1/parse', authMiddleware, async (req, res) => {
  try {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text input is required' });
    }

    // Prompt ottimizzato per Gemini Flash
    // Non serve specificare "Respond ONLY with JSON" aggressivamente perché 
    // lo abbiamo già configurato nell'inizializzazione del modello.
    const prompt = `
    Analyze this text and extract actionable intent.
    
    Text: "${text}"
    Context: ${JSON.stringify(context || {})}

    Desired Schema:
    {
      "intent": "create_event" | "create_task" | "none",
      "confidence": number (0.0-1.0),
      "data": {
        "title": "string",
        "datetime": "ISO8601 string or null"
      }
    }`;

    // Chiamata all'API di Google
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Essendo configurato come responseMimeType: "application/json",
    // response.text() ci restituisce una stringa JSON pulita.
    const parsedData = JSON.parse(response.text());

    // Aggiornamento statistiche utente (opzionale ma consigliato per tenere traccia)
    await db.query(
        'UPDATE users SET daily_actions_used = daily_actions_used + 1 WHERE id = $1',
        [req.user.id]
    ).catch(err => console.error('Failed to update stats', err));

    res.json(parsedData);

  } catch (error) {
    console.error('Parse error:', error);
    // Gestione specifica per errori di sicurezza/blocco di Google (raro ma possibile)
    if (error.message && error.message.includes('SAFETY')) {
         return res.status(400).json({ error: 'Content flagged as unsafe' });
    }
    res.status(500).json({ error: 'Parsing failed' });
  }
});

// --- USER STATS ---

app.get('/api/v1/user/stats', authMiddleware, async (req, res) => {
  try {
    // Nota: Ho corretto la query SQL. La tua query precedente usava una tabella 'actions'
    // che non vedevo definita. Ho semplificato basandomi sui dati in 'users'.
    // Se hai una tabella actions separata, ripristina la join.
    const stats = await db.query(
      `SELECT 
        daily_actions_used,
        subscription_tier
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    res.json(stats.rows[0] || {
      daily_actions_used: 0,
      subscription_tier: req.user.subscription_tier
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Synapse API running on port ${PORT}`);
});