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
    it('should return true when LanguageModel API exists', () => {
      global.self = { LanguageModel: {} };
      assert.strictEqual(isPromptAPISupported(), true);
    });

    it('should return false when LanguageModel API does not exist', () => {
      global.self = {};
      assert.strictEqual(isPromptAPISupported(), false);
    });
  });

  describe('handlePromptSummarization', () => {
    let mockSession;
    let mockStream;
    let onUpdateCalls;

    beforeEach(() => {
      onUpdateCalls = [];
      mockStream = null;
      mockSession = null;
      
      // Mock document for escapeHtml function
      global.document = createDocumentMock();
      global.window = { getSelection: () => ({ toString: () => '' }) };
    });

    afterEach(() => {
      global.self = {};
      delete global.window;
      delete global.document;
    });

    it('should call onUpdate with error when API not supported', async () => {
      global.self = {};
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock('test');

      const onUpdate = (html, isLoading, isError) => {
        onUpdateCalls.push({ html, isLoading, isError });
      };

      await handlePromptSummarization({ length: 'medium' }, onUpdate, null);

      assert.strictEqual(onUpdateCalls.some(call => call.isError && call.html.includes('not supported')), true);
    });

    it('should call onUpdate with error when availability is no', async () => {
      global.self = {
        LanguageModel: {
          availability: async () => 'no'
        }
      };
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock('test');

      const onUpdate = (html, isLoading, isError) => {
        onUpdateCalls.push({ html, isLoading, isError });
      };

      await handlePromptSummarization({ length: 'medium' }, onUpdate, null);

      assert.strictEqual(onUpdateCalls.some(call => call.isError && call.html.includes('not available')), true);
    });

    it('should handle streaming summarization with partial JSON parsing', async () => {
      // Mock streaming chunks
      const chunks = [
        '[{"summary_item_text":"First ',
        'point about AI","start_of_text":"In the beginning"},',
        '{"summary_item_text":"Second point about tech","start_of_text":"Furthermore the study"}]'
      ];

      mockSession = {
        promptStreaming: async function* (prompt, options) {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
        destroy: () => {}
      };

      global.self = {
        LanguageModel: {
          availability: async () => 'ready',
          create: async () => mockSession
        }
      };
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock('In the beginning there were AI. Furthermore the study shows results.');

      const onUpdate = (html, isLoading, isError) => {
        onUpdateCalls.push({ html, isLoading, isError });
      };

      await handlePromptSummarization({ length: 'medium' }, onUpdate, null);

      // Should have loading updates and final content
      assert.ok(onUpdateCalls.length > 0, 'Should have at least one update');
      const finalUpdate = onUpdateCalls[onUpdateCalls.length - 1];
      assert.ok(finalUpdate, 'Final update should exist');
      assert.ok(typeof finalUpdate.html === 'string', 'Final update should have html string');
      assert.ok(finalUpdate.html.includes('First point about AI'), `Expected "First point about AI" in: ${finalUpdate.html}`);
      assert.ok(finalUpdate.html.includes('Second point about tech'));
      assert.ok(finalUpdate.html.includes('scroll-to-text-btn'));
    });

    it('should handle multiple text chunks', async () => {
      const longText = 'a'.repeat(25000); // Force multiple chunks
      
      mockSession = {
        promptStreaming: async function* (prompt, options) {
          yield '[{"summary_item_text":"Summary","start_of_text":"aaaa aaaa aaaa aaaa"}]';
        },
        destroy: () => {}
      };

      global.self = {
        LanguageModel: {
          availability: async () => 'ready',
          create: async () => mockSession
        }
      };
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock( longText);

      const onUpdate = (html, isLoading, isError) => {
        onUpdateCalls.push({ html, isLoading, isError });
      };

      await handlePromptSummarization({ length: 'short' }, onUpdate, null);

      // Should show chunk progress
      const hasChunkProgress = onUpdateCalls.some(call => 
        call.html && call.html.includes('chunk')
      );
      assert.strictEqual(hasChunkProgress, true);
    });

    it('should show selection notice when text is selected', async () => {
      mockSession = {
        promptStreaming: async function* (prompt, options) {
          yield '[{"summary_item_text":"Summary","start_of_text":"Selected text here"}]';
        },
        destroy: () => {}
      };

      global.self = {
        LanguageModel: {
          availability: async () => 'ready',
          create: async () => mockSession
        }
      };
      global.window = { getSelection: () => ({ toString: () => 'Selected text here for testing' }) };
      global.document = createDocumentMock( 'Full page text');

      const mockSelectionNotice = {
        style: { display: '' },
        dataset: {}
      };

      const onUpdate = (html, isLoading, isError, showSelection) => {
        onUpdateCalls.push({ html, isLoading, isError, showSelection });
      };

      await handlePromptSummarization({ length: 'medium' }, onUpdate, mockSelectionNotice);

      assert.strictEqual(mockSelectionNotice.style.display, 'flex');
      assert.strictEqual(mockSelectionNotice.dataset.visible, 'true');
    });

    it('should handle abort signal', async () => {
      let abortCalled = false;

      mockSession = {
        promptStreaming: async function* (prompt, options) {
          // Simulate abort during streaming
          if (options.signal.aborted) {
            throw new Error('Aborted');
          }
          yield '[{"summary_item_text":"Test","start_of_text":"test"}]';
        },
        destroy: () => { abortCalled = true; }
      };

      global.self = {
        LanguageModel: {
          availability: async () => 'ready',
          create: async (options) => {
            // Trigger abort immediately
            setTimeout(() => options.signal.controller?.abort(), 0);
            return mockSession;
          }
        }
      };
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock( 'test');

      const onUpdate = () => {};

      // Start first summarization
      const promise1 = handlePromptSummarization({ length: 'medium' }, onUpdate, null);
      // Start second to trigger abort of first
      const promise2 = handlePromptSummarization({ length: 'medium' }, onUpdate, null);

      await Promise.all([promise1, promise2]);
      
      // Abort should have been called
      assert.strictEqual(abortCalled, true);
    });
  });

  describe('parseStreamingJSON (internal logic test via streaming)', () => {
    let mockSession;
    let onUpdateCalls;

    beforeEach(() => {
      onUpdateCalls = [];
      
      // Mock document for escapeHtml function
      global.document = createDocumentMock();
      global.window = { getSelection: () => ({ toString: () => '' }) };
    });

    afterEach(() => {
      global.self = {};
      delete global.window;
      delete global.document;
    });

    it('should parse complete JSON correctly', async () => {
      mockSession = {
        promptStreaming: async function* (prompt, options) {
          yield '[{"summary_item_text":"Complete item","start_of_text":"First four words"}]';
        },
        destroy: () => {}
      };

      global.self = {
        LanguageModel: {
          availability: async () => 'ready',
          create: async () => mockSession
        }
      };
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock( 'First four words here');

      const onUpdate = (html) => {
        onUpdateCalls.push(html);
      };

      await handlePromptSummarization({ length: 'short' }, onUpdate, null);

      const finalHtml = onUpdateCalls[onUpdateCalls.length - 1];
      assert.ok(finalHtml.includes('Complete item'));
      assert.ok(!finalHtml.includes('▋')); // No cursor for complete items
    });

    it('should handle partial items with cursor during streaming', async () => {
      mockSession = {
        promptStreaming: async function* (prompt, options) {
          yield '[{"summary_item_text":"Partial ';
          yield 'item text","start_of_text":"First four words"}]';
        },
        destroy: () => {}
      };

      global.self = {
        LanguageModel: {
          availability: async () => 'ready',
          create: async () => mockSession
        }
      };
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock( 'First four words here');

      const onUpdate = (html) => {
        onUpdateCalls.push(html);
      };

      await handlePromptSummarization({ length: 'short' }, onUpdate, null);

      // Check intermediate updates had cursor
      const intermediateUpdates = onUpdateCalls.slice(0, -1);
      assert.strictEqual(intermediateUpdates.some(html => html.includes('▋')), true);
    });

    it('should handle incomplete JSON gracefully', async () => {
      mockSession = {
        promptStreaming: async function* (prompt, options) {
          yield '[{"summary_item_text":"Item one","start_of_text":"First"}';
          yield ',{"summary_item_text":"Item two';
          yield '","start_of_text":"Second"}]';
        },
        destroy: () => {}
      };

      global.self = {
        LanguageModel: {
          availability: async () => 'ready',
          create: async () => mockSession
        }
      };
      global.window = { getSelection: () => ({ toString: () => '' }) };
      global.document = createDocumentMock( 'First Second');

      const onUpdate = (html) => {
        onUpdateCalls.push(html);
      };

      await handlePromptSummarization({ length: 'short' }, onUpdate, null);

      const finalHtml = onUpdateCalls[onUpdateCalls.length - 1];
      assert.ok(finalHtml.includes('Item one'));
      assert.ok(finalHtml.includes('Item two'));
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
});
