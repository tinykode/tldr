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
 * Extract bullet points from markdown text
 * @param {string} text - Markdown text with bullet points
 * @returns {string[]} Array of bullet point text (without bullets)
 */
function extractBulletPoints(text) {
  const lines = text.split('\n');
  const bullets = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines starting with -, *, or numbered list
    if (trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      // Remove the bullet/number prefix
      const content = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim();
      if (content) {
        bullets.push(content);
      }
    }
  }
  
  return bullets;
}

/**
 * Format accumulated bullet points into markdown
 * @param {string[]} bulletPoints - Array of bullet points
 * @param {string} format - Output format (markdown or plain-text)
 * @returns {string} Formatted summary
 */
function formatAccumulatedSummary(bulletPoints, format) {
  if (bulletPoints.length === 0) {
    return '';
  }
  
  if (format === 'plain-text') {
    return bulletPoints.join('\n');
  }
  
  // Markdown format (default)
  return bulletPoints.map(point => `- ${point}`).join('\n');
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
    const { chunks, isSelection, totalLength } = extractText();

    // Show selection notice if processing selected text
    if (selectionNoticeElement) {
      selectionNoticeElement.style.display = isSelection ? 'flex' : 'none';
      selectionNoticeElement.dataset.visible = isSelection ? 'true' : 'false';
    }

    console.log(`Processing ${chunks.length} chunk(s), total length: ${totalLength} chars`);

    // Determine if we should accumulate bullet points (only for key-points)
    const shouldAccumulateBullets = config.type === 'key-points';
    const allBulletPoints = [];
    const allSummaries = [];
    let lastDisplayedHTML = '';
    
    for (let i = 0; i < chunks.length; i++) {
      if (signal.aborted) break;
      
      const chunkText = chunks[i];
      const progress = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';
      const loadingMsg = isSelection 
        ? `Summarizing selected text${progress}...` 
        : `Reading and summarizing content${progress}...`;
      
      // Show loading with existing content (if any)
      if (i > 0 && lastDisplayedHTML) {
        onUpdate(lastDisplayedHTML, true, false, isSelection, loadingMsg);
      } else {
        onUpdate(loadingMsg, true, false, isSelection);
      }

      // Generate Summary for this chunk
      const stream = await summarizer.summarizeStreaming(chunkText, { signal });

      let chunkSummary = "";
      for await (const chunk of stream) {
        if (signal.aborted) break;
        chunkSummary += chunk;
        
        // Stream updates in real-time
        if (shouldAccumulateBullets) {
          // For key-points: show previous bullets + current streaming chunk
          const currentBullets = extractBulletPoints(chunkSummary);
          const combinedBullets = [...allBulletPoints, ...currentBullets];
          const accumulatedSummary = formatAccumulatedSummary(combinedBullets, config.format);
          const formattedHTML = parseMarkdown(accumulatedSummary);
          lastDisplayedHTML = formattedHTML;
          onUpdate(formattedHTML, false);
        } else {
          // For paragraphs: show previous paragraphs + current streaming chunk
          const currentSummaries = [...allSummaries, chunkSummary.trim()];
          const combinedSummary = currentSummaries.join('\n\n');
          const formattedHTML = parseMarkdown(combinedSummary);
          lastDisplayedHTML = formattedHTML;
          onUpdate(formattedHTML, false);
        }
      }

      // After chunk completes, save to accumulated results
      if (shouldAccumulateBullets) {
        const bulletPoints = extractBulletPoints(chunkSummary);
        allBulletPoints.push(...bulletPoints);
      } else {
        allSummaries.push(chunkSummary.trim());
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
