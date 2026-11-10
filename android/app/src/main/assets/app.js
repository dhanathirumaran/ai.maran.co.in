// AI Studio Universal Frontend Application Logic
(() => {
  // --- State ---
  const state = {
    currentConversationId: null,
    conversations: [],
    personas: [],
    attachments: [],
    isGenerating: false,
    abortController: null,
    settings: {
      serverUrl: localStorage.getItem('ai_server_url') || '',
      baseUrl: localStorage.getItem('ai_base_url') || 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: localStorage.getItem('ai_api_key') || '',
      model: localStorage.getItem('ai_model') || 'gemini-2.0-flash',
      systemPrompt: localStorage.getItem('ai_system_prompt') || '',
      temperature: parseFloat(localStorage.getItem('ai_temp')) || 0.7,
      maxTokens: parseInt(localStorage.getItem('ai_max_tokens')) || 4096,
    },
  };

  // Preset Configurations
  const PRESETS = {
    omni: {
      baseUrl: 'https://omni.pulsemindstudios.com/v1',
      model: 'ddgw/gpt-5.4-mini',
    },
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      model: 'gemini-2.0-flash',
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    },
    ollama: {
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'llama3.2',
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    },
  };

  const DEFAULT_PERSONAS = [
    {
      id: 'general',
      title: 'General Assistant',
      description: 'Helpful, knowledgeable, and direct assistant',
      system_prompt: 'You are a helpful, accurate, and concise AI assistant. Provide clear, direct answers without unnecessary fluff.',
      is_builtin: true,
    },
    {
      id: 'coding',
      title: 'Software Architect',
      description: 'Senior engineer for clean code, architecture, and debugging',
      system_prompt: 'You are an expert software engineer and architect. Provide clean, secure, idiomatic code with explanations. Prioritize best practices, modularity, and error handling.',
      is_builtin: true,
    },
    {
      id: 'writer',
      title: 'Creative & Technical Writer',
      description: 'Polished prose, documentation, and storytelling',
      system_prompt: 'You are a master writer and editor. Craft clear, engaging, and beautifully formatted text suitable for professional documentation, blogs, or creative writing.',
      is_builtin: true,
    },
    {
      id: 'analyst',
      title: 'Concise Analyst',
      description: 'Critical thinking, structured breakdowns, and actionable takeaways',
      system_prompt: 'You are an analytical consultant. Deconstruct complex problems into structured key points, trade-offs, and clear recommendations with bullet points.',
      is_builtin: true,
    },
  ];

  // --- DOM Elements ---
  const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    searchChats: document.getElementById('searchChats'),
    conversationsList: document.getElementById('conversationsList'),
    messagesContainer: document.getElementById('messagesContainer'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messagesList: document.getElementById('messagesList'),
    attachmentTray: document.getElementById('attachmentTray'),
    chatForm: document.getElementById('chatForm'),
    messageInput: document.getElementById('messageInput'),
    fileInput: document.getElementById('fileInput'),
    attachBtn: document.getElementById('attachBtn'),
    sendBtn: document.getElementById('sendBtn'),
    stopBtn: document.getElementById('stopBtn'),
    currentModelBadge: document.getElementById('currentModelBadge'),
    activeModelLabel: document.getElementById('activeModelLabel'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    resetSettingsBtn: document.getElementById('resetSettingsBtn'),
    toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
    settingServerUrl: document.getElementById('settingServerUrl'),
    settingBaseUrl: document.getElementById('settingBaseUrl'),
    settingApiKey: document.getElementById('settingApiKey'),
    settingModel: document.getElementById('settingModel'),
    settingSystemPrompt: document.getElementById('settingSystemPrompt'),
    settingTemperature: document.getElementById('settingTemperature'),
    settingMaxTokens: document.getElementById('settingMaxTokens'),
    tempVal: document.getElementById('tempVal'),
    openPersonasBtn: document.getElementById('openPersonasBtn'),
    personasModal: document.getElementById('personasModal'),
    closePersonasModal: document.getElementById('closePersonasModal'),
    personasList: document.getElementById('personasList'),
    newPersonaTitle: document.getElementById('newPersonaTitle'),
    newPersonaDesc: document.getElementById('newPersonaDesc'),
    newPersonaPrompt: document.getElementById('newPersonaPrompt'),
    saveNewPersonaBtn: document.getElementById('saveNewPersonaBtn'),
  };

  // --- Helper: Generate UUID ---
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // --- Initialize App ---
  function init() {
    initTheme();
    updateModelBadge();
    loadConversations();
    loadPersonas();
    setupEventListeners();
  }

  // --- Theme Handling ---
  function initTheme() {
    const savedTheme = localStorage.getItem('ai_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    }
  }

  function toggleTheme() {
    if (document.body.classList.contains('light-theme')) {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      localStorage.setItem('ai_theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      localStorage.setItem('ai_theme', 'light');
    }
  }

  function updateModelBadge() {
    elements.activeModelLabel.textContent = state.settings.model || 'gemini-2.0-flash';
  }

  // --- Conversations Management (Hybrid Server + LocalStorage) ---
  async function loadConversations() {
    // If serverUrl is configured and not running from standalone file:// without server
    if (state.settings.serverUrl) {
      try {
        const url = `${state.settings.serverUrl.replace(/\/+$/, '')}/api/conversations`;
        const res = await fetch(url);
        if (res.ok) {
          state.conversations = await res.json();
          renderConversations();
          return;
        }
      } catch (err) {
        console.warn('Server unreachable, falling back to local storage:', err);
      }
    }

    // LocalStorage Fallback
    try {
      const raw = localStorage.getItem('ai_local_conversations');
      state.conversations = raw ? JSON.parse(raw) : [];
      renderConversations();
    } catch (e) {
      console.error('Failed reading local conversations:', e);
      state.conversations = [];
      renderConversations();
    }
  }

  function saveLocalConversations() {
    try {
      localStorage.setItem('ai_local_conversations', JSON.stringify(state.conversations));
    } catch (e) {
      console.error('Failed saving local conversations:', e);
    }
  }

  function renderConversations(filter = '') {
    elements.conversationsList.innerHTML = '';
    const filtered = state.conversations.filter(c =>
      (c.title || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      elements.conversationsList.innerHTML = `
        <div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">
          No conversations yet
        </div>`;
      return;
    }

    filtered.forEach(c => {
      const item = document.createElement('div');
      item.className = `conversation-item ${c.id === state.currentConversationId ? 'active' : ''}`;
      item.dataset.id = c.id;

      item.innerHTML = `
        <span class="conv-title">${escapeHtml(c.title || 'New Chat')}</span>
        <div class="conv-actions">
          <button class="conv-action-btn delete" title="Delete conversation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.conv-action-btn')) {
          switchConversation(c.id);
          closeSidebarOnMobile();
        }
      });

      const delBtn = item.querySelector('.conv-action-btn.delete');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(c.id);
      });

      elements.conversationsList.appendChild(item);
    });
  }

  async function switchConversation(id) {
    state.currentConversationId = id;
    renderConversations(elements.searchChats.value);

    // Try server first if configured
    if (state.settings.serverUrl) {
      try {
        const url = `${state.settings.serverUrl.replace(/\/+$/, '')}/api/conversations/${id}`;
        const res = await fetch(url);
        if (res.ok) {
          const detail = await res.json();
          renderMessageHistory(detail.messages);
          return;
        }
      } catch (e) {
        console.warn('Failed loading from server, checking local:', e);
      }
    }

    // Local conversation lookup
    const conv = state.conversations.find(c => c.id === id);
    if (conv && conv.messages) {
      renderMessageHistory(conv.messages);
    } else {
      elements.welcomeScreen.style.display = 'block';
      elements.messagesList.innerHTML = '';
    }
  }

  function renderMessageHistory(messages) {
    elements.welcomeScreen.style.display = 'none';
    elements.messagesList.innerHTML = '';
    if (!messages || messages.length === 0) {
      elements.welcomeScreen.style.display = 'block';
      return;
    }
    messages.forEach(msg => {
      const atts = typeof msg.attachments === 'string'
        ? JSON.parse(msg.attachments)
        : (msg.attachments || (msg.attachments_json ? JSON.parse(msg.attachments_json) : null));
      appendMessageUI(msg.role, msg.content, atts, msg.reasoning);
    });
    scrollToBottom();
  }

  async function deleteConversation(id) {
    if (!confirm('Are you sure you want to delete this chat?')) return;

    if (state.settings.serverUrl) {
      try {
        const url = `${state.settings.serverUrl.replace(/\/+$/, '')}/api/conversations/${id}`;
        await fetch(url, { method: 'DELETE' });
      } catch (e) {
        console.warn('Server delete failed:', e);
      }
    }

    state.conversations = state.conversations.filter(c => c.id !== id);
    saveLocalConversations();

    if (state.currentConversationId === id) {
      startNewChat();
    } else {
      renderConversations(elements.searchChats.value);
    }
  }

  function startNewChat() {
    state.currentConversationId = null;
    elements.messagesList.innerHTML = '';
    elements.welcomeScreen.style.display = 'block';
    renderConversations();
    elements.messageInput.focus();
    closeSidebarOnMobile();
  }

  // --- Personas ---
  async function loadPersonas() {
    if (state.settings.serverUrl) {
      try {
        const url = `${state.settings.serverUrl.replace(/\/+$/, '')}/api/personas`;
        const res = await fetch(url);
        if (res.ok) {
          state.personas = await res.json();
          renderPersonas();
          return;
        }
      } catch (e) {
        console.warn('Personas server fetch fallback:', e);
      }
    }

    // Local / Default Personas
    const custom = JSON.parse(localStorage.getItem('ai_custom_personas') || '[]');
    state.personas = [...DEFAULT_PERSONAS, ...custom];
    renderPersonas();
  }

  function renderPersonas() {
    elements.personasList.innerHTML = '';
    state.personas.forEach(p => {
      const card = document.createElement('div');
      card.className = 'persona-card';
      card.innerHTML = `
        <div>
          <h5>${escapeHtml(p.title)} ${p.is_builtin ? '<small style="color: var(--accent-color)">(Built-in)</small>' : ''}</h5>
          <p>${escapeHtml(p.description || '')}</p>
        </div>
        <button class="btn btn-secondary select-persona-btn" style="padding: 4px 10px; font-size: 12px;">Use</button>
      `;

      card.querySelector('.select-persona-btn').addEventListener('click', () => {
        state.settings.systemPrompt = p.system_prompt;
        localStorage.setItem('ai_system_prompt', p.system_prompt);
        elements.settingSystemPrompt.value = p.system_prompt;
        closeModal(elements.personasModal);
        alert(`Activated persona: "${p.title}"`);
      });

      elements.personasList.appendChild(card);
    });
  }

  // --- Attachments Handling ---
  elements.attachBtn.addEventListener('click', () => elements.fileInput.click());

  elements.fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const base64 = await readFileAsBase64(file);
        state.attachments.push({
          name: file.name,
          mime_type: file.type,
          data_base64: base64,
        });
      } else {
        const text = await readFileAsText(file);
        state.attachments.push({
          name: file.name,
          mime_type: file.type || 'text/plain',
          data_base64: text,
        });
      }
    }
    elements.fileInput.value = '';
    renderAttachmentTray();
  });

  function renderAttachmentTray() {
    elements.attachmentTray.innerHTML = '';
    if (state.attachments.length === 0) {
      elements.attachmentTray.style.display = 'none';
      return;
    }

    elements.attachmentTray.style.display = 'flex';
    state.attachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'tray-chip';
      chip.innerHTML = `
        <span>📎 ${escapeHtml(att.name)}</span>
        <button type="button" class="tray-chip-remove" data-index="${idx}">&times;</button>
      `;

      chip.querySelector('.tray-chip-remove').addEventListener('click', () => {
        state.attachments.splice(idx, 1);
        renderAttachmentTray();
      });

      elements.attachmentTray.appendChild(chip);
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // --- Chat Stream Execution (Universal Direct API & Server Mode) ---
  async function sendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text && state.attachments.length === 0) return;
    if (state.isGenerating) return;

    // Check credentials if not using a server
    if (!state.settings.serverUrl && !state.settings.apiKey) {
      openModal(elements.settingsModal);
      alert('Please enter your API Key (e.g. Gemini or OpenAI) in Settings to get started!');
      return;
    }

    elements.welcomeScreen.style.display = 'none';

    // Copy attachments and clear draft tray
    const attachmentsPayload = [...state.attachments];
    state.attachments = [];
    renderAttachmentTray();

    // Render User Bubble
    appendMessageUI('user', text, attachmentsPayload);
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';

    // Prepare Assistant Placeholder
    const assistantBubble = appendMessageUI('assistant', '');
    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';
    assistantBubble.appendChild(cursor);

    scrollToBottom();
    setGeneratingState(true);

    state.abortController = new AbortController();

    // Ensure conversation exists
    if (!state.currentConversationId) {
      state.currentConversationId = generateId();
      const title = text.length > 30 ? `${text.slice(0, 30)}...` : (text || 'New Chat');
      state.conversations.unshift({
        id: state.currentConversationId,
        title: title,
        model: state.settings.model,
        messages: [],
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      renderConversations();
    }

    const currentConv = state.conversations.find(c => c.id === state.currentConversationId);
    if (currentConv) {
      if (!currentConv.messages) currentConv.messages = [];
      currentConv.messages.push({
        id: generateId(),
        role: 'user',
        content: text,
        attachments: attachmentsPayload,
        created_at: Date.now(),
      });
      saveLocalConversations();
    }

    let accumulatedText = '';
    let accumulatedReasoning = '';
    let isThinking = false;
    let thinkingStartTime = null;
    let reasoningDetailsEl = null;
    let reasoningSummaryEl = null;
    let reasoningContentEl = null;
    let insideThinkTag = false;

    function handleReasoningToken(chunk) {
      if (!chunk) return;
      if (!reasoningDetailsEl) {
        thinkingStartTime = Date.now();
        isThinking = true;
        reasoningDetailsEl = document.createElement('details');
        reasoningDetailsEl.className = 'reasoning-trace';
        reasoningDetailsEl.open = true;

        reasoningSummaryEl = document.createElement('summary');
        reasoningSummaryEl.className = 'reasoning-summary';
        reasoningSummaryEl.innerHTML = `
          <span class="reasoning-spinner"></span>
          <span>Thinking...</span>
          <span class="reasoning-chevron">▼</span>
        `;

        reasoningContentEl = document.createElement('div');
        reasoningContentEl.className = 'reasoning-content';

        reasoningDetailsEl.appendChild(reasoningSummaryEl);
        reasoningDetailsEl.appendChild(reasoningContentEl);

        const answerBody = assistantBubble.querySelector('.answer-body') || assistantBubble;
        assistantBubble.insertBefore(reasoningDetailsEl, answerBody);
      }

      accumulatedReasoning += chunk;
      reasoningContentEl.textContent = accumulatedReasoning;
      reasoningContentEl.scrollTop = reasoningContentEl.scrollHeight;
      scrollToBottom();
    }

    function handleContentToken(chunk) {
      if (!chunk) return;

      // Handle <think> tags if model emits them in content
      if (chunk.includes('<think>')) {
        insideThinkTag = true;
        const parts = chunk.split('<think>');
        if (parts[0]) handleContentToken(parts[0]);
        if (parts[1]) handleReasoningToken(parts[1]);
        return;
      }
      if (insideThinkTag) {
        if (chunk.includes('</think>')) {
          const parts = chunk.split('</think>');
          handleReasoningToken(parts[0]);
          insideThinkTag = false;
          if (parts[1]) handleContentToken(parts[1]);
        } else {
          handleReasoningToken(chunk);
        }
        return;
      }

      // If we were thinking and real answer arrived, collapse thinking box
      if (isThinking && reasoningDetailsEl) {
        isThinking = false;
        const duration = ((Date.now() - (thinkingStartTime || Date.now())) / 1000).toFixed(1);
        reasoningSummaryEl.innerHTML = `
          <span class="reasoning-check">✓</span>
          <span>Thought for ${duration}s</span>
          <span class="reasoning-chevron">▼</span>
        `;
        reasoningDetailsEl.open = false; // Auto-collapse!
      }

      accumulatedText += chunk;
      const answerBody = assistantBubble.querySelector('.answer-body') || assistantBubble;
      renderMarkdownInto(answerBody, accumulatedText);
      answerBody.appendChild(cursor);
      scrollToBottom();
    }

    try {
      if (state.settings.serverUrl) {
        // --- SERVER MODE ---
        const url = `${state.settings.serverUrl.replace(/\/+$/, '')}/api/chat/stream`;
        const payload = {
          conversation_id: state.currentConversationId,
          message: text,
          model: state.settings.model,
          system_prompt: state.settings.systemPrompt,
          temperature: state.settings.temperature,
          max_tokens: state.settings.maxTokens,
          api_key: state.settings.apiKey,
          base_url: state.settings.baseUrl,
          attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: state.abortController.signal,
        });

        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
        await readSseStream(response.body, {
          onContent: handleContentToken,
          onReasoning: handleReasoningToken,
        });
      } else {
        // --- DIRECT LLM API MODE (Standalone in APK / Browser) ---
        let endpoint = state.settings.baseUrl.trim().replace(/\/+$/, '');
        if (!endpoint.endsWith('/chat/completions')) {
          if (endpoint.endsWith('/v1') || endpoint.endsWith('/openai')) {
            endpoint += '/chat/completions';
          } else {
            endpoint += '/v1/chat/completions';
          }
        }

        const messages = [];
        if (state.settings.systemPrompt) {
          messages.push({ role: 'system', content: state.settings.systemPrompt });
        }

        // Add history messages
        if (currentConv && currentConv.messages) {
          currentConv.messages.slice(0, -1).forEach(m => {
            messages.push({ role: m.role, content: m.content });
          });
        }

        // Build current message with multimodal support
        if (attachmentsPayload.length > 0) {
          const parts = [];
          if (text) parts.push({ type: 'text', text: text });
          attachmentsPayload.forEach(att => {
            if (att.mime_type.startsWith('image/')) {
              parts.push({
                type: 'image_url',
                image_url: { url: `data:${att.mime_type};base64,${att.data_base64}` },
              });
            } else {
              parts.push({
                type: 'text',
                text: `\n--- Attached File: ${att.name} ---\n${att.data_base64}\n`,
              });
            }
          });
          messages.push({ role: 'user', content: parts });
        } else {
          messages.push({ role: 'user', content: text });
        }

        const headers = { 'Content-Type': 'application/json' };
        if (state.settings.apiKey) {
          headers['Authorization'] = `Bearer ${state.settings.apiKey.trim()}`;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: state.settings.model || 'ddgw/gpt-5.4-mini',
            messages: messages,
            stream: true,
            temperature: state.settings.temperature,
            max_tokens: state.settings.maxTokens,
          }),
          signal: state.abortController.signal,
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          throw new Error(`API HTTP ${response.status}: ${errBody || response.statusText}`);
        }

        await readSseStream(response.body, {
          onContent: handleContentToken,
          onReasoning: handleReasoningToken,
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        accumulatedText += ' *(generation stopped by user)*';
      } else {
        console.error('Chat error:', err);
        accumulatedText += `\n\n> ⚠️ **Error:** ${err.message}`;
      }
      const answerBody = assistantBubble.querySelector('.answer-body') || assistantBubble;
      renderMarkdownInto(answerBody, accumulatedText);
    } finally {
      cursor.remove();
      setGeneratingState(false);

      if (isThinking && reasoningDetailsEl) {
        const duration = ((Date.now() - (thinkingStartTime || Date.now())) / 1000).toFixed(1);
        reasoningSummaryEl.innerHTML = `
          <span class="reasoning-check">✓</span>
          <span>Thought for ${duration}s</span>
          <span class="reasoning-chevron">▼</span>
        `;
        reasoningDetailsEl.open = false;
      }

      const answerBody = assistantBubble.querySelector('.answer-body') || assistantBubble;
      renderMarkdownInto(answerBody, accumulatedText);

      // Save assistant message to current conversation with reasoning
      if (currentConv && (accumulatedText || accumulatedReasoning)) {
        currentConv.messages.push({
          id: generateId(),
          role: 'assistant',
          content: accumulatedText,
          reasoning: accumulatedReasoning,
          created_at: Date.now(),
        });
        currentConv.updated_at = Date.now();
        saveLocalConversations();
        renderConversations();
      }
    }
  }

  // --- SSE Stream Parser ---
  async function readSseStream(readableStream, callbacks) {
    const { onContent, onReasoning } = typeof callbacks === 'function' ? { onContent: callbacks } : callbacks;
    const reader = readableStream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let isNextReasoning = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === 'data: [DONE]') return;

        if (trimmed.startsWith('event: reasoning')) {
          isNextReasoning = true;
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (isNextReasoning) {
            isNextReasoning = false;
            if (onReasoning) onReasoning(dataStr);
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              if (delta.reasoning_content && onReasoning) {
                onReasoning(delta.reasoning_content);
              }
              if (delta.content && onContent) {
                onContent(delta.content);
              }
            }
          } catch {
            // Direct text chunk
            if (dataStr !== '[DONE]' && onContent) onContent(dataStr);
          }
        }
      }
    }
  }

  function setGeneratingState(generating) {
    state.isGenerating = generating;
    elements.sendBtn.style.display = generating ? 'none' : 'flex';
    elements.stopBtn.style.display = generating ? 'flex' : 'none';
  }

  // --- Markdown & UI Rendering ---
  function renderMarkdownInto(container, markdownText) {
    if (typeof marked !== 'undefined') {
      try {
        container.innerHTML = marked.parse(markdownText);
        container.querySelectorAll('pre code').forEach((block) => {
          if (typeof hljs !== 'undefined') {
            hljs.highlightElement(block);
          }
          const pre = block.parentElement;
          if (!pre.querySelector('.code-header')) {
            const lang = (block.className.match(/language-(\w+)/) || [, 'code'])[1];
            const header = document.createElement('div');
            header.className = 'code-header';
            header.innerHTML = `
              <span>${lang}</span>
              <button class="copy-code-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
            `;
            header.querySelector('.copy-code-btn').addEventListener('click', (e) => {
              navigator.clipboard.writeText(block.innerText);
              e.currentTarget.textContent = 'Copied!';
              setTimeout(() => {
                e.currentTarget.innerHTML = `
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg> Copy`;
              }, 2000);
            });
            pre.insertBefore(header, block);
          }
        });
        return;
      } catch (e) {
        console.error('Marked parsing error:', e);
      }
    }
    container.textContent = markdownText;
  }

  function appendMessageUI(role, content, attachments, reasoning) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (attachments && attachments.length > 0) {
      const attsDiv = document.createElement('div');
      attsDiv.className = 'message-attachments';
      attachments.forEach(att => {
        if (att.mime_type && att.mime_type.startsWith('image/')) {
          const img = document.createElement('img');
          img.className = 'msg-attachment-thumb';
          img.src = `data:${att.mime_type};base64,${att.data_base64}`;
          attsDiv.appendChild(img);
        } else {
          const fileTag = document.createElement('span');
          fileTag.className = 'msg-attachment-file';
          fileTag.textContent = `📄 ${att.name}`;
          attsDiv.appendChild(fileTag);
        }
      });
      bubble.appendChild(attsDiv);
    }

    if (role === 'assistant') {
      // If historical reasoning exists, render collapsible block
      if (reasoning && reasoning.trim().length > 0) {
        const details = document.createElement('details');
        details.className = 'reasoning-trace';
        details.innerHTML = `
          <summary class="reasoning-summary">
            <span class="reasoning-check">✓</span>
            <span>Thought Process</span>
            <span class="reasoning-chevron">▼</span>
          </summary>
          <div class="reasoning-content">${escapeHtml(reasoning)}</div>
        `;
        bubble.appendChild(details);
      }

      const answerBody = document.createElement('div');
      answerBody.className = 'answer-body';
      renderMarkdownInto(answerBody, content);
      bubble.appendChild(answerBody);
    } else {
      const textDiv = document.createElement('div');
      textDiv.textContent = content;
      bubble.appendChild(textDiv);
    }

    row.appendChild(bubble);
    elements.messagesList.appendChild(row);
    return bubble;
  }

  function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function openModal(modal) {
    modal.classList.add('active');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.remove('open');
      elements.sidebarBackdrop.classList.remove('active');
    }
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    elements.toggleSidebarBtn.addEventListener('click', () => {
      elements.sidebar.classList.toggle('open');
      elements.sidebarBackdrop.classList.toggle('active');
    });

    elements.closeSidebarBtn.addEventListener('click', closeSidebarOnMobile);
    elements.sidebarBackdrop.addEventListener('click', closeSidebarOnMobile);

    elements.newChatBtn.addEventListener('click', startNewChat);

    elements.searchChats.addEventListener('input', (e) => {
      renderConversations(e.target.value);
    });

    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        elements.messageInput.value = chip.dataset.prompt;
        elements.messageInput.focus();
      });
    });

    elements.messageInput.addEventListener('input', () => {
      elements.messageInput.style.height = 'auto';
      elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
    });

    elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    elements.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage();
    });

    elements.stopBtn.addEventListener('click', () => {
      if (state.abortController) {
        state.abortController.abort();
      }
    });

    // Settings Modal
    elements.openSettingsBtn.addEventListener('click', () => {
      elements.settingServerUrl.value = state.settings.serverUrl;
      elements.settingBaseUrl.value = state.settings.baseUrl;
      elements.settingApiKey.value = state.settings.apiKey;
      elements.settingModel.value = state.settings.model;
      elements.settingSystemPrompt.value = state.settings.systemPrompt;
      elements.settingTemperature.value = state.settings.temperature;
      elements.settingMaxTokens.value = state.settings.maxTokens;
      elements.tempVal.textContent = state.settings.temperature;
      openModal(elements.settingsModal);
    });

    elements.currentModelBadge.addEventListener('click', () => {
      elements.openSettingsBtn.click();
    });

    elements.closeSettingsModal.addEventListener('click', () => closeModal(elements.settingsModal));

    elements.toggleKeyVisibility.addEventListener('click', () => {
      const isPassword = elements.settingApiKey.type === 'password';
      elements.settingApiKey.type = isPassword ? 'text' : 'password';
      elements.toggleKeyVisibility.textContent = isPassword ? '🙈' : '👁️';
    });

    elements.settingTemperature.addEventListener('input', (e) => {
      elements.tempVal.textContent = e.target.value;
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = PRESETS[btn.dataset.preset];
        if (preset) {
          elements.settingBaseUrl.value = preset.baseUrl;
          elements.settingModel.value = preset.model;
        }
      });
    });

    elements.saveSettingsBtn.addEventListener('click', () => {
      state.settings.serverUrl = elements.settingServerUrl.value.trim();
      state.settings.baseUrl = elements.settingBaseUrl.value.trim() || 'https://generativelanguage.googleapis.com/v1beta/openai/';
      state.settings.apiKey = elements.settingApiKey.value.trim();
      state.settings.model = elements.settingModel.value.trim() || 'gemini-2.0-flash';
      state.settings.systemPrompt = elements.settingSystemPrompt.value.trim();
      state.settings.temperature = parseFloat(elements.settingTemperature.value);
      state.settings.maxTokens = parseInt(elements.settingMaxTokens.value) || 4096;

      localStorage.setItem('ai_server_url', state.settings.serverUrl);
      localStorage.setItem('ai_base_url', state.settings.baseUrl);
      localStorage.setItem('ai_api_key', state.settings.apiKey);
      localStorage.setItem('ai_model', state.settings.model);
      localStorage.setItem('ai_system_prompt', state.settings.systemPrompt);
      localStorage.setItem('ai_temp', state.settings.temperature);
      localStorage.setItem('ai_max_tokens', state.settings.maxTokens);

      updateModelBadge();
      closeModal(elements.settingsModal);
      loadConversations();
    });

    elements.resetSettingsBtn.addEventListener('click', () => {
      localStorage.clear();
      state.settings = {
        serverUrl: '',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: '',
        model: 'gemini-2.0-flash',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 4096,
      };
      updateModelBadge();
      closeModal(elements.settingsModal);
      loadConversations();
    });

    // Personas Modal
    elements.openPersonasBtn.addEventListener('click', () => openModal(elements.personasModal));
    elements.closePersonasModal.addEventListener('click', () => closeModal(elements.personasModal));

    elements.saveNewPersonaBtn.addEventListener('click', async () => {
      const title = elements.newPersonaTitle.value.trim();
      const description = elements.newPersonaDesc.value.trim();
      const systemPrompt = elements.newPersonaPrompt.value.trim();

      if (!title || !systemPrompt) {
        alert('Please fill out the title and system prompt.');
        return;
      }

      const custom = JSON.parse(localStorage.getItem('ai_custom_personas') || '[]');
      custom.push({ id: generateId(), title, description, system_prompt: systemPrompt, is_builtin: false });
      localStorage.setItem('ai_custom_personas', JSON.stringify(custom));

      elements.newPersonaTitle.value = '';
      elements.newPersonaDesc.value = '';
      elements.newPersonaPrompt.value = '';
      await loadPersonas();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
