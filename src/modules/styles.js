/**
 * Get CSS styles for the overlay
 * @returns {string} CSS styles
 */
export function getOverlayStyles() {
  return `
    :host {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .overlay {
      position: fixed;
      width: 400px;
      max-height: 90vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      border: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease-out;
      overflow: hidden;
    }
    @keyframes slideIn {
      from { transform: translateX(20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .header {
      background: #f8f9fa;
      padding: 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    }
    .header:active {
      cursor: grabbing;
    }
    .title {
      font-weight: 700;
      font-size: 16px;
      color: #202124;
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #5f6368;
      padding: 0;
      line-height: 1;
    }
    .close-btn:hover { color: #202124; }
    .selection-notice {
      padding: 10px 16px;
      background: #e8f5e9;
      border-bottom: 1px solid #c8e6c9;
      color: #2e7d32;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .selection-notice svg {
      flex-shrink: 0;
    }
    .controls {
      padding: 16px;
      border-bottom: 1px solid #eee;
      background: #fff;
    }
    .control-group {
      margin-bottom: 12px;
    }
    .control-group:last-child {
      margin-bottom: 0;
    }
    .control-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #5f6368;
      margin-bottom: 6px;
    }
    .control-group select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #dadce0;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      color: #202124;
      cursor: pointer;
    }
    .control-group select:focus {
      outline: none;
      border-color: #1a73e8;
    }
    .generate-btn {
      width: 100%;
      padding: 10px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 12px;
    }
    .generate-btn:hover {
      background: #1557b0;
    }
    .generate-btn:disabled {
      background: #dadce0;
      cursor: not-allowed;
    }
    .content {
      padding: 24px;
      overflow-y: auto;
      font-size: 16px;
      line-height: 1.6;
      color: #333;
    }
    /* Typography for Markdown results */
    .content h1 { font-size: 1.2em; margin-top: 0; }
    .content ul { padding-left: 20px; margin: 0; }
    .content li { margin-bottom: 8px; }
    .content p { margin-top: 0; }
    
    .loading {
      color: #666;
      font-style: italic;
    }
    .error {
      color: #d93025;
      background: #fce8e6;
      padding: 10px;
      border-radius: 4px;
    }
    .resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      z-index: 10;
    }
    .resize-handle::after {
      content: '';
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 12px;
      height: 12px;
      border-right: 2px solid #dadce0;
      border-bottom: 2px solid #dadce0;
    }
  `;
}
