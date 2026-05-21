import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadMessages(); }, []);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await api.get('/chat/messages');
      setMessages(Array.isArray(res.data.messages) ? res.data.messages : []);
    } catch {
      setError('Qeydlər yüklənmədi');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      const res = await api.post('/chat/message', { message: text });
      if (res.data.message) {
        setMessages(prev => [...prev, res.data.message]);
      }
    } catch {
      setError('Göndərilmədi');
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Qeydlər</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{messages.length} qeyd</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 999 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Aktiv</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#94a3b8', fontSize: 13 }}>
            <div className="loading-spinner" />
            Yüklənir...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#94a3b8' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <p style={{ fontSize: 13, margin: 0 }}>Hələ heç bir qeyd yoxdur</p>
            <p style={{ fontSize: 12, margin: 0 }}>Aşağıdan ilk qeydinizi yazın</p>
          </div>
        )}

        {!loading && messages.map((msg) => {
          const isMe = msg.userId === user?.id;
          return (
            <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isMe ? 'row-reverse' : 'row' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: isMe ? '#3b82f6' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {msg.userName.charAt(0).toUpperCase()}
              </div>
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{isMe ? 'Siz' : msg.userName}</span>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: 16,
                  borderBottomRightRadius: isMe ? 4 : 16,
                  borderBottomLeftRadius: isMe ? 16 : 4,
                  background: isMe ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : '#f1f5f9',
                  color: isMe ? '#fff' : '#0f172a',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  {msg.message}
                </div>
                <span style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
                  {new Date(msg.createdAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Qeyd yazın..."
          maxLength={1000}
          style={{ flex: 1, padding: '10px 16px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 12, outline: 'none', background: '#fff', color: '#0f172a' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            padding: '10px 20px',
            background: input.trim() && !sending ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : '#e2e8f0',
            color: input.trim() && !sending ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}>
          {sending ? (
            <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
          Göndər
        </button>
      </div>
    </div>
  );
}
