'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface JobEntry {
  uuid: string;
  title: string;
  company: string;
  salaryMin: number | null;
  salaryMax: number | null;
  expYears: number | null;
  postedDate: string | null;
  empType: string | null;
  posLevel: string | null;
  views: number | null;
  url: string;
}

interface CompanyGroup {
  company: string;
  jobs: JobEntry[];
}

interface ApiData {
  grouped: CompanyGroup[];
  total: number;
  page: number;
  search: string;
  mode: string;
}

type Mode = 'company' | 'role';

function fmt(n: number) { return `S$${n.toLocaleString()}`; }

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const EMP_COLORS: Record<string, { bg: string; color: string }> = {
  'Permanent':  { bg: '#f0fdf4', color: '#15803d' },
  'Contract':   { bg: '#fffbeb', color: '#92400e' },
  'Temporary':  { bg: '#f5f3ff', color: '#7c3aed' },
  'Part Time':  { bg: '#ecfeff', color: '#0891b2' },
};

function JobRow({ job }: { job: JobEntry }) {
  const empStyle = job.empType ? (EMP_COLORS[job.empType] ?? { bg: '#f1f5f9', color: '#475569' }) : null;
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{job.title}</p>
          {empStyle && job.empType && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: empStyle.bg, color: empStyle.color }}>
              {job.empType}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          {job.salaryMin && job.salaryMax
            ? <span className="font-medium" style={{ color: '#0369a1' }}>{fmt(job.salaryMin)}–{fmt(job.salaryMax)}/mo</span>
            : <span>Salary undisclosed</span>
          }
          {job.expYears !== null && <span>{job.expYears === 0 ? 'Fresh OK' : `${job.expYears}+ yrs`}</span>}
          {job.postedDate && <span>{relativeDate(job.postedDate)}</span>}
        </div>
      </div>
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg no-underline transition-opacity hover:opacity-80"
        style={{ background: 'var(--primary)', color: 'white' }}
      >
        Apply →
      </a>
    </div>
  );
}

function CompanyCard({ group, mode }: { group: CompanyGroup; mode: Mode }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.jobs : group.jobs.slice(0, 3);
  const initials = group.company.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{group.company}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {mode === 'role'
              ? `${group.jobs.length} matching role${group.jobs.length !== 1 ? 's' : ''}`
              : `${group.jobs.length} active listing${group.jobs.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
      </div>
      <div className="px-4 pb-1">
        {shown.map(job => <JobRow key={job.uuid} job={job} />)}
      </div>
      {group.jobs.length > 3 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2.5 text-xs font-medium border-t transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--card-border)', color: 'var(--primary)', background: 'var(--primary-light)' }}
        >
          {expanded ? '▲ Show less' : `▼ Show ${group.jobs.length - 3} more`}
        </button>
      )}
    </div>
  );
}

const MODE_CONFIG: Record<Mode, { icon: string; label: string; placeholder: string; emptyMsg: string }> = {
  company: {
    icon: '🏢',
    label: 'By Company',
    placeholder: 'Search by company name',
    emptyMsg: 'No company found matching',
  },
  role: {
    icon: '💼',
    label: 'By Job Role',
    placeholder: 'Search by job role',
    emptyMsg: 'No postings found for',
  },
};

const SALARY_OPTIONS = [
  { label: 'Any salary', value: 0 },
  { label: '≥ S$2,000',  value: 2000 },
  { label: '≥ S$3,000',  value: 3000 },
  { label: '≥ S$4,000',  value: 4000 },
  { label: '≥ S$5,000',  value: 5000 },
  { label: '≥ S$6,000',  value: 6000 },
  { label: '≥ S$8,000',  value: 8000 },
  { label: '≥ S$10,000', value: 10000 },
];

export default function CompanyJobsPage() {
  const [data, setData]         = useState<ApiData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [mode, setMode]         = useState<Mode>('company');
  const [search, setSearch]     = useState('');
  const [query, setQuery]       = useState('');
  const [minSalary, setMinSalary] = useState(0);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, m: Mode) => {
    if (!q.trim()) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ mode: m, search: q });
      const res = await fetch(`/api/company-jobs?${params}`);
      const { data: d, error: e } = await res.json() as { data: ApiData | null; error: string | null };
      if (e) setError(e);
      else setData(d);
    } catch {
      setError('Failed to load job listings.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(search), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => { load(query, mode); }, [load, query, mode]);

  function switchMode(m: Mode) {
    setMode(m);
    setSearch('');
    setQuery('');
    setMinSalary(0);
  }

  const cfg = MODE_CONFIG[mode];
  const isSearching = query.length > 0;

  // Apply salary filter client-side
  const filteredGroups = (data?.grouped ?? [])
    .map(g => ({
      ...g,
      jobs: minSalary > 0
        ? g.jobs.filter(j => j.salaryMax !== null && j.salaryMax >= minSalary)
        : g.jobs,
    }))
    .filter(g => g.jobs.length > 0);

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🔎 Search All Jobs</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Find live Singapore job postings — search by company or job role, grouped by employer.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: 'var(--muted-bg)' }}>
        {(['company', 'role'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: mode === m ? 'white' : 'transparent',
              color: mode === m ? 'var(--foreground)' : 'var(--muted)',
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <span>{MODE_CONFIG[m].icon}</span>
            <span>{MODE_CONFIG[m].label}</span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none">🔍</span>
        <input
          key={mode}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={cfg.placeholder}
          className="w-full rounded-xl pl-9 pr-9 py-2.5 text-sm border outline-none focus:ring-2"
          style={{ borderColor: 'var(--card-border)', color: 'var(--foreground)', background: 'white' }}
          autoFocus
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setQuery(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base leading-none"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Salary filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>💰 Min salary:</span>
        <div className="flex flex-wrap gap-1.5">
          {SALARY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMinSalary(opt.value)}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
              style={{
                background: minSalary === opt.value ? 'var(--primary)' : 'var(--muted-bg)',
                color: minSalary === opt.value ? 'white' : 'var(--muted)',
                border: minSalary === opt.value ? '1px solid var(--primary)' : '1px solid var(--card-border)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Context hint when no search entered */}
      {!isSearching && !loading && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
          {mode === 'company'
            ? '💡 Type a company name to see all their active listings.'
            : '💡 Type a job role to see which companies are currently hiring for it.'
          }
        </div>
      )}

      {/* Stats bar */}
      {data && !loading && isSearching && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {mode === 'role'
            ? <><strong style={{ color: 'var(--foreground)' }}>{filteredGroups.length}</strong> {filteredGroups.length === 1 ? 'company is' : 'companies are'} hiring for &ldquo;{query}&rdquo;{minSalary > 0 ? ` with salary ≥ S$${minSalary.toLocaleString()}` : ''}</>
            : <><strong style={{ color: 'var(--foreground)' }}>{filteredGroups.length}</strong> {filteredGroups.length === 1 ? 'company' : 'companies'} matched &ldquo;{query}&rdquo; · {filteredGroups.reduce((s, g) => s + g.jobs.length, 0)} listing{filteredGroups.reduce((s, g) => s + g.jobs.length, 0) !== 1 ? 's' : ''}</>
          }
        </p>
      )}

      {data && !loading && !isSearching && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Showing latest postings from <strong style={{ color: 'var(--foreground)' }}>{filteredGroups.length}</strong> companies · <strong>{filteredGroups.reduce((s, g) => s + g.jobs.length, 0).toLocaleString()}</strong> listings{minSalary > 0 ? ` with salary ≥ S$${minSalary.toLocaleString()}` : ' on MCF'}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner label={isSearching ? `Searching for "${query}"…` : 'Fetching latest postings…'} />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card p-6 text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          <button onClick={() => load(query, mode)} className="btn-secondary text-sm">Try Again</button>
        </div>
      )}

      {/* No results */}
      {!loading && !error && data && filteredGroups.length === 0 && (isSearching || minSalary > 0) && (
        <div className="card p-10 text-center space-y-2">
          <p className="text-3xl">{cfg.icon}</p>
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
            {isSearching ? `${cfg.emptyMsg} "${query}"` : 'No listings match this salary filter'}
            {minSalary > 0 ? ` at ≥ S$${minSalary.toLocaleString()}/mo` : ''}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Try a different keyword or adjust the salary filter.</p>
        </div>
      )}

      {/* Company cards */}
      {!loading && !error && data && filteredGroups.length > 0 && (
        <div className="space-y-4">
          {filteredGroups.map(group => (
            <CompanyCard key={group.company} group={group} mode={mode} />
          ))}
        </div>
      )}

      {/* Attribution */}
      {!loading && data && (
        <p className="text-xs text-center pb-2" style={{ color: 'var(--muted)' }}>
          Live data from{' '}
          <a href="https://www.mycareersfuture.gov.sg" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            MyCareersFuture.gov.sg
          </a>
          . Updated in real time.
        </p>
      )}
    </div>
  );
}
