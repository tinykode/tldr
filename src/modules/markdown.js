/**
 * Simple Markdown Parser for converting Markdown to HTML
 * @param {string} text - Markdown text to parse
 * @returns {string} HTML string
 */
export function parseMarkdown(text) {
  if (!text) return '';
  
  // Bold
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Bullets ( - item or * item)
  if (html.match(/^[\-*]\s/m)) {
    const lines = html.split('\n');
    let inList = false;
    let listHtml = '';
    
    lines.forEach(line => {
      if (line.trim().match(/^[\-*]\s/)) {
        if (!inList) {
          listHtml += '<ul>';
          inList = true;
        }
        listHtml += `<li>${line.replace(/^[\-*]\s/, '')}</li>`;
      } else {
        if (inList) {
          listHtml += '</ul>';
          inList = false;
        }
        listHtml += line + '<br>';
      }
    });
    if (inList) listHtml += '</ul>';
    html = listHtml;
  } else {
    // Paragraphs
    html = html.replace(/\n\n/g, '<br><br>');
  }
  
  return html;
}
