import { parseMarkdown } from './markdown.js';
import { extractText } from './text-extractor.js';

/**
 * Check if Summarizer API is supported
 * @returns {boolean}
 */
export function isSummarizerSupported() {
  return 'Summarizer' in self;
}

/**
 * Handle the summarization process
 * @param {Object} config - Summarization configuration
 * @param {string} config.type - Summary type (key-points, tldr, teaser, headline)
 * @param {string} config.length - Summary length (short, medium, long)
 * @param {string} config.format - Output format (markdown)
 * @param {Function} onUpdate - Callback for progress updates
 * @param {HTMLElement} selectionNoticeElement - Element to show selection notice
 * @returns {Promise<void>}
 */
export async function handleSummarization(config, onUpdate, selectionNoticeElement) {
  // Feature Detection
  if (!isSummarizerSupported()) {
    onUpdate("Error: Summarizer API not supported in this browser version. Please update Chrome to 138+.", false, true);
    return;
  }

  try {
    // Check Model Availability
    onUpdate("Loading Gemini Nano model...", true);
    const availability = await self.Summarizer.availability();
    
    if (availability === 'no') {
      onUpdate("Error: AI Model is not available on this device.", false, true);
      return;
    }

    // Create Summarizer Instance
    const summarizer = await self.Summarizer.create({
      type: config.type,
      format: config.format,
      length: config.length,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          onUpdate(`Downloading AI Model: ${Math.round(e.loaded * 100)}%`, true);
        });
      }
    });

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
    const stream = await summarizer.summarizeStreaming(articleText);
    
    let fullSummary = "";
    for await (const chunk of stream) {
      fullSummary += chunk;
      const formattedHTML = parseMarkdown(fullSummary);
      onUpdate(formattedHTML, false);
    }

    // Cleanup
    summarizer.destroy();

  } catch (error) {
    console.error(error);
    onUpdate(`Error: ${error.message}`, false, true);
  }
}
