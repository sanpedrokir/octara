'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoadingSpinner from '../ui/LoadingSpinner';

interface MarketSkill {
  name: string;
  category: 'Technical' | 'Tools & Platforms' | 'Soft Skills' | 'Domain Knowledge';
  importance: 'high' | 'medium' | 'low';
  frequency: number;
}

interface MarketData {
  skills: MarketSkill[];
  jobCount: number;
  totalListings: number;
  sampleCompanies: string[];
}

interface UserSkill {
  skill_title: string;
}

const CATEGORY_STYLE: Record<MarketSkill['category'], { bg: string; color: string; border: string }> = {
  'Technical':          { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'Tools & Platforms':  { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  'Soft Skills':        { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'Domain Knowledge':   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

const IMPORTANCE_LABEL: Record<string, string> = {
  high:   'High demand',
  medium: 'Moderate',
  low:    'Niche',
};

const IMPORTANCE_COLOR: Record<string, string> = {
  high:   '#15803d',
  medium: '#92400e',
  low:    '#6b7280',
};

const CATEGORIES: MarketSkill['category'][] = ['Technical', 'Tools & Platforms', 'Soft Skills', 'Domain Knowledge'];

function tokenize(s: string) {
  return s.toLowerCase().split(/[\s\-\/&,()]+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 1);
}

function fuzzyMatch(a: string, b: string): boolean {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.length || !tb.length) return false;
  const [shorter, longerSet] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return shorter.every(t => longerSet.has(t));
}

export default function MarketSkillsPage() {
  const [jobTitle, setJobTitle]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [data, setData]                 = useState<MarketData | null>(null);
  const [userSkills, setUserSkills]     = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<MarketSkill['category'] | 'All'>('All');

  // Load user's competency profile for comparison
  useEffect(() => {
    fetch('/api/competency/profile')
      .then(r => r.json())
      .then(({ data: rows }) => {
        if (Array.isArray(rows)) setUserSkills(rows.map((r: UserSkill) => r.skill_title));
      })
      .catch(() => {});
  }, []);

  async function search() {
    if (!jobTitle.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    setActiveCategory('All');

    const res = await fetch('/api/market-skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: jobTitle.trim() }),
    });
    const { data: d, error: e } = await res.json();
    if (e) setError(e);
    else setData(d);
    setLoading(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') search();
  }

  const skills = data?.skills ?? [];
  const filtered = activeCategory === 'All' ? skills : skills.filter(s => s.category === activeCategory);

  const matchedCount = skills.filter(s => userSkills.some(u => fuzzyMatch(u, s.name))).length;
  const highDemandCount = skills.filter(s => s.importance === 'high').length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Market Skills Explorer</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          See what skills Singapore employers are actively hiring for, extracted from live job listings on MyCareersFuture.
        </p>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Enter a job title to explore</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            onKeyDown={handleKey}
            placeholder="e.g. Lead Software Engineer, Data Analyst, HR Manager…"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
            style={{
              border: '1.5px solid var(--card-border)',
              color: 'var(--foreground)',
              background: 'white',
            }}
          />
          <button
            onClick={search}
            disabled={loading || !jobTitle.trim()}
            className="btn-primary text-sm px-5 shrink-0"
            style={{ opacity: loading || !jobTitle.trim() ? 0.7 : 1 }}
          >
            {loading ? <LoadingSpinner label="" /> : '🔍 Search'}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Pulls up to 10 recent listings from MyCareersFuture, then AI extracts and aggregates the required skills.
        </p>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="card p-4 text-sm" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="card p-8 flex flex-col items-center gap-3">
          <LoadingSpinner label="" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Searching MyCareersFuture and extracting skills with AI…
          </p>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="space-y-5">

          {/* Source badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
              Based on {data.jobCount} live listings · {data.totalListings.toLocaleString()} total found
            </span>
            <a
              href={`https://www.mycareersfuture.gov.sg/search?search=${encodeURIComponent(jobTitle)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: 'var(--muted-bg)', color: 'var(--primary)', border: '1px solid var(--card-border)' }}
            >
              View all on MyCareersFuture ↗
            </a>
          </div>

          {/* Sample companies */}
          {data.sampleCompanies.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Listings from: {data.sampleCompanies.join(' · ')}
            </p>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: '#1e40af' }}>{skills.length}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Skills Found</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: '#b91c1c' }}>{highDemandCount}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>High Demand</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: '#15803d' }}>{matchedCount}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>You Already Have</p>
            </div>
          </div>

          {/* Profile match banner */}
          {userSkills.length > 0 && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
              <span className="font-semibold">Profile match: </span>
              You have {matchedCount} of {skills.length} skills employers are looking for.
              {matchedCount < skills.length && (
                <> <Link href="/gap-analysis" className="underline font-medium">See your full gap analysis →</Link></>
              )}
            </div>
          )}
          {userSkills.length === 0 && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <Link href="/competency" className="underline font-medium">Upload your CV</Link> to see which of these skills you already have.
            </div>
          )}

          {/* Category filter tabs */}
          <div className="flex flex-wrap gap-2">
            {(['All', ...CATEGORIES] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                style={{
                  background: activeCategory === cat ? 'var(--primary)' : 'var(--muted-bg)',
                  color: activeCategory === cat ? 'white' : 'var(--foreground)',
                  border: '1px solid',
                  borderColor: activeCategory === cat ? 'var(--primary)' : 'var(--card-border)',
                }}
              >
                {cat}
                {cat !== 'All' && (
                  <span className="ml-1 opacity-70">
                    ({skills.filter(s => s.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Skills grid */}
          {filtered.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No skills in this category.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((skill, i) => {
                const catStyle = CATEGORY_STYLE[skill.category] ?? CATEGORY_STYLE['Technical'];
                const hasSkill = userSkills.some(u => fuzzyMatch(u, skill.name));
                return (
                  <div
                    key={`${skill.name}-${i}`}
                    className="card p-4 flex items-start gap-3"
                    style={{ border: `1px solid ${hasSkill ? '#bbf7d0' : 'var(--card-border)'}`, background: hasSkill ? '#f0fdf4' : 'white' }}
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{skill.name}</span>
                        {hasSkill && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: '#dcfce7', color: '#15803d' }}>
                            ✓ You have this
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}
                        >
                          {skill.category}
                        </span>
                        <span className="text-xs font-medium" style={{ color: IMPORTANCE_COLOR[skill.importance] }}>
                          {IMPORTANCE_LABEL[skill.importance]}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          · {skill.frequency}/{data.jobCount} listings
                        </span>
                      </div>
                    </div>

                    {/* Frequency bar */}
                    <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5" style={{ width: 36 }}>
                      <div className="w-2 rounded-full" style={{ height: 48, background: '#e5e7eb', position: 'relative', overflow: 'hidden' }}>
                        <div
                          style={{
                            position: 'absolute', bottom: 0, width: '100%',
                            height: `${Math.round((skill.frequency / data.jobCount) * 100)}%`,
                            background: skill.importance === 'high' ? '#22c55e' : skill.importance === 'medium' ? '#f97316' : '#94a3b8',
                            borderRadius: '9999px',
                            transition: 'height 0.5s ease',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono" style={{ color: 'var(--muted)', fontSize: 10 }}>
                        {Math.round((skill.frequency / data.jobCount) * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            Skills extracted by AI from {data.jobCount} recent listings. Try different job titles to compare what employers ask for.
          </p>
        </div>
      )}
    </div>
  );
}
