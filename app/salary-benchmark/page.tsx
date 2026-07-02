'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Link from 'next/link';

interface SalaryBand {
  level: string;
  min: number;
  max: number;
  typical: number;
  description: string;
}

interface SalaryData {
  role: string;
  sector: string;
  currency: string;
  bands: SalaryBand[];
  top_paying_factors: string[];
  in_demand_skills: string[];
  market_outlook: string;
  data_note: string;
}

function fmt(n: number) {
  return `S$${n.toLocaleString()}`;
}

const BAND_COLORS = ['#bfdbfe', '#93c5fd', '#3b82f6'];
const BAND_TEXT   = ['#1e40af', '#1d4ed8', '#1d4ed8'];

export default function SalaryBenchmarkPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [data, setData]       = useState<SalaryData | null>(null);

  useEffect(() => {
    fetch('/api/salary-benchmark')
      .then(r => r.json())
      .then(({ data: d, error: e }) => {
        if (e === 'NO_CAREER_GOAL') setError('NO_CAREER_GOAL');
        else if (e) setError(e);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load salary data.'); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner label="Fetching salary benchmarks…" />
      </div>
    );
  }

  if (error === 'NO_CAREER_GOAL') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">💰</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Set your career goal first</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Salary benchmarks are personalised to your target role.</p>
        <Link href="/career" className="btn-primary inline-block">Go to Career Goal →</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 max-w-lg mx-auto mt-16 text-center space-y-3">
        <p className="text-2xl">⚠️</p>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const maxSalary = Math.max(...data.bands.map(b => b.max));

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>💰 Salary Benchmark</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Singapore market salary ranges for <strong style={{ color: 'var(--foreground)' }}>{data.role}</strong>{data.sector ? ` · ${data.sector}` : ''}.
        </p>
      </div>

      {/* Salary bands */}
      <div className="card p-5 space-y-5">
        <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Annual Salary Ranges (SGD)</h2>
        {data.bands.map((band, i) => {
          const pct = Math.round((band.typical / maxSalary) * 100);
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{band.level}</p>
                <p className="text-sm font-bold" style={{ color: BAND_TEXT[i] }}>{fmt(band.min)} – {fmt(band.max)}</p>
              </div>
              <div className="relative h-7 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full flex items-center pl-3 transition-all"
                  style={{ width: `${pct}%`, background: BAND_COLORS[i], minWidth: '4rem' }}
                >
                  <span className="text-xs font-bold" style={{ color: BAND_TEXT[i] }}>{fmt(band.typical)}</span>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{band.description}</p>
            </div>
          );
        })}
        <p className="text-xs text-center pt-1" style={{ color: 'var(--muted)' }}>Bars show typical / median. Range shows min–max.</p>
      </div>

      {/* Market outlook */}
      <div className="card p-4 flex gap-3" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
        <span className="text-xl shrink-0">📈</span>
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: '#15803d' }}>Market Outlook</p>
          <p className="text-sm" style={{ color: '#166534' }}>{data.market_outlook}</p>
        </div>
      </div>

      {/* Top paying factors + in demand skills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>🚀 Top Salary Boosters</p>
          <ul className="space-y-1">
            {data.top_paying_factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-xs font-bold mt-0.5" style={{ color: 'var(--primary)' }}>✓</span>
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>🔥 In-Demand Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {data.in_demand_skills.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{s}</span>
            ))}
          </div>
          <Link href="/gap-analysis" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
            Check your skill gaps →
          </Link>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
        ℹ️ These are estimated ranges based on Singapore market knowledge as of 2024-2025. Actual salaries vary by company size, skills, and negotiation.
      </div>
    </div>
  );
}
