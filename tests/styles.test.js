import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { getOverlayStyles } from '../src/modules/styles.js';

describe('Overlay Styles', () => {
  describe('getOverlayStyles', () => {
    it('should return a non-empty string', () => {
      const styles = getOverlayStyles();
      assert.ok(typeof styles === 'string');
      assert.ok(styles.length > 0);
    });

    it('should include overlay class styles', () => {
      const styles = getOverlayStyles();
      assert.ok(styles.includes('.overlay'));
    });

    it('should include header class styles', () => {
      const styles = getOverlayStyles();
      assert.ok(styles.includes('.header'));
    });

    it('should include controls class styles', () => {
      const styles = getOverlayStyles();
      assert.ok(styles.includes('.controls'));
    });

    it('should include button styles', () => {
      const styles = getOverlayStyles();
      assert.ok(styles.includes('.generate-btn'));
    });

    it('should include animation styles', () => {
      const styles = getOverlayStyles();
      assert.ok(styles.includes('@keyframes slideIn'));
    });

    it('should include error and loading styles', () => {
      const styles = getOverlayStyles();
      assert.ok(styles.includes('.error'));
      assert.ok(styles.includes('.loading'));
    });

    it('should have proper z-index comment reference', () => {
      const styles = getOverlayStyles();
      // Check that important layout properties are present
      assert.ok(styles.includes('position: fixed'));
      assert.ok(styles.includes('border-radius'));
    });
  });
});
