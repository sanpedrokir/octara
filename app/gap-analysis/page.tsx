'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LoadingSpinner from '../ui/LoadingSpinner';

type Filter = 'all' | 'matched' | 'missing';
type Status = 'strong' | 'partial' | 'course_earned' | 'missing';

interface CompetencyRow {
  skill_title: string;
  skill_code: string | null;
  required_level: string | null;
  user_proficiency: string | null;
  source: string | null;
  ssg_matched: boolean;
  self_assessment_score: number | null;
  matched: boolean;
  status: Status;
}

interface GapSummary {
  total: number;
  matched: number;
  missing: number;
  strong: number;
  course_earned: number;
}

interface GapData {
  career: { sector: string; role: string };
  required: CompetencyRow[];
  summary: GapSummary;
}

interface Course {
  title: string;
  provider: string;
  type: 'ssg' | 'youtube' | 'mooc' | 'online';
  url: string;
  description: string;
  skills_covered: string[];
  // runtime state
  _trackId?: number;
  _status?: 'tracked' | 'completed';
}

const SCORE_LABELS = ['', 'No knowledge', 'Basic awareness', 'Applied', 'Proficient', 'Expert'];
const SCORE_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#6366f1'];
const TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  ssg:     { label: 'SSG',     icon: '🏛',  color: '#7c3aed', bg: '#f5f3ff' },
  youtube: { label: 'YouTube', icon: '▶',   color: '#dc2626', bg: '#fef2f2' },
  mooc:    { label: 'MOOC',    icon: '🎓',  color: '#2563eb', bg: '#eff6ff' },
  online:  { label: 'Online',  icon: '🌐',  color: '#059669', bg: '#f0fdf4' },
};

const STATUS_STYLE: Record<Status, { row: string; badge: string; badgeText: string }> = {
  strong:       { row: '#f0fdf4', badge: '#dcfce7', badgeText: '#15803d' },
  partial:      { row: '#fffbeb', badge: '#fef3c7', badgeText: '#92400e' },
  course_earned:{ row: '#eff6ff', badge: '#dbeafe', badgeText: '#1d4ed8' },
  missing:      { row: '#fff1f2', badge: '#fee2e2', badgeText: '#b91c1c' },
};

const STATUS_LABEL: Record<Status, string> = {
  strong:       '✓ Matched',
  partial:      '~ Partial',
  course_earned:'🎓 Course earned',
  missing:      '✗ Missing',
};

function ScoreDots({ score, size = 18 }: { score: number | null; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <div
          key={n}
          style={{
            width: size, height: size,
            borderRadius: '50%',
            background: score !== null && n <= score ? SCORE_COLORS[score] : '#e5e7eb',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}

export default function GapAnalysisPage() {
  const [gapData, setGapData]       = useState<GapData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState<Filter>('all');
  const [gapPage, setGapPage]       = useState(0);
  const [assessingKey, setAssessingKey] = useState<string | null>(null);
  const [pendingScore, setPendingScore] = useState<number>(0);
  const [savingAssess, setSavingAssess] = useState(false);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseError, setCourseError] = useState('');
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/gap-analysis');
    const { data, error: e } = await res.json();
    if (e === 'NO_CAREER_GOAL') {
      setError('NO_CAREER_GOAL');
    } else if (e === 'NO_SECTOR') {
      setError('NO_SECTOR');
    } else if (e) {
      setError(e);
    } else {
      setGapData(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Open self-assess panel for a skill
  function openAssess(skill: CompetencyRow) {
    setAssessingKey(skill.skill_title);
    setPendingScore(skill.self_assessment_score ?? 0);
  }

  function closeAssess() {
    setAssessingKey(null);
    setPendingScore(0);
  }

  async function saveAssessment(skillTitle: string, score: number) {
    setSavingAssess(true);
    await fetch('/api/gap-analysis/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_title: skillTitle, score }),
    });
    setSavingAssess(false);
    closeAssess();
    load();
  }

  // Recommend courses for missing skills
  async function recommendCourses() {
    if (!gapData) return;
    const missing = gapData.required
      .filter(r => r.status === 'missing')
      .map(r => r.skill_title);
    if (!missing.length) return;

    setLoadingCourses(true);
    setCourseError('');
    setCourses([]);

    const res = await fetch('/api/gap-analysis/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingSkills: missing, sector: gapData.career.sector, role: gapData.career.role }),
    });
    const { data, error: e } = await res.json();
    if (e) { setCourseError(e); }
    else { setCourses(data?.courses ?? []); }
    setLoadingCourses(false);
  }

  // Track a course from recommendations
  async function trackCourse(course: Course, markComplete = false) {
    const courseKey = `${course.title}::${course.provider}`;
    setTrackingId(courseKey);

    const existing = course._trackId;

    if (markComplete && existing) {
      // Mark existing tracked record as completed
      const res = await fetch('/api/courses/track', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing, status: 'completed' }),
      });
      const { data } = await res.json();
      if (data) {
        // Credit each skill covered into user_competencies
        for (const skill of course.skills_covered) {
          await fetch('/api/competency/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skill_title: skill, proficiency_level: 'intermediate', source: 'course', ssg_matched: false }),
          });
        }
        setCourses(prev => prev.map(c =>
          c.title === course.title && c.provider === course.provider
            ? { ...c, _status: 'completed' } : c
        ));
        load(); // refresh gap analysis
      }
    } else if (!existing) {
      const res = await fetch('/api/courses/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_title: course.title,
          provider_name: course.provider,
          course_url: course.url,
          skill_name: course.skills_covered[0] ?? null,
        }),
      });
      const { data } = await res.json();
      if (data) {
        setCourses(prev => prev.map(c =>
          c.title === course.title && c.provider === course.provider
            ? { ...c, _trackId: data.id, _status: 'tracked' } : c
        ));
      }
    }

    setTrackingId(null);
  }

  // Filter rows
  const filtered = gapData?.required.filter(r => {
    if (filter === 'matched') return r.matched;
    if (filter === 'missing') return !r.matched;
    return true;
  }) ?? [];
  const GAP_PAGE_SIZE = 10;
  const gapTotalPages = Math.ceil(filtered.length / GAP_PAGE_SIZE);
  const pagedRows = filtered.slice(gapPage * GAP_PAGE_SIZE, (gapPage + 1) * GAP_PAGE_SIZE);

  // ── Empty / Error states ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner label="Analysing competency gap…" />
      </div>
    );
  }

  if (error === 'NO_CAREER_GOAL') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">🎯</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Set your career goal first</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Gap analysis requires a career aspiration to compare against the SSG Skills Framework.
        </p>
        <Link href="/career" className="btn-primary inline-block">Go to Career Goal →</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 max-w-lg mx-auto mt-16 text-center space-y-3">
        <p className="text-2xl">⚠️</p>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        <button onClick={load} className="btn-primary text-sm">Retry</button>
      </div>
    );
  }

  if (!gapData) return null;

  const { career, summary } = gapData;
  const missingCount = gapData.required.filter(r => r.status === 'missing').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Competency Gap Analysis</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {career.role ? `${career.role} · ` : ''}{career.sector} · SSG Skills Framework
        </p>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Required',    value: summary.total,        color: '#1e40af', bg: '#eff6ff' },
          { label: 'Matched',     value: summary.matched,      color: '#15803d', bg: '#f0fdf4' },
          { label: 'Missing',     value: summary.missing,      color: '#b91c1c', bg: '#fef2f2' },
          { label: 'Self-Rated',  value: summary.strong,       color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── No data from SSG ────────────────────────────────────────────── */}
      {gapData.required.length === 0 && (
        <div className="card p-8 text-center space-y-3">
          <p className="text-3xl">🔍</p>
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
            No SSG skills found for "{career.sector}"
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The SSG Skills Framework database may not have entries for this sector yet.
            Try uploading your resume to build your competency profile manually.
          </p>
          <Link href="/competency" className="btn-primary inline-block text-sm">Go to Competency Profile</Link>
        </div>
      )}

      {/* ── 3-Column Competency Table ────────────────────────────────────── */}
      {gapData.required.length > 0 && (
        <div className="card overflow-hidden">
          {/* Filter tabs */}
          <div className="flex border-b" style={{ borderColor: 'var(--card-border)' }}>
            {([
              { id: 'all' as Filter,     label: `All (${summary.total})` },
              { id: 'matched' as Filter, label: `✓ Matched (${summary.matched})` },
              { id: 'missing' as Filter, label: `✗ Missing (${summary.missing})` },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => { setFilter(t.id); setGapPage(0); }}
                className="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                style={{
                  borderColor: filter === t.id ? 'var(--primary)' : 'transparent',
                  color: filter === t.id ? 'var(--primary)' : 'var(--muted)',
                  background: 'transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div
            className="hidden sm:grid grid-cols-[1fr_1fr_180px] gap-0 text-xs font-semibold uppercase tracking-wide px-4 py-2.5"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', borderBottom: '1px solid var(--card-border)' }}
          >
            <span>Required Competency</span>
            <span>Your Current Level</span>
            <span className="text-center">Self-Assessment</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
            {pagedRows.map((row, i) => {
              const style = STATUS_STYLE[row.status];
              const isAssessing = assessingKey === row.skill_title;

              return (
                <div key={`${row.skill_code ?? row.skill_title}-${i}`}>
                  {/* Main row */}
                  <div
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px] gap-3 sm:gap-0 p-4"
                    style={{ background: style.row }}
                  >
                    {/* Col 1: Required competency */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {row.skill_title}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: style.badge, color: style.badgeText }}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {row.skill_code && (
                          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{row.skill_code}</span>
                        )}
                        {row.required_level && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>
                            Required: {row.required_level}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Col 2: User's current level */}
                    <div className="flex flex-col justify-center gap-1 sm:px-4">
                      {row.user_proficiency ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{
                                background: { basic: '#f3f4f6', intermediate: '#eff6ff', advanced: '#f0fdf4', expert: '#fdf4ff' }[row.user_proficiency] ?? '#f3f4f6',
                                color:      { basic: '#6b7280', intermediate: '#2563eb', advanced: '#15803d', expert: '#7c3aed' }[row.user_proficiency] ?? '#6b7280',
                              }}
                            >
                              {row.user_proficiency}
                            </span>
                            {row.ssg_matched && (
                              <span className="text-xs" style={{ color: '#15803d' }}>✓ SSG</span>
                            )}
                          </div>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {row.source === 'resume' ? '📄 from resume' : row.source === 'course' ? '🎓 course earned' : row.source === 'ssg' ? '🏛 SSG' : row.source === 'self_assessment' ? '⭐ self-assessed' : '✍️ self-added'}
                          </span>
                        </>
                      ) : row.status === 'course_earned' ? (
                        <span className="text-sm" style={{ color: '#1d4ed8' }}>🎓 Earned via course</span>
                      ) : (
                        <span className="text-sm italic" style={{ color: 'var(--muted)' }}>Not in profile</span>
                      )}
                    </div>

                    {/* Col 3: Self-assess */}
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      {row.self_assessment_score ? (
                        <>
                          <ScoreDots score={row.self_assessment_score} size={14} />
                          <span className="text-xs" style={{ color: SCORE_COLORS[row.self_assessment_score] }}>
                            {row.self_assessment_score}/5 · {SCORE_LABELS[row.self_assessment_score]}
                          </span>
                          <button
                            onClick={() => openAssess(row)}
                            className="text-xs underline"
                            style={{ color: 'var(--muted)' }}
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openAssess(row)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium w-full max-w-[140px]"
                          style={{ background: 'var(--primary)', color: 'white' }}
                        >
                          Assess Myself
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline self-assessment panel */}
                  {isAssessing && (
                    <div
                      className="px-4 pb-4 pt-3 space-y-3"
                      style={{ background: '#f8fafc', borderTop: '1px solid var(--card-border)' }}
                    >
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        How would you rate your <strong>{row.skill_title}</strong> competency?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => setPendingScore(n)}
                            className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-bold"
                            style={{
                              borderColor: pendingScore === n ? SCORE_COLORS[n] : 'var(--card-border)',
                              background: pendingScore === n ? SCORE_COLORS[n] : 'white',
                              color: pendingScore === n ? 'white' : 'var(--foreground)',
                              minWidth: 64,
                            }}
                          >
                            <span className="text-lg font-black">{n}</span>
                            <span className="text-xs font-normal text-center leading-tight" style={{ color: pendingScore === n ? 'rgba(255,255,255,0.9)' : 'var(--muted)' }}>
                              {SCORE_LABELS[n]}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveAssessment(row.skill_title, pendingScore)}
                          disabled={!pendingScore || savingAssess}
                          className="btn-primary text-sm"
                          style={{ opacity: !pendingScore || savingAssess ? 0.6 : 1 }}
                        >
                          {savingAssess ? 'Saving…' : 'Save Assessment'}
                        </button>
                        <button
                          onClick={closeAssess}
                          className="text-sm px-4 py-2 rounded-lg"
                          style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {gapTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                <button
                  onClick={() => setGapPage(p => Math.max(0, p - 1))}
                  disabled={gapPage === 0}
                  className="text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ color: gapPage === 0 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                >
                  ← Previous
                </button>
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  Page {gapPage + 1} of {gapTotalPages} · {filtered.length} skills
                </span>
                <button
                  onClick={() => setGapPage(p => Math.min(gapTotalPages - 1, p + 1))}
                  disabled={gapPage === gapTotalPages - 1}
                  className="text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ color: gapPage === gapTotalPages - 1 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Course Recommendations ───────────────────────────────────────── */}
      {gapData.required.length > 0 && (
        <div className="card p-5 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Course Recommendations</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {missingCount > 0
                  ? `Courses to bridge ${missingCount} missing competencies — SSG, YouTube, and free MOOCs`
                  : 'All competencies matched! Great job.'}
              </p>
            </div>
            {missingCount > 0 && (
              <button
                onClick={recommendCourses}
                disabled={loadingCourses}
                className="btn-primary text-sm shrink-0"
                style={{ opacity: loadingCourses ? 0.7 : 1 }}
              >
                {loadingCourses ? <><LoadingSpinner label="" /> Generating…</> : courses.length ? '🔄 Regenerate' : '🤖 Recommend Courses'}
              </button>
            )}
          </div>

          {courseError && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)' }}>
              {courseError}
            </div>
          )}

          {loadingCourses && (
            <div className="flex items-center gap-3 py-4">
              <LoadingSpinner label="" />
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                AI is analysing your gaps and matching courses…
              </span>
            </div>
          )}

          {courses.length > 0 && (
            <div className="space-y-3">
              {courses.map((course, i) => {
                const meta = TYPE_META[course.type] ?? TYPE_META.online;
                const isTracking = trackingId === `${course.title}::${course.provider}`;
                const isTracked = course._status === 'tracked';
                const isCompleted = course._status === 'completed';

                return (
                  <div
                    key={i}
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: isCompleted ? '#f0fdf4' : 'var(--muted-bg)', border: `1px solid ${isCompleted ? '#bbf7d0' : 'transparent'}` }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type badge */}
                      <div
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={course.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold hover:underline"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {course.title}
                          </a>
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.color }}>
                            {meta.label}
                          </span>
                          {isCompleted && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{course.provider}</p>
                        <p className="text-sm mt-1.5" style={{ color: 'var(--foreground)', lineHeight: 1.5 }}>
                          {course.description}
                        </p>
                        {/* Skills covered */}
                        {course.skills_covered?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Covers:</span>
                            {course.skills_covered.map(s => (
                              <span
                                key={s}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: '#f1f5f9', color: '#475569' }}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {!isCompleted && (
                      <div className="flex gap-2 pt-1 pl-11">
                        {!isTracked ? (
                          <button
                            onClick={() => trackCourse(course)}
                            disabled={!!isTracking}
                            className="text-sm px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: 'var(--primary)', color: 'white', opacity: isTracking ? 0.7 : 1 }}
                          >
                            {isTracking ? '…' : '📌 Track'}
                          </button>
                        ) : (
                          <>
                            <span className="text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                              📌 Tracking
                            </span>
                            <button
                              onClick={() => trackCourse(course, true)}
                              disabled={!!isTracking}
                              className="text-sm px-3 py-1.5 rounded-lg font-medium"
                              style={{ background: '#dcfce7', color: '#15803d', opacity: isTracking ? 0.7 : 1 }}
                            >
                              {isTracking ? '…' : '✓ Mark Complete'}
                            </button>
                          </>
                        )}
                        <a
                          href={course.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}
                        >
                          Open ↗
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {courses.length === 0 && !loadingCourses && missingCount > 0 && (
            <div className="text-center py-6" style={{ color: 'var(--muted)' }}>
              <p className="text-2xl mb-2">🤖</p>
              <p className="text-sm">Click "Recommend Courses" to get AI-curated learning resources for your skill gaps.</p>
            </div>
          )}

          {missingCount === 0 && (
            <div className="text-center py-6" style={{ color: 'var(--muted)' }}>
              <p className="text-2xl mb-2">🏆</p>
              <p className="text-sm font-medium" style={{ color: '#15803d' }}>All required competencies matched!</p>
              <p className="text-xs mt-1">Keep building your profile by uploading your resume or adding new skills.</p>
            </div>
          )}

          {/* Link to My Courses */}
          {courses.some(c => c._status) && (
            <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Tracked courses appear in My Courses.</p>
              <Link href="/my-courses" className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                View My Courses →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
