'use client';

import { useState } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface SectionScore {
  score: number;
  feedback: string;
  rewrite?: string;
  tip?: string;
  missing_skills?: string[];
  missing?: string[];
}

interface ScoreData {
  overall_score: number;
  grade: string;
  targetRole: string;
  sections: {
    headline: SectionScore;
    summary: SectionScore;
    skills: SectionScore;
    experience: SectionScore;
    completeness: SectionScore;
  };
  top_3_actions: string[];
  keywords_to_add: string[];
}

const GRADE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  B: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  C: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  D: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  F: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

const MAX_SCORES: Record<string, number> = {
  headline: 20, summary: 25, skills: 20, experience: 25, completeness: 10,
};

function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 rounded-full h-2" style={{ background: 'var(--muted-bg)' }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{score}/{max}</span>
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  headline: 'Headline', summary: 'Summary / About', skills: 'Skills Section',
  experience: 'Experience', completeness: 'Profile Completeness',
};

export default function LinkedInScorerPage() {
  const [profileText, setProfileText] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [result, setResult]           = useState<ScoreData | null>(null);
  const [expanded, setExpanded]       = useState<string | null>('headline');

  async function score() {
    if (profileText.trim().length < 50) {
      setError('Please paste at least 50 characters of your LinkedIn profile text.');
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch('/api/linkedin-scorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileText }),
    });
    const { data, error: e } = await res.json();
    if (e) setError(e);
    else setResult(data);
    setLoading(false);
  }

  const gradeStyle = result ? (GRADE_STYLE[result.grade] ?? GRADE_STYLE.C) : null;
  const scoreColor = result
    ? result.overall_score >= 80 ? '#15803d' : result.overall_score >= 60 ? '#1d4ed8' : result.overall_score >= 40 ? '#92400e' : '#b91c1c'
    : '#64748b';

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🔗 LinkedIn Profile Scorer</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Paste your LinkedIn profile text and get an AI-powered score with section-by-section feedback and rewrite suggestions.
        </p>
      </div>

      {/* How to get text */}
      <div className="rounded-xl px-4 py-3 text-xs space-y-1" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
        <p className="font-semibold">How to get your LinkedIn profile text:</p>
        <p>Go to your LinkedIn profile → select all text on the page (Ctrl+A / Cmd+A) → copy and paste it below.</p>
      </div>

      {/* Input */}
      {!result && (
        <div className="space-y-3">
          <textarea
            value={profileText}
            onChange={e => setProfileText(e.target.value)}
            placeholder="Paste your LinkedIn profile text here…"
            rows={10}
            className="w-full rounded-xl p-3 text-sm border outline-none resize-y"
            style={{ border: '1.5px solid var(--card-border)', color: 'var(--foreground)', background: 'white' }}
          />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{profileText.length} characters</p>
          {error && <p className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>}
          <button
            onClick={score}
            disabled={loading || profileText.trim().length < 50}
            className="btn-primary text-sm px-8"
            style={{ opacity: loading || profileText.trim().length < 50 ? 0.6 : 1 }}
          >
            {loading ? <><LoadingSpinner label="" /> Scoring…</> : '🔍 Score My Profile'}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => { setResult(null); setProfileText(''); }} className="btn-secondary text-sm">← Score Again</button>
          </div>

          {/* Overall score */}
          <div className="card p-6 flex items-center gap-6">
            <div className="text-center shrink-0">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold" style={{ background: gradeStyle?.bg, color: gradeStyle?.color, border: `3px solid ${gradeStyle?.border}` }}>
                {result.grade}
              </div>
              <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--muted)' }}>Grade</p>
            </div>
            <div className="flex-1">
              <p className="text-4xl font-bold" style={{ color: scoreColor }}>{result.overall_score}<span className="text-lg font-normal" style={{ color: 'var(--muted)' }}>/100</span></p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Optimised for: <strong style={{ color: 'var(--foreground)' }}>{result.targetRole}</strong></p>
              <div className="mt-3 space-y-1.5">
                {Object.entries(result.sections).map(([key, sec]) => (
                  <ScoreBar key={key} score={sec.score} max={MAX_SCORES[key] ?? 10} color={scoreColor} />
                ))}
              </div>
            </div>
          </div>

          {/* Top 3 actions */}
          <div className="card p-4 space-y-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>🎯 Top 3 Actions to Improve</p>
            {result.top_3_actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--primary)', fontSize: '0.6rem' }}>{i + 1}</span>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{a}</p>
              </div>
            ))}
          </div>

          {/* Section breakdown */}
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Section Breakdown</p>
            {Object.entries(result.sections).map(([key, sec]) => {
              const isOpen = expanded === key;
              return (
                <div key={key} className="card overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : key)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{SECTION_LABELS[key]}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold" style={{ color: scoreColor }}>{sec.score}/{MAX_SCORES[key] ?? 10}</span>
                      <span style={{ color: 'var(--muted)' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
                      <p className="text-sm mt-3" style={{ color: 'var(--foreground)' }}>{sec.feedback}</p>
                      {sec.rewrite && (
                        <div className="rounded-lg p-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: '#15803d' }}>✏️ Suggested Rewrite</p>
                          <p className="text-sm" style={{ color: '#15803d' }}>{sec.rewrite}</p>
                        </div>
                      )}
                      {sec.tip && (
                        <div className="rounded-lg p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: '#92400e' }}>💡 Tip</p>
                          <p className="text-sm" style={{ color: '#92400e' }}>{sec.tip}</p>
                        </div>
                      )}
                      {sec.missing_skills && sec.missing_skills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Skills to add:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sec.missing_skills.map((s, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c' }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {sec.missing && sec.missing.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Missing elements:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sec.missing.map((m, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Keywords */}
          <div className="card p-4 space-y-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>🔑 Keywords to Add</p>
            <div className="flex flex-wrap gap-1.5">
              {result.keywords_to_add.map((k, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{k}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
