import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';

export default function ChatPage() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatAccess = user?.chatAccess;

  useEffect(() => {
    if (chatAccess !== 'approved' || !token) return;
    loadMessages();
    const sock = io(window.location.origin, { auth: { token }, path: '/socket.io', transports: ['websocket', 'polling'] });
    sock.on('connect', () => setConnected(true));
    sock.on('disconnect', () => setConnected(false));
    sock.on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
    setSocket(sock);
    return () => { sock.disconnect(); };
  }, [chatAccess, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await api.get('/chat/messages');
      setMessages(res.data.messages);
    } catch { }
  }

  async function sendMessage() {
    if (!input.trim() || !socket) return;
    socket.emit('chat:message', { message: input.trim() });
    setInput('');
  }

  async function requestAccess() {
    setRequestLoading(true);
    try {
      await api.post('/auth/chat-access-request');
      setRequestSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.general'));
    } finally { setRequestLoading(false); }
  }

  if (chatAccess === 'none' || chatAccess === 'denied') {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="text-4xl mb-4">💬</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('chat.title')}</h2>
        <p className="text-sm text-gray-500 mb-6">{t('chat.noAccess')}</p>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
        {requestSent ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{t('chat.requestSent')}</div>
        ) : (
          <button onClick={requestAccess} disabled={requestLoading}
            className="px-6 py-2.5 text-sm font-medium text-white rounded-lg bg-gray-800 hover:bg-gray-900 disabled:opacity-50 transition-colors">
            {requestLoading ? t('common.loading') : t('chat.requestAccess')}
          </button>
        )}
      </div>
    );
  }

  if (chatAccess === 'pending') {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('chat.title')}</h2>
        <p className="text-sm text-gray-500">{t('chat.pending')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">{t('chat.title')}</h2>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-600' : 'text-gray-400'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          {connected ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">{t('common.noData')}</div>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMe ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {msg.userName.charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <span className="text-xs text-gray-400 mb-0.5">{isMe ? 'Siz' : msg.userName}</span>
                <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.message}
                </div>
                <span className="text-xs text-gray-300 mt-0.5">
                  {new Date(msg.createdAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={t('chat.typeMessage')}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
          maxLength={1000}
        />
        <button
          onClick={sendMessage} disabled={!input.trim() || !connected}
          className="px-5 py-2.5 text-sm font-medium text-white bg-gray-800 rounded-xl disabled:opacity-40 hover:bg-gray-900 transition-colors">
          {t('chat.send')}
        </button>
      </div>
    </div>
  );
}
