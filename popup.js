async function openOverlay() {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Opening...";

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Send message to content script to show overlay
  chrome.tabs.sendMessage(tab.id, { 
    action: "SHOW_OVERLAY"
  }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "Error: Refresh the page.";
    } else {
      statusEl.textContent = "";
      window.close(); // Close popup to let user see the overlay
    }
  });
}

// Auto-open overlay when popup loads
document.addEventListener('DOMContentLoaded', () => {
  openOverlay();
});

document.getElementById('openBtn').addEventListener('click', openOverlay);