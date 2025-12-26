import { parseMarkdown } from './markdown.js';
import { extractText } from './text-extractor.js';

/**
 * Check if Prompt API is supported
 * @returns {boolean}
 */
export function isPromptAPISupported() {
  // In content script, check if background supports it
  return typeof chrome !== 'undefined' && !!chrome.runtime;
}

const LengthToNumberMap = {
  "short": 3,
  "medium": 5,
  "long": 7
}

// Global port for communication with background
let port = null;
let currentController = null;

/**
 * Wait for user to click continue button
 * @param {Function} onUpdate - Callback to update UI
 * @param {string} currentContent - Current HTML content
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

/**
 * Handle summarization using Prompt API via background service worker
 * @param {Object} config - Configuration object
 * @param {Function} onUpdate - Callback for updates
 * @param {HTMLElement} selectionNoticeElement - Selection notice element
 */
export async function handlePromptSummarization(config, onUpdate, selectionNoticeElement) {
  console.log('[Content] Starting prompt summarization via background');
  
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();
  const signal = currentController.signal;

  if (!isPromptAPISupported()) {
    onUpdate("Error: Chrome extension API not available", false, true);
    return;
  }

  try {
    // Extract text
    const { chunks, isSelection } = extractText(20000);
    console.log(`[Content] Extracted ${chunks.length} chunks, isSelection:`, isSelection);

    if (selectionNoticeElement) {
      selectionNoticeElement.style.display = isSelection ? 'flex' : 'none';
      selectionNoticeElement.dataset.visible = isSelection ? 'true' : 'false';
    }

    onUpdate(isSelection ? "Generating key points..." : "Reading and generating key points...", true, false, isSelection);

    let allKeyPoints = [];
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      if (signal.aborted) break;

      // Pause after every 5 chunks (but not at the end)
      if (i > 0 && i % 5 === 0 && i < totalChunks) {
        const remainingChunks = totalChunks - i;
        const currentHtml = renderKeyPoints(allKeyPoints);
        await waitForContinue(onUpdate, currentHtml, remainingChunks);
        
        if (signal.aborted) break;
      }

      const chunkText = chunks[i];

      // Show chunk progress if multiple chunks (append to existing content)
      if (totalChunks > 1 && i > 0) {
        const currentHtml = renderKeyPoints(allKeyPoints);
        const progressMessage = `\n\n*Processing chunk ${i + 1}/${totalChunks}...*`;
        onUpdate(currentHtml + `<p style="color: #666; font-style: italic; margin-top: 16px;">${progressMessage}</p>`, false);
      }

      console.log(`[Content] Processing chunk ${i + 1}/${totalChunks}`);

      // Connect to background and send summarization request
      port = chrome.runtime.connect({ name: 'prompt-api' });
      
      let accumulatedText = '';
      let lastCompleteCount = 0;

      // Listen for responses from background
      const processStream = new Promise((resolve, reject) => {
        port.onMessage.addListener((message) => {
          console.log('[Content] Received message from background:', message.type);

          if (signal.aborted) {
            port.disconnect();
            resolve();
            return;
          }

          switch (message.type) {
            case 'update':
              onUpdate(message.content, message.isLoading);
              break;

            case 'chunk':
              accumulatedText += message.content;

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
              break;

            case 'complete':
              console.log('[Content] Stream complete');
              accumulatedText = message.content;
              
              // Final parse to ensure we got everything
              try {
                const finalItems = JSON.parse(accumulatedText);
                if (Array.isArray(finalItems) && finalItems.length > lastCompleteCount) {
                  const newItems = finalItems.slice(lastCompleteCount);
                  allKeyPoints = allKeyPoints.concat(newItems);
                }
              } catch (e) {
                console.error('[Content] Failed to parse final JSON:', e);
              }

              port.disconnect();
              resolve();
              break;

            case 'error':
              console.error('[Content] Error from background:', message.content);
              onUpdate(message.content, false, true);
              port.disconnect();
              reject(new Error(message.content));
              break;

            case 'aborted':
              console.log('[Content] Operation aborted');
              port.disconnect();
              resolve();
              break;
          }
        });

        port.onDisconnect.addListener(() => {
          console.log('[Content] Port disconnected');
          resolve();
        });
      });

      // Send summarization request
      port.postMessage({
        type: 'summarize',
        data: {
          text: chunkText,
          length: config.length,
        }
      });

      // Wait for stream to complete
      await processStream;

      if (signal.aborted) break;
    }

    // Final render with all complete items
    if (!signal.aborted && allKeyPoints.length > 0) {
      const html = renderKeyPoints(allKeyPoints, 0);
      onUpdate(html, false);

      // Generate TLDR from all key points
      try {
        const tldr = await generateTLDR(allKeyPoints, config.length);
        if (tldr && !signal.aborted) {
          const htmlWithTldr = renderKeyPoints(allKeyPoints, 0, tldr);
          onUpdate(htmlWithTldr, false);
        }
      } catch (tldrError) {
        console.error('[Content] TLDR generation failed:', tldrError);
        // Keep existing content without TLDR
      }
    }

  } catch (error) {
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      console.log('[Content] Prompt summarization aborted');
      return;
    }
    console.error('[Content] Error:', error);
    onUpdate(`Error: ${error.message}`, false, true);
  } finally {
    if (port) {
      port.disconnect();
      port = null;
    }
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
  const completeObjectRegex = /\{\s*"summary_item_text"\s*:\s*"([^"]+)"\s*,\s*"origin_text_reference"\s*:\s*"([^"]+)"\s*\}/g;
  let match;
  const allMatches = [];
  
  while ((match = completeObjectRegex.exec(text)) !== null) {
    allMatches.push({
      summary_item_text: match[1],
      origin_text_reference: match[2]
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
        origin_text_reference: ''
      };
    }
  }

  return result;
}

/**
 * Render key points with scroll-to-text buttons
 * @param {Array} keyPoints - Array of {summary_item_text, origin_text_reference}
 * @param {number} partialCount - Number of partial items being rendered (0 or 1)
 * @param {string} tldr - Optional TLDR summary to display at top
 * @returns {string} HTML string
 */
function renderKeyPoints(keyPoints, partialCount = 0, tldr = null) {
  if (!keyPoints || keyPoints.length === 0) {
    return '<p style="color: #666;">No key points generated.</p>';
  }

  let html = '';

  // Add TLDR section if available
  if (tldr) {
    html += `
      <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="color: #fff; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; opacity: 0.9;">TL;DR</div>
        <div style="color: #fff; font-size: 15px; line-height: 1.6;">${escapeHtml(tldr)}</div>
      </div>
    `;
  }

  html += '<div class="key-points-list">';

  keyPoints.forEach((point, index) => {
    const escapedText = escapeHtml(point.origin_text_reference);
    const isPartial = index === keyPoints.length - 1 && partialCount > 0;
    
    html += `
      <div class="key-point-item" style="display: flex; gap: 6px; margin-bottom: 10px; align-items: baseline;">
        <span style="color: #333; flex: 1;">• ${escapeHtml(point.summary_item_text)}${isPartial ? '<span style="animation: blink 1s infinite;">▋</span>' : ''}</span>`;
    
    // Only show scroll button for complete items with origin_text_reference
    if (!isPartial && point.origin_text_reference) {
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
 * Generate TLDR from all key points
 * @param {Array} keyPoints - Array of key points
 * @param {string} length - Desired length (short/medium/long)
 * @returns {Promise<string>} TLDR text
 */
async function generateTLDR(keyPoints, length) {
  if (!keyPoints || keyPoints.length === 0) return null;

  const bulletList = keyPoints.map(p => p.summary_item_text).join('\n');
  const maxSentences = length === 'short' ? 1 : length === 'medium' ? 2 : 3;
  
  const prompt = `Summarize these key points into ${maxSentences} concise sentence${maxSentences > 1 ? 's' : ''}:\n\n${bulletList}`;

  return new Promise((resolve, reject) => {
    const tldrPort = chrome.runtime.connect({ name: 'prompt-api' });
    let tldrText = '';

    tldrPort.onMessage.addListener((message) => {
      switch (message.type) {
        case 'chunk':
          tldrText += message.content;
          break;
        case 'complete':
          tldrPort.disconnect();
          resolve(tldrText.replace(/"/g, '').trim());
          break;
        case 'error':
          console.error('[Content] TLDR generation error:', message.content);
          tldrPort.disconnect();
          reject(new Error(message.content));
          break;
      }
    });

    tldrPort.onDisconnect.addListener(() => {
      if (tldrText) {
        resolve(tldrText.replace(/"/g, '').trim());
      } else {
        reject(new Error('Port disconnected without TLDR'));
      }
    });

    tldrPort.postMessage({
      type: 'prompt',
      data: { prompt }
    });
  });
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
