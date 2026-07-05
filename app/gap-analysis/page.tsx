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
  matched: boolean;
  status: Status;
  fuzzy_matched_via: string | null;
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
  is_esco: boolean;
}

interface SsgCourse {
  title: string;
  provider: string;
  type: 'ssg';
  url: string;
  description: string;
  skills_covered: string[];
  _trackId?: number;
  _status?: 'tracked' | 'completed';
}

interface YouTubeVideo {
  courseTitle: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  watchUrl: string;
}

interface MoocCourse {
  title: string;
  provider: string;
  type: 'mooc';
  url: string;
  description: string;
  skills_covered: string[];
  _trackId?: number;
  _status?: 'tracked' | 'completed';
}

interface InstCourse {
  id: number;
  title: string;
  provider: string;
  type: 'institution';
  url: string | null;
  description: string | null;
  duration: string | null;
  cost: string | null;
  skills_covered: string[];
}

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

const PAGE_SIZE = 5;

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="text-sm px-4 py-2 rounded-lg font-medium"
        style={{ color: page === 0 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
      >
        ← Previous
      </button>
      <span className="text-sm" style={{ color: 'var(--muted)' }}>
        Page {page + 1} of {totalPages} · {total} items
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        className="text-sm px-4 py-2 rounded-lg font-medium"
        style={{ color: page === totalPages - 1 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
      >
        Next →
      </button>
    </div>
  );
}

export default function GapAnalysisPage() {
  const [gapData, setGapData]       = useState<GapData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState<Filter>('all');
  const [gapPage, setGapPage]       = useState(0);
  // Course recommendation state
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseError, setCourseError]       = useState('');
  const [ssgCourses, setSsgCourses]         = useState<SsgCourse[]>([]);
  const [youtubeMap, setYoutubeMap]         = useState<Record<string, YouTubeVideo>>({});
  const [moocCourses, setMoocCourses]       = useState<MoocCourse[]>([]);
  const [combinedPage, setCombinedPage]     = useState(0);
  const [courseTab, setCourseTab]           = useState<'ssg' | 'youtube' | 'mooc' | 'institution'>('ssg');
  const [instCourses, setInstCourses]       = useState<InstCourse[]>([]);
  const [instName, setInstName]             = useState<string | null>(null);
  const [trackingId, setTrackingId]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/gap-analysis');
    const { data, error: e } = await res.json();
    if (e === 'NO_CAREER_GOAL') { setError('NO_CAREER_GOAL'); setLoading(false); return; }
    if (e === 'NO_SECTOR') { setError('NO_SECTOR'); setLoading(false); return; }
    if (e === 'NO_COMPETENCY_PROFILE') { setError('NO_COMPETENCY_PROFILE'); setLoading(false); return; }
    if (e === 'ESCO_SKILLS_NOT_SYNCED') { setError('ESCO_SKILLS_NOT_SYNCED'); setLoading(false); return; }
    if (e) { setError(e); setLoading(false); return; }
    setGapData(data);

    // Load saved recommendations — only apply if they were generated for the same role
    const missing = (data.required ?? []).filter((r: { status: string }) => r.status === 'missing').map((r: { skill_title: string }) => r.skill_title);
    let hasRecs = false;
    try {
      const recRes = await fetch('/api/gap-analysis/recommend');
      const { data: recData } = await recRes.json() as { data: { courses: SsgCourse[]; youtube: Record<string, YouTubeVideo>; mooc: MoocCourse[]; role: string | null; sector: string | null } | null };
      if (recData) {
        const currentRole = (data.career.role || data.career.sector || '').toLowerCase().trim();
        const savedRole   = (recData.role || recData.sector || '').toLowerCase().trim();
        if (!savedRole || savedRole === currentRole) {
          setSsgCourses((recData.courses ?? []).map((c) => ({ ...c })));
          setYoutubeMap(typeof recData.youtube === 'object' && !Array.isArray(recData.youtube) ? recData.youtube : {});
          setMoocCourses((recData.mooc ?? []).map((c) => ({ ...c })));
          hasRecs = (recData.courses?.length ?? 0) > 0 || (recData.mooc?.length ?? 0) > 0;
        }
      }
    } catch { /* ignore */ }

    setLoading(false);

    // Fetch institution courses (students only — API returns empty if no institution linked)
    if (missing.length > 0) {
      try {
        const instRes = await fetch('/api/gap-analysis/institution-courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missingSkills: missing }),
        });
        const { data: instData } = await instRes.json() as { data: { courses: InstCourse[]; institutionName: string | null } | null };
        if (instData?.courses?.length) {
          setInstCourses(instData.courses);
          setInstName(instData.institutionName);
        }
      } catch { /* non-fatal */ }
    }

    // Auto-generate recommendations if missing skills exist but no saved recs for this role
    if (!hasRecs && missing.length > 0) {
      setLoadingCourses(true);
      setCourseError('');
      try {
        const res = await fetch('/api/gap-analysis/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missingSkills: missing, sector: data.career.sector, role: data.career.role, isEsco: data.is_esco }),
        });
        const { data: recData, error: recErr } = await res.json();
        if (recErr) { setCourseError(recErr); }
        else if (recData) {
          setSsgCourses((recData.courses ?? []).map((c: SsgCourse) => ({ ...c })));
          setYoutubeMap(typeof recData.youtube === 'object' && !Array.isArray(recData.youtube) ? recData.youtube : {});
          setMoocCourses((recData.mooc ?? []).map((c: MoocCourse) => ({ ...c })));
        }
      } catch { setCourseError('Failed to generate recommendations.'); }
      finally { setLoadingCourses(false); }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recommendCourses() {
    if (!gapData) return;
    const missing = gapData.required.filter(r => r.status === 'missing').map(r => r.skill_title);
    if (!missing.length) return;

    setLoadingCourses(true);
    setCourseError('');
    setSsgCourses([]);
    setYoutubeMap({});
    setMoocCourses([]);
    setCombinedPage(0);

    const res = await fetch('/api/gap-analysis/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingSkills: missing, sector: gapData.career.sector, role: gapData.career.role, isEsco: gapData.is_esco }),
    });
    const { data, error: e } = await res.json();
    if (e) {
      setCourseError(e);
    } else {
      setSsgCourses((data?.courses ?? []).map((c: SsgCourse) => ({ ...c })));
      setYoutubeMap(typeof data?.youtube === 'object' && !Array.isArray(data?.youtube)
        ? data.youtube as Record<string, YouTubeVideo>
        : {});
      setMoocCourses((data?.mooc ?? []).map((c: MoocCourse) => ({ ...c })));
    }
    setLoadingCourses(false);
  }

  async function trackCourse(course: SsgCourse | MoocCourse, markComplete = false) {
    const courseKey = `${course.title}::${course.provider}`;
    setTrackingId(courseKey);
    const existing = course._trackId;

    if (markComplete && existing) {
      const res = await fetch('/api/courses/track', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing, status: 'completed' }),
      });
      const { data } = await res.json();
      if (data) {
        for (const skill of course.skills_covered) {
          await fetch('/api/competency/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skill_title: skill, proficiency_level: 'intermediate', source: 'course', ssg_matched: false }),
          });
        }
        const updater = (c: SsgCourse | MoocCourse) =>
          c.title === course.title && c.provider === course.provider ? { ...c, _status: 'completed' as const } : c;
        if (course.type === 'ssg') setSsgCourses(prev => prev.map(updater as (c: SsgCourse) => SsgCourse));
        else setMoocCourses(prev => prev.map(updater as (c: MoocCourse) => MoocCourse));
        load();
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
        const updater = (c: SsgCourse | MoocCourse) =>
          c.title === course.title && c.provider === course.provider ? { ...c, _trackId: data.id, _status: 'tracked' as const } : c;
        if (course.type === 'ssg') setSsgCourses(prev => prev.map(updater as (c: SsgCourse) => SsgCourse));
        else setMoocCourses(prev => prev.map(updater as (c: MoocCourse) => MoocCourse));
      }
    }
    setTrackingId(null);
  }

  // Gap table filtering + pagination
  const filtered = gapData?.required.filter(r => {
    if (filter === 'matched') return r.matched;
    if (filter === 'missing') return !r.matched;
    return true;
  }) ?? [];
  const GAP_PAGE_SIZE = 10;
  const gapTotalPages = Math.ceil(filtered.length / GAP_PAGE_SIZE);
  const pagedRows = filtered.slice(gapPage * GAP_PAGE_SIZE, (gapPage + 1) * GAP_PAGE_SIZE);

  // Combined 3-column pagination
  const combinedTotal = Math.max(ssgCourses.length, moocCourses.length);
  const ssgPaged  = ssgCourses.slice(combinedPage * PAGE_SIZE, (combinedPage + 1) * PAGE_SIZE);
  const moocPaged = moocCourses.slice(combinedPage * PAGE_SIZE, (combinedPage + 1) * PAGE_SIZE);
  const rowCount  = Math.max(ssgPaged.length, moocPaged.length);

  const missingCount = gapData?.required.filter(r => r.status === 'missing').length ?? 0;
  const anyTracked   = ssgCourses.some(c => c._status) || moocCourses.some(c => c._status);
  const isEsco       = gapData?.is_esco ?? false;

  // ── Shared course card action buttons ─────────────────────────────────
  function CourseActions({ course }: { course: SsgCourse | MoocCourse }) {
    const isTracking = trackingId === `${course.title}::${course.provider}`;
    const isTracked = course._status === 'tracked';
    const isCompleted = course._status === 'completed';
    if (isCompleted) return null;
    return (
      <div className="flex gap-2 flex-wrap pt-1">
        {!isTracked ? (
          <button
            onClick={() => trackCourse(course)}
            disabled={!!isTracking}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--primary)', color: 'white', opacity: isTracking ? 0.7 : 1 }}
          >
            {isTracking ? '…' : '📌 Track'}
          </button>
        ) : (
          <>
            <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              📌 Tracking
            </span>
            <button
              onClick={() => trackCourse(course, true)}
              disabled={!!isTracking}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
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
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}
        >
          Open ↗
        </a>
      </div>
    );
  }

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

  if (error === 'ESCO_SKILLS_NOT_SYNCED') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">🔄</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>ESCO skills not synced yet</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          The required skills for your occupation haven&apos;t been imported yet. Ask your administrator to run
          <strong> ESCO → Sync Skills per Occupation</strong> in the Admin Panel. This is a one-time setup
          (takes ~10 minutes) and only needs to be repeated when ESCO releases a new version.
        </p>
      </div>
    );
  }

  if (error === 'NO_COMPETENCY_PROFILE') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-4xl">📄</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Upload your resume first</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          You haven&apos;t uploaded your resume yet. Upload it in Competency Profile first so we can analyse your skill gaps.
        </p>
        <Link href="/competency" className="btn-primary inline-block">Go to Competency Profile →</Link>
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Competency Gap Analysis</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {career.role ? `${career.role} · ` : ''}{career.sector} · {isEsco ? 'ESCO Skills Framework' : 'SSG Skills Framework'}
        </p>
      </div>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-3 text-xs space-y-1" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
        <p className="font-semibold">How these numbers relate to your other pages</p>
        <p><span className="font-medium">Competency Profile</span> — all skills extracted from your CV (may be a larger number).</p>
        <p><span className="font-medium">Gap Analysis</span> — only the skills required for <span className="font-medium">{career.role || career.sector}</span> are shown here, compared against what you have.</p>
        <p><span className="font-medium">Career Goal</span> sets the target role. Re-upload your CV anytime — Gap Analysis updates automatically on your next visit.</p>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Required', value: summary.total,   color: '#1e40af', bg: '#eff6ff' },
          { label: 'Matched',  value: summary.matched, color: '#15803d', bg: '#f0fdf4' },
          { label: 'Missing',  value: summary.missing, color: '#b91c1c', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} className="card p-2.5 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Skills match progress bar ────────────────────────────────────── */}
      {summary.total > 0 && (() => {
        const pct = Math.round((summary.matched / summary.total) * 100);
        const barColor = pct < 30 ? '#ef4444' : pct < 60 ? '#f97316' : pct < 80 ? '#eab308' : '#22c55e';
        return (
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Skills Match Progress</span>
              <span className="text-sm font-bold" style={{ color: barColor }}>{pct}% ({summary.matched}/{summary.total})</span>
            </div>
            <div className="w-full rounded-full h-3" style={{ background: 'var(--muted-bg)' }}>
              <div className="h-3 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {summary.missing} skill{summary.missing !== 1 ? 's' : ''} to close · complete courses below to improve your match
            </p>
          </div>
        );
      })()}

      {/* ── No SSG data ─────────────────────────────────────────────────── */}
      {gapData.required.length === 0 && (
        <div className="card p-8 text-center space-y-3">
          <p className="text-3xl">🔍</p>
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
            {isEsco ? `No ESCO skills found for "${career.role || career.sector}"` : `No SSG skills found for "${career.sector}"`}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Upload your resume to build your competency profile manually.
          </p>
          <Link href="/competency" className="btn-primary inline-block text-sm">Go to Competency Profile</Link>
        </div>
      )}

      {/* ── Competency Table ─────────────────────────────────────────────── */}
      {gapData.required.length > 0 && (
        <div className="card overflow-hidden">
          {/* Filter tabs */}
          <div className="overflow-x-auto">
            <div className="flex border-b min-w-max" style={{ borderColor: 'var(--card-border)' }}>
              {([
                { id: 'all' as Filter,     label: `All (${summary.total})` },
                { id: 'matched' as Filter, label: `✓ Matched (${summary.matched})` },
                { id: 'missing' as Filter, label: `✗ Missing (${summary.missing})` },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setFilter(t.id); setGapPage(0); }}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
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
          </div>

          {/* Column headers */}
          <div
            className="hidden sm:grid grid-cols-[1fr_1fr] gap-0 text-xs font-semibold uppercase tracking-wide px-4 py-2.5"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', borderBottom: '1px solid var(--card-border)' }}
          >
            <span>Required Competency</span>
            <span>Your Current Level</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
            {pagedRows.map((row, i) => {
              const style = STATUS_STYLE[row.status];

              return (
                <div key={`${row.skill_code ?? row.skill_title}-${i}`}>
                  <div
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3 sm:gap-0 p-4"
                    style={{ background: style.row }}
                  >
                    {/* Col 1 */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{row.skill_title}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: style.badge, color: style.badgeText }}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {row.skill_code && <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{row.skill_code}</span>}
                        {row.required_level && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>
                            Required: {row.required_level}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Col 2 */}
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
                            {row.ssg_matched && <span className="text-xs" style={{ color: '#15803d' }}>✓ SSG</span>}
                          </div>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {row.source === 'resume' ? '📄 from resume'
                              : row.source === 'course' ? '🎓 course earned'
                              : row.source === 'ssg' ? '🏛 SSG'
                              : '✍️ self-added'}
                          </span>
                          {row.fuzzy_matched_via && (
                            <span className="text-xs italic" style={{ color: '#92400e' }}>
                              ~ via &ldquo;{row.fuzzy_matched_via}&rdquo;
                            </span>
                          )}
                        </>
                      ) : row.status === 'course_earned' ? (
                        <span className="text-sm" style={{ color: '#1d4ed8' }}>🎓 Earned via course</span>
                      ) : (
                        <span className="text-sm italic" style={{ color: 'var(--muted)' }}>Not in profile</span>
                      )}
                    </div>

                  </div>
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

      {/* ── Course Recommendations wrapper ───────────────────────────────── */}
      {gapData.required.length > 0 && (
        <div className="space-y-5">

          {/* Header + generate button */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>📚 Course Recommendations</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {missingCount > 0
                  ? 'SSG courses, YouTube videos and MOOCs to bridge missing competencies'
                  : 'All competencies matched — great job!'}
              </p>
            </div>
            {loadingCourses ? (
              <span className="text-xs flex items-center gap-1.5 shrink-0" style={{ color: 'var(--muted)' }}>
                <LoadingSpinner label="" /> Generating…
              </span>
            ) : (ssgCourses.length > 0 || moocCourses.length > 0) && missingCount > 0 ? (
              <button
                onClick={recommendCourses}
                className="text-xs px-3 py-1.5 rounded-lg font-medium shrink-0"
                style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}
              >
                ↻ Refresh
              </button>
            ) : null}
          </div>

          {courseError && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)' }}>
              {courseError}
            </div>
          )}

          {loadingCourses && (
            <div className="card p-6 flex items-center gap-3">
              <LoadingSpinner label="" />
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {isEsco
                  ? 'Fetching YouTube videos and MOOC recommendations…'
                  : 'Fetching SSG courses, YouTube videos and MOOC recommendations…'}
              </span>
            </div>
          )}

          {/* Empty state */}
          {ssgCourses.length === 0 && moocCourses.length === 0 && !loadingCourses && missingCount > 0 && (
            <div className="card p-8 text-center space-y-2">
              <p className="text-3xl">🤖</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {isEsco
                  ? 'Click "Generate Recommendations" to get YouTube videos and MOOC recommendations. Once generated, they are saved automatically.'
                  : 'Click "Generate Recommendations" to get SSG courses, YouTube videos and MOOC recommendations. Once generated, they are saved automatically.'}
              </p>
            </div>
          )}

          {missingCount === 0 && (
            <div className="card p-8 text-center space-y-2">
              <p className="text-3xl">🏆</p>
              <p className="text-sm font-medium" style={{ color: '#15803d' }}>All required competencies matched!</p>
            </div>
          )}

          {/* ── Course Tabs ───────────────────────────────────────────────── */}
          {(ssgCourses.length > 0 || moocCourses.length > 0) && (() => {
            const ytVideos  = Object.values(youtubeMap);
            const activeTab = isEsco && courseTab === 'ssg' ? 'youtube' : courseTab;
            const tabItems  = activeTab === 'ssg' ? ssgCourses : activeTab === 'youtube' ? ytVideos : activeTab === 'institution' ? instCourses : moocCourses;
            const tabTotal  = tabItems.length;
            const tabPaged  = tabItems.slice(combinedPage * PAGE_SIZE, (combinedPage + 1) * PAGE_SIZE);

            const TAB_DEF = [
              ...(!isEsco ? [{ key: 'ssg',         label: '🏛 SSG Courses',      count: ssgCourses.length,  color: '#7c3aed' }] : []),
              {              key: 'youtube',     label: '▶ YouTube',             count: ytVideos.length,    color: '#dc2626' },
              {              key: 'mooc',        label: '🎓 MOOC / Coursera',    count: moocCourses.length, color: '#2563eb' },
              ...(instCourses.length > 0 ? [{ key: 'institution', label: `🏫 ${instName ?? 'My Institution'}`, count: instCourses.length, color: '#0d9488' }] : []),
            ] as { key: string; label: string; count: number; color: string }[];

            return (
              <div className="card overflow-hidden">
                {/* Tab bar */}
                <div className="flex overflow-x-auto border-b" style={{ borderColor: 'var(--card-border)' }}>
                  {TAB_DEF.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setCourseTab(tab.key as 'ssg' | 'youtube' | 'mooc' | 'institution'); setCombinedPage(0); }}
                      className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
                      style={{
                        borderBottomColor: activeTab === tab.key ? tab.color : 'transparent',
                        color: activeTab === tab.key ? tab.color : 'var(--muted)',
                        background: 'transparent',
                      }}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                          style={{ background: activeTab === tab.key ? tab.color : '#94a3b8' }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {tabPaged.length === 0 && (
                    <p className="p-6 text-sm italic text-center" style={{ color: 'var(--muted)' }}>No items in this tab.</p>
                  )}

                  {/* SSG tab */}
                  {activeTab === 'ssg' && (tabPaged as SsgCourse[]).map((ssg, i) => (
                    <div key={i} className="p-4 space-y-2" style={{ background: ssg._status === 'completed' ? '#f0fdf4' : 'white' }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#f5f3ff', color: '#7c3aed' }}>SSG</span>
                        {ssg._status === 'completed' && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>✓ Completed</span>}
                      </div>
                      <a href={ssg.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-semibold hover:underline leading-snug block" style={{ color: 'var(--foreground)' }}>
                        {ssg.title}
                      </a>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{ssg.provider}</p>
                      {ssg.description && <p className="text-xs" style={{ color: '#475569' }}>{ssg.description}</p>}
                      {ssg.skills_covered?.length > 0 && (
                        <span className="inline-block text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {ssg.skills_covered[0]}
                        </span>
                      )}
                      <CourseActions course={ssg} />
                    </div>
                  ))}

                  {/* YouTube tab */}
                  {activeTab === 'youtube' && (tabPaged as YouTubeVideo[]).map((yt, i) => (
                    <div key={i} className="p-4" style={{ background: '#fef9f9' }}>
                      <a href={yt.watchUrl} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start no-underline group">
                        <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 100, height: 58, background: '#dc2626' }}>
                          {yt.thumbnailUrl ? (
                            <img src={yt.thumbnailUrl} alt={yt.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-xl">▶</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug group-hover:underline" style={{ color: 'var(--foreground)' }}>
                            {yt.videoId ? yt.title : `Search: ${yt.title}`}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            {yt.channelTitle}{!yt.videoId && ' · YouTube search'}
                          </p>
                        </div>
                      </a>
                    </div>
                  ))}

                  {/* MOOC tab */}
                  {activeTab === 'mooc' && (tabPaged as MoocCourse[]).map((mooc, i) => (
                    <div key={i} className="p-4 space-y-2" style={{ background: mooc._status === 'completed' ? '#f0fdf4' : 'white' }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#eff6ff', color: '#2563eb' }}>Coursera</span>
                        {mooc._status === 'completed' && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>✓ Completed</span>}
                      </div>
                      <a href={mooc.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-semibold hover:underline leading-snug block" style={{ color: 'var(--foreground)' }}>
                        {mooc.title}
                      </a>
                      <p className="text-xs line-clamp-2" style={{ color: '#475569', lineHeight: 1.5 }}>{mooc.description}</p>
                      {mooc.skills_covered?.length > 0 && (
                        <span className="inline-block text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {mooc.skills_covered[0]}
                        </span>
                      )}
                      <CourseActions course={mooc} />
                    </div>
                  ))}

                  {/* Institution tab */}
                  {activeTab === 'institution' && (tabPaged as InstCourse[]).map((course, i) => (
                    <div key={i} className="p-4 space-y-2" style={{ background: 'white' }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#ccfbf1', color: '#0d9488' }}>
                          {instName ?? 'My Institution'}
                        </span>
                        {course.duration && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>⏱ {course.duration}</span>
                        )}
                        {course.cost && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>💰 {course.cost}</span>
                        )}
                      </div>
                      {course.url ? (
                        <a href={course.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-semibold hover:underline leading-snug block" style={{ color: 'var(--foreground)' }}>
                          {course.title}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>{course.title}</p>
                      )}
                      {course.description && (
                        <p className="text-xs line-clamp-2" style={{ color: '#475569', lineHeight: 1.5 }}>{course.description}</p>
                      )}
                      {course.skills_covered.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {course.skills_covered.slice(0, 3).map(s => (
                            <span key={s} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#ccfbf1', color: '#0d9488' }}>{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {tabTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                    <button
                      onClick={() => setCombinedPage(p => Math.max(0, p - 1))}
                      disabled={combinedPage === 0}
                      className="text-sm px-4 py-2 rounded-lg font-medium"
                      style={{ color: combinedPage === 0 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                    >
                      ← Previous
                    </button>
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>
                      Page {combinedPage + 1} of {Math.ceil(tabTotal / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => setCombinedPage(p => Math.min(Math.ceil(tabTotal / PAGE_SIZE) - 1, p + 1))}
                      disabled={combinedPage >= Math.ceil(tabTotal / PAGE_SIZE) - 1}
                      className="text-sm px-4 py-2 rounded-lg font-medium"
                      style={{ color: combinedPage >= Math.ceil(tabTotal / PAGE_SIZE) - 1 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Link to My Courses */}
          {anyTracked && (
            <div className="flex items-center justify-between px-1">
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
