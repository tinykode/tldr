async function openOverlay() {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Opening...";

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      statusEl.textContent = "Error: No active tab found";
      console.error("No active tab found");
      return;
    }

    console.log("Sending message to tab:", tab.id, tab.url);

    // Send message to content script to show overlay
    chrome.tabs.sendMessage(tab.id, { 
      action: "SHOW_OVERLAY"
    }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        console.error("Content script error:", errorMsg);
        
        // Show helpful error message
        if (errorMsg.includes("Receiving end does not exist")) {
          statusEl.textContent = "Error: Content script not loaded. Refresh the page (F5) or reload the extension.";
        } else {
          statusEl.textContent = `Error: ${errorMsg}`;
        }
      } else {
        console.log("Overlay opened successfully", response);
        statusEl.textContent = "";
        window.close(); // Close popup to let user see the overlay
      }
    });
  } catch (error) {
    console.error("Popup error:", error);
    statusEl.textContent = `Error: ${error.message}`;
  }
}

// Auto-open overlay when popup loads
document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded, attempting to open overlay");
  openOverlay();
});

document.getElementById('openBtn').addEventListener('click', () => {
  console.log("Open button clicked");
  openOverlay();
});