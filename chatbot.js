(function () {
  const ACCENT = '#E8B84B';
  const NAVY = '#1A2E4A';
  const API_ENDPOINT = '/api/chat';
  const MAX_HISTORY = 10;

  let history = [];
  let isOpen = false;
  let isLoading = false;

  /* ── inject font ── */
  if (!document.querySelector('#lsy-pretendard')) {
    const link = document.createElement('link');
    link.id = 'lsy-pretendard';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css';
    document.head.appendChild(link);
  }

  /* ── styles ── */
  const style = document.createElement('style');
  style.textContent = `
    #lsy-chat-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${NAVY}; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(26,46,74,.35);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #lsy-chat-fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(26,46,74,.45); }
    #lsy-chat-fab svg { display: block; }

    #lsy-chat-window {
      position: fixed; bottom: 96px; right: 28px; z-index: 9998;
      width: 380px; max-width: calc(100vw - 40px);
      height: 540px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 20px;
      box-shadow: 0 8px 40px rgba(26,46,74,.22);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
      transform: translateY(16px) scale(.97); opacity: 0; pointer-events: none;
      transition: transform .25s cubic-bezier(.4,0,.2,1), opacity .25s;
    }
    #lsy-chat-window.open {
      transform: translateY(0) scale(1); opacity: 1; pointer-events: all;
    }

    #lsy-chat-header {
      background: ${NAVY}; padding: 16px 20px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    #lsy-chat-header .lsy-header-info { display: flex; align-items: center; gap: 10px; }
    #lsy-chat-header .lsy-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: ${ACCENT}; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; color: ${NAVY};
    }
    #lsy-chat-header .lsy-title { color: #fff; font-weight: 700; font-size: 15px; line-height: 1.2; }
    #lsy-chat-header .lsy-sub { color: rgba(255,255,255,.6); font-size: 12px; margin-top: 1px; }
    #lsy-chat-close {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: rgba(255,255,255,.7); line-height: 1;
      transition: color .15s;
    }
    #lsy-chat-close:hover { color: #fff; }

    #lsy-chat-messages {
      flex: 1; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }
    #lsy-chat-messages::-webkit-scrollbar { width: 4px; }
    #lsy-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #lsy-chat-messages::-webkit-scrollbar-thumb { background: #dde3ea; border-radius: 4px; }

    .lsy-msg { display: flex; gap: 8px; max-width: 100%; }
    .lsy-msg.user { flex-direction: row-reverse; }
    .lsy-msg-bubble {
      max-width: 78%; padding: 11px 14px; border-radius: 16px;
      font-size: 14px; line-height: 1.65; word-break: keep-all;
    }
    .lsy-msg.bot .lsy-msg-bubble {
      background: #F2F5F8; color: #1A2E4A; border-bottom-left-radius: 4px;
    }
    .lsy-msg.user .lsy-msg-bubble {
      background: ${NAVY}; color: #fff; border-bottom-right-radius: 4px;
    }
    .lsy-msg.error .lsy-msg-bubble {
      background: #FEE9E9; color: #c0392b; border-bottom-left-radius: 4px;
    }

    /* 로딩 점 애니메이션 */
    .lsy-dots { display: flex; gap: 4px; align-items: center; padding: 4px 0; }
    .lsy-dots span {
      width: 7px; height: 7px; border-radius: 50%; background: #9aa5b4;
      animation: lsy-bounce 1.2s infinite ease-in-out;
    }
    .lsy-dots span:nth-child(1) { animation-delay: 0s; }
    .lsy-dots span:nth-child(2) { animation-delay: .2s; }
    .lsy-dots span:nth-child(3) { animation-delay: .4s; }
    @keyframes lsy-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: .5; }
      40% { transform: translateY(-6px); opacity: 1; }
    }

    #lsy-chat-input-area {
      padding: 12px 14px; border-top: 1px solid #ECECEC;
      display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
    }
    #lsy-chat-input {
      flex: 1; border: 1.5px solid #D8DFE8; border-radius: 12px;
      padding: 10px 14px; font-family: inherit; font-size: 14px; color: ${NAVY};
      resize: none; outline: none; line-height: 1.5; max-height: 100px;
      transition: border-color .15s;
    }
    #lsy-chat-input:focus { border-color: ${NAVY}; }
    #lsy-chat-input::placeholder { color: #aab0bc; }
    #lsy-chat-send {
      width: 40px; height: 40px; border-radius: 50%; background: ${NAVY};
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background .15s, transform .1s;
    }
    #lsy-chat-send:hover { background: #243d62; }
    #lsy-chat-send:active { transform: scale(.93); }
    #lsy-chat-send:disabled { background: #cdd4dc; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  /* ── FAB button ── */
  const fab = document.createElement('button');
  fab.id = 'lsy-chat-fab';
  fab.setAttribute('aria-label', '채팅 상담 열기');
  fab.innerHTML = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="${ACCENT}"/>
      <circle cx="8" cy="11" r="1.2" fill="${NAVY}"/>
      <circle cx="12" cy="11" r="1.2" fill="${NAVY}"/>
      <circle cx="16" cy="11" r="1.2" fill="${NAVY}"/>
    </svg>`;
  document.body.appendChild(fab);

  /* ── chat window ── */
  const win = document.createElement('div');
  win.id = 'lsy-chat-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'LSY 마케팅 상담 챗봇');
  win.innerHTML = `
    <div id="lsy-chat-header">
      <div class="lsy-header-info">
        <div class="lsy-avatar">L</div>
        <div>
          <div class="lsy-title">LSY 마케팅 어시스턴트</div>
          <div class="lsy-sub">서비스 · 상담 안내</div>
        </div>
      </div>
      <button id="lsy-chat-close" aria-label="닫기">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div id="lsy-chat-messages"></div>
    <div id="lsy-chat-input-area">
      <textarea id="lsy-chat-input" placeholder="궁금한 점을 물어보세요…" rows="1"></textarea>
      <button id="lsy-chat-send" aria-label="전송">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2.2" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>`;
  document.body.appendChild(win);

  /* ── refs ── */
  const messagesEl = win.querySelector('#lsy-chat-messages');
  const inputEl = win.querySelector('#lsy-chat-input');
  const sendBtn = win.querySelector('#lsy-chat-send');
  const closeBtn = win.querySelector('#lsy-chat-close');

  /* ── helpers ── */
  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `lsy-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'lsy-msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function showLoading() {
    const wrap = document.createElement('div');
    wrap.className = 'lsy-msg bot';
    wrap.id = 'lsy-loading-msg';
    wrap.innerHTML = `<div class="lsy-msg-bubble"><div class="lsy-dots"><span></span><span></span><span></span></div></div>`;
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  function removeLoading() {
    const el = document.getElementById('lsy-loading-msg');
    if (el) el.remove();
  }

  function setInputState(disabled) {
    inputEl.disabled = disabled;
    sendBtn.disabled = disabled;
    isLoading = disabled;
  }

  /* ── auto-resize textarea ── */
  inputEl.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });

  /* ── open / close ── */
  function openChat() {
    isOpen = true;
    win.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    inputEl.focus();
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  /* ── send message ── */
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';

    addMessage('user', text);

    history.push({ role: 'user', content: text });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

    setInputState(true);
    showLoading();

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);

      const data = await res.json();
      const reply = data.reply || '응답을 받지 못했습니다.';

      removeLoading();
      addMessage('bot', reply);
      history.push({ role: 'assistant', content: reply });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

    } catch (err) {
      removeLoading();
      addMessage('error', '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      console.error('[LSY Chat]', err);
    } finally {
      setInputState(false);
      inputEl.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  /* ── welcome message (1초 후) ── */
  setTimeout(() => {
    addMessage('bot', '안녕하세요! 👋 LSY마케팅 상담 어시스턴트입니다.\n서비스, 요금, 진행 과정 등 궁금한 점을 편하게 물어보세요.');
    openChat();
  }, 1000);

})();
