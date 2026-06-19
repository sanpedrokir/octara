'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import QuizLeaderboard from '../ui/QuizLeaderboard';

type View = 'loading' | 'quiz' | 'result' | 'error';

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

const DIFF_STYLE: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  easy:   { label: 'Easy',   color: '#15803d', bg: '#dcfce7', dot: '🟢' },
  medium: { label: 'Medium', color: '#b45309', bg: '#fef3c7', dot: '🟡' },
  hard:   { label: 'Hard',   color: '#dc2626', bg: '#fee2e2', dot: '🔴' },
};

const PASS_THRESHOLD = 0.8;

export default function WorkKnowledgeQuizPage() {
  const [view, setView]               = useState<View>('loading');
  const [careerSector, setCareerSector] = useState('');
  const [errorMsg, setErrorMsg]       = useState('');
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [currentQ, setCurrentQ]       = useState(0);
  const [answers, setAnswers]         = useState<(string | null)[]>([]);
  const [score, setScore]             = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [lbRefresh, setLbRefresh]     = useState(0);

  const loadQuiz = useCallback(async (sector: string) => {
    setView('loading');
    setShowExplanation(false);
    try {
      const res = await fetch(`/api/skill-quiz/sector-questions?sector=${encodeURIComponent(sector)}`);
      const { data, error } = await res.json();
      if (error || !data?.length) {
        setErrorMsg(error || 'No questions available for your sector yet. Ask an admin to generate them.');
        setView('error');
        return;
      }
      setQuestions(data);
      setAnswers(new Array(data.length).fill(null));
      setCurrentQ(0);
      setView('quiz');
    } catch {
      setErrorMsg('Failed to load questions. Please refresh.');
      setView('error');
    }
  }, []);

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.json())
      .then(({ data }) => {
        const sector = (data?.career_sector ?? '').trim();
        if (!sector) {
          setErrorMsg('NO_CAREER_GOAL');
          setView('error');
          return;
        }
        setCareerSector(sector);
        loadQuiz(sector);
      })
      .catch(() => {
        setErrorMsg('Failed to load your profile. Please refresh.');
        setView('error');
      });
  }, [loadQuiz]);

  async function submitQuiz() {
    setSubmitting(true);
    const correct = questions.reduce((n, q, i) => n + (answers[i] === q.correct_answer ? 1 : 0), 0);
    setScore(correct);

    try {
      await fetch('/api/skill-quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: careerSector, score: correct, total: questions.length }),
      });
    } catch { /* non-fatal */ }

    setSubmitting(false);
    setView('result');
    setLbRefresh(n => n + 1); // trigger leaderboard refresh
  }

  function selectAnswer(letter: string) {
    if (answers[currentQ]) return;
    const updated = [...answers];
    updated[currentQ] = letter;
    setAnswers(updated);
    setShowExplanation(true);
  }

  function nextQuestion() {
    setShowExplanation(false);
    setCurrentQ(q => q + 1);
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 animate-spin"
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
          {careerSector ? `Loading ${careerSector} quiz…` : 'Detecting your sector…'}
        </p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Selecting 20 random questions from the question bank.
        </p>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (view === 'error') {
    if (errorMsg === 'NO_CAREER_GOAL') {
      return (
        <div className="max-w-md mx-auto mt-16 text-center space-y-4">
          <p className="text-4xl">🎯</p>
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Set your career goal first</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The quiz is tailored to your career sector. Set your career goal so we know which sector to test you on.
          </p>
          <Link href="/career" className="btn-primary inline-block">Set Career Goal →</Link>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">⚠️</p>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{errorMsg}</p>
        <button onClick={() => careerSector ? loadQuiz(careerSector) : window.location.reload()} className="btn-primary">
          Retry
        </button>
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
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--primary)' }}>
              🧠 Work Knowledge Quiz
            </p>
            <h1 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{careerSector}</h1>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            Pass: 80% (16/20)
          </span>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
            <span>Question {currentQ + 1} of {questions.length}</span>
            <span>{answers.filter(a => a !== null).length} answered</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'var(--muted-bg)' }}>
            <div className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'var(--primary)' }} />
          </div>
        </div>

        {/* Question card */}
        <div className="card p-6 space-y-5">
          {diff && (
            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: diff.bg, color: diff.color }}>
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

              let bg = 'transparent', border = 'var(--card-border)', color = 'var(--foreground)';
              if (reveal && isCorrect) { bg = '#f0fdf4'; border = '#22c55e'; color = '#15803d'; }
              else if (reveal && isSelected && !isCorrect) { bg = '#fef2f2'; border = '#ef4444'; color = '#dc2626'; }
              else if (!reveal && isSelected) { bg = 'var(--primary-light)'; border = 'var(--primary)'; color = 'var(--primary)'; }

              return (
                <button key={opt.letter} onClick={() => selectAnswer(opt.letter)} disabled={!!answered}
                  className="w-full text-left p-4 rounded-xl transition-all text-sm font-medium"
                  style={{ border: `2px solid ${border}`, background: bg, color, cursor: answered ? 'default' : 'pointer' }}>
                  <span className="font-bold mr-2">{opt.letter}.</span>{opt.text}
                  {reveal && isCorrect && <span className="ml-2">✓</span>}
                  {reveal && isSelected && !isCorrect && <span className="ml-2">✗</span>}
                </button>
              );
            })}
          </div>

          {showExplanation && q.explanation && (
            <div className="p-3 rounded-lg text-sm"
              style={{ background: '#f8fafc', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Explanation: </span>
              {q.explanation}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { setCurrentQ(q => q - 1); setShowExplanation(!!answers[currentQ - 1]); }}
            disabled={currentQ === 0} className="btn-secondary" style={{ opacity: currentQ === 0 ? 0.4 : 1 }}>
            ← Previous
          </button>

          <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
            {questions.map((_, i) => (
              <button key={i} onClick={() => { setCurrentQ(i); setShowExplanation(!!answers[i]); }}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background: i === currentQ ? 'var(--primary)'
                    : answers[i] !== null ? '#86efac' : 'var(--card-border)',
                }}
                aria-label={`Question ${i + 1}`} />
            ))}
          </div>

          {isLast ? (
            <button onClick={submitQuiz} disabled={!allAnswered || submitting} className="btn-primary"
              style={{ opacity: !allAnswered || submitting ? 0.6 : 1 }}>
              {submitting ? 'Submitting…' : allAnswered ? 'Submit ✓' : `${answers.filter(a => a !== null).length}/${questions.length} answered`}
            </button>
          ) : (
            <button onClick={nextQuestion} disabled={!answered} className="btn-primary"
              style={{ opacity: !answered ? 0.4 : 1 }}>
              Next →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  const total   = questions.length;
  const passed  = score / total >= PASS_THRESHOLD;
  const pct     = Math.round((score / total) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Score card */}
        <div className="card p-6 space-y-4 text-center"
          style={{ borderTop: `4px solid ${passed ? '#16a34a' : '#dc2626'}` }}>
          <div className="text-5xl">{passed ? '🏆' : '📚'}</div>
          <div>
            <p className="text-4xl font-bold" style={{ color: passed ? '#16a34a' : '#dc2626' }}>
              {score} / {total}
            </p>
            <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--foreground)' }}>
              {pct}% — {passed ? 'Passed!' : 'Not passed'}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{careerSector}</p>
          </div>

          {passed ? (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
              Well done! 🎉 You scored {pct}% — check your rank on the leaderboard!
            </div>
          ) : (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              Need 80% (16/20) to pass. Retake to climb the leaderboard!
            </div>
          )}

          <div className="flex justify-center gap-6 text-sm">
            {[
              { label: 'Correct',   value: score,        color: '#16a34a' },
              { label: 'Incorrect', value: total - score, color: '#dc2626' },
              { label: 'Score',     value: `${pct}%`,    color: 'var(--foreground)' },
            ].map(s => (
              <div key={s.label}>
                <p className="font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          <button onClick={() => loadQuiz(careerSector)} className="btn-primary w-full">
            🔄 Retake Quiz
          </button>
        </div>

        {/* Leaderboard */}
        <div className="card p-5">
          <QuizLeaderboard sector={careerSector} refreshTrigger={lbRefresh} />
        </div>
      </div>
    </div>
  );
}
