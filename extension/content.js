console.log('⚡ Synapse loaded!');

// URL del tuo backend su Render (quello corretto che abbiamo trovato prima)
const API_URL = 'https://synapse-api-xf4z.onrender.com/api/v1';

// 🔴 INCOLLA QUI IL TOKEN CHE HAI COPIATO DALLA DASHBOARD
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMWFiOGYwNy03YTc5LTQzNWMtYmYwOS1jOGQzMGU3MWVmMjgiLCJlbWFpbCI6ImZyYXNhcjg2QGdtYWlsLmNvbSIsImlhdCI6MTc2ODQwNDM5MywiZXhwIjoxNzcwOTk2MzkzfQ.t3Q8sU9QrUOd5693afRE-JgRubS6Q4rtCGfF78Ago2E'; 

document.addEventListener('mouseup', async () => {
  const selectedText = window.getSelection().toString().trim();
  
  // Seleziona solo se il testo è abbastanza lungo (es. > 5 caratteri)
  if (selectedText.length > 5) {
    console.log('Selected text:', selectedText);
    
    // Logica semplice: cerca parole chiave temporali
    const dateKeywords = ['giovedì', 'venerdì', 'domani', 'alle', 'meeting', 'chiama', 'ricorda'];
    const hasDateHint = dateKeywords.some(keyword => 
      selectedText.toLowerCase().includes(keyword)
    );
    
    if (hasDateHint) {
      showQuickAction(selectedText);
    }
  }
});

function showQuickAction(text) {
  const existing = document.getElementById('synapse-quick-action');
  if (existing) existing.remove();
  
  const button = document.createElement('div');
  button.id = 'synapse-quick-action';
  button.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      z-index: 2147483647; /* Z-index altissimo per stare sopra tutto */
      font-family: sans-serif;
      font-weight: bold;
      transition: all 0.2s;
    ">
      ⚡ Analyze with AI
    </div>
  `;
  
  // Quando clicchi, parte la chiamata vera!
  button.onclick = async () => {
    const btnContent = button.querySelector('div');
    btnContent.innerHTML = "⏳ Thinking..."; // Feedback visivo
    
    try {
      const response = await fetch(`${API_URL}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}` // Qui usiamo il tuo pass
        },
        body: JSON.stringify({
          text: text,
          context: { url: window.location.href }
        })
      });

      if (!response.ok) throw new Error('Auth failed or Server error');

      const data = await response.json();
      console.log("AI Response:", data);

      // Mostra il risultato dell'AI
      alert(
        `🤖 Synapse AI Plan:\n\n` +
        `Intent: ${data.intent.toUpperCase()}\n` +
        `Title: ${data.data.title || 'N/A'}\n` +
        `Time: ${data.data.datetime || 'N/A'}\n\n` +
        `(Check Dashboard for stats!)`
      );

    } catch (error) {
      alert("Error: " + error.message + "\n(Did you paste the token?)");
    }
    
    button.remove();
  };
  
  document.body.appendChild(button);
  setTimeout(() => { if(document.body.contains(button)) button.remove() }, 10000);
}