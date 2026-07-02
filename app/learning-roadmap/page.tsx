'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Link from 'next/link';

interface Milestone {
  title: string;
  description: string;
  type: 'course' | 'project' | 'certification' | 'practice';
}

interface Phase {
  phase: number;
  title: string;
  duration: string;
  focus: string;
  milestones: Milestone[];
  skills_targeted: string[];
  resources: string[];
}

interface RoadmapData {
  role: string;
  total_duration: string;
  phases: Phase[];
  quick_wins: string[];
  success_metric: string;
}

const PHASE_COLORS = [
  { bg: '#eff6ff', border: '#bfdbfe', accent: '#1d4ed8', light: '#dbeafe' },
  { bg: '#f0fdf4', border: '#bbf7d0', accent: '#15803d', light: '#dcfce7' },
  { bg: '#faf5ff', border: '#e9d5ff', accent: '#7c3aed', light: '#ede9fe' },
];

const MILESTONE_TYPE_ICON: Record<string, string> = {
  course:        '📚',
  project:       '🛠',
  certification: '🏅',
  practice:      '🎯',
};

export default function LearningRoadmapPage() {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [data, setData]           = useState<RoadmapData | null>(null);
  const [expanded, setExpanded]   = useState<number[]>([1]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch('/api/learning-roadmap')
      .then(r => r.json())
      .then(({ data: d, error: e }) => {
        if (e === 'NO_CAREER_GOAL') setError('NO_CAREER_GOAL');
        else if (e) setError(e);
        else { setData(d); setExpanded([1]); }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load roadmap.'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  function togglePhase(phase: number) {
    setExpanded(prev => prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner label="Building your learning roadmap…" /></div>;

  if (error === 'NO_CAREER_GOAL') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">🗺️</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Set your career goal first</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Your roadmap is personalised to your target role and skill gaps.</p>
        <Link href="/career" className="btn-primary inline-block">Go to Career Goal →</Link>
      </div>
    );
  }

  if (error) return (
    <div className="card p-6 max-w-lg mx-auto mt-16 text-center space-y-3">
      <p className="text-2xl">⚠️</p>
      <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      <button className="btn-secondary" onClick={load}>Retry</button>
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🗺️ Learning Roadmap</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Personalised path to <strong style={{ color: 'var(--foreground)' }}>{data.role}</strong> · {data.total_duration}
          </p>
        </div>
        <button className="btn-secondary text-xs shrink-0" onClick={load}>↺ Refresh</button>
      </div>

      {/* Quick wins */}
      {data.quick_wins?.length > 0 && (
        <div className="card p-4" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#92400e' }}>⚡ Start This Week</p>
          <ul className="space-y-1">
            {data.quick_wins.map((w, i) => (
              <li key={i} className="text-sm" style={{ color: '#78350f' }}>• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Phase timeline */}
      <div className="relative space-y-4">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-8 bottom-8 w-0.5 hidden sm:block" style={{ background: '#e2e8f0' }} />

        {data.phases.map((phase) => {
          const c = PHASE_COLORS[(phase.phase - 1) % PHASE_COLORS.length];
          const open = expanded.includes(phase.phase);
          return (
            <div key={phase.phase} className="relative flex gap-4">
              {/* Phase number bubble */}
              <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-base z-10" style={{ background: c.accent, color: 'white', border: '3px solid white', boxShadow: '0 0 0 2px ' + c.border }}>
                {phase.phase}
              </div>

              {/* Card */}
              <div className="flex-1 card overflow-hidden" style={{ border: `1.5px solid ${c.border}` }}>
                {/* Phase header */}
                <button
                  className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3"
                  style={{ background: c.bg }}
                  onClick={() => togglePhase(phase.phase)}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold" style={{ color: c.accent }}>Phase {phase.phase}: {phase.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: c.light, color: c.accent }}>{phase.duration}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{phase.focus}</p>
                  </div>
                  <span style={{ color: c.accent }}>{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div className="px-4 py-4 space-y-4" style={{ background: 'white' }}>
                    {/* Skills targeted */}
                    {phase.skills_targeted.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>SKILLS TO BUILD</p>
                        <div className="flex flex-wrap gap-1.5">
                          {phase.skills_targeted.map((s, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.light, color: c.accent, border: `1px solid ${c.border}` }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Milestones */}
                    {phase.milestones.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>MILESTONES</p>
                        <div className="space-y-2">
                          {phase.milestones.map((m, i) => (
                            <div key={i} className="flex gap-3 p-2.5 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              <span className="text-base shrink-0">{MILESTONE_TYPE_ICON[m.type] ?? '📌'}</span>
                              <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{m.title}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{m.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resources */}
                    {phase.resources.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>RECOMMENDED RESOURCES</p>
                        <ul className="space-y-1">
                          {phase.resources.map((r, i) => (
                            <li key={i} className="text-xs flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                              <span style={{ color: c.accent }}>›</span> {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Success metric */}
      {data.success_metric && (
        <div className="card p-4 flex gap-3" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
          <span className="text-xl shrink-0">🏁</span>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: '#15803d' }}>You are ready when…</p>
            <p className="text-sm" style={{ color: '#166534' }}>{data.success_metric}</p>
          </div>
        </div>
      )}

      {/* Links */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/gap-analysis" className="btn-secondary text-sm">View Gap Analysis →</Link>
        <Link href="/job-matcher" className="btn-secondary text-sm">Match a Job Description →</Link>
      </div>
    </div>
  );
}
