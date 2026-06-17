'use client';

import { useState, useEffect, useCallback } from 'react';
import type { QuizQuestion } from '@/lib/types';

type SkillStatus = {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  passed: boolean;
  bestScore: number | null;
  attempts: number;
};

type View = 'list' | 'generating' | 'quiz' | 'result';

const PRIORITY_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: '#fef2f2', color: '#dc2626', label: 'High Priority' },
  medium: { bg: '#fffbeb', color: '#d97706', label: 'Medium Priority' },
  low:    { bg: '#f0fdf4', color: '#16a34a', label: 'Lower Priority' },
};

export default function SkillQuizPage() {
  const [view, setView] = useState<View>('list');
  const [skills, setSkills] = useState<SkillStatus[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [error, setError] = useState('');

  // Quiz state
  const [quizSkill, setQuizSkill] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);

  // Result state
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoadingSkills(true);
    setError('');
    const res = await fetch('/api/skill-quiz/gaps');
    const { data, error: err } = await res.json();
    if (err) { setError(err); } else { setSkills(data ?? []); }
    setLoadingSkills(false);
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  async function startQuiz(skill: string) {
    setQuizSkill(skill);
    setView('generating');
    setError('');

    const res = await fetch('/api/skill-quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill }),
    });
    const { data, error: err } = await res.json();

    if (err || !data?.length) {
      setError('Could not generate questions. Please try again.');
      setView('list');
      return;
    }

    setQuestions(data);
    setAnswers(new Array(data.length).fill(null));
    setCurrentQ(0);
    setView('quiz');
  }

  async function submitQuiz() {
    setSubmitting(true);
    const correct = questions.reduce(
      (n, q, i) => n + (answers[i] === q.ans ? 1 : 0),
      0
    );
    const total = questions.length;

    const res = await fetch('/api/skill-quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill: quizSkill, score: correct, total }),
    });
    const { data } = await res.json();

    setScore(correct);
    setPassed(data?.passed ?? correct / total >= 0.8);
    setView('result');
    setSubmitting(false);
  }

  function selectAnswer(letter: string) {
    const updated = [...answers];
    updated[currentQ] = letter;
    setAnswers(updated);
  }

  function backToList() {
    setView('list');
    setQuestions([]);
    setAnswers([]);
    setCurrentQ(0);
    loadSkills();
  }

  // ── LIST VIEW ────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🧠 Skill Gap Quiz</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Answer 25 questions per skill. Score 80% or more (20/25) to advance and close that skill gap.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        {loadingSkills ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl skeleton" />)}
          </div>
        ) : skills.length === 0 ? (
          <div className="card p-10 text-center">
            <span className="text-5xl block mb-4">🎯</span>
            <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>No skill gaps found</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Run a skill gap analysis in Skills Navigator first to get your personalised quiz list.
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Skills', value: skills.length, icon: '📋', color: 'var(--primary)', bg: 'var(--primary-light)' },
                { label: 'Passed', value: skills.filter(s => s.passed).length, icon: '✅', color: '#16a34a', bg: '#f0fdf4' },
                { label: 'Remaining', value: skills.filter(s => !s.passed).length, icon: '⏳', color: '#d97706', bg: '#fffbeb' },
              ].map(s => (
                <div key={s.label} className="card p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: s.bg }}>
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Skill cards */}
            <div className="space-y-3">
              {skills.map(s => {
                const pc = PRIORITY_COLOR[s.priority] ?? PRIORITY_COLOR.low;
                return (
                  <div
                    key={s.skill}
                    className="card p-5 flex items-start gap-4"
                    style={{ borderLeft: `4px solid ${pc.color}` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{s.skill}</p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: pc.bg, color: pc.color }}
                        >
                          {pc.label}
                        </span>
                        {s.passed && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>
                            ✓ Passed
                          </span>
                        )}
                      </div>
                      {s.reason && (
                        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{s.reason}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
                        {s.attempts > 0 && (
                          <>
                            <span>Best score: <strong style={{ color: 'var(--foreground)' }}>{s.bestScore}/20</strong></span>
                            <span>{s.attempts} attempt{s.attempts !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => startQuiz(s.skill)}
                      className="btn-primary shrink-0 text-sm"
                      style={{ minWidth: '110px' }}
                    >
                      {s.passed ? 'Retry Quiz' : s.attempts > 0 ? 'Try Again' : 'Start Quiz →'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── GENERATING VIEW ──────────────────────────────────────
  if (view === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Generating quiz for <span style={{ color: 'var(--primary)' }}>{quizSkill}</span>…</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>AI is crafting 25 skill-specific questions tailored to Singapore professionals.</p>
      </div>
    );
  }

  // ── QUIZ VIEW ────────────────────────────────────────────
  if (view === 'quiz') {
    const q = questions[currentQ];
    const answered = answers[currentQ];
    const isLast = currentQ === questions.length - 1;
    const allAnswered = answers.every(a => a !== null);
    const progress = ((currentQ + 1) / questions.length) * 100;

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--primary)' }}>Skill Quiz</p>
            <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{quizSkill}</h1>
          </div>
          <button
            onClick={backToList}
            className="text-sm"
            style={{ color: 'var(--muted)' }}
          >
            ✕ Exit
          </button>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
            <span>Question {currentQ + 1} of {questions.length}</span>
            <span>{answers.filter(a => a !== null).length} answered</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'var(--muted-bg)' }}>
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'var(--primary)' }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="card p-6 space-y-5">
          {q.difficulty && (() => {
            const d = q.difficulty!;
            const badge = d === 'easy'
              ? { label: 'Easy', color: '#15803d', bg: '#dcfce7' }
              : d === 'medium'
              ? { label: 'Medium', color: '#b45309', bg: '#fef3c7' }
              : { label: 'Hard', color: '#dc2626', bg: '#fee2e2' };
            return (
              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'} {badge.label}
              </span>
            );
          })()}
          <p className="font-semibold leading-relaxed" style={{ color: 'var(--foreground)', fontSize: '1rem' }}>
            {q.q}
          </p>

          <div className="space-y-2.5">
            {q.opts.map(opt => {
              const letter = opt[0]; // "A", "B", "C", "D"
              const selected = answered === letter;
              return (
                <button
                  key={opt}
                  onClick={() => selectAnswer(letter)}
                  className="w-full text-left p-4 rounded-xl transition-all text-sm font-medium"
                  style={{
                    border: selected ? '2px solid var(--primary)' : '2px solid var(--card-border)',
                    background: selected ? 'var(--primary-light)' : 'transparent',
                    color: selected ? 'var(--primary)' : 'var(--foreground)',
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentQ(q => q - 1)}
            disabled={currentQ === 0}
            className="btn-secondary"
            style={{ opacity: currentQ === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>

          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background: i === currentQ
                    ? 'var(--primary)'
                    : answers[i] !== null
                    ? '#86efac'
                    : 'var(--card-border)',
                }}
                aria-label={`Go to question ${i + 1}`}
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
              onClick={() => setCurrentQ(q => q + 1)}
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

  // ── RESULT VIEW ──────────────────────────────────────────
  const total = questions.length;
  const pct = Math.round((score / total) * 100);

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 animate-fade-in pt-8">
      <div
        className="card p-10 space-y-4"
        style={{ borderTop: `4px solid ${passed ? '#16a34a' : '#dc2626'}` }}
      >
        <div className="text-6xl">{passed ? '🏆' : '📚'}</div>

        <div>
          <p className="text-4xl font-bold mb-1" style={{ color: passed ? '#16a34a' : '#dc2626' }}>
            {score} / {total}
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {pct}% — {passed ? 'Passed!' : 'Not passed'}
          </p>
        </div>

        {passed ? (
          <div className="p-4 rounded-xl text-sm" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <p className="font-semibold">Skill gap closed! 🎉</p>
            <p className="mt-1">
              You have demonstrated proficiency in <strong>{quizSkill}</strong>. This skill gap is now marked as advanced.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            <p className="font-semibold">Keep going — you need 80% (16/20) to pass.</p>
            <p className="mt-1">
              Review your knowledge of <strong>{quizSkill}</strong> and try again when ready.
            </p>
          </div>
        )}

        {/* Score breakdown */}
        <div className="flex justify-center gap-6 text-sm pt-2">
          <div>
            <p className="font-bold text-lg" style={{ color: '#16a34a' }}>{score}</p>
            <p style={{ color: 'var(--muted)' }}>Correct</p>
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: '#dc2626' }}>{total - score}</p>
            <p style={{ color: 'var(--muted)' }}>Incorrect</p>
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{pct}%</p>
            <p style={{ color: 'var(--muted)' }}>Score</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => startQuiz(quizSkill)} className="btn-secondary">
          Try Again
        </button>
        <button onClick={backToList} className="btn-primary">
          Back to Skill List →
        </button>
      </div>
    </div>
  );
}
