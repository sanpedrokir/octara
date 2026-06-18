'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LeaderboardEntry {
  rank: number;
  name: string;
  total_attempts: number;
  quizzes_passed: number;
  avg_pct: number;
  best_pct: number;
  is_me: boolean;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  inTop20: boolean;
}

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankBadge({ rank }: { rank: number }) {
  const medal = RANK_MEDAL[rank];
  if (medal) return <span className="text-xl">{medal}</span>;
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}
    >
      {rank}
    </span>
  );
}

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--muted-bg)', minWidth: 48 }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium shrink-0" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(({ data: d, error: e }) => {
        if (e) setError(e);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, []);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>🏆 Quiz Leaderboard</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Ranked by quizzes passed · avg score</p>
        </div>
        <Link href="/skill-quiz" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
          Take a quiz →
        </Link>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-lg skeleton" />)}
        </div>
      )}

      {error && !loading && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Leaderboard unavailable.</p>
      )}

      {!loading && !error && data && (
        <>
          {data.leaderboard.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-3xl">🎯</p>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No quiz results yet</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Be the first to complete a Work Knowledge Quiz!</p>
              <Link href="/skill-quiz" className="btn-primary inline-block text-sm mt-1 no-underline">Start a Quiz</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Column headers */}
              <div
                className="grid text-xs font-semibold uppercase tracking-wide px-3 py-1.5"
                style={{ gridTemplateColumns: '32px 1fr 56px 72px', color: 'var(--muted)' }}
              >
                <span>#</span>
                <span>Name</span>
                <span className="text-center">Passed</span>
                <span className="text-right">Avg Score</span>
              </div>

              {/* Rows */}
              {data.leaderboard.map(entry => (
                <div
                  key={`${entry.rank}-${entry.name}`}
                  className="grid items-center px-3 py-2.5 rounded-xl gap-2"
                  style={{
                    gridTemplateColumns: '32px 1fr 56px 72px',
                    background: entry.is_me ? 'var(--primary-light)' : 'var(--muted-bg)',
                    border: entry.is_me ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                  }}
                >
                  <RankBadge rank={entry.rank} />

                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: entry.is_me ? 'var(--primary)' : 'var(--foreground)' }}>
                      {entry.name}
                      {entry.is_me && <span className="ml-1 text-xs font-normal">(you)</span>}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {entry.total_attempts} attempt{entry.total_attempts !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="text-center">
                    <span
                      className="text-sm font-bold"
                      style={{ color: entry.quizzes_passed > 0 ? '#15803d' : 'var(--muted)' }}
                    >
                      {entry.quizzes_passed}
                    </span>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>passed</p>
                  </div>

                  <div className="text-right">
                    <span
                      className="text-sm font-bold"
                      style={{ color: entry.avg_pct >= 80 ? '#15803d' : entry.avg_pct >= 60 ? '#d97706' : '#dc2626' }}
                    >
                      {entry.avg_pct}%
                    </span>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>avg</p>
                  </div>
                </div>
              ))}

              {/* Current user outside top 20 */}
              {!data.inTop20 && data.myEntry && (
                <>
                  <div className="flex items-center gap-2 py-1 px-3">
                    <div className="flex-1 border-t border-dashed" style={{ borderColor: 'var(--card-border)' }} />
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>your position</span>
                    <div className="flex-1 border-t border-dashed" style={{ borderColor: 'var(--card-border)' }} />
                  </div>
                  <div
                    className="grid items-center px-3 py-2.5 rounded-xl gap-2"
                    style={{
                      gridTemplateColumns: '32px 1fr 56px 72px',
                      background: 'var(--primary-light)',
                      border: '1.5px solid var(--primary)',
                    }}
                  >
                    <RankBadge rank={data.myEntry.rank} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--primary)' }}>
                        {data.myEntry.name} <span className="text-xs font-normal">(you)</span>
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {data.myEntry.total_attempts} attempt{data.myEntry.total_attempts !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold" style={{ color: data.myEntry.quizzes_passed > 0 ? '#15803d' : 'var(--muted)' }}>
                        {data.myEntry.quizzes_passed}
                      </span>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>passed</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold" style={{ color: data.myEntry.avg_pct >= 80 ? '#15803d' : data.myEntry.avg_pct >= 60 ? '#d97706' : '#dc2626' }}>
                        {data.myEntry.avg_pct}%
                      </span>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>avg</p>
                    </div>
                  </div>
                </>
              )}

              {/* No quiz activity for current user yet */}
              {!data.inTop20 && !data.myEntry && (
                <div className="px-3 py-3 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                  You haven&apos;t taken any quizzes yet.{' '}
                  <Link href="/skill-quiz" className="font-medium no-underline" style={{ color: 'var(--primary)' }}>
                    Start now →
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
