console.log('⚡ Synapse loaded!');

const API_URL = 'https://synapse-api.onrender.com/api/v1';

// Simple detection for demo
document.addEventListener('DOMContentLoaded', () => {
  console.log('Synapse is monitoring this page');
});

// Listen for text selection
document.addEventListener('mouseup', async () => {
  const selectedText = window.getSelection().toString().trim();
  
  if (selectedText.length > 10) {
    console.log('Selected text:', selectedText);
    
    // Check if it contains date-related keywords
    const dateKeywords = ['giovedì', 'venerdì', 'domani', 'alle', 'meeting'];
    const hasDateHint = dateKeywords.some(keyword => 
      selectedText.toLowerCase().includes(keyword)
    );
    
    if (hasDateHint) {
      showQuickAction(selectedText);
    }
  }
});

function showQuickAction(text) {
  // Remove existing action
  const existing = document.getElementById('synapse-quick-action');
  if (existing) existing.remove();
  
  // Create quick action button
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
      z-index: 999999;
      font-family: -apple-system, sans-serif;
      animation: slideIn 0.3s ease-out;
    ">
      ⚡ Create event from selection?
    </div>
  `;
  
  button.onclick = async () => {
    alert('Demo: This would create an event!\nText: ' + text);
    button.remove();
  };
  
  document.body.appendChild(button);
  
  // Auto-remove after 5 seconds
  setTimeout(() => button.remove(), 5000);
}