// AI Studio Frontend Application Logic
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
      baseUrl: localStorage.getItem('ai_base_url') || '',
      apiKey: localStorage.getItem('ai_api_key') || '',
      model: localStorage.getItem('ai_model') || 'gemini-2.0-flash',
      systemPrompt: localStorage.getItem('ai_system_prompt') || '',
      temperature: parseFloat(localStorage.getItem('ai_temp')) || 0.7,
      maxTokens: parseInt(localStorage.getItem('ai_max_tokens')) || 4096,
    },
  };

  // Preset Configurations
  const PRESETS = {
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

  // --- API Calls & Data Sync ---
  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        state.conversations = await res.json();
        renderConversations();
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }

  function renderConversations(filter = '') {
    elements.conversationsList.innerHTML = '';
    const filtered = state.conversations.filter(c =>
      c.title.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      elements.conversationsList.innerHTML = `
        <div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">
          No conversations found
        </div>`;
      return;
    }

    filtered.forEach(c => {
      const item = document.createElement('div');
      item.className = `conversation-item ${c.id === state.currentConversationId ? 'active' : ''}`;
      item.dataset.id = c.id;

      item.innerHTML = `
        <span class="conv-title">${escapeHtml(c.title)}</span>
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
    if (state.currentConversationId === id) return;
    state.currentConversationId = id;
    renderConversations(elements.searchChats.value);

    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const detail = await res.json();
        elements.welcomeScreen.style.display = 'none';
        elements.messagesList.innerHTML = '';

        detail.messages.forEach(msg => {
          appendMessageUI(msg.role, msg.content, msg.attachments_json ? JSON.parse(msg.attachments_json) : null);
        });

        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    }
  }

  async function deleteConversation(id) {
    if (!confirm('Are you sure you want to delete this chat?')) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        state.conversations = state.conversations.filter(c => c.id !== id);
        if (state.currentConversationId === id) {
          startNewChat();
        } else {
          renderConversations(elements.searchChats.value);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
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
    try {
      const res = await fetch('/api/personas');
      if (res.ok) {
        state.personas = await res.json();
        renderPersonas();
      }
    } catch (err) {
      console.error('Failed to load personas:', err);
    }
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

  // --- Chat Stream Execution ---
  async function sendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text && state.attachments.length === 0) return;
    if (state.isGenerating) return;

    elements.welcomeScreen.style.display = 'none';

    // Copy attachments for payload and clear tray
    const attachmentsPayload = [...state.attachments];
    state.attachments = [];
    renderAttachmentTray();

    // Render User Message
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

    let accumulatedText = '';

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: state.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep unfinished line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: conversation_id')) {
            // Next data line has the conversation_id
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') break;

            // Check if this was the conversation_id assignment
            if (!state.currentConversationId && dataStr.length === 36 && dataStr.includes('-')) {
              state.currentConversationId = dataStr;
              loadConversations();
              continue;
            }

            accumulatedText += dataStr;
            renderMarkdownInto(assistantBubble, accumulatedText);
            assistantBubble.appendChild(cursor);
            scrollToBottom();
          } else if (trimmed.startsWith('event: error')) {
            // Error event
            const errLine = lines.find(l => l.startsWith('data: '));
            const errMsg = errLine ? errLine.slice(6) : 'Unknown upstream error';
            accumulatedText += `\n\n> ⚠️ **Error:** ${errMsg}\n`;
            renderMarkdownInto(assistantBubble, accumulatedText);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        accumulatedText += ' *(generation stopped by user)*';
      } else {
        console.error('Chat error:', err);
        accumulatedText += `\n\n> ⚠️ **Connection Error:** ${err.message}`;
      }
      renderMarkdownInto(assistantBubble, accumulatedText);
    } finally {
      cursor.remove();
      setGeneratingState(false);
      renderMarkdownInto(assistantBubble, accumulatedText);
      loadConversations();
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
        // Attach copy button and syntax highlighting to code blocks
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

  function appendMessageUI(role, content, attachments) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Render attachments if present
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
      renderMarkdownInto(bubble, content);
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

  // --- Modal Helpers ---
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
    // Sidebar toggle (Mobile & Desktop)
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

    // Prompt Chips on Welcome Screen
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        elements.messageInput.value = chip.dataset.prompt;
        elements.messageInput.focus();
      });
    });

    // Form input resize & submission
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

    elements.settingTemperature.addEventListener('input', (e) => {
      elements.tempVal.textContent = e.target.value;
    });

    // Quick presets inside settings modal
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
      state.settings.baseUrl = elements.settingBaseUrl.value.trim();
      state.settings.apiKey = elements.settingApiKey.value.trim();
      state.settings.model = elements.settingModel.value.trim() || 'gemini-2.0-flash';
      state.settings.systemPrompt = elements.settingSystemPrompt.value.trim();
      state.settings.temperature = parseFloat(elements.settingTemperature.value);
      state.settings.maxTokens = parseInt(elements.settingMaxTokens.value) || 4096;

      localStorage.setItem('ai_base_url', state.settings.baseUrl);
      localStorage.setItem('ai_api_key', state.settings.apiKey);
      localStorage.setItem('ai_model', state.settings.model);
      localStorage.setItem('ai_system_prompt', state.settings.systemPrompt);
      localStorage.setItem('ai_temp', state.settings.temperature);
      localStorage.setItem('ai_max_tokens', state.settings.maxTokens);

      updateModelBadge();
      closeModal(elements.settingsModal);
    });

    elements.resetSettingsBtn.addEventListener('click', () => {
      localStorage.clear();
      state.settings = {
        baseUrl: '',
        apiKey: '',
        model: 'gemini-2.0-flash',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 4096,
      };
      updateModelBadge();
      closeModal(elements.settingsModal);
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

      try {
        const res = await fetch('/api/personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, system_prompt: systemPrompt }),
        });

        if (res.ok) {
          elements.newPersonaTitle.value = '';
          elements.newPersonaDesc.value = '';
          elements.newPersonaPrompt.value = '';
          await loadPersonas();
        }
      } catch (err) {
        console.error('Failed to create persona:', err);
      }
    });
  }

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
