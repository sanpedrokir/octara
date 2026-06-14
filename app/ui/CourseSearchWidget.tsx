'use client';

import { useState, useRef } from 'react';
import type { SsgCourse } from '@/lib/types';

const SUGGESTIONS = ['Python', 'Data Analytics', 'Cloud Computing', 'Cybersecurity', 'Agile', 'Digital Marketing', 'Leadership', 'Machine Learning'];

export default function CourseSearchWidget() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SsgCourse[]>([]);
  const [source, setSource] = useState<'live' | 'catalog' | 'mock' | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function search(kw: string) {
    const q = kw.trim();
    if (!q) return;
    setKeyword(q);
    setLoading(true);
    setSearched(true);
    const res = await fetch(`/api/courses/search?keyword=${encodeURIComponent(q)}`);
    const { data, source: s } = await res.json();
    setResults(data || []);
    setSource(s ?? null);
    setLoading(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(keyword);
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="Search e.g. Python, Cloud, Data Analytics…"
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'white',
          }}
        />
        <button
          type="submit"
          disabled={loading || !keyword.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {/* Quick suggestion chips */}
      {!searched && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => search(s)}
              className="px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          Searching SkillsFuture courses…
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>No courses found. Try a different keyword.</p>
      )}

      {!loading && searched && source && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ background: source === 'mock' ? '#fbbf24' : '#4ade80' }}
          />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {source === 'live' ? 'Live results from SkillsFuture API' : source === 'catalog' ? 'SkillsFuture course catalog (25K+ courses)' : 'SSG API not connected — click a link to search SkillsFuture directly'}
          </span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.slice(0, 4).map((course, i) => {
            const isSearchLink = !course.referenceNumber;
            const key = course.referenceNumber || `search-${i}`;
            if (isSearchLink) {
              return (
                <a
                  key={key}
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg no-underline transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px dashed rgba(255,255,255,0.4)' }}
                >
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>🔍</span>
                  <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{course.title}</span>
                  <span className="ml-auto text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.55)' }}>Opens SkillsFuture →</span>
                </a>
              );
            }
            return (
              <a
                key={key}
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg p-3 transition-colors no-underline"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug truncate" style={{ color: 'white' }}>{course.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>{course.providerName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold" style={{ color: '#7dd3fc' }}>
                      ${course.subsidisedFee && course.subsidisedFee > 0 ? course.subsidisedFee.toLocaleString() : course.totalCostOfTrainingPerTrainee.toLocaleString()}
                    </p>
                    {course.subsidisedFee && course.subsidisedFee > 0 && (
                      <p className="text-xs line-through" style={{ color: 'rgba(255,255,255,0.4)' }}>${course.totalCostOfTrainingPerTrainee.toLocaleString()}</p>
                    )}
                  </div>
                </div>
                {course.modeOfTraining && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(125,211,252,0.2)', color: '#7dd3fc' }}>
                    {course.modeOfTraining}
                  </span>
                )}
              </a>
            );
          })}
          <a
            href={`https://courses.myskillsfuture.gov.sg/search?keyword=${encodeURIComponent(keyword)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs py-2 rounded-lg no-underline transition-opacity hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            View all results on SkillsFuture →
          </a>
        </div>
      )}
    </div>
  );
}
