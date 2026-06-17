'use client';

import { useState, useEffect, useRef } from 'react';

const TARGET = 1000;
const TOTAL_BATCHES = 40;

type SectorRow = {
  sector: string;
  count: number;
  target: number;
  complete: boolean;
};

type GeneratingState = {
  sector: string;
  batch: number;       // 0-based current batch
  count: number;       // questions in DB so far
  error: string | null;
  done: boolean;
};

export default function SectorQuestionsPage() {
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Record<string, GeneratingState>>({});
  const abortRef = useRef<Record<string, boolean>>({});

  async function fetchSectors() {
    setLoading(true);
    const res = await fetch('/api/admin/sector-questions');
    const { data } = await res.json();
    if (data) setSectors(data);
    setLoading(false);
  }

  useEffect(() => { fetchSectors(); }, []);

  async function generateSector(sector: string) {
    abortRef.current[sector] = false;

    // Find current count
    const existing = sectors.find(s => s.sector === sector);
    const startCount = existing?.count ?? 0;
    const startBatch = Math.floor(startCount / 25); // resume from where we left off

    setGenerating(prev => ({
      ...prev,
      [sector]: { sector, batch: startBatch, count: startCount, error: null, done: false },
    }));

    let currentCount = startCount;

    for (let batch = startBatch; batch < TOTAL_BATCHES; batch++) {
      if (abortRef.current[sector]) break;
      if (currentCount >= TARGET) break;

      try {
        const res = await fetch('/api/admin/sector-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sector, batchIndex: batch }),
        });
        const { data, error } = await res.json();

        if (error) {
          setGenerating(prev => ({ ...prev, [sector]: { ...prev[sector], error, done: true } }));
          break;
        }

        if (data.skipped) {
          setGenerating(prev => ({ ...prev, [sector]: { ...prev[sector], count: data.total, done: true } }));
          break;
        }

        currentCount = data.total;
        setGenerating(prev => ({
          ...prev,
          [sector]: { ...prev[sector], batch: batch + 1, count: currentCount, error: null },
        }));

        if (currentCount >= TARGET) break;
      } catch {
        setGenerating(prev => ({
          ...prev,
          [sector]: { ...prev[sector], error: 'Network error — retrying may help', done: true },
        }));
        break;
      }
    }

    setGenerating(prev => ({ ...prev, [sector]: { ...prev[sector], done: true } }));
    // Refresh the sector list
    const res = await fetch('/api/admin/sector-questions');
    const { data } = await res.json();
    if (data) setSectors(data);
  }

  function stopSector(sector: string) {
    abortRef.current[sector] = true;
  }

  async function generateAll() {
    const incomplete = sectors.filter(s => !s.complete);
    for (const s of incomplete) {
      if (abortRef.current['__all__']) break;
      await generateSector(s.sector);
    }
    abortRef.current['__all__'] = false;
  }

  function stopAll() {
    abortRef.current['__all__'] = true;
    Object.keys(generating).forEach(sector => { abortRef.current[sector] = true; });
  }

  const totalComplete = sectors.filter(s => s.complete).length;
  const totalSectors = sectors.length;
  const anyGenerating = Object.values(generating).some(g => !g.done);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Sector Scenario Questions</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Generate 1,000 corporate scenario questions per sector. Each run adds 25 questions (one batch).
          The system automatically generates 40 batches to reach 1,000.
        </p>
      </div>

      {/* Summary bar */}
      <div className="card p-5 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>{totalComplete}<span className="text-lg font-normal text-gray-400">/{totalSectors}</span></p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Sectors complete (1,000 questions)</p>
        </div>
        <div className="flex gap-3 ml-auto">
          <button
            onClick={generateAll}
            disabled={anyGenerating || totalComplete === totalSectors}
            className="btn-primary"
            style={{ opacity: anyGenerating || totalComplete === totalSectors ? 0.5 : 1 }}
          >
            {anyGenerating ? 'Generating…' : '⚡ Generate All Sectors'}
          </button>
          {anyGenerating && (
            <button onClick={stopAll} className="btn-ghost" style={{ color: 'var(--danger)' }}>
              Stop All
            </button>
          )}
          <button onClick={fetchSectors} className="btn-ghost text-sm">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl skeleton" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {sectors.map(row => {
            const gen = generating[row.sector];
            const isRunning = gen && !gen.done;
            const displayCount = gen ? gen.count : row.count;
            const pct = Math.min(100, Math.round((displayCount / TARGET) * 100));
            const batchPct = gen && !gen.done ? Math.round((gen.batch / TOTAL_BATCHES) * 100) : null;

            return (
              <div key={row.sector} className="card p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Sector name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{row.sector}</span>
                      {row.complete && !isRunning && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>✓ Complete</span>
                      )}
                      {isRunning && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium animate-pulse" style={{ background: '#eff6ff', color: 'var(--primary)' }}>
                          Batch {gen.batch}/{TOTAL_BATCHES}…
                        </span>
                      )}
                      {gen?.error && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef2f2', color: 'var(--danger)' }}>{gen.error}</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full" style={{ background: 'var(--muted-bg)' }}>
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? 'var(--teal)' : 'var(--primary)',
                        }}
                      />
                    </div>

                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {displayCount.toLocaleString()} / {TARGET.toLocaleString()} questions
                      {batchPct !== null && ` · batch ${gen.batch + 1} of ${TOTAL_BATCHES}`}
                    </p>
                  </div>

                  {/* Action button */}
                  <div className="shrink-0">
                    {isRunning ? (
                      <button
                        onClick={() => stopSector(row.sector)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => generateSector(row.sector)}
                        disabled={row.complete && !gen?.error}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{
                          background: row.complete ? 'var(--muted-bg)' : 'var(--primary)',
                          color: row.complete ? 'var(--muted)' : 'white',
                          cursor: row.complete ? 'default' : 'pointer',
                        }}
                      >
                        {row.complete ? 'Done' : displayCount > 0 ? 'Resume' : 'Generate'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-4" style={{ background: 'var(--muted-bg)' }}>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          <strong>How it works:</strong> Each "Generate" run calls OpenAI 40 times (25 questions per batch = 1,000 total).
          Each batch covers a different workplace focus area to ensure variety.
          If generation is interrupted, click <em>Resume</em> to continue from where it left off.
          Questions are stored permanently in the <code>sector_scenario_questions</code> table.
        </p>
      </div>
    </div>
  );
}
