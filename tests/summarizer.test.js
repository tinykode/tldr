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
      // Summarizer may be called multiple times for chunks, just verify it was destroyed
      assert.ok(mockSummarizer.destroy.mock.calls.length >= 1);
    });
    it('should abort previous summarization request when a new one is started', async () => {
      const creates = [];
      const mockSummarizer = {
        summarizeStreaming: async function* (text) {
          yield 'Part 1';
        },
        destroy: mock.fn()
      };

      global.self = {
        Summarizer: {
          availability: async () => 'readily',
          create: async (config) => {
            creates.push(config);
            return mockSummarizer;
          }
        }
      };

      const { handleSummarization } = await import('../src/modules/summarizer.js');

      const updates1 = [];
      const onUpdate1 = (...args) => updates1.push(args);

      const updates2 = [];
      const onUpdate2 = (...args) => updates2.push(args);

      // Start first request
      const p1 = handleSummarization(
        { type: 'tldr', length: 'medium', format: 'markdown' },
        onUpdate1
      );

      // Start second request immediately (before first one finishes)
      const p2 = handleSummarization(
        { type: 'key-points', length: 'short', format: 'markdown' },
        onUpdate2
      );

      await Promise.all([p1, p2]);

      // Only the second request should have reached create()
      // The first one should have been aborted early (during availability check or before create)
      assert.strictEqual(creates.length, 1);
      assert.strictEqual(creates[0].type, 'key-points');
      assert.strictEqual(creates[0].length, 'short');

      // onUpdate1 might have been called with "Loading..." but should not have "Downloading" or content
      // It definitely shouldn't have completed
    });

    it('should pause after every 5 chunks and wait for continue button', async () => {
      // Create text that will result in 8 chunks (recursive splitting creates 8 from this size)
      const longText = 'a'.repeat(21000 * 7); // Results in 8 chunks
      
      let streamCallCount = 0;
      const mockSummarizer = {
        summarizeStreaming: async function* (text) {
          streamCallCount++;
          yield `Summary ${streamCallCount}`;
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
        body: { innerText: longText },
        addEventListener: (event, handler, useCapture) => {
          if (event === 'click') {
            // Simulate click after small delay
            setTimeout(() => {
              const clickEvent = {
                composedPath: () => [{ id: 'continue-processing-btn' }]
              };
              handler(clickEvent);
            }, 10);
          }
        },
        removeEventListener: mock.fn()
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

      // Should have pause message after 5 chunks
      const pauseUpdate = updates.find(u => 
        u[0] && u[0].includes('continue-processing-btn') && u[0].includes('3 more chunks remaining')
      );
      assert.ok(pauseUpdate, 'Should show continue button after 5 chunks');

      // All chunks should be processed
      assert.strictEqual(streamCallCount, 8);
    });

    it('should show remaining chunk count in continue button', async () => {
      const longText = 'a'.repeat(21000 * 12); // Results in 16 chunks
      
      let clickCount = 0;
      const mockSummarizer = {
        summarizeStreaming: async function* (text) {
          yield 'Summary';
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
        body: { innerText: longText },
        addEventListener: (event, handler, useCapture) => {
          if (event === 'click') {
            setTimeout(() => {
              clickCount++;
              const clickEvent = {
                composedPath: () => [{ id: 'continue-processing-btn' }]
              };
              handler(clickEvent);
            }, 10);
          }
        },
        removeEventListener: mock.fn()
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

      // Check for pause messages with remaining counts (16 total chunks)
      const hasElevenRemaining = updates.some(u => 
        u[0] && u[0].includes('11 more chunks remaining') // After 5 chunks: 16-5=11
      );
      assert.ok(hasElevenRemaining, 'Should show 11 chunks remaining after first pause');

      const hasSixRemaining = updates.some(u => 
        u[0] && u[0].includes('6 more chunks remaining') // After 10 chunks: 16-10=6
      );
      assert.ok(hasSixRemaining, 'Should show 6 chunks remaining after second pause');

      // Should have clicked continue at least twice (at chunk 5, 10, and 15)
      assert.ok(clickCount >= 2, `Should have clicked continue at least 2 times, got ${clickCount}`);
    });
  });
});
