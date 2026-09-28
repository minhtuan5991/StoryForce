// Centralized, versioned selector maps. Providers can change these at any time.
// Never operate outside a known provider or bypass a platform checkpoint.
globalThis.STORYFORGE_ADAPTERS = {
  version: '1.1.10',
  chatgpt: {host: 'chatgpt.com', messages:[
    '[data-message-author-role="assistant"]','[data-turn="assistant"]',
    '[data-content-search-unit-key$=":assistant"]','[data-chatgpt-search-unit-key$=":assistant"]',
    '[data-markdown-text-style="assistant-message"]',
  ], input: [
    '#prompt-textarea[contenteditable="true"]', 'textarea#prompt-textarea',
    '#prompt-textarea [contenteditable="true"]',
    'form[data-type="unified-composer"] [contenteditable="true"]',
    'main form [data-lexical-editor="true"][contenteditable="true"]',
    'main .ProseMirror[contenteditable="true"]',
    'form [role="textbox"][contenteditable="true"]',
    'main [role="textbox"][contenteditable="true"]',
    'main form textarea[placeholder]', 'textarea[placeholder*="ChatGPT"]',
    '[contenteditable="true"][aria-label*="ChatGPT"]', '[contenteditable="plaintext-only"][role="textbox"]',
    '[contenteditable="true"][data-placeholder]'
  ], run: ['button[data-testid="send-button"]','button[data-testid="composer-send-button"]','button[aria-label="Send prompt"]','button[aria-label="Send message"]','button[aria-label="Send"]','button[aria-label="Gửi lời nhắc"]','button[aria-label="Gửi tin nhắn"]','button[aria-label="Gửi"]'], result: ['[data-message-author-role="assistant"] .markdown','[data-message-author-role="assistant"]'], busy: ['button[data-testid="stop-button"]','button[aria-label="Stop generating"]','button[aria-label="Dừng tạo"]']},
  gemini: {host: 'gemini.google.com', input: ['rich-textarea [contenteditable="true"]','div[contenteditable="true"][role="textbox"]'], run: ['button[aria-label="Gửi tin nhắn"]','button[aria-label="Send message"]','button[data-test-id="send-button"]','button.send-button'], result: ['message-content .markdown','model-response'], busy: ['button[aria-label="Ngừng tạo câu trả lời"]','button[aria-label="Stop response"]','button[aria-label="Dừng phản hồi"]','button[aria-label="Ngừng phản hồi"]','button[data-test-id="stop-button"]']},
  aistudio: {host: 'aistudio.google.com', input: ['textarea[aria-label="Text"]','textarea[placeholder*="text"]','textarea'], run: ['button[aria-label="Run"]','button[aria-label="Generate"]'], result: ['ms-model-response','[data-test-id="model-response"]'], busy: ['button[aria-label="Stop"]'], media: true},
  flow: {host: 'labs.google', input: ['textarea','[contenteditable="true"][role="textbox"]'], run: ['button[aria-label="Generate"]','button[aria-label="Create"]'], result: [], busy: [], media: true}
};
