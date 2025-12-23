import { parseMarkdown } from './markdown.js';
import { extractText } from './text-extractor.js';

/**
 * Check if Summarizer API is supported
 * @returns {boolean}
 */
export function isSummarizerSupported() {
  return 'Summarizer' in self;
}

// Global controller to manage cancellation
let currentController = null;

/**
 * Wait for user to click continue button
 * @param {Function} onUpdate - Callback to update UI
 * @param {string} currentContent - Current summary content
 * @param {number} remainingChunks - Number of chunks remaining
 * @returns {Promise<void>}
 */
function waitForContinue(onUpdate, currentContent, remainingChunks) {
  return new Promise((resolve) => {
    const continueBtn = `
      <div style="text-align: center; margin: 20px 0; padding: 16px; background: #f8f9fa; border-radius: 6px;">
        <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">Processed 5 chunks. ${remainingChunks} more chunk${remainingChunks !== 1 ? 's' : ''} remaining.</p>
        <button id="continue-processing-btn" style="padding: 8px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Continue Processing</button>
      </div>
    `;
    
    const contentWithButton = currentContent + continueBtn;
    onUpdate(contentWithButton, false);
    
    const handleClick = (e) => {
      const actualTarget = e.composedPath()[0];
      if (actualTarget && actualTarget.id === 'continue-processing-btn') {
        document.removeEventListener('click', handleClick, true);
        resolve();
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClick, true);
    }, 100);
  });
}

export async function handleSummarization(config, onUpdate, selectionNoticeElement) {
  // Abort previous generation if it exists
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();
  const signal = currentController.signal;

  // Feature Detection
  if (!isSummarizerSupported()) {
    onUpdate("Error: Summarizer API not supported in this browser version. Please update Chrome to 138+.", false, true);
    return;
  }

  try {
    // Check Model Availability
    onUpdate("Loading Gemini Nano model...", true);

    if (signal.aborted) return;

    // Note: availability() is quick but good to check signal after await if it was async
    const availability = await self.Summarizer.availability();

    if (signal.aborted) return;

    if (availability === 'no') {
      onUpdate("Error: AI Model is not available on this device.", false, true);
      return;
    }

    // Create Summarizer Instance with signal
    const summarizer = await self.Summarizer.create({
      type: config.type,
      format: config.format,
      length: config.length,
      signal, // Pass abort signal
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          // Only update if not aborted (though create should throw if aborted)
          if (!signal.aborted) {
            onUpdate(`Downloading AI Model: ${Math.round(e.loaded * 100)}%`, true);
          }
        });
      }
    });

    if (signal.aborted) {
      summarizer.destroy();
      return;
    }

    // Extract Text (prioritize selection)
    const { chunks, isSelection } = extractText(20000);

    // Show selection notice if processing selected text
    if (selectionNoticeElement) {
      selectionNoticeElement.style.display = isSelection ? 'flex' : 'none';
      // Store selection notice state for persistence
      selectionNoticeElement.dataset.visible = isSelection ? 'true' : 'false';
    }

    onUpdate(isSelection ? "Summarizing selected text..." : "Reading and summarizing content...", true, false, isSelection);

    // Process each chunk
    let fullSummary = "";
    const totalChunks = chunks.length;
    
    for (let i = 0; i < totalChunks; i++) {
      if (signal.aborted) break;
      
      // Pause after every 5 chunks (but not at the end)
      if (i > 0 && i % 5 === 0 && i < totalChunks) {
        const remainingChunks = totalChunks - i;
        const formattedHTML = parseMarkdown(fullSummary);
        await waitForContinue(onUpdate, formattedHTML, remainingChunks);
        
        if (signal.aborted) break;
      }
      
      const chunkText = chunks[i];
      
      // Show chunk progress if multiple chunks (append to existing content)
      if (totalChunks > 1 && i > 0) {
        const progressMessage = `\n\n*Parsing chunk ${i + 1}/${totalChunks}...*`;
        const contentWithProgress = fullSummary + progressMessage;
        const formattedHTML = parseMarkdown(contentWithProgress);
        onUpdate(formattedHTML, false);
      }
      
      // Generate Summary for this chunk (Streaming)
      const stream = await summarizer.summarizeStreaming(chunkText, { signal });
      
      let chunkSummary = "";
      for await (const chunk of stream) {
        if (signal.aborted) break;
        chunkSummary += chunk;
        
        // Build full summary with chunk separator
        const currentFull = fullSummary + (fullSummary && totalChunks > 1 ? "\n\n---\n\n" : "") + chunkSummary;
        const formattedHTML = parseMarkdown(currentFull);
        onUpdate(formattedHTML, false);
      }
      
      // Add completed chunk to full summary
      if (chunkSummary) {
        fullSummary += (fullSummary && totalChunks > 1 ? "\n\n---\n\n" : "") + chunkSummary;
      }
    }

    // Cleanup
    summarizer.destroy();

    // Clear controller if this was the active one
    if (currentController === signal.controller) { // Note: signal.controller isn't standard property, check by ref
      // We can't easily check equal ref unless we kept it properly.
      // But actually, relies on scope.
    }
  } catch (error) {
    // Ignore AbortError
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      console.log('Summarization aborted by new request');
      return;
    }
    console.error(error);
    onUpdate(`Error: ${error.message}`, false, true);
  } finally {
    // Optional: If we want to check strict equality
    // if (currentController && currentController.signal === signal) ...
  }
}
