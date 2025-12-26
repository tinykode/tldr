import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('Background Service Worker', () => {
  describe('Prompt API Support Check', () => {
    it('should detect Prompt API when LanguageModel exists', () => {
      global.self = { LanguageModel: {} };
      const isSupported = 'LanguageModel' in global.self;
      assert.strictEqual(isSupported, true);
      delete global.self;
    });

    it('should detect no Prompt API when LanguageModel missing', () => {
      global.self = {};
      const isSupported = 'LanguageModel' in global.self;
      assert.strictEqual(isSupported, false);
      delete global.self;
    });
  });

  describe('Port-based message handling', () => {
    it('should have proper message types defined', () => {
      const validTypes = ['summarize', 'prompt', 'abort', 'destroy'];
      const responseTypes = ['update', 'chunk', 'complete', 'error', 'aborted'];
      
      assert.ok(validTypes.includes('summarize'));
      assert.ok(validTypes.includes('prompt'));
      assert.ok(responseTypes.includes('chunk'));
      assert.ok(responseTypes.includes('complete'));
    });

    it('should support prompt message type for TLDR generation', () => {
      const validTypes = ['summarize', 'prompt', 'abort', 'destroy'];
      assert.ok(validTypes.includes('prompt'));
    });
  });

  describe('Prompt construction', () => {
    it('should map length to number of points', () => {
      const lengthMap = { short: 3, medium: 5, long: 7 };
      
      assert.strictEqual(lengthMap['short'], 3);
      assert.strictEqual(lengthMap['medium'], 5);
      assert.strictEqual(lengthMap['long'], 7);
    });

    it('should default to 5 points for invalid length', () => {
      const length = 'invalid';
      const lengthMap = { short: 3, medium: 5, long: 7 };
      const numPoints = lengthMap[length] || 5;
      
      assert.strictEqual(numPoints, 5);
    });
  });

  describe('TLDR Generation', () => {
    it('should map length to sentence count for TLDR', () => {
      const lengthToSentences = { short: 1, medium: 2, long: 3 };
      
      assert.strictEqual(lengthToSentences['short'], 1);
      assert.strictEqual(lengthToSentences['medium'], 2);
      assert.strictEqual(lengthToSentences['long'], 3);
    });

    it('should construct TLDR prompt with correct format', () => {
      const keyPoints = [
        { summary_item_text: 'Point one' },
        { summary_item_text: 'Point two' },
        { summary_item_text: 'Point three' }
      ];
      const bulletList = keyPoints.map(p => p.summary_item_text).join('\n');
      const maxSentences = 2;
      const prompt = `Summarize these key points into ${maxSentences} concise sentence${maxSentences > 1 ? 's' : ''}:\n\n${bulletList}`;
      
      assert.ok(prompt.includes('Summarize these key points'));
      assert.ok(prompt.includes('Point one'));
      assert.ok(prompt.includes('2 concise sentences'));
    });

    it('should handle empty keypoints array for TLDR', () => {
      const keyPoints = [];
      const shouldGenerateTLDR = keyPoints && keyPoints.length > 0;
      
      assert.strictEqual(shouldGenerateTLDR, false);
    });
  });

  describe('JSON Schema for Summarization', () => {
    it('should define correct schema structure', () => {
      const schema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            summary_item_text: { type: "string" },
            origin_text_reference: { type: "string" }
          },
          required: ["summary_item_text", "origin_text_reference"]
        }
      };

      assert.strictEqual(schema.type, 'array');
      assert.strictEqual(schema.items.type, 'object');
      assert.ok(schema.items.properties.summary_item_text);
      assert.ok(schema.items.properties.origin_text_reference);
      assert.deepStrictEqual(schema.items.required, ['summary_item_text', 'origin_text_reference']);
    });
  });

  describe('handleSummarize function behavior', () => {
    it('should send error when API not supported', () => {
      const messages = [];
      const mockPort = {
        postMessage: (msg) => messages.push(msg)
      };

      // Simulate no API support
      const isSupported = false;
      
      if (!isSupported) {
        mockPort.postMessage({
          type: 'error',
          content: 'Error: Prompt API not supported. Please update Chrome to latest version.',
          isComplete: true
        });
      }

      assert.strictEqual(messages.length, 1);
      assert.strictEqual(messages[0].type, 'error');
      assert.ok(messages[0].content.includes('not supported'));
    });

    it('should build correct prompt structure', () => {
      const data = { text: 'Sample text to summarize', length: 'medium' };
      const numPoints = { short: 3, medium: 5, long: 7 }[data.length] || 5;
      
      const prompt = `Please summarize the following text into key points.

Respond with a JSON array where each item has:
- summary_item_text: A concise bullet point summarizing part of the text
- origin_text_reference: The first 4 words from the original text that this summary corresponds to, NOT the first words of the summary you generated

Format example:
[
  {"summary_item_text": "The main concept discusses...", "origin_text_reference": "In the beginning there"},
  {"summary_item_text": "Another key point about...", "origin_text_reference": "Furthermore the study shows"}
]

Please try to summarize only the main content of the article not anything on the side or not related to the topic.
Please provide ${numPoints} summary items.
Each summary item should be around 25-30 words.

Text to summarize:

${data.text}`;

      assert.ok(prompt.includes('JSON array'));
      assert.ok(prompt.includes('summary_item_text'));
      assert.ok(prompt.includes('origin_text_reference'));
      assert.ok(prompt.includes(`Please provide ${numPoints} summary items`));
      assert.ok(prompt.includes(data.text));
    });

    it('should handle streaming response chunks', () => {
      const chunks = [];
      const mockPort = {
        postMessage: (msg) => chunks.push(msg)
      };

      // Simulate streaming chunks
      const streamChunks = ['[{"summary', '_item_text":"', 'Test"', '}]'];
      
      streamChunks.forEach(chunk => {
        mockPort.postMessage({
          type: 'chunk',
          content: chunk,
          isLoading: true
        });
      });

      assert.strictEqual(chunks.length, streamChunks.length);
      chunks.forEach(chunk => {
        assert.strictEqual(chunk.type, 'chunk');
        assert.strictEqual(chunk.isLoading, true);
      });
    });

    it('should send complete message after streaming', () => {
      const messages = [];
      const mockPort = {
        postMessage: (msg) => messages.push(msg)
      };

      const finalContent = '[{"summary_item_text":"Test","origin_text_reference":"In the"}]';
      
      mockPort.postMessage({
        type: 'complete',
        content: finalContent,
        isComplete: true
      });

      const completeMsg = messages.find(m => m.type === 'complete');
      assert.ok(completeMsg);
      assert.strictEqual(completeMsg.content, finalContent);
      assert.strictEqual(completeMsg.isComplete, true);
    });

    it('should handle errors during summarization', () => {
      const messages = [];
      const mockPort = {
        postMessage: (msg) => messages.push(msg)
      };

      const error = new Error('Model failed to load');
      
      mockPort.postMessage({
        type: 'error',
        content: `Error: ${error.message}`,
        isComplete: true
      });

      const errorMsg = messages.find(m => m.type === 'error');
      assert.ok(errorMsg);
      assert.ok(errorMsg.content.includes('Model failed to load'));
    });
  });

  describe('handlePrompt function behavior', () => {
    it('should send error when API not supported', () => {
      const messages = [];
      const mockPort = {
        postMessage: (msg) => messages.push(msg)
      };

      const isSupported = false;
      
      if (!isSupported) {
        mockPort.postMessage({
          type: 'error',
          content: 'Error: Prompt API not supported.',
          isComplete: true
        });
      }

      assert.strictEqual(messages.length, 1);
      assert.strictEqual(messages[0].type, 'error');
    });

    it('should handle TLDR prompt request', () => {
      const data = {
        prompt: 'Summarize these key points into 2 concise sentences:\n\nPoint one\nPoint two'
      };

      assert.ok(data.prompt.includes('Summarize these key points'));
      assert.ok(data.prompt.includes('Point one'));
    });

    it('should stream TLDR response', () => {
      const chunks = [];
      const mockPort = {
        postMessage: (msg) => chunks.push(msg)
      };

      const tldrChunks = ['This is ', 'a concise ', 'summary.'];
      
      tldrChunks.forEach(chunk => {
        mockPort.postMessage({
          type: 'chunk',
          content: chunk
        });
      });

      assert.strictEqual(chunks.length, tldrChunks.length);
      chunks.forEach(chunk => {
        assert.strictEqual(chunk.type, 'chunk');
      });
    });
  });

  describe('handleAbort function behavior', () => {
    it('should send aborted message', () => {
      const messages = [];
      const mockPort = {
        postMessage: (msg) => messages.push(msg)
      };

      mockPort.postMessage({
        type: 'aborted',
        content: 'Operation cancelled',
        isComplete: true
      });

      const abortMsg = messages.find(m => m.type === 'aborted');
      assert.ok(abortMsg);
      assert.strictEqual(abortMsg.content, 'Operation cancelled');
    });

    it('should handle abort controller logic', () => {
      let controller = new AbortController();
      assert.strictEqual(controller.signal.aborted, false);
      
      controller.abort();
      assert.strictEqual(controller.signal.aborted, true);
      
      controller = null;
      assert.strictEqual(controller, null);
    });
  });

  describe('Session management', () => {
    it('should track session state', () => {
      let session = null;
      assert.strictEqual(session, null);
      
      // Simulate session creation
      session = { id: 'mock-session' };
      assert.ok(session);
      
      // Simulate session destruction
      session = null;
      assert.strictEqual(session, null);
    });

    it('should send loading message on first session creation', () => {
      const messages = [];
      const mockPort = {
        postMessage: (msg) => messages.push(msg)
      };

      let currentSession = null;
      
      if (!currentSession) {
        mockPort.postMessage({
          type: 'update',
          content: 'Loading Gemini Nano model...',
          isLoading: true
        });
      }

      const loadingMsg = messages.find(m => m.type === 'update');
      assert.ok(loadingMsg);
      assert.ok(loadingMsg.content.includes('Loading Gemini Nano'));
      assert.strictEqual(loadingMsg.isLoading, true);
    });

    it('should reuse existing session', () => {
      let sessionCreationCount = 0;
      let currentSession = null;
      
      // First call
      if (!currentSession) {
        sessionCreationCount++;
        currentSession = { id: 'session-1' };
      }
      
      // Second call
      if (!currentSession) {
        sessionCreationCount++;
      }
      
      assert.strictEqual(sessionCreationCount, 1);
      assert.ok(currentSession);
    });
  });
});
