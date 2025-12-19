import { showOverlay, updateOverlayContent } from './modules/overlay.js';
import { handleSummarization } from './modules/summarizer.js';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SUMMARIZE") {
    startSummarization(request.config);
    sendResponse({ received: true });
  } else if (request.action === "SHOW_OVERLAY") {
    showOverlay(startSummarization);
    sendResponse({ received: true });
  }
});

/**
 * Start the summarization process
 * @param {Object} config - Summarization configuration
 * @param {HTMLElement} selectionNotice - Selection notice element
 */
function startSummarization(config, selectionNotice) {
  handleSummarization(config, updateOverlayContent, selectionNotice);
}
