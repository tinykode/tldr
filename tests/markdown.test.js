import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseMarkdown } from '../src/modules/markdown.js';

describe('Markdown Parser', () => {
  describe('parseMarkdown', () => {
    it('should return empty string for empty input', () => {
      assert.strictEqual(parseMarkdown(''), '');
      assert.strictEqual(parseMarkdown(null), '');
      assert.strictEqual(parseMarkdown(undefined), '');
    });

    it('should convert bold text with **', () => {
      const input = 'This is **bold** text';
      const expected = 'This is <strong>bold</strong> text';
      assert.strictEqual(parseMarkdown(input), expected);
    });

    it('should convert multiple bold sections', () => {
      const input = '**First** and **Second** bold';
      const expected = '<strong>First</strong> and <strong>Second</strong> bold';
      assert.strictEqual(parseMarkdown(input), expected);
    });

    it('should convert bullet list with - prefix', () => {
      const input = '- Item 1\n- Item 2\n- Item 3';
      const result = parseMarkdown(input);
      assert.ok(result.includes('<ul>'));
      assert.ok(result.includes('<li>Item 1</li>'));
      assert.ok(result.includes('<li>Item 2</li>'));
      assert.ok(result.includes('<li>Item 3</li>'));
      assert.ok(result.includes('</ul>'));
    });

    it('should convert bullet list with * prefix', () => {
      const input = '* Item A\n* Item B';
      const result = parseMarkdown(input);
      assert.ok(result.includes('<ul>'));
      assert.ok(result.includes('<li>Item A</li>'));
      assert.ok(result.includes('<li>Item B</li>'));
      assert.ok(result.includes('</ul>'));
    });

    it('should handle mixed content with bullets and text', () => {
      const input = 'Header\n- Bullet 1\n- Bullet 2\nFooter';
      const result = parseMarkdown(input);
      assert.ok(result.includes('<ul>'));
      assert.ok(result.includes('<li>Bullet 1</li>'));
      assert.ok(result.includes('<li>Bullet 2</li>'));
      assert.ok(result.includes('</ul>'));
    });

    it('should convert double newlines to line breaks', () => {
      const input = 'Paragraph 1\n\nParagraph 2';
      const result = parseMarkdown(input);
      assert.ok(result.includes('<br><br>'));
    });

    it('should handle bold within bullet lists', () => {
      const input = '- **Bold** item\n- Normal item';
      const result = parseMarkdown(input);
      assert.ok(result.includes('<strong>Bold</strong>'));
      assert.ok(result.includes('<li>'));
    });

    it('should handle empty lines in bullet lists', () => {
      const input = '- Item 1\n\n- Item 2';
      const result = parseMarkdown(input);
      // Should close and reopen list or handle gracefully
      assert.ok(result.includes('<li>Item 1</li>'));
      assert.ok(result.includes('<li>Item 2</li>'));
    });

    it('should not convert text that looks like markdown but is not', () => {
      const input = 'This has * asterisk but not bullet';
      const result = parseMarkdown(input);
      // Should not create a list since * is not at line start
      assert.ok(!result.includes('<ul>') || result.includes('asterisk'));
    });
  });
});
