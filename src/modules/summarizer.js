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
    const { text: articleText, isSelection } = extractText(20000);

    // Show selection notice if processing selected text
    if (selectionNoticeElement) {
      selectionNoticeElement.style.display = isSelection ? 'flex' : 'none';
      // Store selection notice state for persistence
      selectionNoticeElement.dataset.visible = isSelection ? 'true' : 'false';
    }

    onUpdate(isSelection ? "Summarizing selected text..." : "Reading and summarizing content...", true, false, isSelection);

    // Generate Summary (Streaming for better UX)
    const stream = await summarizer.summarizeStreaming(articleText, { signal });

    let fullSummary = "";
    for await (const chunk of stream) {
      if (signal.aborted) break; // Should be handled by stream throwing, but extra safety
      fullSummary += chunk;
      const formattedHTML = parseMarkdown(fullSummary);
      onUpdate(formattedHTML, false);
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
