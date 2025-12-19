# TL;DR AI Summarizer Chrome Extension

![TL;DR Extension Screenshot](https://raw.githubusercontent.com/tinykode/tldr/main/image.png)

AI-powered page summarization using Chrome's built-in Gemini Nano model.

## Project Structure

```
.
├── src/
│   ├── content.js              # Main content script entry point
│   └── modules/
│       ├── markdown.js         # Markdown to HTML parser
│       ├── overlay.js          # Overlay UI management
│       ├── styles.js           # CSS styles for overlay
│       ├── summarizer.js       # AI summarization logic
│       └── text-extractor.js   # Page text extraction
├── tests/
│   ├── markdown.test.js        # Tests for markdown parser
│   ├── styles.test.js          # Tests for styles module
│   ├── summarizer.test.js      # Tests for summarizer
│   └── text-extractor.test.js  # Tests for text extractor
├── popup.html                  # Extension popup UI
├── popup.js                    # Popup logic
├── manifest.json               # Extension manifest
└── package.json                # Node.js dependencies and scripts
```

## Development

### Install Dependencies

```bash
npm install
```

### Build Extension

```bash
# Build once
npm run build

# Build and watch for changes
npm run build:watch
```

This bundles all the modular code from `src/` into `dist/content.js` using esbuild.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Load Extension

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension directory

## Testing

Tests are written using Node.js built-in test runner (`node:test`). Each module has corresponding test coverage:

- **markdown.test.js**: Tests for Markdown parsing functionality
- **styles.test.js**: Tests for CSS style generation
- **text-extractor.test.js**: Tests for page text extraction
- **summarizer.test.js**: Tests for AI summarization logic

## Architecture

The extension is split into modular components:

- **content.js**: Entry point that coordinates message handling
- **overlay.js**: Manages the UI overlay with Shadow DOM
- **summarizer.js**: Handles AI model interaction and summarization
- **markdown.js**: Converts Markdown output to HTML
- **text-extractor.js**: Extracts text from web pages
- **styles.js**: Provides CSS styling for the overlay

All modules use ES6 imports/exports for better maintainability and testability.
