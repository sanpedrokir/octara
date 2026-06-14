'use client';

import { useEffect, useState } from 'react';
import type { SsgCourse } from '@/lib/types';

interface RecommendedData {
  courses: SsgCourse[];
  industry_name: string;
  job_role_name: string;
  source: 'live' | 'catalog' | 'mock';
}

function extractKeyword(title: string): string {
  const m = title.match(/^Search "(.+)" courses on SkillsFuture$/);
  return m ? m[1] : title;
}

export default function RecommendedCourses() {
  const [data, setData] = useState<RecommendedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<Set<string>>(new Set());
  const [tracked, setTracked] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/courses/recommended')
      .then(r => r.json())
      .then(({ data: d }) => { if (d) setData(d); })
      .finally(() => setLoading(false));

    fetch('/api/courses/tracked')
      .then(r => r.json())
      .then(({ data: t }) => {
        if (Array.isArray(t)) {
          setTracked(new Set(t.map((c: { course_reference_number: string; course_title: string }) =>
            c.course_reference_number || c.course_title
          )));
        }
      });
  }, []);

  async function track(course: SsgCourse) {
    const key = course.referenceNumber || course.title;
    if (tracking.has(key) || tracked.has(key)) return;
    setTracking(prev => new Set([...prev, key]));

    await fetch('/api/courses/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_reference_number: course.referenceNumber,
        course_title: course.title,
        provider_name: course.providerName,
        course_url: course.url,
        fee: course.totalCostOfTrainingPerTrainee,
      }),
    });

    setTracked(prev => new Set([...prev, key]));
    setTracking(prev => { const n = new Set(prev); n.delete(key); return n; });
  }

  if (loading) {
    return (
      <div className="card p-5">
        <div className="h-4 w-48 rounded skeleton mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg skeleton" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const liveCourses = data.courses.filter(c => c.referenceNumber);
  const searchLinks = data.courses.filter(c => !c.referenceNumber);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
            📚 Courses for <span style={{ color: 'var(--primary)' }}>{data.job_role_name}</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{data.industry_name}</p>
        </div>
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
          style={
            data.source === 'mock'
              ? { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }
              : { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
          }
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: data.source === 'mock' ? '#9ca3af' : '#16a34a' }} />
          {data.source === 'live' ? 'Live from SkillsFuture' : data.source === 'catalog' ? 'SkillsFuture catalog' : 'No SSG API — search manually'}
        </span>
      </div>

      {/* Live course cards */}
      {liveCourses.length > 0 && (
        <div className="space-y-2 mb-3">
          {liveCourses.map(course => {
            const key = course.referenceNumber;
            const isTracked = tracked.has(key);
            const isTracking = tracking.has(key);
            return (
              <div key={key} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                <div className="flex-1 min-w-0">
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium no-underline hover:underline block truncate"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {course.title}
                  </a>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                    {course.providerName}{course.modeOfTraining ? ` · ${course.modeOfTraining}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {course.subsidisedFee && course.subsidisedFee > 0 ? (
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>${course.subsidisedFee.toLocaleString()}</p>
                      <p className="text-xs line-through" style={{ color: 'var(--muted)' }}>${course.totalCostOfTrainingPerTrainee.toLocaleString()}</p>
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={() => track(course)}
                  disabled={isTracked || isTracking}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                  style={isTracked ? { background: '#dcfce7', color: '#15803d', cursor: 'default' } : { background: 'var(--primary)', color: 'white', cursor: isTracking ? 'wait' : 'pointer' }}
                >
                  {isTracked ? '✓ Added' : isTracking ? '…' : '+ Track'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* No live data — show skill keyword chips */}
      {liveCourses.length === 0 && searchLinks.length > 0 && (
        <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>
            Search these skill topics on SkillsFuture:
          </p>
          <div className="flex flex-wrap gap-2">
            {searchLinks.map(link => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium no-underline transition-opacity hover:opacity-80"
                style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)' }}
              >
                🔍 {extractKeyword(link.title)}
              </a>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Click a topic to open SkillsFuture and use the search box to find matching courses.
          </p>
        </div>
      )}

      <a
        href={`https://courses.myskillsfuture.gov.sg/search?keyword=${encodeURIComponent(data.job_role_name)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-xs mt-3 py-2 rounded-lg no-underline transition-opacity hover:opacity-70"
        style={{ color: 'var(--primary)', border: '1px solid var(--card-border)' }}
      >
        Browse all courses on SkillsFuture →
      </a>
    </div>
  );
}
