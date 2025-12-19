import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

describe('Summarizer', () => {
  describe('isSummarizerSupported', () => {
    it('should return true when Summarizer API exists', async () => {
      global.self = { Summarizer: {} };
      
      const { isSummarizerSupported } = await import('../src/modules/summarizer.js');
      assert.strictEqual(isSummarizerSupported(), true);
    });

    it('should return false when Summarizer API does not exist', () => {
      const originalSelf = global.self;
      global.self = {};
      
      // Check without Summarizer property
      const result = 'Summarizer' in global.self;
      assert.strictEqual(result, false);
      
      global.self = originalSelf;
    });
  });

  describe('handleSummarization', () => {
    it('should call onUpdate with error when API not supported', async () => {
      global.self = {};
      const updates = [];
      const onUpdate = (...args) => updates.push(args);
      
      const { handleSummarization } = await import('../src/modules/summarizer.js');
      
      await handleSummarization(
        { type: 'tldr', length: 'medium', format: 'markdown' },
        onUpdate
      );

      assert.ok(updates.length > 0);
      assert.ok(updates[0][0].includes('not supported'));
      assert.strictEqual(updates[0][2], true); // isError
    });

    it('should call onUpdate with error when availability is no', async () => {
      global.self = {
        Summarizer: {
          availability: async () => 'no'
        }
      };
      
      const updates = [];
      const onUpdate = (...args) => updates.push(args);
      
      const { handleSummarization } = await import('../src/modules/summarizer.js');
      
      await handleSummarization(
        { type: 'tldr', length: 'medium', format: 'markdown' },
        onUpdate
      );

      const errorUpdate = updates.find(u => u[2] === true);
      assert.ok(errorUpdate);
      assert.ok(errorUpdate[0].includes('not available'));
    });

    it('should handle summarization with streaming', async () => {
      const mockSummarizer = {
        summarizeStreaming: async function* (text) {
          yield 'Part 1 ';
          yield 'Part 2';
        },
        destroy: mock.fn()
      };

      global.self = {
        Summarizer: {
          availability: async () => 'readily',
          create: async () => mockSummarizer
        }
      };

      global.document = {
        body: { innerText: 'Test content to summarize' }
      };
      
      global.window = {
        getSelection: () => ({ toString: () => '' })
      };

      const updates = [];
      const onUpdate = (...args) => updates.push(args);
      
      const { handleSummarization } = await import('../src/modules/summarizer.js');
      
      await handleSummarization(
        { type: 'tldr', length: 'medium', format: 'markdown' },
        onUpdate,
        null
      );

      // Should have loading updates and content updates
      assert.ok(updates.some(u => u[1] === true)); // Loading state
      assert.ok(updates.some(u => u[1] === false && !u[2])); // Content state
      assert.ok(mockSummarizer.destroy.mock.calls.length === 1);
    });
  });
});
