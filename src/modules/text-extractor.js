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
 * Split text into chunks recursively, ensuring no chunk exceeds maxChunkSize
 * @param {string} text - Text to split
 * @param {number} maxChunkSize - Maximum size per chunk
 * @returns {string[]} Array of text chunks
 */
export function splitIntoChunks(text, maxChunkSize = 20000) {
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const midpoint = Math.floor(text.length / 2);
  const firstHalf = text.substring(0, midpoint);
  const secondHalf = text.substring(midpoint);
  
  return [
    ...splitIntoChunks(firstHalf, maxChunkSize),
    ...splitIntoChunks(secondHalf, maxChunkSize)
  ];
}

/**
 * Extract text content, prioritizing selected text
 * @param {number} maxChunkSize - Maximum size per chunk
 * @returns {Object} { chunks: string[], isSelection: boolean }
 */
export function extractText(maxChunkSize = 20000) {
  const selectedText = getSelectedText();
  
  if (selectedText) {
    return {
      chunks: splitIntoChunks(selectedText, maxChunkSize),
      isSelection: true
    };
  }
  
  return {
    chunks: splitIntoChunks(extractPageText(), maxChunkSize),
    isSelection: false
  };
}
