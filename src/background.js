/**
 * Background Service Worker for Prompt API
 * Runs in extension context with direct access to Prompt API
 */

let currentSession = null;
let currentController = null;

/**
 * Check if Prompt API is supported
 */
function isPromptAPISupported() {
  return 'LanguageModel' in self;
}

/**
 * Initialize Prompt API session
 */
async function initSession(signal) {
  console.log('[Background] Initializing Prompt API session...');

  const availability = await self.LanguageModel.availability();
  console.log('[Background] Prompt API availability:', availability);

  if (availability === 'no') {
    throw new Error('AI Model is not available on this device.');
  }

  const session = await self.LanguageModel.create({
    signal,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        console.log(`[Background] Downloading AI Model: ${Math.round(e.loaded * 100)}%`);
      });
    }
  });

  console.log('[Background] Session created successfully');
  return session;
}

/**
 * Handle summarization request from content script
 */
async function handleSummarize(data, port) {
  console.log('[Background] Received summarize request:', data);

  if (!isPromptAPISupported()) {
    port.postMessage({
      type: 'error',
      content: 'Error: Prompt API not supported. Please update Chrome to latest version.',
      isComplete: true
    });
    return;
  }

  // Abort any existing operation
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    // Create session if needed (only send loading message on first-time setup)
    if (!currentSession) {
      port.postMessage({
        type: 'update',
        content: 'Loading Gemini Nano model...',
        isLoading: true
      });
      currentSession = await initSession(signal);
    }

    if (signal.aborted) {
      console.log('[Background] Operation aborted');
      return;
    }

    // Define JSON schema for structured output
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

    // Build prompt
    const { text, length } = data;
    const numPoints = { short: 3, medium: 5, long: 7 }[length] || 5;

    // Build the prompt
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

${text}`;
    console.log('[Background] Prompting model...');

    // Stream the response (don't send intermediate message, content handles UI)
    const stream = currentSession.promptStreaming(prompt, {
      responseConstraint: schema,
      signal
    });
    let accumulatedText = '';

    for await (const chunk of stream) {
      if (signal.aborted) break;

      accumulatedText = chunk;

      // Send progress update
      port.postMessage({
        type: 'chunk',
        content: chunk,
        isLoading: true
      });
    }

    if (signal.aborted) {
      console.log('[Background] Stream aborted');
      return;
    }

    console.log('[Background] Stream complete, accumulated text length:', accumulatedText.length);

    // Send final result
    port.postMessage({
      type: 'complete',
      content: accumulatedText,
      isComplete: true
    });

  } catch (error) {
    console.error('[Background] Error during summarization:', error);
    port.postMessage({
      type: 'error',
      content: `Error: ${error.message}`,
      isComplete: true
    });
  }
}

/**
 * Handle simple prompt request (for TLDR generation)
 */
async function handlePrompt(data, port) {
  console.log('[Background] Received prompt request');

  if (!isPromptAPISupported()) {
    port.postMessage({
      type: 'error',
      content: 'Error: Prompt API not supported.',
      isComplete: true
    });
    return;
  }

  try {
    // Create session if needed
    if (!currentSession) {
      currentSession = await initSession(new AbortController().signal);
    }

    // Stream the response
    const stream = currentSession.promptStreaming(data.prompt);
    let accumulatedText = '';

    for await (const chunk of stream) {
      accumulatedText = chunk;
      port.postMessage({
        type: 'chunk',
        content: chunk
      });
    }

    // Send final result
    port.postMessage({
      type: 'complete',
      content: accumulatedText
    });

  } catch (error) {
    console.error('[Background] Error during prompt:', error);
    port.postMessage({
      type: 'error',
      content: `Error: ${error.message}`
    });
  }
}

/**
 * Handle abort request
 */
function handleAbort(port) {
  console.log('[Background] Received abort request');
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
  port.postMessage({
    type: 'aborted',
    content: 'Operation cancelled',
    isComplete: true
  });
}

/**
 * Handle destroy session request
 */
function handleDestroy() {
  console.log('[Background] Destroying session');
  if (currentSession) {
    currentSession.destroy();
    currentSession = null;
  }
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
}

// Listen for long-lived connections from content script
chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] Port connected:', port.name);

  if (port.name === 'prompt-api') {
    port.onMessage.addListener((message) => {
      console.log('[Background] Received message:', message.type);

      switch (message.type) {
        case 'summarize':
          handleSummarize(message.data, port);
          break;
        case 'prompt':
          handlePrompt(message.data, port);
          break;
        case 'abort':
          handleAbort(port);
          break;
        case 'destroy':
          handleDestroy();
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('[Background] Port disconnected');
      // Don't destroy session on disconnect - keep it for reuse
    });
  }
});

// Log when background script loads
console.log('[Background] Service worker loaded. Prompt API supported:', isPromptAPISupported());
