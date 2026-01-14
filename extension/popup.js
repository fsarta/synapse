// URL del tuo Backend (quello corretto trovato prima)
const API_URL = 'https://synapse-api-xf4z.onrender.com/api/v1'; 

document.addEventListener('DOMContentLoaded', async () => {
  const loginScreen = document.getElementById('login-screen');
  const loggedScreen = document.getElementById('logged-screen');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const errorMsg = document.getElementById('error-msg');

  // 1. Controlla se siamo già loggati all'apertura
  const stored = await chrome.storage.local.get(['synapse_token']);
  if (stored.synapse_token) {
    showLoggedScreen();
  }

  // 2. Gestione Login
  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    errorMsg.textContent = '';
    loginBtn.textContent = 'Loading...';

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // SALVA IL TOKEN nello storage di Chrome
      await chrome.storage.local.set({ 
        synapse_token: data.token,
        synapse_user: data.user
      });

      showLoggedScreen();

    } catch (err) {
      errorMsg.textContent = err.message;
    } finally {
      loginBtn.textContent = 'Login';
    }
  });

  // 3. Gestione Logout
  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove(['synapse_token', 'synapse_user']);
    showLoginScreen();
  });

  // 4. Bottone Dashboard
  dashboardBtn.addEventListener('click', () => {
    // Inserisci qui il tuo URL Vercel corretto
    window.open('https://synapse-dashboard-r6xoeckq4-frasars-projects.vercel.app', '_blank');
  });

  // Funzioni UI Helper
  function showLoggedScreen() {
    loginScreen.classList.add('hidden');
    loggedScreen.classList.remove('hidden');
  }

  function showLoginScreen() {
    loggedScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    emailInput.value = '';
    passwordInput.value = '';
  }
});