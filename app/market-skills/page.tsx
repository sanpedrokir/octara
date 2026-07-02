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
  'Technical':         { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'Tools & Platforms': { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  'Soft Skills':       { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'Domain Knowledge':  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

const IMPORTANCE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  high:   { label: 'High demand',  bg: '#dcfce7', color: '#15803d' },
  medium: { label: 'Moderate',     bg: '#fef3c7', color: '#92400e' },
  low:    { label: 'Niche',        bg: '#f1f5f9', color: '#64748b' },
};

const CATEGORIES: MarketSkill['category'][] = ['Technical', 'Tools & Platforms', 'Soft Skills', 'Domain Knowledge'];

function tokenize(s: string) {
  return s.toLowerCase().split(/[\s\-\/&,()]+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 1);
}
function fuzzyMatch(a: string, b: string): boolean {
  const ta = tokenize(a), tb = tokenize(b);
  if (!ta.length || !tb.length) return false;
  const [shorter, longerSet] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return shorter.every(t => longerSet.has(t));
}

export default function MarketSkillsPage() {
  const [sectors, setSectors]       = useState<string[]>([]);
  const [tracks, setTracks]         = useState<string[]>([]);
  const [roles, setRoles]           = useState<string[]>([]);

  const [sector, setSector]         = useState('');
  const [track, setTrack]           = useState('');
  const [jobRole, setJobRole]       = useState('');

  const [loadingTracks, setLoadingTracks] = useState(false);
  const [loadingRoles, setLoadingRoles]   = useState(false);
  const [searching, setSearching]         = useState(false);
  const [error, setError]                 = useState('');
  const [data, setData]                   = useState<MarketData | null>(null);
  const [userSkills, setUserSkills]       = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<MarketSkill['category'] | 'All'>('All');

  // Load sectors on mount
  useEffect(() => {
    fetch('/api/job-role-catalog/sectors')
      .then(r => r.json())
      .then(({ data: d }) => { if (Array.isArray(d)) setSectors(d); })
      .catch(() => {});
  }, []);

  // Load user profile for comparison
  useEffect(() => {
    fetch('/api/competency/profile')
      .then(r => r.json())
      .then(({ data: rows }) => {
        if (Array.isArray(rows)) setUserSkills(rows.map((r: UserSkill) => r.skill_title));
      })
      .catch(() => {});
  }, []);

  // Load tracks when sector changes
  useEffect(() => {
    if (!sector) { setTracks([]); setTrack(''); setRoles([]); setJobRole(''); return; }
    setLoadingTracks(true);
    setTrack(''); setRoles([]); setJobRole('');
    fetch(`/api/job-role-catalog/tracks?sector=${encodeURIComponent(sector)}`)
      .then(r => r.json())
      .then(({ data: d }) => { if (Array.isArray(d)) setTracks(d); })
      .catch(() => {})
      .finally(() => setLoadingTracks(false));
  }, [sector]);

  // Load roles when sector or track changes
  useEffect(() => {
    if (!sector) return;
    setLoadingRoles(true);
    setJobRole('');
    const params = new URLSearchParams({ sector, limit: '200' });
    if (track) params.set('tracks', track);
    fetch(`/api/job-role-catalog/roles?${params}`)
      .then(r => r.json())
      .then(({ data: d }) => {
        const list = (d?.rows ?? []) as Array<{ job_role: string }>;
        setRoles([...new Set(list.map(r => r.job_role))].sort());
      })
      .catch(() => {})
      .finally(() => setLoadingRoles(false));
  }, [sector, track]);

  async function search() {
    if (!jobRole) return;
    setSearching(true);
    setError('');
    setData(null);
    setActiveCategory('All');

    const res = await fetch('/api/market-skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: jobRole }),
    });
    const { data: d, error: e } = await res.json();
    if (e) setError(e);
    else setData(d);
    setSearching(false);
  }

  const skills   = data?.skills ?? [];
  const filtered = activeCategory === 'All' ? skills : skills.filter(s => s.category === activeCategory);
  const matchedCount    = skills.filter(s => userSkills.some(u => fuzzyMatch(u, s.name))).length;
  const highDemandCount = skills.filter(s => s.importance === 'high').length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Market Skills Explorer</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          See what skills Singapore employers are actively hiring for, extracted from live job listings on MyCareersFuture.
        </p>
      </div>

      {/* ── Selector card ─────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Select a job role to explore</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Sector */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Sector</label>
            <select
              value={sector}
              onChange={e => setSector(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
              style={{ border: '1.5px solid var(--card-border)', color: sector ? 'var(--foreground)' : 'var(--muted)', background: 'white' }}
            >
              <option value="">— Select sector —</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Track */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Track</label>
            <select
              value={track}
              onChange={e => setTrack(e.target.value)}
              disabled={!sector || loadingTracks}
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
              style={{ border: '1.5px solid var(--card-border)', color: 'var(--foreground)', background: 'white', opacity: !sector ? 0.5 : 1 }}
            >
              <option value="">{loadingTracks ? 'Loading…' : tracks.length ? '— All tracks —' : sector ? 'No tracks' : '— Select sector first —'}</option>
              {tracks.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Job Role */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Job Role</label>
            <select
              value={jobRole}
              onChange={e => setJobRole(e.target.value)}
              disabled={!sector || loadingRoles}
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
              style={{ border: '1.5px solid var(--card-border)', color: jobRole ? 'var(--foreground)' : 'var(--muted)', background: 'white', opacity: !sector ? 0.5 : 1 }}
            >
              <option value="">{loadingRoles ? 'Loading…' : roles.length ? '— Select role —' : sector ? 'No roles found' : '— Select sector first —'}</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={search}
          disabled={searching || !jobRole}
          className="btn-primary text-sm px-6"
          style={{ opacity: searching || !jobRole ? 0.6 : 1 }}
        >
          {searching ? <><LoadingSpinner label="" /> Searching…</> : '🔍 Find Market Skills'}
        </button>

        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Searches live listings on MyCareersFuture for the selected role, then AI extracts and aggregates the required skills.
        </p>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="card p-4 text-sm" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {searching && (
        <div className="card p-8 flex flex-col items-center gap-3">
          <LoadingSpinner label="" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Searching MyCareersFuture for <strong>{jobRole}</strong> and extracting skills with AI…
          </p>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────── */}
      {data && !searching && (
        <div className="space-y-5">

          {/* Source badge row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
              Based on {data.jobCount} live listings · {data.totalListings.toLocaleString()} total found
            </span>
            <a
              href={`https://www.mycareersfuture.gov.sg/search?search=${encodeURIComponent(jobRole)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: 'var(--muted-bg)', color: 'var(--primary)', border: '1px solid var(--card-border)' }}
            >
              View all on MyCareersFuture ↗
            </a>
          </div>

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
          {userSkills.length > 0 ? (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
              <span className="font-semibold">Profile match: </span>
              You have {matchedCount} of {skills.length} skills employers are looking for.
              {matchedCount < skills.length && (
                <> <Link href="/gap-analysis" className="underline font-medium">See your full gap analysis →</Link></>
              )}
            </div>
          ) : (
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
                {cat}{cat !== 'All' && ` (${skills.filter(s => s.category === cat).length})`}
              </button>
            ))}
          </div>

          {/* Skills list */}
          {filtered.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No skills in this category.</p>
          ) : (
            <div className="card overflow-hidden divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {filtered.map((skill, i) => {
                const catStyle = CATEGORY_STYLE[skill.category];
                const imp      = IMPORTANCE_BADGE[skill.importance];
                const hasSkill = userSkills.some(u => fuzzyMatch(u, skill.name));
                return (
                  <div
                    key={`${skill.name}-${i}`}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: hasSkill ? '#f0fdf4' : 'white' }}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{skill.name}</span>
                        {hasSkill && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>
                            ✓ You have this
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}>
                          {skill.category}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: imp.bg, color: imp.color }}>
                          {imp.label}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {skill.frequency}/{data.jobCount} listings
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            Skills extracted by AI from {data.jobCount} recent listings on MyCareersFuture.
          </p>
        </div>
      )}
    </div>
  );
}
