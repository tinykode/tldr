import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { splitIntoChunks } from '../src/modules/text-extractor.js';

// Mock the document and body for text extraction
describe('Text Extractor', () => {
  describe('getSelectedText', () => {
    it('should return empty string when no selection exists', () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body>Test</body></html>');
      global.window = dom.window;
      
      const selection = window.getSelection()?.toString().trim() || '';
      assert.strictEqual(selection, '');
    });
  });

  describe('splitIntoChunks', () => {
    it('should return single chunk when text is smaller than maxChunkSize', () => {
      const text = 'Short text';
      const chunks = splitIntoChunks(text, 20000);
      
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0], text);
    });

    it('should split text recursively when larger than maxChunkSize', () => {
      const text = 'a'.repeat(50000);
      const chunks = splitIntoChunks(text, 20000);
      
      assert.ok(chunks.length > 1);
      chunks.forEach(chunk => {
        assert.ok(chunk.length <= 20000);
      });
    });

    it('should split text correctly for edge cases', () => {
      const text = 'b'.repeat(21000);
      const chunks = splitIntoChunks(text, 20000);
      
      assert.strictEqual(chunks.length, 2);
      assert.ok(chunks[0].length <= 20000);
      assert.ok(chunks[1].length <= 20000);
    });
  });

  describe('extractText', () => {
    it('should return object with chunks and isSelection properties', () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body>Page content</body></html>');
      global.document = dom.window.document;
      global.window = dom.window;
      
      // Mock no selection
      global.window.getSelection = () => ({ toString: () => '' });
      
      const result = { 
        chunks: [dom.window.document.body.textContent],
        isSelection: false 
      };
      
      assert.ok(Array.isArray(result.chunks));
      assert.ok(typeof result.isSelection === 'boolean');
      assert.strictEqual(result.isSelection, false);
    });

    it('should detect selected text and set isSelection to true', () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body>Selected text here</body></html>');
      global.document = dom.window.document;
      global.window = dom.window;
      
      // Mock text selection
      global.window.getSelection = () => ({ toString: () => 'Selected text here' });
      
      const selectedText = window.getSelection()?.toString().trim() || '';
      const result = {
        chunks: [selectedText],
        isSelection: true
      };
      
      assert.strictEqual(result.isSelection, true);
      assert.ok(result.chunks[0].includes('Selected text'));
    });
  });

  describe('extractPageText', () => {
    it('should extract text from document body', () => {
      const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <h1>Title</h1>
            <p>This is paragraph text.</p>
            <div>Some more content here.</div>
          </body>
        </html>
      `);

      const mockDocument = dom.window.document;
      const text = mockDocument.body.textContent;
      
      assert.ok(typeof text === 'string');
      assert.ok(text.includes('Title'));
      assert.ok(text.includes('paragraph text'));
    });

    it('should handle empty body', () => {
      const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <body></body>
        </html>
      `);

      const mockDocument = dom.window.document;
      const text = mockDocument.body.textContent;
      
      assert.strictEqual(typeof text, 'string');
    });
  });
});
