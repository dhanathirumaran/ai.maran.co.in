// ==========================================================================
// General Bot &bull; ai.maran.co.in
// Dedicated 1-on-1 General AI Companion
// ==========================================================================

(() => {
  // --- Bot Configuration & State ---
  const state = {
    messages: [], // Array of { id, role, content, attachments, reasoning, created_at }
    attachments: [],
    isGenerating: false,
    abortController: null,
    currentUtterance: null,
    settings: {
      baseUrl: localStorage.getItem('ai_base_url') || 'https://omni.pulsemindstudios.com/v1',
      apiKey: localStorage.getItem('ai_api_key') || 'sk-1f024b5463df9ab9-773f64-ad742b97',
      model: localStorage.getItem('ai_model') || 'ddgw/gpt-5.4-mini',
      systemPrompt: 'You are General Bot, a smart, versatile, and highly capable AI assistant. Answer directly, concisely, and accurately. When writing code, provide clean, modern, and idiomatic code, and output interactive HTML/SVG artifacts when relevant.',
      temperature: 0.7,
      maxTokens: 4096,
    },
  };

  // --- SVG Icons Helper (shadcn / Lucide inspired) ---
  const ICONS = {
    spin: `<svg class="trace-icon-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    check: `<svg class="trace-icon-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
    alert: `<svg class="trace-icon-alert" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    chevron: `<svg class="trace-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
    volume: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    volumeStop: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
    copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    maximize: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  };

  // --- DOM Elements ---
  const elements = {
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
    artifactModal: document.getElementById('artifactModal'),
    closeArtifactModal: document.getElementById('closeArtifactModal'),
    artifactModalFrame: document.getElementById('artifactModalFrame'),
    artifactModalName: document.getElementById('artifactModalName'),
    reloadArtifactBtn: document.getElementById('reloadArtifactBtn'),
  };

  let activeArtifactCode = '';

  // --- Helper: Generate UUID ---
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // --- Initialize Bot ---
  function init() {
    loadChatHistory();
    setupEventListeners();
  }

  // --- Continuous Chat History ---
  function loadChatHistory() {
    try {
      const saved = localStorage.getItem('general_bot_history');
      if (saved) {
        state.messages = JSON.parse(saved);
        if (state.messages.length > 0) {
          elements.welcomeScreen.style.display = 'none';
          elements.messagesList.innerHTML = '';
          state.messages.forEach((msg) => {
            appendMessageUI(msg.role, msg.content, msg.attachments, msg.reasoning, msg.id, msg.created_at);
          });
          scrollToBottom();
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
      state.messages = [];
    }
    elements.welcomeScreen.style.display = 'block';
  }

  function saveChatHistory() {
    try {
      localStorage.setItem('general_bot_history', JSON.stringify(state.messages));
    } catch (e) {
      console.warn('Failed to save chat history:', e);
    }
  }

  function resetMemory() {
    state.messages = [];
    localStorage.removeItem('general_bot_history');
    elements.messagesList.innerHTML = '';
    elements.welcomeScreen.style.display = 'block';
    state.attachments = [];
    renderAttachmentTray();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // --- Trace / Chain-of-Thought Component Builder ---
  function parseReasoningSteps(raw) {
    if (!raw || !raw.trim()) return [];
    const lines = raw.split(/\n\s*\n+/);
    const steps = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const firstLine = trimmed.split('\n')[0].replace(/^[#*\s\d.-]+/, '').trim();
      const title = firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
      steps.push({
        title: title || 'Analytical thought step',
        body: trimmed,
      });
    }
    return steps;
  }

  function buildTraceElement(isStreaming = false, rawReasoning = '', durationSec = null) {
    const container = document.createElement('div');
    container.className = 'trace-container';

    const details = document.createElement('details');
    details.className = 'trace-collapsible';
    details.open = isStreaming;

    const summary = document.createElement('summary');
    summary.className = 'trace-summary';

    const left = document.createElement('div');
    left.className = 'trace-summary-left';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'trace-status-icon';
    iconSpan.innerHTML = isStreaming ? ICONS.spin : ICONS.check;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'trace-title';
    titleSpan.textContent = isStreaming ? 'Thinking...' : 'Reasoning Process';

    const durationBadge = document.createElement('span');
    durationBadge.className = 'trace-duration-badge';
    if (durationSec !== null) {
      durationBadge.textContent = `${durationSec}s`;
    }

    left.appendChild(iconSpan);
    left.appendChild(titleSpan);
    left.appendChild(durationBadge);

    const chevron = document.createElement('span');
    chevron.innerHTML = ICONS.chevron;

    summary.appendChild(left);
    summary.appendChild(chevron);
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'trace-content';

    const treeLine = document.createElement('div');
    treeLine.className = 'trace-tree-line';
    content.appendChild(treeLine);

    const stepList = document.createElement('div');
    stepList.className = 'trace-step-list';

    const steps = parseReasoningSteps(rawReasoning);
    if (steps.length > 0) {
      steps.forEach((s, idx) => {
        const stepRow = document.createElement('div');
        stepRow.className = `trace-step ${idx === steps.length - 1 && isStreaming ? 'running' : 'done'}`;
        stepRow.innerHTML = `
          <div class="trace-line">
            <span class="trace-step-dot"></span>
            <span class="trace-step-title">${escapeHtml(s.title)}</span>
          </div>
          <div class="trace-step-body">${escapeHtml(s.body)}</div>
        `;
        stepList.appendChild(stepRow);
      });
    } else {
      const rawDiv = document.createElement('div');
      rawDiv.className = 'trace-raw-stream';
      rawDiv.textContent = rawReasoning || 'Analyzing query...';
      stepList.appendChild(rawDiv);
    }

    content.appendChild(stepList);
    details.appendChild(content);
    container.appendChild(details);

    return {
      container,
      details,
      summary,
      iconSpan,
      titleSpan,
      durationBadge,
      stepList,
    };
  }

  // --- Artifacts System: Live Interactive Previews ---
  function detectAndRenderArtifacts(container) {
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (pre.closest('.artifact-card')) return;

      const lang = (codeEl.className.match(/language-(\w+)/) || [, ''])[1].toLowerCase();
      const rawCode = codeEl.innerText.trim();

      const isHtml =
        lang === 'html' ||
        rawCode.startsWith('<!DOCTYPE html>') ||
        rawCode.startsWith('<html') ||
        (rawCode.includes('<head>') && rawCode.includes('<body>'));
      const isSvg = lang === 'svg' || (rawCode.startsWith('<svg') && rawCode.endsWith('</svg>'));

      if (isHtml || isSvg) {
        const artifactCard = document.createElement('div');
        artifactCard.className = 'artifact-card';

        const artifactTitle = isSvg ? 'Vector SVG Artifact' : 'Interactive Web Artifact';
        const docHtml = isSvg
          ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff;overflow:hidden;}</style></head><body>${rawCode}</body></html>`
          : rawCode;

        artifactCard.innerHTML = `
          <div class="artifact-header">
            <div class="artifact-info">
              <span class="artifact-badge">⚡</span>
              <span>${artifactTitle}</span>
            </div>
            <div class="artifact-tabs">
              <button class="artifact-tab-btn active" data-tab="preview">Preview</button>
              <button class="artifact-tab-btn" data-tab="code">Code</button>
            </div>
            <div class="artifact-actions">
              <button class="artifact-btn fullscreen-btn" title="Fullscreen Preview">${ICONS.maximize}</button>
              <button class="artifact-btn copy-btn" title="Copy Code">${ICONS.copy}</button>
            </div>
          </div>
          <div class="artifact-view-panel">
            <div class="artifact-preview-panel active">
              <iframe class="artifact-iframe" sandbox="allow-scripts allow-modals"></iframe>
            </div>
            <div class="artifact-code-panel"></div>
          </div>
        `;

        const iframe = artifactCard.querySelector('.artifact-iframe');
        iframe.srcdoc = docHtml;

        const previewPanel = artifactCard.querySelector('.artifact-preview-panel');
        const codePanel = artifactCard.querySelector('.artifact-code-panel');
        const tabBtns = artifactCard.querySelectorAll('.artifact-tab-btn');

        codePanel.appendChild(pre.cloneNode(true));

        tabBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            tabBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.tab === 'preview') {
              previewPanel.classList.add('active');
              codePanel.classList.remove('active');
            } else {
              codePanel.classList.add('active');
              previewPanel.classList.remove('active');
            }
          });
        });

        artifactCard.querySelector('.fullscreen-btn').addEventListener('click', () => {
          activeArtifactCode = docHtml;
          elements.artifactModalName.textContent = artifactTitle;
          elements.artifactModalFrame.srcdoc = docHtml;
          elements.artifactModal.classList.add('active');
        });

        artifactCard.querySelector('.copy-btn').addEventListener('click', (e) => {
          navigator.clipboard.writeText(rawCode);
          e.currentTarget.style.color = 'var(--success-color)';
          setTimeout(() => {
            e.currentTarget.style.color = '';
          }, 2000);
        });

        pre.replaceWith(artifactCard);
      }
    });
  }

  // --- Voice Synthesis (TTS) Assistant Toolbar ---
  function speakMessage(text, btn) {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this device/browser.');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (state.currentUtterance && state.currentUtterance.btn === btn) {
        btn.classList.remove('speaking');
        btn.innerHTML = `${ICONS.volume} Speak`;
        state.currentUtterance = null;
        return;
      }
    }

    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [Code omitted] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~>\-]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    btn.classList.add('speaking');
    btn.innerHTML = `${ICONS.volumeStop} Stop`;
    state.currentUtterance = { utterance, btn };

    utterance.onend = () => {
      btn.classList.remove('speaking');
      btn.innerHTML = `${ICONS.volume} Speak`;
      state.currentUtterance = null;
    };

    utterance.onerror = () => {
      btn.classList.remove('speaking');
      btn.innerHTML = `${ICONS.volume} Speak`;
      state.currentUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  function createMessageToolbar(text, role, msgId, timestamp) {
    const toolbar = document.createElement('div');
    toolbar.className = 'message-actions-toolbar';

    if (role === 'assistant') {
      const speakBtn = document.createElement('button');
      speakBtn.className = 'action-pill-btn';
      speakBtn.innerHTML = `${ICONS.volume} Speak`;
      speakBtn.addEventListener('click', () => speakMessage(text, speakBtn));
      toolbar.appendChild(speakBtn);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'action-pill-btn';
      copyBtn.innerHTML = `${ICONS.copy} Copy`;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = `${ICONS.copy} Copy`;
        }, 2000);
      });
      toolbar.appendChild(copyBtn);
    }

    const timeLabel = document.createElement('span');
    timeLabel.className = 'message-timestamp';
    const date = timestamp ? new Date(timestamp) : new Date();
    timeLabel.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    toolbar.appendChild(timeLabel);

    return toolbar;
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
    const rawText = elements.messageInput.value.trim();
    if (!rawText && state.attachments.length === 0) return;
    if (state.isGenerating) return;

    // Check for in-chat memory reset commands
    const normalized = rawText.toLowerCase().trim();
    if (
      normalized === '/reset' ||
      normalized === '/clear' ||
      normalized === 'reset memory' ||
      normalized === 'clear chat' ||
      normalized === 'start fresh' ||
      normalized === 'clear memory'
    ) {
      elements.messageInput.value = '';
      elements.messageInput.style.height = 'auto';
      resetMemory();
      return;
    }

    elements.welcomeScreen.style.display = 'none';

    const attachmentsPayload = [...state.attachments];
    state.attachments = [];
    renderAttachmentTray();

    // Render User Message
    const userMsgId = generateId();
    appendMessageUI('user', rawText, attachmentsPayload, null, userMsgId, Date.now());
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';

    // Store User Message in History
    state.messages.push({
      id: userMsgId,
      role: 'user',
      content: rawText,
      attachments: attachmentsPayload,
      created_at: Date.now(),
    });
    saveChatHistory();

    // Prepare Assistant Bubble
    const assistantBubble = appendMessageUI('assistant', '');
    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';
    assistantBubble.appendChild(cursor);

    scrollToBottom();
    setGeneratingState(true);

    state.abortController = new AbortController();

    let accumulatedText = '';
    let accumulatedReasoning = '';
    let isThinking = false;
    let thinkingStartTime = null;
    let thinkingTimerInterval = null;
    let traceObj = null;
    let insideThinkTag = false;

    function handleReasoningToken(chunk) {
      if (!chunk) return;
      if (!traceObj) {
        thinkingStartTime = Date.now();
        isThinking = true;
        traceObj = buildTraceElement(true, '', null);
        const answerBody = assistantBubble.querySelector('.answer-body') || assistantBubble;
        assistantBubble.insertBefore(traceObj.container, answerBody);

        thinkingTimerInterval = setInterval(() => {
          if (isThinking && thinkingStartTime) {
            const elapsed = ((Date.now() - thinkingStartTime) / 1000).toFixed(1);
            traceObj.durationBadge.textContent = `${elapsed}s`;
          }
        }, 100);
      }

      accumulatedReasoning += chunk;
      const steps = parseReasoningSteps(accumulatedReasoning);
      traceObj.stepList.innerHTML = '';
      if (steps.length > 0) {
        steps.forEach((s, idx) => {
          const stepRow = document.createElement('div');
          stepRow.className = `trace-step ${idx === steps.length - 1 ? 'running' : 'done'}`;
          stepRow.innerHTML = `
            <div class="trace-line">
              <span class="trace-step-dot"></span>
              <span class="trace-step-title">${escapeHtml(s.title)}</span>
            </div>
            <div class="trace-step-body">${escapeHtml(s.body)}</div>
          `;
          traceObj.stepList.appendChild(stepRow);
        });
      }
      scrollToBottom();
    }

    function handleContentToken(chunk) {
      if (!chunk) return;

      // Handle embedded <think>...</think> tags
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

      // Transition from thinking to answering
      if (isThinking && traceObj) {
        isThinking = false;
        clearInterval(thinkingTimerInterval);
        const duration = ((Date.now() - (thinkingStartTime || Date.now())) / 1000).toFixed(1);
        traceObj.iconSpan.innerHTML = ICONS.check;
        traceObj.titleSpan.textContent = 'Reasoning Process';
        traceObj.durationBadge.textContent = `Thought for ${duration}s`;
        traceObj.details.open = false;
      }

      accumulatedText += chunk;
      const answerBody = assistantBubble.querySelector('.answer-body') || assistantBubble;
      renderMarkdownInto(answerBody, accumulatedText);
      detectAndRenderArtifacts(answerBody);
      answerBody.appendChild(cursor);
      scrollToBottom();
    }

    try {
      let endpoint = state.settings.baseUrl.trim().replace(/\/+$/, '');
      if (!endpoint.endsWith('/chat/completions')) {
        if (endpoint.endsWith('/v1') || endpoint.endsWith('/openai')) {
          endpoint += '/chat/completions';
        } else {
          endpoint += '/v1/chat/completions';
        }
      }

      // Build conversation payload for the API
      const apiMessages = [];
      if (state.settings.systemPrompt) {
        apiMessages.push({ role: 'system', content: state.settings.systemPrompt });
      }

      // Add prior messages for context
      state.messages.slice(0, -1).forEach((m) => {
        apiMessages.push({ role: m.role, content: m.content });
      });

      // Add current message with attachment support
      if (attachmentsPayload.length > 0) {
        const parts = [];
        if (rawText) parts.push({ type: 'text', text: rawText });
        attachmentsPayload.forEach((att) => {
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
        apiMessages.push({ role: 'user', content: parts });
      } else {
        apiMessages.push({ role: 'user', content: rawText });
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
          messages: apiMessages,
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
      clearInterval(thinkingTimerInterval);

      if (isThinking && traceObj) {
        const duration = ((Date.now() - (thinkingStartTime || Date.now())) / 1000).toFixed(1);
        traceObj.iconSpan.innerHTML = ICONS.check;
        traceObj.titleSpan.textContent = 'Reasoning Process';
        traceObj.durationBadge.textContent = `Thought for ${duration}s`;
        traceObj.details.open = false;
      }

      const answerBody = assistantBubble.querySelector('.answer-body') || assistantBubble;
      renderMarkdownInto(answerBody, accumulatedText);
      detectAndRenderArtifacts(answerBody);

      const msgId = generateId();
      const toolbar = createMessageToolbar(accumulatedText, 'assistant', msgId, Date.now());
      assistantBubble.appendChild(toolbar);

      if (accumulatedText || accumulatedReasoning) {
        state.messages.push({
          id: msgId,
          role: 'assistant',
          content: accumulatedText,
          reasoning: accumulatedReasoning,
          created_at: Date.now(),
        });
        saveChatHistory();
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
      buffer = lines.pop();

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

  // --- Markdown Rendering & Highlighting ---
  function renderMarkdownInto(container, markdownText) {
    if (typeof marked !== 'undefined') {
      try {
        container.innerHTML = marked.parse(markdownText);
        container.querySelectorAll('pre code').forEach((block) => {
          if (typeof hljs !== 'undefined') {
            hljs.highlightElement(block);
          }
          const pre = block.parentElement;
          if (!pre.querySelector('.code-header') && !pre.closest('.artifact-card')) {
            const lang = (block.className.match(/language-(\w+)/) || [, 'code'])[1];
            const header = document.createElement('div');
            header.className = 'code-header';
            header.innerHTML = `
              <span>${lang}</span>
              <button class="copy-code-btn">
                ${ICONS.copy}
                Copy
              </button>
            `;
            header.querySelector('.copy-code-btn').addEventListener('click', (e) => {
              navigator.clipboard.writeText(block.innerText);
              e.currentTarget.textContent = 'Copied!';
              setTimeout(() => {
                e.currentTarget.innerHTML = `${ICONS.copy} Copy`;
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

  function appendMessageUI(role, content, attachments, reasoning, msgId, timestamp) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (attachments && attachments.length > 0) {
      const attsDiv = document.createElement('div');
      attsDiv.className = 'message-attachments';
      attachments.forEach((att) => {
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
      if (reasoning && reasoning.trim().length > 0) {
        const trace = buildTraceElement(false, reasoning, null);
        bubble.appendChild(trace.container);
      }

      const answerBody = document.createElement('div');
      answerBody.className = 'answer-body';
      renderMarkdownInto(answerBody, content);
      detectAndRenderArtifacts(answerBody);
      bubble.appendChild(answerBody);

      if (content) {
        const toolbar = createMessageToolbar(content, 'assistant', msgId, timestamp);
        bubble.appendChild(toolbar);
      }
    } else {
      const textDiv = document.createElement('div');
      textDiv.textContent = content;
      bubble.appendChild(textDiv);

      const toolbar = createMessageToolbar(content, 'user', msgId, timestamp);
      bubble.appendChild(toolbar);
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

  // --- Event Listeners ---
  function setupEventListeners() {
    // Prompt Chips
    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        elements.messageInput.value = chip.dataset.prompt;
        elements.messageInput.focus();
        elements.messageInput.style.height = 'auto';
        elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
      });
    });

    // Composer Input resizing
    elements.messageInput.addEventListener('input', () => {
      elements.messageInput.style.height = 'auto';
      elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
    });

    // Enter to send, Shift+Enter for newline
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

    // Fullscreen Artifact Modal
    if (elements.closeArtifactModal) {
      elements.closeArtifactModal.addEventListener('click', () => {
        elements.artifactModal.classList.remove('active');
      });
    }

    if (elements.reloadArtifactBtn) {
      elements.reloadArtifactBtn.addEventListener('click', () => {
        if (elements.artifactModalFrame && activeArtifactCode) {
          elements.artifactModalFrame.srcdoc = activeArtifactCode;
        }
      });
    }

    // Modal background dismiss
    if (elements.artifactModal) {
      elements.artifactModal.addEventListener('click', (e) => {
        if (e.target === elements.artifactModal) {
          elements.artifactModal.classList.remove('active');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
