'use client';

import { useState, useEffect, useCallback } from 'react';

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  best_score: number;
  total: number;
  pct: number;
  ever_passed: boolean;
  attempts: number;
  is_me: boolean;
}

export default function QuizLeaderboard({
  sector,
  compact = false,
  refreshTrigger = 0,
}: {
  sector: string;
  compact?: boolean;
  refreshTrigger?: number;
}) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank]           = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading]         = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!sector) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/skill-quiz/leaderboard?sector=${encodeURIComponent(sector)}`);
      const { data } = await res.json();
      if (data) { setLeaderboard(data.rankings ?? []); setMyRank(data.me ?? null); }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, [sector]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard, refreshTrigger]);

  if (!sector) return null;

  const displayList = compact ? leaderboard.slice(0, 5) : leaderboard;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold" style={{ fontSize: compact ? '0.875rem' : '1rem', color: 'var(--foreground)' }}>
            🏆 {sector} Leaderboard
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Best score per learner · All users
          </p>
        </div>
        <button
          onClick={fetchLeaderboard}
          className="text-xs px-2.5 py-1 rounded-lg font-medium"
          style={{ background: 'var(--muted-bg)', color: 'var(--muted)', cursor: 'pointer' }}
        >
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      {myRank && (
        <div className="p-2.5 rounded-xl text-xs font-semibold" style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1.5px solid var(--primary)' }}>
          {RANK_MEDAL[myRank.rank] ?? `#${myRank.rank}`}&nbsp; You are ranked <strong>#{myRank.rank}</strong> with {myRank.pct}%
          {myRank.ever_passed ? ' · ✓ Passed' : ''}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-11 rounded-xl skeleton" />)}
        </div>
      ) : displayList.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>
          No scores yet — be the first to take the quiz!
        </p>
      ) : (
        <div className="space-y-1.5">
          {displayList.map(entry => (
            <div
              key={entry.user_id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              style={{
                background: entry.is_me ? 'var(--primary-light)' : 'var(--muted-bg)',
                border: entry.is_me ? '1.5px solid var(--primary)' : '1.5px solid transparent',
              }}
            >
              <span className="text-base w-7 text-center shrink-0">
                {RANK_MEDAL[entry.rank] ?? `#${entry.rank}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: entry.is_me ? 'var(--primary)' : 'var(--foreground)' }}>
                  {entry.name}{entry.is_me ? ' (You)' : ''}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {entry.attempts} attempt{entry.attempts !== 1 ? 's' : ''}
                  {entry.ever_passed ? ' · ✓ Passed' : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold" style={{ color: entry.pct >= 80 ? '#16a34a' : 'var(--foreground)' }}>
                  {entry.pct}%
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{entry.best_score}/{entry.total}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {compact && leaderboard.length > 5 && (
        <a href="/skill-quiz" className="text-xs font-medium no-underline block text-center pt-1" style={{ color: 'var(--primary)' }}>
          View full leaderboard →
        </a>
      )}
    </div>
  );
}
