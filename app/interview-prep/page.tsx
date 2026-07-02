'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Link from 'next/link';

interface Question {
  id: number;
  type: 'behavioral' | 'technical' | 'situational';
  question: string;
  tip: string;
}

interface PrepData {
  role: string;
  questions: Question[];
}

interface Feedback {
  score: number;
  grade: string;
  strengths: string[];
  improvements: string[];
  model_answer_snippet: string;
  star_tip: string;
}

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  behavioral:  { bg: '#eff6ff', color: '#1d4ed8' },
  technical:   { bg: '#f0fdf4', color: '#15803d' },
  situational: { bg: '#faf5ff', color: '#7c3aed' },
};

const GRADE_COLOR: Record<string, string> = {
  Strong: '#15803d',
  Good: '#1d4ed8',
  'Needs Work': '#b45309',
  Weak: '#b91c1c',
};

export default function InterviewPrepPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<PrepData | null>(null);

  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch('/api/interview-prep')
      .then(r => r.json())
      .then(({ data: d, error: e }) => {
        if (e) { setError(e); } else { setData(d); }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load questions.'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  function regenerate() {
    setData(null);
    setCurrent(0);
    setAnswer('');
    setFeedback(null);
    setAnsweredCount(0);
    load();
  }

  async function submitAnswer() {
    if (!data || !answer.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: data.questions[current].question, answer, role: data.role }),
      });
      const { data: fb, error: e } = await res.json() as { data: Feedback | null; error: string | null };
      if (e) { alert(e); } else { setFeedback(fb); setAnsweredCount(c => c + 1); }
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    if (!data) return;
    const next = (current + 1) % data.questions.length;
    setCurrent(next);
    setAnswer('');
    setFeedback(null);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner label="Generating interview questions…" /></div>;

  if (error === 'NO_CAREER_GOAL') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">🎤</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Set your career goal first</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Interview questions are tailored to your target role.</p>
        <Link href="/career" className="btn-primary inline-block">Go to Career Goal →</Link>
      </div>
    );
  }

  if (error) return (
    <div className="card p-6 max-w-lg mx-auto mt-16 text-center space-y-3">
      <p className="text-2xl">⚠️</p>
      <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      <button className="btn-secondary" onClick={load}>Retry</button>
    </div>
  );

  if (!data) return null;

  const q = data.questions[current];
  const badge = TYPE_BADGE[q.type] ?? TYPE_BADGE.behavioral;

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🎤 Interview Prep Coach</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Practise for <strong style={{ color: 'var(--foreground)' }}>{data.role}</strong> · {answeredCount}/{data.questions.length} answered
          </p>
        </div>
        <button className="btn-secondary text-xs shrink-0" onClick={regenerate}>↺ New Set</button>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 flex-wrap">
        {data.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); setAnswer(''); setFeedback(null); }}
            className="w-7 h-7 rounded-full text-xs font-bold transition-all"
            style={{
              background: i === current ? 'var(--primary)' : '#e2e8f0',
              color: i === current ? 'white' : '#64748b',
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize" style={{ background: badge.bg, color: badge.color }}>
            {q.type}
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Q{q.id} of {data.questions.length}</span>
        </div>

        <p className="text-base font-semibold leading-relaxed" style={{ color: 'var(--foreground)' }}>{q.question}</p>

        <div className="rounded-lg px-3 py-2.5 text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
          💡 <strong>Tip:</strong> {q.tip}
        </div>

        <textarea
          className="w-full rounded-xl border p-3 text-sm resize-none focus:outline-none focus:ring-2"
          style={{ borderColor: 'var(--card-border)', minHeight: '120px', color: 'var(--foreground)', background: 'white' }}
          placeholder="Type your answer here… aim for 2-3 minutes if spoken aloud"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={submitting}
        />

        <button
          className="btn-primary w-full"
          onClick={submitAnswer}
          disabled={submitting || !answer.trim()}
        >
          {submitting ? 'Analysing…' : 'Get AI Feedback'}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl" style={{ background: '#eff6ff', color: GRADE_COLOR[feedback.grade] ?? '#1d4ed8' }}>
              {feedback.score}/10
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: GRADE_COLOR[feedback.grade] ?? '#1d4ed8' }}>{feedback.grade}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>AI score</p>
            </div>
          </div>

          {feedback.strengths.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1.5" style={{ color: '#15803d' }}>✓ Strengths</p>
              <ul className="space-y-1">
                {feedback.strengths.map((s, i) => <li key={i} className="text-sm" style={{ color: 'var(--foreground)' }}>• {s}</li>)}
              </ul>
            </div>
          )}

          {feedback.improvements.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1.5" style={{ color: '#b45309' }}>⚑ Improve</p>
              <ul className="space-y-1">
                {feedback.improvements.map((s, i) => <li key={i} className="text-sm" style={{ color: 'var(--foreground)' }}>• {s}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
            <strong>Model answer snippet:</strong> {feedback.model_answer_snippet}
          </div>

          <div className="rounded-lg px-3 py-2.5 text-xs" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
            <strong>STAR tip:</strong> {feedback.star_tip}
          </div>

          <button className="btn-secondary w-full" onClick={nextQuestion}>
            Next Question →
          </button>
        </div>
      )}
    </div>
  );
}
