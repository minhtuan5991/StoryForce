// Centralized, versioned selector maps. Providers can change these at any time.
// Never operate outside a known provider or bypass a platform checkpoint.
globalThis.STORYFORGE_ADAPTERS = {
  version: '1.1.5',
  chatgpt: {host: 'chatgpt.com', input: ['#prompt-textarea', '[contenteditable="true"][data-placeholder]'], run: ['button[data-testid="send-button"]','button[aria-label="Send prompt"]'], result: ['[data-message-author-role="assistant"] .markdown','[data-message-author-role="assistant"]'], busy: ['button[data-testid="stop-button"]']},
  gemini: {host: 'gemini.google.com', input: ['rich-textarea [contenteditable="true"]','div[contenteditable="true"][role="textbox"]'], run: ['button[aria-label="Gửi tin nhắn"]','button[aria-label="Send message"]','button[data-test-id="send-button"]','button.send-button'], result: ['message-content .markdown','model-response'], busy: ['button[aria-label="Ngừng tạo câu trả lời"]','button[aria-label="Stop response"]','button[aria-label="Dừng phản hồi"]','button[aria-label="Ngừng phản hồi"]','button[data-test-id="stop-button"]']},
  aistudio: {host: 'aistudio.google.com', input: ['textarea[aria-label="Text"]','textarea[placeholder*="text"]','textarea'], run: ['button[aria-label="Run"]','button[aria-label="Generate"]'], result: ['ms-model-response','[data-test-id="model-response"]'], busy: ['button[aria-label="Stop"]'], media: true},
  flow: {host: 'labs.google', input: ['textarea','[contenteditable="true"][role="textbox"]'], run: ['button[aria-label="Generate"]','button[aria-label="Create"]'], result: [], busy: [], media: true}
};
