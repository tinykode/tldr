import { getOverlayStyles } from './styles.js';

// Overlay state
let overlayContainer = null;
let contentDiv = null;
let generateBtn = null;
let handleWindowResize = null;

// Edge margin to prevent overlay from being glued to window edges
const EDGE_MARGIN = 10;

// Persistent state
let savedState = {
  content: null,
  isLoading: false,
  isError: false,
  styleValue: 'key-points',
  lengthValue: 'medium',
  selectionNoticeVisible: false,
  position: { top: 20, right: 20 },
  size: { width: 400, minHeight: 200 }
};

/**
 * Show the summarizer overlay on the page
 * @param {Function} onGenerate - Callback when generate button is clicked
 */
export function showOverlay(onGenerate) {
  if (overlayContainer) {
    return; // Don't recreate if already exists
  }

  // Create host for Shadow DOM
  const host = document.createElement('div');
  host.id = "tldr-ai-extension-root";
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.right = "0";
  host.style.zIndex = "2147483647"; // Max Z-Index
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Styles
  const style = document.createElement('style');
  style.textContent = getOverlayStyles();

  // Markup
  const wrapper = document.createElement('div');
  wrapper.className = 'overlay';
  
  wrapper.innerHTML = `
    <div class="header">
      <div class="title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        TL;DR Summary
      </div>
      <button class="close-btn">&times;</button>
    </div>
    <div id="selection-notice" class="selection-notice" style="display: none;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
      <span>Processing selected text</span>
    </div>
    <div class="resize-handle"></div>
    <div class="controls">
      <div class="control-group">
        <label for="style-select">Style:</label>
        <select id="style-select">
          <option value="key-points">Key Points (Bullets)</option>
          <option value="tldr">TL;DR (Concise)</option>
          <option value="teaser">Teaser</option>
          <option value="headline">Headline</option>
        </select>
      </div>
      <div class="control-group">
        <label for="length-select">Length:</label>
        <select id="length-select">
          <option value="short">Short</option>
          <option value="medium" selected>Medium</option>
          <option value="long">Long</option>
        </select>
      </div>
      <button id="generate-btn" class="generate-btn">Generate Summary</button>
    </div>
    <div class="content" id="summary-content">
      <div style="color: #666; text-align: center; padding: 20px;">
        Select your preferences above and click "Generate Summary" to begin.
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(wrapper);

  // References
  overlayContainer = host;
  contentDiv = wrapper.querySelector('#summary-content');
  generateBtn = wrapper.querySelector('#generate-btn');
  const styleSelect = wrapper.querySelector('#style-select');
  const lengthSelect = wrapper.querySelector('#length-select');
  const selectionNotice = wrapper.querySelector('#selection-notice');
  const header = wrapper.querySelector('.header');
  const resizeHandle = wrapper.querySelector('.resize-handle');

  // Apply saved position and size (with viewport constraints and edge margins)
  const constrainedTop = Math.min(savedState.position.top, window.innerHeight - savedState.size.minHeight - EDGE_MARGIN);
  const constrainedRight = Math.min(savedState.position.right, window.innerWidth - savedState.size.width - EDGE_MARGIN);
  const constrainedWidth = Math.min(savedState.size.width, window.innerWidth - (EDGE_MARGIN * 2));
  const constrainedHeight = Math.min(savedState.size.minHeight, window.innerHeight - (EDGE_MARGIN * 2));
  
  wrapper.style.top = `${Math.max(EDGE_MARGIN, constrainedTop)}px`;
  wrapper.style.right = `${Math.max(EDGE_MARGIN, constrainedRight)}px`;
  wrapper.style.width = `${Math.max(300, constrainedWidth)}px`;
  wrapper.style.minHeight = `${Math.max(200, constrainedHeight)}px`;

  // Restore saved state
  if (savedState.content) {
    updateOverlayContent(savedState.content, savedState.isLoading, savedState.isError);
  }
  if (savedState.selectionNoticeVisible) {
    selectionNotice.style.display = 'flex';
  }
  styleSelect.value = savedState.styleValue;
  lengthSelect.value = savedState.lengthValue;

  // Constrain position to viewport with edge margin
  const constrainPosition = () => {
    const rect = wrapper.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - EDGE_MARGIN;
    const maxTop = window.innerHeight - rect.height - EDGE_MARGIN;
    
    let left = rect.left;
    let top = rect.top;
    
    // Keep within bounds with margin
    if (left < EDGE_MARGIN) left = EDGE_MARGIN;
    if (top < EDGE_MARGIN) top = EDGE_MARGIN;
    if (left > maxLeft) left = Math.max(EDGE_MARGIN, maxLeft);
    if (top > maxTop) top = Math.max(EDGE_MARGIN, maxTop);
    
    wrapper.style.left = `${left}px`;
    wrapper.style.top = `${top}px`;
    wrapper.style.right = 'auto';
    
    // Save position
    savedState.position = { 
      top, 
      right: window.innerWidth - left - wrapper.offsetWidth 
    };
  };

  // Make draggable
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('close-btn')) return;
    isDragging = true;
    const rect = wrapper.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    let newLeft = e.clientX - dragOffset.x;
    let newTop = e.clientY - dragOffset.y;
    
    // Constrain to viewport with edge margin
    const maxLeft = window.innerWidth - wrapper.offsetWidth - EDGE_MARGIN;
    const maxTop = window.innerHeight - wrapper.offsetHeight - EDGE_MARGIN;
    
    newLeft = Math.max(EDGE_MARGIN, Math.min(newLeft, maxLeft));
    newTop = Math.max(EDGE_MARGIN, Math.min(newTop, maxTop));
    
    wrapper.style.top = `${newTop}px`;
    wrapper.style.left = `${newLeft}px`;
    wrapper.style.right = 'auto';
    
    // Save position
    savedState.position = { 
      top: newTop, 
      right: window.innerWidth - newLeft - wrapper.offsetWidth 
    };
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Make resizable
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let startWidth = 0;
  let startHeight = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    startWidth = wrapper.offsetWidth;
    startHeight = wrapper.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;
    
    const rect = wrapper.getBoundingClientRect();
    const maxWidth = window.innerWidth - rect.left - EDGE_MARGIN;
    const maxHeight = window.innerHeight - rect.top - EDGE_MARGIN;
    
    const newWidth = Math.max(300, Math.min(startWidth + deltaX, maxWidth));
    const newHeight = Math.max(200, Math.min(startHeight + deltaY, maxHeight));
    
    wrapper.style.width = `${newWidth}px`;
    wrapper.style.height = `${newHeight}px`;
    wrapper.style.maxHeight = 'none';
    
    // Save size
    savedState.size = { width: newWidth, minHeight: newHeight };
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
  });

  // Handle window resize to keep overlay visible
  handleWindowResize = () => {
    if (!overlayContainer) return;
    constrainPosition();
    
    // Also constrain size if needed with edge margin
    const rect = wrapper.getBoundingClientRect();
    const maxWidth = window.innerWidth - rect.left - EDGE_MARGIN;
    const maxHeight = window.innerHeight - rect.top - EDGE_MARGIN;
    
    if (rect.width > maxWidth) {
      wrapper.style.width = `${Math.max(300, maxWidth)}px`;
      savedState.size.width = Math.max(300, maxWidth);
    }
    if (rect.height > maxHeight) {
      wrapper.style.height = `${Math.max(200, maxHeight)}px`;
      savedState.size.minHeight = Math.max(200, maxHeight);
    }
  };

  window.addEventListener('resize', handleWindowResize);

  // Close handler
  wrapper.querySelector('.close-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    closeOverlay();
  });

  // Generate button handler
  generateBtn.addEventListener('click', () => {
    const type = styleSelect.value;
    const length = lengthSelect.value;
    
    // Save current control values
    savedState.styleValue = type;
    savedState.lengthValue = length;
    
    // Disable button during processing
    setButtonState(false, 'Generating...');
    
    if (onGenerate) {
      onGenerate({ type, length, format: 'markdown' }, selectionNotice);
    }
  });
}

/**
 * Close and cleanup the overlay
 */
export function closeOverlay() {
  if (overlayContainer) {
    // Remove window resize listener
    if (handleWindowResize) {
      window.removeEventListener('resize', handleWindowResize);
      handleWindowResize = null;
    }
    
    // State is already saved via updateOverlayContent, just cleanup DOM references
    overlayContainer.remove();
    overlayContainer = null;
    contentDiv = null;
    generateBtn = null;
  }
}

/**
 * Update the content displayed in the overlay
 * @param {string} html - HTML content to display
 * @param {boolean} isLoading - Whether showing loading state
 * @param {boolean} isError - Whether showing error state
 * @param {boolean} showSelection - Whether to show selection notice
 */
export function updateOverlayContent(html, isLoading, isError = false, showSelection = null) {
  // Save state for persistence
  savedState.content = html;
  savedState.isLoading = isLoading;
  savedState.isError = isError;
  if (showSelection !== null) {
    savedState.selectionNoticeVisible = showSelection;
  }

  if (!contentDiv) return;

  if (isError) {
    contentDiv.innerHTML = `<div class="error">${html}</div>`;
    setButtonState(true, 'Generate Summary');
  } else if (isLoading) {
    contentDiv.innerHTML = `<div class="loading">${html}</div>`;
  } else {
    contentDiv.innerHTML = html;
    setButtonState(true, 'Generate Summary');
  }
}

/**
 * Set the generate button state
 * @param {boolean} enabled - Whether button is enabled
 * @param {string} text - Button text
 */
function setButtonState(enabled, text) {
  if (generateBtn) {
    generateBtn.disabled = !enabled;
    generateBtn.textContent = text;
  }
}

/**
 * Check if overlay is currently open
 * @returns {boolean}
 */
export function isOverlayOpen() {
  return overlayContainer !== null;
}
