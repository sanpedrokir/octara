'use client';

import { useState } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Link from 'next/link';

interface MatchResult {
  match_score: number;
  verdict: string;
  matched_skills: string[];
  missing_skills: string[];
  transferable_skills: string[];
  top_strengths: string[];
  gaps_to_close: string[];
  apply_recommendation: string;
}

const VERDICT_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  'Strong Match':  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'Good Match':    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'Partial Match': { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  'Weak Match':    { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

function ScoreRing({ score }: { score: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#3b82f6' : score >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{score}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="10" fill="#94a3b8">%</text>
    </svg>
  );
}

export default function JobMatcherPage() {
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<MatchResult | null>(null);

  async function analyse() {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch('/api/job-matcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd }),
      });
      const { data: d, error: e } = await res.json() as { data: MatchResult | null; error: string | null };
      if (e) setError(e); else setData(d);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const verdictStyle = data ? (VERDICT_STYLES[data.verdict] ?? VERDICT_STYLES['Partial Match']) : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🎯 Job Description Matcher</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Paste a job description to see how well your profile matches and what gaps to close.
        </p>
      </div>

      {/* Input */}
      <div className="card p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Job Description</label>
          <textarea
            className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--card-border)', color: 'var(--foreground)', minHeight: '180px' }}
            placeholder="Paste the full job description here — the more detail, the better the match…"
            value={jd}
            onChange={e => setJd(e.target.value)}
          />
        </div>
        <button
          className="btn-primary w-full"
          onClick={analyse}
          disabled={loading || jd.trim().length < 50}
        >
          {loading ? 'Analysing…' : '🎯 Analyse Match'}
        </button>
        {error && (
          <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>
            {error.includes('CV') ? (
              <><Link href="/competency" style={{ color: 'var(--primary)' }}>Upload your CV</Link> first so we can match your skills.</>
            ) : error}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner label="Matching your profile to the JD…" />
        </div>
      )}

      {data && verdictStyle && (
        <div className="space-y-4 animate-fade-in">
          {/* Score + verdict */}
          <div className="card p-5 flex flex-wrap items-center gap-5 sm:gap-6 justify-center sm:justify-start">
            <ScoreRing score={data.match_score} />
            <div className="space-y-1 min-w-0">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-bold" style={{ background: verdictStyle.bg, color: verdictStyle.color, border: `1.5px solid ${verdictStyle.border}` }}>
                {data.verdict}
              </span>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Overall match score</p>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{data.apply_recommendation}</p>
            </div>
          </div>

          {/* Grid: matched + missing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4 space-y-2">
              <p className="text-sm font-semibold" style={{ color: '#15803d' }}>✓ Matched Skills ({data.matched_skills.length})</p>
              {data.matched_skills.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>No direct matches found.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.matched_skills.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-4 space-y-2">
              <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>✗ Missing Skills ({data.missing_skills.length})</p>
              {data.missing_skills.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>No critical gaps found.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.missing_skills.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Transferable */}
          {data.transferable_skills.length > 0 && (
            <div className="card p-4 space-y-2">
              <p className="text-sm font-semibold" style={{ color: '#7c3aed' }}>↗ Transferable Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {data.transferable_skills.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Strengths + gaps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.top_strengths.length > 0 && (
              <div className="card p-4 space-y-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>🌟 Your Strengths</p>
                <ul className="space-y-1">
                  {data.top_strengths.map((s, i) => <li key={i} className="text-sm" style={{ color: 'var(--foreground)' }}>• {s}</li>)}
                </ul>
              </div>
            )}
            {data.gaps_to_close.length > 0 && (
              <div className="card p-4 space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#b45309' }}>⚑ Close These Gaps</p>
                <ul className="space-y-1">
                  {data.gaps_to_close.map((s, i) => <li key={i} className="text-sm" style={{ color: 'var(--foreground)' }}>• {s}</li>)}
                </ul>
                <Link href="/learning-roadmap" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
                  See your Learning Roadmap →
                </Link>
              </div>
            )}
          </div>

          <button className="btn-secondary w-full" onClick={() => { setData(null); setJd(''); }}>
            Analyse Another Job →
          </button>
        </div>
      )}
    </div>
  );
}
