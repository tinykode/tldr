# Building a Privacy-First Summarizer with Chrome's Prompt API and Structured Output

We built a Chrome extension that summarizes web pages using Chrome's built-in AI (Gemini Nano). Everything runs locally on your device. No data leaves your browser.

![Extension in action - showing summary overlay on article](screenshots/extension-demo.png)
*Screenshot: The extension generating key points from a long article in real-time*

## The Problem

Most AI-powered extensions send your data to remote servers. We wanted something different: instant summaries with zero privacy concerns.

## The Solution: Prompt API + Structured Output

Chrome 138+ includes the Prompt API - direct access to Gemini Nano running locally. The key feature we leverage: **structured output with JSON Schema**.

### Why Structured Output Matters

Without structure, AI returns unpredictable text. We need consistent data to build features. Here's our schema:

```javascript
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
```

The AI always returns valid JSON. Each summary point includes:
- `summary_item_text` - The actual summary
- `origin_text_reference` - First 4 words from the original text

![Example of structured JSON output from the AI](screenshots/structured-output.png)
*Screenshot: Raw JSON response showing summary points with text references*

### The Magic: Scroll-to-Context

That `origin_text_reference` field unlocks something useful. Click any summary point and we find that exact text on the page, scroll to it, and highlight it.

![Clicking a summary point scrolls to the original context](screenshots/scroll-to-context.gif)
*Animation: Clicking a key point instantly navigates to and highlights the relevant text*

```javascript
const response = await session.promptStreaming(prompt, {
  responseConstraint: schema,
  signal
});
```

The AI streams back perfectly formatted JSON. We parse it incrementally, showing partial results as they arrive. Users see summaries building in real-time.

![Streaming summary generation showing partial results](screenshots/streaming-demo.gif)
*Animation: Key points appearing incrementally as the AI generates them*

## Architecture: Background Service Worker

The Prompt API needs extension context, not content script context. We built a background service worker that:

1. Receives text chunks from content script via message passing
2. Prompts Gemini Nano with structured output constraint
3. Streams responses back to content script
4. Maintains session across requests

This means no flags needed in Chrome 138+. It just works.

![Architecture diagram showing message flow between content script and background worker](screenshots/architecture.png)
*Diagram: How content script and background service worker communicate*

## The Results

- Summaries appear in ~2-3 seconds
- Click any point to jump to context
- Handles long articles by chunking
- Works offline
- Zero privacy concerns

All processing happens on your machine. The model (3-5GB) downloads once and stays on device.

---

## Try It Yourself

**TL;DR - Built-in AI Summarizer** is available now. Install it, click the icon on any article, and watch local AI do its thing.

No accounts. No API keys. No data collection. Just summaries.

The extension proves what's possible when AI runs locally with structured output. We're excited to see what others build with these APIs.

*Psst... Your browser is already smarter than you think. Chrome's got Gemini Nano hiding inside. We just woke it up.*
