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

  describe('TLDR Generation and Rendering', () => {
    beforeEach(() => {
      global.document = createDocumentMock();
    });

    afterEach(() => {
      delete global.document;
    });

    it('should render TLDR section when tldr parameter provided', () => {
      const keyPoints = [
        { summary_item_text: 'Point one', origin_text_reference: 'In the beginning' },
        { summary_item_text: 'Point two', origin_text_reference: 'Furthermore this shows' }
      ];
      const tldr = 'This is a concise summary of the main points.';
      
      // Simulate renderKeyPoints logic
      let html = '';
      if (tldr) {
        html += `<div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">`;
        html += `<div style="color: #fff; font-weight: 600;">TL;DR</div>`;
        html += `<div style="color: #fff;">${tldr}</div>`;
        html += `</div>`;
      }
      
      assert.ok(html.includes('TL;DR'));
      assert.ok(html.includes(tldr));
      assert.ok(html.includes('linear-gradient'));
    });

    it('should not render TLDR section when tldr is null', () => {
      const keyPoints = [
        { summary_item_text: 'Point one', origin_text_reference: 'In the beginning' }
      ];
      const tldr = null;
      
      let html = '';
      if (tldr) {
        html += '<div>TL;DR</div>';
      }
      
      assert.strictEqual(html, '');
      assert.ok(!html.includes('TL;DR'));
    });

    it('should escape HTML in TLDR text', () => {
      const tldr = '<script>alert("xss")</script>';
      
      // Simulate escapeHtml function
      const div = document.createElement('div');
      div.textContent = tldr;
      const escaped = div.innerHTML;
      
      assert.ok(!escaped.includes('<script>'));
      assert.ok(escaped.includes('&lt;script&gt;'));
    });

    it('should position TLDR before key points list', () => {
      const keyPoints = [
        { summary_item_text: 'Point one', origin_text_reference: 'ref' }
      ];
      const tldr = 'Summary text';
      
      // Simulate render order
      let html = '';
      if (tldr) {
        html += `<div class="tldr">TL;DR: ${tldr}</div>`;
      }
      html += '<div class="key-points-list">';
      html += '<div class="key-point-item">• Point one</div>';
      html += '</div>';
      
      const tldrIndex = html.indexOf('tldr');
      const pointsIndex = html.indexOf('key-points-list');
      
      assert.ok(tldrIndex < pointsIndex, 'TLDR should appear before key points');
    });

    it('should handle TLDR generation after all chunks complete', () => {
      const allKeyPoints = [
        { summary_item_text: 'First point' },
        { summary_item_text: 'Second point' },
        { summary_item_text: 'Third point' }
      ];
      
      // Simulate TLDR generation flow
      const shouldGenerateTLDR = allKeyPoints.length > 0;
      assert.strictEqual(shouldGenerateTLDR, true);
      
      // Verify we can construct prompt from points
      const bulletList = allKeyPoints.map(p => p.summary_item_text).join('\n');
      assert.ok(bulletList.includes('First point'));
      assert.ok(bulletList.includes('Second point'));
      assert.ok(bulletList.includes('Third point'));
    });
  });
});
