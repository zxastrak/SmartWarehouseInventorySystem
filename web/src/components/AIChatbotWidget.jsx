import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { aiApi } from '../utils/api.js';
import '../styles/chatbot.css';

// Helper ringan untuk merender format markdown sederhana (bold, list, bullet, line-breaks)
function renderFormattedMessage(text) {
  if (!text) return null;

  // Pisahkan per paragraf / baris
  const lines = text.split('\n');
  const elements = [];

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`br-${lineIdx}`} style={{ height: '6px' }} />);
      return;
    }

    // List item dengan angka (1. 2. dst)
    const isNumbered = /^\d+\.\s+(.+)/.exec(trimmed);
    // List item dengan bullet (- atau *)
    const isBullet = /^[-*]\s+(.+)/.exec(trimmed);

    let content = trimmed;
    let isListItem = false;

    if (isNumbered) {
      content = isNumbered[1];
      isListItem = true;
    } else if (isBullet) {
      content = isBullet[1];
      isListItem = true;
    }

    // Parsing sederhana untuk **bold** dan `code`
    const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={pIdx}>{part.slice(1, -1)}</code>;
      }
      return part;
    });

    if (isListItem) {
      elements.push(
        <div key={`li-${lineIdx}`} style={{ display: 'flex', gap: '6px', margin: '3px 0 3px 6px' }}>
          <span style={{ color: '#5c732b', fontWeight: 'bold' }}>•</span>
          <span style={{ flex: 1 }}>{parts}</span>
        </div>
      );
    } else {
      elements.push(
        <p key={`p-${lineIdx}`} style={{ margin: '0 0 4px 0' }}>
          {parts}
        </p>
      );
    }
  });

  return elements;
}

const QUICK_PROMPTS = [
  'SOP Inbound Dock',
  'Penanganan Barang Rusak',
  'Aturan Anti Self-Approval PO',
  'Alur Outbound Gudang',
];

export default function AIChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'init',
      sender: 'ai',
      text: 'Halo! Saya asisten operasional SUSUNO. Ada yang bisa saya bantu terkait SOP gudang, alur Inbound/Outbound, atau panduan sistem hari ini?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const windowRef = useRef(null);

  // Fungsi untuk menempatkan chatbot selalu di paling atas stack Top Layer browser
  const bringToTop = useCallback(() => {
    const el = isOpen ? windowRef.current : launcherRef.current;
    if (!el || typeof el.showPopover !== 'function') return;

    try {
      if (el.matches && el.matches(':popover-open')) {
        el.hidePopover();
      }
    } catch (_) {}

    try {
      el.showPopover();
    } catch (_) {}
  }, [isOpen]);

  // Pantau setiap kali ada modal dialog yang terbuka (showModal) di seluruh aplikasi
  useEffect(() => {
    bringToTop();

    // Observe kapanpun ada <dialog> yang mendapatkan atribut open (showModal)
    const observer = new MutationObserver((mutations) => {
      let shouldPromote = false;
      for (const m of mutations) {
        if (
          m.type === 'attributes' &&
          m.attributeName === 'open' &&
          m.target &&
          m.target.tagName === 'DIALOG'
        ) {
          shouldPromote = true;
          break;
        }
      }
      if (shouldPromote) {
        bringToTop();
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['open'],
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [bringToTop]);

  // Auto-scroll ke pesan terbaru
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, isLoading]);

  // Fungsi pengiriman pesan
  const handleSendMessage = async (textToSend) => {
    const query = typeof textToSend === 'string' ? textToSend.trim() : inputMessage.trim();
    if (!query || isLoading) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Tambahkan pesan user ke antarmuka
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: currentTime,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Siapkan riwayat percakapan (dibatasi 10 pesan terakhir)
      const history = messages
        .filter((m) => m.id !== 'init' && m.text)
        .slice(-10)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        }));

      const res = await aiApi.chat({
        message: query,
        history: history,
      });

      const replyText = res.reply || 'Maaf, tidak ada tanggapan yang diterima dari server.';

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: '⚠️ Terjadi kendala teknis saat menghubungi server AI. Pastikan server backend SUSUNO aktif di port 5000.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset percakapan
  const handleResetChat = () => {
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: 'ai',
        text: 'Percakapan telah direset. Silakan ajukan pertanyaan seputar operasional atau SOP gudang SUSUNO.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return createPortal(
    <>
      {/* Floating Edge-Docked Action Button — Native Top Layer Popover */}
      {!isOpen && (
        <button
          ref={launcherRef}
          popover="manual"
          className="susuno-ai-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Buka Chatbot AI SUSUNO"
          title="Buka AI Asisten SUSUNO"
        >
          <div className="susuno-ai-launcher-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span>AI Asisten</span>
          <span className="susuno-ai-launcher-badge">SOP</span>
        </button>
      )}

      {/* Pop-up Chat Window — Native Top Layer Popover */}
      {isOpen && (
        <div
          ref={windowRef}
          popover="manual"
          className="susuno-ai-window"
          role="dialog"
          aria-label="Jendela Chatbot SUSUNO"
        >
          {/* Header */}
          <div className="susuno-ai-header">
            <div className="susuno-ai-header-info">
              <div className="susuno-ai-header-avatar">🤖</div>
              <div className="susuno-ai-header-titles">
                <h4>Asisten AI SUSUNO</h4>
                <div className="susuno-ai-header-status">
                  <span className="susuno-ai-status-dot" />
                  <span>Knowledge Base Aktif</span>
                </div>
              </div>
            </div>
            <div className="susuno-ai-header-actions">
              <button
                className="susuno-ai-header-btn"
                onClick={handleResetChat}
                title="Bersihkan Percakapan"
                aria-label="Bersihkan Percakapan"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
              <button
                className="susuno-ai-header-btn"
                onClick={() => setIsOpen(false)}
                title="Tutup Chat"
                aria-label="Tutup Chat"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="susuno-ai-messages">
            {messages.map((m) => (
              <div key={m.id} className={`susuno-ai-bubble-row ${m.sender}`}>
                {m.sender === 'ai' && <div className="susuno-ai-avatar-tiny">🤖</div>}
                <div className="susuno-ai-bubble">
                  {renderFormattedMessage(m.text)}
                  <div className="susuno-ai-bubble-time">{m.time}</div>
                </div>
              </div>
            ))}

            {/* Typing Indicator saat menunggu jawaban */}
            {isLoading && (
              <div className="susuno-ai-bubble-row ai">
                <div className="susuno-ai-avatar-tiny">🤖</div>
                <div className="susuno-ai-typing">
                  <span className="susuno-ai-typing-dot" />
                  <span className="susuno-ai-typing-dot" />
                  <span className="susuno-ai-typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="susuno-ai-chips-wrap">
            <div className="susuno-ai-chips-label">Pertanyaan Cepat:</div>
            <div className="susuno-ai-chips">
              {QUICK_PROMPTS.map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  className="susuno-ai-chip"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form
            className="susuno-ai-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="susuno-ai-input"
              placeholder="Tanyakan SOP gudang, PO, dock..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="susuno-ai-send-btn"
              disabled={isLoading || !inputMessage.trim()}
              title="Kirim Pertanyaan"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>,
    document.body
  );
}
