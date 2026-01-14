const API_URL = 'https://synapse-api-xf4z.onrender.com/api/v1';

// Ascolta i messaggi dal Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.type === 'ANALYZE_TEXT') {
    // Dobbiamo ritornare true per dire a Chrome che risponderemo in modo asincrono
    handleAnalysis(request, sendResponse);
    return true; 
  }
});

async function handleAnalysis(request, sendResponse) {
  try {
    const response = await fetch(`${API_URL}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.token}` // Il token arriva dal content script
      },
      body: JSON.stringify({
        text: request.text,
        context: { url: request.url }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Server error');
    }

    const data = await response.json();
    // Invia il risultato al Content Script
    sendResponse({ success: true, data: data });

  } catch (error) {
    console.error('Background fetch error:', error);
    // Invia l'errore al Content Script
    sendResponse({ success: false, error: error.message });
  }
}