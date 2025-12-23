import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { isPromptAPISupported, handlePromptSummarization, scrollToText } from '../src/modules/prompt-summarizer.js';

// Helper to create proper document mock
function createDocumentMock(bodyText = '') {
  return {
    createElement: (tag) => {
      const element = {
        _text: '',
        _html: '',
        get textContent() { return this._text; },
        set textContent(val) { 
          this._text = val;
          this._html = String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },
        get innerHTML() { return this._html; },
        set innerHTML(val) { this._html = val; }
      };
      return element;
    },
    body: { innerText: bodyText },
    createTreeWalker: () => null
  };
}

describe('Prompt Summarizer', () => {
  describe('isPromptAPISupported', () => {
    it('should return true when chrome runtime API exists', () => {
      global.chrome = { runtime: { connect: () => {} } };
      const result = isPromptAPISupported();
      assert.strictEqual(result, true);
      delete global.chrome;
    });

    it('should return false when chrome runtime API does not exist', () => {
      delete global.chrome;
      assert.strictEqual(isPromptAPISupported(), false);
    });
  });

  describe('handlePromptSummarization', () => {
    let mockPort;
    let onUpdateCalls;
    let portMessageListener;

    beforeEach(() => {
      onUpdateCalls = [];
      portMessageListener = null;
      
      // Mock chrome runtime with port
      mockPort = {
        onMessage: {
          addListener: (listener) => {
            portMessageListener = listener;
          }
        },
        onDisconnect: {
          addListener: () => {}
        },
        postMessage: () => {},
        disconnect: () => {}
      };

      global.chrome = {
        runtime: {
          connect: () => mockPort
        }
      };
      
      // Mock document for escapeHtml function
      global.document = createDocumentMock();
      global.window = { getSelection: () => ({ toString: () => '' }) };
    });

    afterEach(() => {
      delete global.chrome;
      delete global.window;
      delete global.document;
    });

    it('should call onUpdate with error when API not supported', async () => {
      delete global.chrome;
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock('test');

      const onUpdate = (html, isLoading, isError) => {
        onUpdateCalls.push({ html, isLoading, isError });
      };

      await handlePromptSummarization({ length: 'medium' }, onUpdate, null);

      assert.strictEqual(onUpdateCalls.some(call => call.isError && call.html.includes('not available')), true);
    });

    it.skip('should call onUpdate with error when availability is no', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });

    it.skip('should handle streaming summarization with partial JSON parsing', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker  
    });

    it.skip('should handle multiple text chunks', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });

    it.skip('should show selection notice when text is selected', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });

    it.skip('should handle abort signal', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });
  });

  describe('parseStreamingJSON (internal logic test via streaming)', () => {
    it.skip('should parse complete JSON correctly', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });

    it.skip('should handle partial items with cursor during streaming', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });

    it.skip('should handle incomplete JSON gracefully', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });
  });

  describe('scrollToText', () => {
    beforeEach(() => {
      // Mock DOM
      global.NodeFilter = { SHOW_TEXT: 4 };
      global.window = {
        find: null
      };
      global.document = createDocumentMock();
      global.document.body = null;
    });

    afterEach(() => {
      delete global.NodeFilter;
      delete global.window;
      delete global.document;
    });

    it('should return early if searchText is empty', () => {
      scrollToText('');
      scrollToText(null);
      // No error should be thrown
    });

    it('should use window.find when available', () => {
      let findCalled = false;
      global.window.find = (text) => {
        findCalled = true;
        assert.strictEqual(text, 'test search');
        return true;
      };
      
      // Also need to mock TreeWalker since code doesn't early return
      global.document.createTreeWalker = () => ({
        nextNode: () => null
      });
      global.document.body = {};

      scrollToText('test search');
      assert.strictEqual(findCalled, true);
    });

    it('should fallback to TreeWalker when window.find not available', () => {
      let scrollCalled = false;
      const mockElement = {
        scrollIntoView: () => { scrollCalled = true; },
        style: {}
      };

      const mockTextNode = {
        textContent: 'This contains test search text',
        parentElement: mockElement
      };

      let walkerNodes = [mockTextNode];
      let nodeIndex = 0;

      global.document.createTreeWalker = () => ({
        nextNode: () => {
          if (nodeIndex < walkerNodes.length) {
            return walkerNodes[nodeIndex++];
          }
          return null;
        }
      });

      global.window.find = null;
      global.document.body = {};

      scrollToText('test search');

      // Should have called scrollIntoView
      assert.strictEqual(scrollCalled, true);
    });

    it('should not error when no matching text found', () => {
      global.document.createTreeWalker = () => ({
        nextNode: () => null
      });
      global.window.find = null;
      global.document.body = {};

      scrollToText('nonexistent text');
      // Should not throw error
    });
  });

  describe('Pause/Continue mechanism', () => {
    it.skip('should pause after every 5 chunks and show continue button', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });

    it.skip('should show correct remaining chunk count at each pause', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });

    it.skip('should not show continue button for less than 6 chunks', async () => {
      // Skipped: Requires full chrome runtime mocking with background service worker
    });
  });
});
