'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LoadingSpinner from '../ui/LoadingSpinner';

interface Job {
  uuid: string;
  title: string;
  company: string;
  salaryMin: number | null;
  salaryMax: number | null;
  expYears: number | null;
  postedDate: string | null;
  expiryDate: string | null;
  empType: string | null;
  posLevel: string | null;
  views: number | null;
  url: string;
}

interface JobsData {
  jobs: Job[];
  total: number;
  role: string;
  sector: string;
  page: number;
}

const EMP_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  'Permanent':    { bg: '#f0fdf4', color: '#15803d' },
  'Contract':     { bg: '#fffbeb', color: '#92400e' },
  'Temporary':    { bg: '#f5f3ff', color: '#7c3aed' },
  'Part Time':    { bg: '#ecfeff', color: '#0891b2' },
  'Freelance':    { bg: '#fef2f2', color: '#b91c1c' },
};

function fmt(n: number) {
  return `S$${n.toLocaleString()}`;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

type SortMode = 'newest' | 'salary';

function sortJobs(jobs: Job[], mode: SortMode): Job[] {
  if (mode === 'salary') {
    return [...jobs].sort((a, b) => (b.salaryMax ?? 0) - (a.salaryMax ?? 0));
  }
  return jobs;
}

function JobCard({ job }: { job: Job }) {
  const empStyle = job.empType ? (EMP_TYPE_STYLE[job.empType] ?? { bg: '#f1f5f9', color: '#475569' }) : null;
  const hasSalary = job.salaryMin !== null && job.salaryMax !== null;

  return (
    <div
      className="card p-4 sm:p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
      style={{ borderLeft: '3px solid var(--primary)' }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base leading-snug" style={{ color: 'var(--foreground)' }}>
            {job.title}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{job.company}</p>
        </div>
        {empStyle && job.empType && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{ background: empStyle.bg, color: empStyle.color }}
          >
            {job.empType}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--muted)' }}>
        {hasSalary && (
          <span className="font-semibold text-sm" style={{ color: '#0369a1' }}>
            {fmt(job.salaryMin!)} – {fmt(job.salaryMax!)}/mo
          </span>
        )}
        {!hasSalary && (
          <span className="italic">Salary not stated</span>
        )}
        {job.expYears !== null && (
          <span>⏱ {job.expYears === 0 ? 'No experience required' : `${job.expYears}+ yrs exp`}</span>
        )}
        {job.posLevel && <span>📌 {job.posLevel}</span>}
        {job.postedDate && <span>🕐 {relativeDate(job.postedDate)}</span>}
        {job.views !== null && <span>👁 {job.views.toLocaleString()} views</span>}
      </div>

      <div className="flex items-center justify-end pt-1">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors no-underline"
          style={{ background: 'var(--primary)', color: 'white' }}
        >
          View on MCF →
        </a>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function JobsPage() {
  const [data, setData]       = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [page, setPage]       = useState(0);
  const [sort, setSort]       = useState<SortMode>('newest');

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/jobs?page=${p}`);
      const { data: d, error: e } = await res.json() as { data: JobsData | null; error: string | null };
      if (e === 'NO_CAREER_GOAL') { setError('NO_CAREER_GOAL'); }
      else if (e) { setError(e); }
      else { setData(d); }
    } catch {
      setError('Failed to load job postings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  function goPage(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!loading && error === 'NO_CAREER_GOAL') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">💼</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Set your career goal first</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Job postings are matched to your target role.</p>
        <Link href="/career" className="btn-primary inline-block">Go to Career Goal →</Link>
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className="card p-6 max-w-lg mx-auto mt-16 text-center space-y-3">
        <p className="text-2xl">⚠️</p>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        <button onClick={() => load(page)} className="btn-secondary text-sm">Try Again</button>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const displayed  = data ? sortJobs(data.jobs, sort) : [];

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>💼 Job Postings</h1>
        {data && (
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--foreground)' }}>{data.total.toLocaleString()}</strong> live listings for{' '}
            <strong style={{ color: 'var(--foreground)' }}>{data.role}</strong>
            {data.sector ? <> · {data.sector}</> : ''} on MyCareersFuture
          </p>
        )}
      </div>

      {/* Sort + page info */}
      {data && !loading && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Page {page + 1} of {totalPages} · showing {displayed.length} listings
          </p>
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--muted-bg)' }}>
            {(['newest', 'salary'] as SortMode[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="text-xs px-3 py-1 rounded-md font-medium transition-colors"
                style={{
                  background: sort === s ? 'white' : 'transparent',
                  color: sort === s ? 'var(--foreground)' : 'var(--muted)',
                  boxShadow: sort === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {s === 'newest' ? '🕐 Newest' : '💰 Highest Salary'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner label="Fetching live job postings…" />
        </div>
      )}

      {/* Job cards */}
      {!loading && data && (
        <div className="space-y-3">
          {displayed.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No job postings found for this role right now.</p>
            </div>
          ) : (
            displayed.map(job => <JobCard key={job.uuid} job={job} />)
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => goPage(page - 1)}
            disabled={page === 0}
            className="btn-secondary text-sm"
            style={{ opacity: page === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i : page < 4 ? i : page + i - 3;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => goPage(p)}
                  className="w-8 h-8 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: p === page ? 'var(--primary)' : 'transparent',
                    color: p === page ? 'white' : 'var(--muted)',
                  }}
                >
                  {p + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="btn-secondary text-sm"
            style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>
      )}

      {/* MCF attribution */}
      {data && !loading && (
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
