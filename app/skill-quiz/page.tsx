'use client';

import { useState, useEffect } from 'react';

type View = 'select' | 'loading' | 'quiz' | 'result';

interface SectorInfo { sector: string; count: number; }

interface Question {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
  difficulty: string | null;
}

const SECTOR_ICONS: Record<string, string> = {
  'Accountancy': '📊',
  'Aerospace': '✈️',
  'Air Transport': '🛫',
  'Arts and Entertainment': '🎭',
  'Built Environment': '🏗️',
  'Chemical': '⚗️',
  'Cleaning': '🧹',
  'Community and Social Services': '🤝',
  'Early Childhood Care and Education': '👶',
  'Education': '🎓',
  'Electronics': '🔌',
  'Energy and Power': '⚡',
  'Environmental Services': '🌱',
  'Financial Services': '💳',
  'Food Manufacturing': '🍽️',
  'Food Services': '🍜',
  'Hotel and Accommodation Services': '🏨',
  'Human Resource': '👥',
  'Infocomm Technology': '💻',
  'Insurance': '🛡️',
  'Land Transport': '🚌',
  'Landscape': '🌿',
  'Logistics': '📦',
  'Marine and Offshore': '⚓',
  'Media': '📺',
  'Medical Technology': '🏥',
  'Nursing': '💉',
  'Precision Engineering': '⚙️',
  'Public Safety': '🚨',
  'Real Estate': '🏠',
  'Retail': '🛒',
  'Sea Transport': '🚢',
  'Security': '🔒',
  'Social Service': '❤️',
  'Telecommunications': '📡',
  'Tourism': '🗺️',
  'Training and Adult Education': '📖',
  'Wholesale Trade': '🏭',
};

const DIFF_STYLE: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  easy:   { label: 'Easy',   color: '#15803d', bg: '#dcfce7', dot: '🟢' },
  medium: { label: 'Medium', color: '#b45309', bg: '#fef3c7', dot: '🟡' },
  hard:   { label: 'Hard',   color: '#dc2626', bg: '#fee2e2', dot: '🔴' },
};

const PASS_THRESHOLD = 0.8;
const TOTAL_QS = 30;

export default function WorkKnowledgeQuizPage() {
  const [view, setView]                 = useState<View>('select');
  const [sectors, setSectors]           = useState<SectorInfo[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [selectedSector, setSelectedSector] = useState('');
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [currentQ, setCurrentQ]         = useState(0);
  const [answers, setAnswers]           = useState<(string | null)[]>([]);
  const [score, setScore]               = useState(0);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    fetch('/api/skill-quiz/sectors')
      .then(r => r.json())
      .then(({ data }) => { setSectors(data ?? []); setLoadingSectors(false); })
      .catch(() => setLoadingSectors(false));
  }, []);

  async function startQuiz(sector: string) {
    setSelectedSector(sector);
    setView('loading');
    setError('');
    setShowExplanation(false);

    const res = await fetch(`/api/skill-quiz/sector-questions?sector=${encodeURIComponent(sector)}`);
    const { data, error: err } = await res.json();

    if (err || !data?.length) {
      setError('No questions available for this sector yet. Ask an admin to generate them.');
      setView('select');
      return;
    }

    setQuestions(data);
    setAnswers(new Array(data.length).fill(null));
    setCurrentQ(0);
    setView('quiz');
  }

  async function submitQuiz() {
    setSubmitting(true);
    const correct = questions.reduce((n, q, i) => n + (answers[i] === q.correct_answer ? 1 : 0), 0);
    setScore(correct);

    await fetch('/api/skill-quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill: selectedSector, score: correct, total: questions.length }),
    });

    setSubmitting(false);
    setView('result');
  }

  function selectAnswer(letter: string) {
    if (answers[currentQ]) return; // lock after selecting
    const updated = [...answers];
    updated[currentQ] = letter;
    setAnswers(updated);
    setShowExplanation(true);
  }

  function nextQuestion() {
    setShowExplanation(false);
    setCurrentQ(q => q + 1);
  }

  function backToSelect() {
    setView('select');
    setQuestions([]);
    setAnswers([]);
    setCurrentQ(0);
    setShowExplanation(false);
  }

  // ── SECTOR SELECT ─────────────────────────────────────────────────────────
  if (view === 'select') {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🧠 Work Knowledge Quiz</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Choose a sector. Answer 30 scenario-based questions. Score 80% or more (24/30) to pass.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        {loadingSectors ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-xl skeleton" />)}
          </div>
        ) : sectors.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <span className="text-5xl block">📋</span>
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>No question banks available yet</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              An admin needs to generate sector questions first from the Admin Panel → Sector Scenario Questions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sectors.map(s => {
              const icon = SECTOR_ICONS[s.sector] ?? '🏢';
              return (
                <button
                  key={s.sector}
                  onClick={() => startQuiz(s.sector)}
                  className="card p-4 text-left flex items-center gap-4 transition-all hover:shadow-md"
                  style={{ cursor: 'pointer' }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: 'var(--primary-light)' }}
                  >
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{s.sector}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {s.count.toLocaleString()} questions in bank
                    </p>
                  </div>
                  <span className="ml-auto text-lg shrink-0" style={{ color: 'var(--muted)' }}>→</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
          Loading <span style={{ color: 'var(--primary)' }}>{selectedSector}</span> quiz…
        </p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Selecting 30 random questions from the bank.</p>
      </div>
    );
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  if (view === 'quiz') {
    const q = questions[currentQ];
    const answered = answers[currentQ];
    const isLast = currentQ === questions.length - 1;
    const allAnswered = answers.every(a => a !== null);
    const progress = ((currentQ + 1) / questions.length) * 100;
    const diff = q.difficulty ? DIFF_STYLE[q.difficulty.toLowerCase()] : null;

    const options = [
      { letter: 'A', text: q.option_a },
      { letter: 'B', text: q.option_b },
      { letter: 'C', text: q.option_c },
      { letter: 'D', text: q.option_d },
    ];

    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--primary)' }}>Work Knowledge Quiz</p>
            <h1 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{selectedSector}</h1>
          </div>
          <button onClick={backToSelect} className="text-sm" style={{ color: 'var(--muted)' }}>✕ Exit</button>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
            <span>Question {currentQ + 1} of {questions.length}</span>
            <span>{answers.filter(a => a !== null).length} answered</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'var(--muted-bg)' }}>
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--primary)' }} />
          </div>
        </div>

        {/* Question card */}
        <div className="card p-6 space-y-5">
          {diff && (
            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: diff.bg, color: diff.color }}>
              {diff.dot} {diff.label}
            </span>
          )}

          <p className="font-semibold leading-relaxed" style={{ color: 'var(--foreground)', fontSize: '1rem' }}>
            {q.question}
          </p>

          <div className="space-y-2.5">
            {options.map(opt => {
              const isSelected = answered === opt.letter;
              const isCorrect  = opt.letter === q.correct_answer;
              const reveal     = !!answered;

              let bg = 'transparent';
              let border = 'var(--card-border)';
              let color = 'var(--foreground)';

              if (reveal && isCorrect) {
                bg = '#f0fdf4'; border = '#22c55e'; color = '#15803d';
              } else if (reveal && isSelected && !isCorrect) {
                bg = '#fef2f2'; border = '#ef4444'; color = '#dc2626';
              } else if (!reveal && isSelected) {
                bg = 'var(--primary-light)'; border = 'var(--primary)'; color = 'var(--primary)';
              }

              return (
                <button
                  key={opt.letter}
                  onClick={() => selectAnswer(opt.letter)}
                  disabled={!!answered}
                  className="w-full text-left p-4 rounded-xl transition-all text-sm font-medium"
                  style={{ border: `2px solid ${border}`, background: bg, color, cursor: answered ? 'default' : 'pointer' }}
                >
                  <span className="font-bold mr-2">{opt.letter}.</span>{opt.text}
                  {reveal && isCorrect && <span className="ml-2">✓</span>}
                  {reveal && isSelected && !isCorrect && <span className="ml-2">✗</span>}
                </button>
              );
            })}
          </div>

          {/* Explanation shown after answering */}
          {showExplanation && q.explanation && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#f8fafc', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Explanation: </span>
              {q.explanation}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { setCurrentQ(q => q - 1); setShowExplanation(!!answers[currentQ - 1]); }}
            disabled={currentQ === 0}
            className="btn-secondary"
            style={{ opacity: currentQ === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>

          {/* Dot nav */}
          <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentQ(i); setShowExplanation(!!answers[i]); }}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background: i === currentQ ? 'var(--primary)'
                    : answers[i] !== null ? '#86efac'
                    : 'var(--card-border)',
                }}
                aria-label={`Question ${i + 1}`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={submitQuiz}
              disabled={!allAnswered || submitting}
              className="btn-primary"
              style={{ opacity: !allAnswered || submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Submitting…' : allAnswered ? 'Submit Quiz ✓' : `Answer all (${answers.filter(a => a !== null).length}/${questions.length})`}
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              disabled={!answered}
              className="btn-primary"
              style={{ opacity: !answered ? 0.4 : 1 }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  const total = questions.length;
  const passed = score / total >= PASS_THRESHOLD;
  const pct = Math.round((score / total) * 100);

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 animate-fade-in pt-8">
      <div className="card p-10 space-y-4" style={{ borderTop: `4px solid ${passed ? '#16a34a' : '#dc2626'}` }}>
        <div className="text-6xl">{passed ? '🏆' : '📚'}</div>
        <div>
          <p className="text-4xl font-bold mb-1" style={{ color: passed ? '#16a34a' : '#dc2626' }}>
            {score} / {total}
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {pct}% — {passed ? 'Passed!' : 'Not passed'}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{selectedSector}</p>
        </div>

        {passed ? (
          <div className="p-4 rounded-xl text-sm" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <p className="font-semibold">Well done! 🎉</p>
            <p className="mt-1">You scored {pct}% on the <strong>{selectedSector}</strong> quiz. You need 80% (24/30) to pass — you cleared it.</p>
          </div>
        ) : (
          <div className="p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            <p className="font-semibold">Keep going — you need 80% (24/30) to pass.</p>
            <p className="mt-1">Review the <strong>{selectedSector}</strong> sector knowledge and try again when ready.</p>
          </div>
        )}

        <div className="flex justify-center gap-6 text-sm pt-2">
          {[
            { label: 'Correct',   value: score,         color: '#16a34a' },
            { label: 'Incorrect', value: total - score,  color: '#dc2626' },
            { label: 'Score',     value: `${pct}%`,     color: 'var(--foreground)' },
          ].map(s => (
            <div key={s.label}>
              <p className="font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
              <p style={{ color: 'var(--muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => startQuiz(selectedSector)} className="btn-secondary">Try Again</button>
        <button onClick={backToSelect} className="btn-primary">Choose Another Sector →</button>
      </div>
    </div>
  );
}
