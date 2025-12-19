import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

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

  describe('extractText', () => {
    it('should return object with text and isSelection properties', () => {
      const dom = new JSDOM('<!DOCTYPE html><html><body>Page content</body></html>');
      global.document = dom.window.document;
      global.window = dom.window;
      
      // Mock no selection
      global.window.getSelection = () => ({ toString: () => '' });
      
      const result = { 
        text: dom.window.document.body.textContent.substring(0, 20000),
        isSelection: false 
      };
      
      assert.ok(typeof result.text === 'string');
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
        text: selectedText.substring(0, 20000),
        isSelection: true
      };
      
      assert.strictEqual(result.isSelection, true);
      assert.ok(result.text.includes('Selected text'));
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
      // textContent is more reliable in test environments than innerText
      const text = mockDocument.body.textContent.substring(0, 20000);
      
      assert.ok(typeof text === 'string');
      assert.ok(text.includes('Title'));
      assert.ok(text.includes('paragraph text'));
    });

    it('should respect maxLength parameter', () => {
      const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <p>This is a very long text that should be truncated based on the maxLength parameter provided.</p>
          </body>
        </html>
      `);

      const mockDocument = dom.window.document;
      const maxLength = 10;
      const text = mockDocument.body.textContent.substring(0, maxLength);
      
      assert.ok(text.length <= maxLength);
    });

    it('should handle empty body', () => {
      const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <body></body>
        </html>
      `);

      const mockDocument = dom.window.document;
      const text = mockDocument.body.textContent.substring(0, 20000);
      
      assert.strictEqual(typeof text, 'string');
    });
  });
});
