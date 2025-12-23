import { parseMarkdown } from './markdown.js';
import { extractText } from './text-extractor.js';

/**
 * Check if Prompt API is supported
 * @returns {boolean}
 */
export function isPromptAPISupported() {
  return 'LanguageModel' in self;
}

const LengthToNumberMap = {
  "short": 3,
  "medium": 5,
  "long": 7
}

// Global controller to manage cancellation
let currentController = null;

/**
 * Handle summarization using Prompt API with structured JSON output
 * @param {Object} config - Configuration object
 * @param {Function} onUpdate - Callback for updates
 * @param {HTMLElement} selectionNoticeElement - Selection notice element
 */
export async function handlePromptSummarization(config, onUpdate, selectionNoticeElement) {
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();
  const signal = currentController.signal;

  if (!isPromptAPISupported()) {
    onUpdate("Error: Prompt API not supported. Please update Chrome to latest version and enable Prompt API via the flags", false, true);
    return;
  }

  try {
    onUpdate("Loading Gemini Nano model...", true);

    if (signal.aborted) return;

    const availability = await self.LanguageModel.availability();

    if (signal.aborted) return;

    if (availability === 'no') {
      onUpdate("Error: AI Model is not available on this device.", false, true);
      return;
    }

    const session = await self.LanguageModel.create({
      signal,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          if (!signal.aborted) {
            onUpdate(`Downloading AI Model: ${Math.round(e.loaded * 100)}%`, true);
          }
        });
      }
    });

    if (signal.aborted) {
      session.destroy();
      return;
    }

    // Extract text
    const { chunks, isSelection } = extractText(20000);

    if (selectionNoticeElement) {
      selectionNoticeElement.style.display = isSelection ? 'flex' : 'none';
      selectionNoticeElement.dataset.visible = isSelection ? 'true' : 'false';
    }

    onUpdate(isSelection ? "Generating key points..." : "Reading and generating key points...", true, false, isSelection);

    // Define JSON schema for structured output
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          summary_item_text: { type: "string" },
          start_of_text: { type: "string" }
        },
        required: ["summary_item_text", "start_of_text"]
      }
    };

    let allKeyPoints = [];
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      if (signal.aborted) break;

      const chunkText = chunks[i];

      // Show chunk progress if multiple chunks (append to existing content)
      if (totalChunks > 1 && i > 0) {
        const currentHtml = renderKeyPoints(allKeyPoints);
        const progressMessage = `\n\n*Processing chunk ${i + 1}/${totalChunks}...*`;
        onUpdate(currentHtml + `<p style="color: #666; font-style: italic; margin-top: 16px;">${progressMessage}</p>`, false);
      }

      // Build the prompt
      const prompt = `Please summarize the following text into key points.

Respond with a JSON array where each item has:
- summary_item_text: A concise bullet point summarizing part of the text
- start_of_text: The first 4 words from the original text that this summary corresponds to, not the first words of the summary you generated

Format example:
[
  {"summary_item_text": "The main concept discusses...", "start_of_text": "In the beginning there"},
  {"summary_item_text": "Another key point about...", "start_of_text": "Furthermore the study shows"}
]

Please try to summarize only the main content of the article not anything on the side or not related to the topic.
Please provide ${LengthToNumberMap[config.length]} summary items.
Each summary item should be around 25-30 words.

Text to summarize:

${chunkText}`;

      // Stream the response
      const stream = session.promptStreaming(prompt, {
        responseConstraint: schema,
        signal
      });

      let accumulatedText = '';
      let lastCompleteCount = 0;

      for await (const chunk of stream) {
        if (signal.aborted) break;

        accumulatedText += chunk;

        // Parse complete and partial items
        const { completeItems, partialItem } = parseStreamingJSON(accumulatedText);
        
        // Update complete items if we have new ones
        if (completeItems.length > lastCompleteCount) {
          const newItems = completeItems.slice(lastCompleteCount);
          allKeyPoints = allKeyPoints.concat(newItems);
          lastCompleteCount = completeItems.length;
        }

        // Render all complete items + partial item
        const itemsToRender = [...allKeyPoints];
        if (partialItem && partialItem.summary_item_text) {
          itemsToRender.push(partialItem);
        }

        const html = renderKeyPoints(itemsToRender, partialItem ? 1 : 0);
        onUpdate(html, false);
      }

      if (signal.aborted) break;

      // Final parse to ensure we got everything (no partial items)
      try {
        const finalItems = JSON.parse(accumulatedText);
        if (Array.isArray(finalItems) && finalItems.length > lastCompleteCount) {
          const newItems = finalItems.slice(lastCompleteCount);
          allKeyPoints = allKeyPoints.concat(newItems);
          // Final render with all complete items
          const html = renderKeyPoints(allKeyPoints, 0);
          onUpdate(html, false);
        }
      } catch (e) {
        console.error('Failed to parse final JSON:', e);
      }
    }

    session.destroy();

  } catch (error) {
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      console.log('Prompt summarization aborted');
      return;
    }
    console.error(error);
    onUpdate(`Error: ${error.message}`, false, true);
  }
}

/**
 * Parse streaming JSON to extract complete and partial items
 * @param {string} text - Accumulated JSON text
 * @returns {{ completeItems: Array, partialItem: Object|null }}
 */
function parseStreamingJSON(text) {
  const result = { completeItems: [], partialItem: null };
  
  try {
    // Try to parse complete items by adding closing bracket
    let textToParse = text.trim();
    const isComplete = textToParse.endsWith(']');
    
    if (!isComplete) {
      textToParse = textToParse.replace(/,?\s*$/, '') + ']';
    }
    
    const items = JSON.parse(textToParse);
    if (Array.isArray(items)) {
      if (isComplete) {
        // JSON is complete, all items are final
        result.completeItems = items;
      } else {
        // JSON is incomplete, last item is partial
        if (items.length > 0) {
          result.completeItems = items.slice(0, -1);
          result.partialItem = items[items.length - 1];
        }
      }
    }
    return result;
  } catch (e) {
    // Couldn't parse, try to extract partial data with regex
  }

  // Extract complete objects using regex
  const completeObjectRegex = /\{\s*"summary_item_text"\s*:\s*"([^"]+)"\s*,\s*"start_of_text"\s*:\s*"([^"]+)"\s*\}/g;
  let match;
  const allMatches = [];
  
  while ((match = completeObjectRegex.exec(text)) !== null) {
    allMatches.push({
      summary_item_text: match[1],
      start_of_text: match[2]
    });
  }

  // If we found any matches, treat last one as partial (since JSON isn't complete)
  if (allMatches.length > 0) {
    result.completeItems = allMatches.slice(0, -1);
    result.partialItem = allMatches[allMatches.length - 1];
  } else {
    // No complete matches, try to extract any partial text
    const partialMatch = text.match(/\{\s*"summary_item_text"\s*:\s*"([^"]*)/);
    if (partialMatch && partialMatch[1]) {
      result.partialItem = {
        summary_item_text: partialMatch[1],
        start_of_text: ''
      };
    }
  }

  return result;
}

/**
 * Render key points with scroll-to-text buttons
 * @param {Array} keyPoints - Array of {summary_item_text, start_of_text}
 * @param {number} partialCount - Number of partial items being rendered (0 or 1)
 * @returns {string} HTML string
 */
function renderKeyPoints(keyPoints, partialCount = 0) {
  if (!keyPoints || keyPoints.length === 0) {
    return '<p style="color: #666;">No key points generated.</p>';
  }

  let html = '<div class="key-points-list">';

  keyPoints.forEach((point, index) => {
    const escapedText = escapeHtml(point.start_of_text);
    const isPartial = index === keyPoints.length - 1 && partialCount > 0;
    
    html += `
      <div class="key-point-item" style="display: flex; gap: 6px; margin-bottom: 10px; align-items: baseline;">
        <span style="color: #333; flex: 1;">• ${escapeHtml(point.summary_item_text)}${isPartial ? '<span style="animation: blink 1s infinite;">▋</span>' : ''}</span>`;
    
    // Only show scroll button for complete items with start_of_text
    if (!isPartial && point.start_of_text) {
      html += `
        <button 
          class="scroll-to-text-btn" 
          data-search-text="${escapedText}"
          style="border: none; background: none; cursor: pointer; font-size: 14px; color: #666; padding: 0; line-height: 1; transition: color 0.2s;"
          onmouseover="this.style.color='#007bff'" 
          onmouseout="this.style.color='#666'"
          title="Scroll to this section"
        >↗</button>`;
    }
    
    html += `
      </div>
    `;
  });

  html += '</div>';
  return html;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Scroll to text on the page
 * @param {string} searchText - Text to search for (first 4 words)
 */
export function scrollToText(searchText) {
  if (!searchText) return;

  // Try using window.find() first (works in some browsers)
  if (window.find) {
    window.find(searchText, false, false, true);
  }

  // Fallback: manual DOM search
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes(searchText)) {
      const element = node.parentElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }
}
