/**
 * Get currently selected text on the page
 * @returns {string} Selected text or empty string
 */
export function getSelectedText() {
  return window.getSelection()?.toString().trim() || '';
}

/**
 * Extract text content from the current page
 * @param {number} maxLength - Maximum length of text to extract
 * @returns {string} Extracted text
 */
export function extractPageText(maxLength = 20000) {
  return document.body.innerText.substring(0, maxLength);
}

/**
 * Extract text content, prioritizing selected text
 * @param {number} maxLength - Maximum length of text to extract
 * @returns {Object} { text: string, isSelection: boolean }
 */
export function extractText(maxLength = 20000) {
  const selectedText = getSelectedText();
  
  if (selectedText) {
    return {
      text: selectedText.substring(0, maxLength),
      isSelection: true
    };
  }
  
  return {
    text: extractPageText(maxLength),
    isSelection: false
  };
}
