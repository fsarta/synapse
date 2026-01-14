console.log('⚡ Synapse loaded!');
const API_URL = 'https://synapse-api-xf4z.onrender.com/api/v1';

document.addEventListener('mouseup', async () => {
  const selectedText = window.getSelection().toString().trim();
  
  if (selectedText.length > 5) {
    // Prima di fare qualsiasi cosa, controlliamo se l'utente è loggato
    const stored = await chrome.storage.local.get(['synapse_token']);
    
    // Se non c'è token, ignoriamo (o potremmo mostrare un avviso "Login required")
    if (!stored.synapse_token) return;

    const dateKeywords = ['lunedì', 'giovedì', 'martedì', 'marcoledì', 'giovedì', 'venerdì', 'sabato', 'domenica', 'appuntamento', 'domani', 'alle', 'meeting', 'chiama', 'ricorda'];
    const hasDateHint = dateKeywords.some(keyword => selectedText.toLowerCase().includes(keyword));
    
    if (hasDateHint) {
      showQuickAction(selectedText, stored.synapse_token);
    }
  }
});

function showQuickAction(text, token) {
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
    
    chrome.runtime.sendMessage({
      type: 'ANALYZE_TEXT',
      text: text,
      token: token,
      url: window.location.href
    }, (response) => {
      
      // Gestione della risposta dal Background
      if (chrome.runtime.lastError) {
        alert("Extension Error: " + chrome.runtime.lastError.message);
      } else if (response && response.success) {
        const data = response.data;
        alert(
          `🤖 PLAN:\n` +
          `Intent: ${data.intent.toUpperCase()}\n` +
          `Title: ${data.data.title || 'N/A'}\n` +
          `Time: ${data.data.datetime || 'N/A'}`
        );
      } else {
        alert("Error: " + (response ? response.error : "Unknown error"));
      }
      
      button.remove();
    });
  };
  
  document.body.appendChild(button);
  setTimeout(() => { if(document.body.contains(button)) button.remove() }, 10000);
}