/**
 * Get currently selected text on the page
 * @returns {string} Selected text or empty string
 */
export function getSelectedText() {
  return window.getSelection()?.toString().trim() || '';
}

/**
 * Extract text content from the current page
 * @returns {string} Extracted text
 */
export function extractPageText() {
  return document.body.innerText;
}

/**
 * Split text into chunks for processing
 * @param {string} text - Text to split
 * @param {number} chunkSize - Maximum characters per chunk
 * @returns {string[]} Array of text chunks
 */
export function splitIntoChunks(text, chunkSize = 15000) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // If not at the end, try to break at a paragraph or sentence
    if (end < text.length) {
      // Try to find paragraph break
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + chunkSize * 0.7) {
        end = paragraphBreak + 2;
      } else {
        // Try to find sentence break
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + chunkSize * 0.7) {
          end = sentenceBreak + 2;
        }
      }
    }
    
    chunks.push(text.substring(start, end).trim());
    start = end;
  }
  
  return chunks;
}

/**
 * Extract text content, prioritizing selected text
 * @returns {Object} { chunks: string[], isSelection: boolean, totalLength: number }
 */
export function extractText() {
  const selectedText = getSelectedText();
  
  if (selectedText) {
    const chunks = splitIntoChunks(selectedText);
    return {
      chunks,
      isSelection: true,
      totalLength: selectedText.length
    };
  }
  
  const pageText = extractPageText();
  const chunks = splitIntoChunks(pageText);
  
  return {
    chunks,
    isSelection: false,
    totalLength: pageText.length
  };
}
