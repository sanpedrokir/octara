'use client';

import { useEffect, useState } from 'react';
import type { SsgCourse, TrackedCourse } from '@/lib/types';
import Link from 'next/link';

interface RecommendedData {
  courses: SsgCourse[];
  industry_name: string;
  job_role_name: string;
  source: 'live' | 'catalog' | 'mock';
}

export default function MyCoursesPage() {
  const [tracked, setTracked] = useState<TrackedCourse[]>([]);
  const [recommended, setRecommended] = useState<RecommendedData | null>(null);
  const [loadingTracked, setLoadingTracked] = useState(true);
  const [loadingRec, setLoadingRec] = useState(true);
  const [updating, setUpdating] = useState<Set<number>>(new Set());
  const [tracking, setTracking] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/courses/tracked')
      .then(r => r.json())
      .then(({ data }) => { if (Array.isArray(data)) setTracked(data); })
      .finally(() => setLoadingTracked(false));

    fetch('/api/courses/recommended')
      .then(r => r.json())
      .then(({ data }) => { if (data) setRecommended(data); })
      .finally(() => setLoadingRec(false));
  }, []);

  async function toggleDone(course: TrackedCourse) {
    setUpdating(prev => new Set([...prev, course.id]));
    const newStatus = course.status === 'completed' ? 'in_progress' : 'completed';
    const res = await fetch('/api/courses/track', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: course.id, status: newStatus }),
    });
    const { data } = await res.json();
    if (data) {
      setTracked(prev => prev.map(c => c.id === course.id ? { ...c, status: newStatus } : c));
    }
    setUpdating(prev => { const n = new Set(prev); n.delete(course.id); return n; });
  }

  async function removeCourse(course: TrackedCourse) {
    setUpdating(prev => new Set([...prev, course.id]));
    await fetch(`/api/courses/track?id=${course.id}`, { method: 'DELETE' });
    setTracked(prev => prev.filter(c => c.id !== course.id));
    setUpdating(prev => { const n = new Set(prev); n.delete(course.id); return n; });
  }

  async function trackRecommended(course: SsgCourse) {
    const key = course.referenceNumber || course.title;
    if (tracking.has(key)) return;
    setTracking(prev => new Set([...prev, key]));

    const res = await fetch('/api/courses/track', {
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
    const { data } = await res.json();
    if (data) setTracked(prev => [data, ...prev]);
    setTracking(prev => { const n = new Set(prev); n.delete(key); return n; });
  }

  const trackedKeys = new Set(tracked.map(c => c.course_reference_number || c.course_title));
  const completedCount = tracked.filter(c => c.status === 'completed').length;
  const inProgressCount = tracked.filter(c => c.status === 'in_progress').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>My Courses</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Track your SkillsFuture learning progress.</p>
      </div>

      {/* Stats */}
      {!loadingTracked && tracked.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Tracked', value: tracked.length, icon: '📚', color: 'var(--primary)', bg: 'var(--primary-light)' },
            { label: 'In Progress', value: inProgressCount, icon: '⏳', color: 'var(--warning)', bg: '#fffbeb' },
            { label: 'Completed', value: completedCount, icon: '✅', color: 'var(--teal)', bg: '#f0fdfa' },
          ].map(s => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: s.bg }}>
                {s.icon}
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tracked courses */}
      <div className="card p-5">
        <h2 className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>📖 My Tracked Courses</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Click the large circle beside the Course Title once you have completed the course — this updates your career readiness progress.
        </p>

        {loadingTracked ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg skeleton" />)}
          </div>
        ) : tracked.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl block mb-3">📭</span>
            <p className="text-sm mb-1 font-medium" style={{ color: 'var(--foreground)' }}>No courses tracked yet</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Add courses from the recommended list below or via Skills Navigator</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tracked.map(course => {
              const done = course.status === 'completed';
              const busy = updating.has(course.id);
              return (
                <div
                  key={course.id}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: done ? '#f0fdf4' : 'var(--muted-bg)', border: done ? '1px solid #bbf7d0' : '1px solid transparent' }}
                >
                  {/* Done checkbox */}
                  <button
                    onClick={() => toggleDone(course)}
                    disabled={busy}
                    className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: done ? '#16a34a' : 'var(--muted)',
                      background: done ? '#16a34a' : 'transparent',
                      cursor: busy ? 'wait' : 'pointer',
                    }}
                    title={done ? 'Mark as in progress' : 'Mark as done'}
                  >
                    {done && <span className="text-white text-xs">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    {course.course_url ? (
                      <a
                        href={course.course_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium no-underline hover:underline block truncate"
                        style={{ color: done ? '#15803d' : 'var(--foreground)', textDecoration: done ? 'line-through' : 'none' }}
                      >
                        {course.course_title}
                      </a>
                    ) : (
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: done ? '#15803d' : 'var(--foreground)', textDecoration: done ? 'line-through' : 'none' }}
                      >
                        {course.course_title}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {course.provider_name && (
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{course.provider_name}</p>
                      )}
                      {course.skill_name && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                          {course.skill_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {course.fee && course.fee > 0 && (
                    <p className="text-xs font-medium shrink-0" style={{ color: 'var(--muted)' }}>
                      ${Number(course.fee).toLocaleString()}
                    </p>
                  )}

                  <button
                    onClick={() => removeCourse(course)}
                    disabled={busy}
                    className="shrink-0 text-xs px-2 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--muted)', background: 'transparent' }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommended courses */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              ✨ Recommended for You
            </h2>
            {recommended && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Based on your goal: <span style={{ color: 'var(--primary)' }}>{recommended.job_role_name}</span>
              </p>
            )}
          </div>
          {recommended && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
              style={
                recommended.source === 'mock'
                  ? { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }
                  : { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
              }
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: recommended.source === 'mock' ? '#9ca3af' : '#16a34a' }} />
              {recommended.source === 'live' ? 'Live from SkillsFuture' : recommended.source === 'catalog' ? 'SkillsFuture catalog' : 'No SSG API — search manually'}
            </span>
          )}
        </div>

        {loadingRec ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg skeleton" />)}
          </div>
        ) : !recommended ? (
          <div className="text-center py-8">
            <span className="text-4xl block mb-3">🎯</span>
            <p className="text-sm mb-3 font-medium" style={{ color: 'var(--foreground)' }}>No career goal set yet</p>
            <Link href="/career" className="btn-primary text-sm no-underline" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
              Set Career Goal →
            </Link>
          </div>
        ) : (() => {
          const liveCourses = recommended.courses.filter(c => c.referenceNumber);
          const searchLinks = recommended.courses.filter(c => !c.referenceNumber);
          const extractKeyword = (title: string) => {
            const m = title.match(/^Search "(.+)" courses on SkillsFuture$/);
            return m ? m[1] : title;
          };
          return (
            <div>
              {/* Live course cards */}
              {liveCourses.length > 0 && (
                <div className="space-y-2 mb-3">
                  {liveCourses.map(course => {
                    const key = course.referenceNumber;
                    const isTracked = trackedKeys.has(key);
                    const isTracking = tracking.has(key);
                    return (
                      <div key={key} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                        <div className="flex-1 min-w-0">
                          <a href={course.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-medium no-underline hover:underline block truncate" style={{ color: 'var(--foreground)' }}>
                            {course.title}
                          </a>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                            {course.providerName}{course.modeOfTraining ? ` · ${course.modeOfTraining}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {course.subsidisedFee && course.subsidisedFee > 0 ? (
                            <>
                              <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>${course.subsidisedFee.toLocaleString()}</p>
                              <p className="text-xs line-through" style={{ color: 'var(--muted)' }}>${course.totalCostOfTrainingPerTrainee.toLocaleString()}</p>
                            </>
                          ) : null}
                        </div>
                        <button onClick={() => trackRecommended(course)} disabled={isTracked || isTracking}
                          className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                          style={isTracked ? { background: '#dcfce7', color: '#15803d', cursor: 'default' } : { background: 'var(--primary)', color: 'white', cursor: isTracking ? 'wait' : 'pointer' }}>
                          {isTracked ? '✓ Added' : isTracking ? '…' : '+ Track'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No live data — skill keyword chips */}
              {liveCourses.length === 0 && searchLinks.length > 0 && (
                <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>
                    Search these skill topics on SkillsFuture:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchLinks.map(link => (
                      <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium no-underline transition-opacity hover:opacity-80"
                        style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                        🔍 {extractKeyword(link.title)}
                      </a>
                    ))}
                  </div>
                  <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                    Click a topic to open SkillsFuture and use the search box to find matching courses.
                  </p>
                </div>
              )}

              <a href={`https://courses.myskillsfuture.gov.sg/search?keyword=${encodeURIComponent(recommended.job_role_name)}`}
                target="_blank" rel="noopener noreferrer"
                className="block text-center text-xs mt-3 py-2 rounded-lg no-underline transition-opacity hover:opacity-70"
                style={{ color: 'var(--primary)', border: '1px solid var(--card-border)' }}>
                Browse all courses on SkillsFuture →
              </a>
            </div>
          );
        })()}
      </div>

      <div className="text-center">
        <Link href="/skills-navigator" className="text-sm no-underline" style={{ color: 'var(--primary)' }}>
          Run full skills gap analysis in Skills Navigator →
        </Link>
      </div>
    </div>
  );
}
