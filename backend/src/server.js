import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pg from 'pg';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Anthropic from '@anthropic-ai/sdk';

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

// Database
const db = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Redis
const redis = createClient({ 
  url: process.env.REDIS_URL 
});
await redis.connect();

// Anthropic
const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY 
});

// Middleware
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

// Auth routes
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

// Auth middleware
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

// Parse endpoint
app.post('/api/v1/parse', authMiddleware, async (req, res) => {
  try {
    const { text, context } = req.body;

    const prompt = `Analyze this text and extract actionable intent.

Text: "${text}"
Context: ${JSON.stringify(context)}

Respond ONLY with JSON:
{
  "intent": "create_event" | "create_task" | "none",
  "confidence": 0.0-1.0,
  "data": {
    "title": "...",
    "datetime": "ISO8601"
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    res.json(parsed);
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({ error: 'Parsing failed' });
  }
});

// User stats
app.get('/api/v1/user/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE user_id = $1) as total_actions,
        daily_actions_used,
        subscription_tier
       FROM actions
       RIGHT JOIN users ON users.id = $1
       WHERE users.id = $1 OR actions.user_id = $1
       GROUP BY users.id, daily_actions_used, subscription_tier`,
      [req.user.id]
    );

    res.json(stats.rows[0] || {
      total_actions: 0,
      daily_actions_used: 0,
      subscription_tier: req.user.subscription_tier
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Synapse API running on port ${PORT}`);
});