/**
 * Get CSS styles for the overlay
 * @returns {string} CSS styles
 */
export function getOverlayStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :host {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    
    /* --- Typography --- */
    .lens-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      background: linear-gradient(to right, #9333ea, #3b82f6);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      display: inline-block; /* Fix for background-clip on some elements */
    }
    .lens-body {
      font-size: 0.875rem;
      line-height: 1.625;
      color: #475569;
    }
    .lens-label-micro {
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #94a3b8;
      margin-bottom: 8px;
      display: block;
    }
    .lens-badge {
      font-size: 0.625rem;
      font-weight: 600;
      color: #9333ea;
      background-color: #f3e8ff;
      padding: 2px 8px;
      border-radius: 99px;
    }
    .overlay {
      position: fixed;
      width: 400px;
      max-height: 90vh;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      border: 1px solid rgba(255, 255, 255, 0.5);
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
      background: rgba(255, 255, 255, 0.3);
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
      background: transparent;
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
    /* --- Slider Container --- */
    .density-slider-container {
      position: relative;
      height: 24px;
      width: 100%;
      display: flex;
      align-items: center;
      user-select: none;
      margin: 10px 0;
    }
    /* --- The Visual Track (Background) --- */
    .slider-track {
      position: absolute;
      width: 100%;
      height: 6px;
      background-color: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
      z-index: 0;
    }
    /* --- The Gradient Fill --- */
    .slider-fill {
      height: 100%;
      width: 0%; 
      background: linear-gradient(90deg, #a855f7 0%, #3b82f6 100%);
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    /* --- The Dots/Steps --- */
    .slider-steps {
      position: absolute;
      width: 100%;
      display: flex;
      justify-content: space-between;
      padding: 0 2px;
      pointer-events: none;
      z-index: 1;
    }
    .slider-dot {
      width: 8px;
      height: 8px;
      background-color: white;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #cbd5e1;
      transition: all 0.3s ease;
    }
    /* Active State for Dot */
    .slider-dot.active {
      box-shadow: 0 0 0 2px #9333ea;
      transform: scale(1.25);
      background-color: #f3e8ff;
    }
    /* --- The Invisible Interactive Input --- */
    .slider-input {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      z-index: 10;
      margin: 0;
    }
    .slider-input::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; }
    .slider-input::-moz-range-thumb { border: none; width: 24px; height: 24px; }
    
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
