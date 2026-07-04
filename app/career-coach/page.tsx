'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const STARTER_PROMPTS = [
  'How do I switch careers into tech?',
  'How should I prepare for a job interview?',
  'What skills should I build for my career goal?',
  'How do I negotiate a higher salary?',
  'I feel stuck in my current job. What should I do?',
  'How can I use my SkillsFuture credits wisely?',
];

export default function CareerCoachPage() {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [userName, setUserName]   = useState('');
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.json())
      .then(({ data }) => { if (data?.name) setUserName(data.name.split(' ')[0]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Build Gemini-format history (exclude the message we're about to send)
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    try {
      const res = await fetch('/api/career-coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const { data, error } = await res.json();
      let reply: string;
      if (data?.reply) {
        reply = data.reply;
      } else if (res.status === 503) {
        reply = 'The Career Coach is not configured yet. Please contact the administrator.';
      } else if (res.status === 429 || error === 'quota_exceeded') {
        reply = 'I\'m currently at capacity. Please try again in a moment.';
      } else if (res.status === 401 || error === 'invalid_api_key') {
        reply = 'The Career Coach API key is invalid. Please contact the administrator.';
      } else {
        reply = 'Sorry, something went wrong. Please try again.';
      }
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: 'Connection error. Please try again.' }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [messages, loading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-176px)] md:h-[calc(100vh-120px)] max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          🎓
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Career Coach</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Cora · AI Career Advisor · Always available</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">

        {/* Welcome / empty state */}
        {isEmpty && (
          <div className="space-y-5 pt-4">
            <div className="card p-6 text-center space-y-2"
              style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1.5px solid #c7d2fe' }}>
              <p className="text-3xl">👋</p>
              <p className="font-bold text-lg" style={{ color: '#4338ca' }}>
                Hi{userName ? `, ${userName}` : ''}! I&apos;m Cora, your Career Coach.
              </p>
              <p className="text-sm" style={{ color: '#6366f1' }}>
                I&apos;m here to help you navigate your career journey — job search, skill building, career transitions, workplace challenges, and more.
              </p>
              <p className="text-xs mt-1" style={{ color: '#818cf8' }}>
                I only cover career topics. Ask me anything career-related!
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--muted)' }}>
                Suggested questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-sm px-4 py-3 rounded-xl transition-all hover:shadow-sm"
                    style={{
                      background: 'var(--muted-bg)',
                      border: '1.5px solid var(--card-border)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', minWidth: '2rem' }}>
                🎓
              </div>
            )}
            <div
              className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
              style={
                msg.role === 'user'
                  ? { background: 'var(--primary)', color: 'white', borderBottomRightRadius: '4px' }
                  : { background: 'white', color: 'var(--foreground)', border: '1.5px solid var(--card-border)', borderBottomLeftRadius: '4px' }
              }
            >
              {msg.text}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 mt-0.5"
                style={{ background: 'var(--primary-light)', color: 'var(--primary)', minWidth: '2rem' }}>
                {userName ? userName[0].toUpperCase() : 'U'}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', minWidth: '2rem' }}>
              🎓
            </div>
            <div className="px-4 py-3 rounded-2xl" style={{ background: 'white', border: '1.5px solid var(--card-border)', borderBottomLeftRadius: '4px' }}>
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 rounded-full inline-block"
                    style={{
                      background: '#a5b4fc',
                      animation: 'bounce 1.2s infinite',
                      animationDelay: `${i * 0.2}s`,
                    }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
        {!isEmpty && (
          <button
            onClick={() => setMessages([])}
            className="text-xs mb-2 px-2 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--muted)', background: 'transparent' }}
          >
            ↺ New conversation
          </button>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Cora a career question… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 resize-none text-sm px-4 py-3 rounded-xl outline-none transition-all"
            style={{
              background: 'white',
              border: '1.5px solid var(--card-border)',
              color: 'var(--foreground)',
              lineHeight: '1.5',
            }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="px-4 py-3 rounded-xl font-semibold text-sm transition-all shrink-0"
            style={{
              background: (!input.trim() || loading) ? 'var(--muted-bg)' : 'var(--primary)',
              color: (!input.trim() || loading) ? 'var(--muted)' : 'white',
              cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            Send ↑
          </button>
        </div>
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--muted)' }}>
          Cora is an AI coach. For critical career decisions, also consult a human professional.
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
