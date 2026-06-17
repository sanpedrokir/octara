'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '../ui/LoadingSpinner';
import Navbar from '../ui/Navbar';
import DashboardSidebar from '../ui/DashboardSidebar';
import MobileNav from '../ui/MobileNav';
import type { SkillGap, RoadmapData, SsgCourse, TrackedCourse, CareerAspiration, Industry, JobRole } from '@/lib/types';

type Step = 1 | 2 | 3 | 4 | 5;

interface AnalysisResult {
  skill_gaps: SkillGap[];
  current_strengths: string[];
  summary: string;
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map(s => (
        <div key={s} className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
            style={{
              background: s < current ? 'var(--teal)' : s === current ? 'var(--primary)' : 'var(--muted-bg)',
              color: s <= current ? 'white' : 'var(--muted)',
            }}
          >
            {s < current ? '✓' : s}
          </div>
          {s < total && <div className="h-0.5 w-6 sm:w-10" style={{ background: s < current ? 'var(--teal)' : 'var(--card-border)' }} />}
        </div>
      ))}
      <span className="ml-2 text-sm font-medium" style={{ color: 'var(--muted)' }}>
        {['About You', 'Target Role', 'AI Analysis', 'Courses', 'Roadmap'][current - 1]}
      </span>
    </div>
  );
}

type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
interface SkillWithLevel { skill: string; level: SkillLevel; }

const LEVEL_STYLES: Record<SkillLevel, { bg: string; color: string }> = {
  beginner:     { bg: '#f0fdf4', color: '#16a34a' },
  intermediate: { bg: '#fff7ed', color: '#d97706' },
  advanced:     { bg: '#e8f4fd', color: '#0078d4' },
};

function SkillWithLevelInput({ skills, onChange }: { skills: SkillWithLevel[]; onChange: (s: SkillWithLevel[]) => void }) {
  const [input, setInput] = useState('');
  const [level, setLevel] = useState<SkillLevel>('beginner');

  function add() {
    const v = input.trim();
    if (v && !skills.find(s => s.skill.toLowerCase() === v.toLowerCase())) {
      onChange([...skills, { skill: v, level }]);
      setInput('');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {skills.map(s => (
          <span key={s.skill} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: LEVEL_STYLES[s.level].bg, color: LEVEL_STYLES[s.level].color, border: `1px solid ${LEVEL_STYLES[s.level].color}33` }}>
            {s.skill}
            <span className="opacity-60">· {s.level.charAt(0).toUpperCase() + s.level.slice(1)}</span>
            <button onClick={() => onChange(skills.filter(x => x.skill !== s.skill))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '2px', lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type a skill and press Enter" />
        <select className="input" style={{ width: '140px' }} value={level} onChange={e => setLevel(e.target.value as SkillLevel)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button type="button" onClick={add} className="btn-secondary text-sm shrink-0">Add</button>
      </div>
    </div>
  );
}

const SESSION_KEY = 'skills-navigator-state';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(patch: Record<string, unknown>) {
  try {
    const current = loadSession() ?? {};
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
  } catch { /* ignore */ }
}

export default function SkillsNavigatorPage() {
  const searchParams = useSearchParams();
  const [step, setStepRaw] = useState<Step>(1);
  const [career, setCareer] = useState<CareerAspiration | null>(null);
  const [trackedCourses, setTrackedCourses] = useState<TrackedCourse[]>([]);
  const [trackingIds, setTrackingIds] = useState<Set<string>>(new Set());

  const [userType, setUserType] = useState<string>('');

  // Step 2 – dropdown data
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [step2JobRoles, setStep2JobRoles] = useState<JobRole[]>([]);
  const [selectedIndustryId, setSelectedIndustryId] = useState('');

  // Step 1 form
  const [form, setForm] = useState({
    currentRole: '',
    yearsExperience: '3',
    currentSkills: [] as SkillWithLevel[],
    internshipText: '',
  });

  // Step 2 – target
  const [targetRole, setTargetRole] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');

  // Results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [coursesBySkill, setCoursesBySkill] = useState<Record<string, SsgCourse[]>>({});
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  // Loading states
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchingCourses, setFetchingCourses] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [analysisError, setAnalysisError] = useState('');

  function setStep(s: Step) {
    setStepRaw(s);
    saveSession({ step: s });
  }

  const loadInitialData = useCallback(async () => {
    const [careerRes, coursesRes, indRes, latestRes] = await Promise.all([
      fetch('/api/career'),
      fetch('/api/courses/tracked'),
      fetch('/api/industries'),
      fetch('/api/skills/latest'),
    ]);
    const [careerJson, coursesJson, indJson, latestJson] = await Promise.all([
      careerRes.json(), coursesRes.json(), indRes.json(), latestRes.json(),
    ]);

    if (indJson.data) setIndustries(indJson.data);

    const latest = latestJson.data;
    const careerData = careerJson.data;

    // Detect if the saved analysis was for a different career goal.
    // Also treat empty analysisTargetRole as stale — can't verify it matches.
    const forceFresh = searchParams.get('fresh') === '1';
    const careerGoalName = careerData?.job_role_name || '';
    const analysisTargetRole = latest?.assessment?.targetRole || '';
    const analysisIsStale = forceFresh || !!(
      careerGoalName && (
        !analysisTargetRole ||
        analysisTargetRole.toLowerCase() !== careerGoalName.toLowerCase()
      )
    );

    if (latest?.assessment && !analysisIsStale) {
      // Restore saved analysis + roadmap from DB
      const a = latest.assessment;
      setAnalysis({
        skill_gaps: a.skillGaps,
        current_strengths: a.strengths,
        summary: a.summary,
      });
      setTargetRole(a.targetRole);
      setTargetIndustry(a.targetIndustry);
      setForm(p => ({
        ...p,
        currentRole: a.currentRole || p.currentRole,
        currentSkills: Array.isArray(a.currentSkills) ? a.currentSkills : p.currentSkills,
      }));

      if (latest.roadmap) {
        const { coursesBySkill: cbs, createdAt: _ca, ...roadmapData } = latest.roadmap;
        setRoadmap(roadmapData);
        if (cbs && Object.keys(cbs).length > 0) setCoursesBySkill(cbs);
        setStepRaw(5);
      } else {
        setStepRaw(3);
      }

      saveSession({
        step: latest.roadmap ? 5 : 3,
        analysis: { skill_gaps: a.skillGaps, current_strengths: a.strengths, summary: a.summary },
        targetRole: a.targetRole,
        targetIndustry: a.targetIndustry,
        currentRole: a.currentRole,
        currentSkills: a.currentSkills,
        coursesBySkill: latest.roadmap?.coursesBySkill ?? {},
        roadmap: latest.roadmap ? (() => { const { coursesBySkill: _c, createdAt: _ca, ...r } = latest.roadmap; return r; })() : null,
      });
    } else if (analysisIsStale) {
      // Career goal changed — discard stale analysis and start fresh from step 1
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    } else {
      // No saved analysis — check sessionStorage as fallback
      const saved = loadSession();
      if (saved) {
        if (saved.step) setStepRaw(saved.step as Step);
        if (saved.analysis) setAnalysis(saved.analysis);
        if (saved.coursesBySkill) setCoursesBySkill(saved.coursesBySkill);
        if (saved.roadmap) setRoadmap(saved.roadmap);
        if (saved.targetRole) setTargetRole(saved.targetRole);
        if (saved.targetIndustry) setTargetIndustry(saved.targetIndustry);
      }
    }

    if (careerData) {
      setCareer(careerData);
      // Set target from career goal if there is no valid (non-stale) saved analysis
      if (!latest?.assessment || analysisIsStale) {
        setTargetRole(r => r || careerData.job_role_name || '');
        setTargetIndustry(i => i || careerData.industry_name || '');
      }
      if (careerData.industry_id) setSelectedIndustryId(String(careerData.industry_id));
    }

    if (coursesJson.data) {
      setTrackedCourses(coursesJson.data);
      setTrackingIds(new Set(coursesJson.data.map((c: TrackedCourse) => c.course_reference_number || c.course_title)));
    }

    setLoadingInitial(false);
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(json => {
      if (json.data?.profile?.user_type) setUserType(json.data.profile.user_type);
    });
  }, []);

  useEffect(() => {
    if (!selectedIndustryId) { setStep2JobRoles([]); return; }
    fetch(`/api/job-roles?industry_id=${selectedIndustryId}`)
      .then(r => r.json())
      .then(json => { if (json.data) setStep2JobRoles(json.data); });
  }, [selectedIndustryId]);

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await fetch('/api/skills/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRole: form.currentRole,
          currentSkills: form.currentSkills.map(s => `${s.skill} (${s.level})`),
          targetRole,
          targetIndustry,
          yearsExperience: userType === 'student' ? 0 : Number(form.yearsExperience),
          resumeText: form.internshipText || '',
        }),
      });
      const { data, error } = await res.json();
      if (data && !error) {
        setAnalysis(data);
        saveSession({
          analysis: data, targetRole, targetIndustry,
          currentRole: form.currentRole, currentSkills: form.currentSkills, yearsExperience: form.yearsExperience,
        });
        setStep(3);
        const skillNames = data.skill_gaps.map((g: SkillGap) => g.skill);
        fetchCourses(skillNames);
      } else {
        setAnalysisError(error || 'Analysis failed. Please try again.');
      }
    } catch {
      setAnalysisError('Network error. Please check your connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function fetchCourses(skills: string[]) {
    setFetchingCourses(true);
    const res = await fetch('/api/skills/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills }),
    });
    const { data } = await res.json();
    if (data) {
      setCoursesBySkill(data);
      saveSession({ coursesBySkill: data });
    }
    setFetchingCourses(false);
  }


  async function generateRoadmap() {
    setGeneratingRoadmap(true);
    const res = await fetch('/api/skills/roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillGaps: analysis?.skill_gaps || [],
        coursesBySkill,
        targetRole,
        targetIndustry,
      }),
    });
    const { data } = await res.json();
    if (data) {
      setRoadmap(data);
      saveSession({ roadmap: data });
      setStep(5);
    }
    setGeneratingRoadmap(false);
  }

  async function trackCourse(course: SsgCourse, skillName?: string) {
    const key = course.referenceNumber || course.title;
    if (trackingIds.has(key)) return;

    const res = await fetch('/api/courses/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_reference_number: course.referenceNumber,
        course_title: course.title,
        provider_name: course.providerName,
        course_url: course.url,
        fee: course.totalCostOfTrainingPerTrainee,
        skill_name: skillName || null,
      }),
    });
    const { data } = await res.json();
    if (data) {
      setTrackedCourses(prev => [data, ...prev]);
      setTrackingIds(prev => new Set([...prev, key]));
    }
  }

  async function updateCourseStatus(id: number, status: 'in_progress' | 'completed') {
    await fetch('/api/courses/track', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setTrackedCourses(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  }

  async function removeCourse(id: number) {
    await fetch(`/api/courses/track?id=${id}`, { method: 'DELETE' });
    setTrackedCourses(prev => prev.filter(c => c.id !== id));
  }

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <Navbar user={null} />
        <div className="flex flex-1 max-w-7xl mx-auto w-full">
          <DashboardSidebar />
          <main className="flex-1 flex items-center justify-center"><LoadingSpinner label="Loading Skills Navigator…" /></main>
        </div>
        <MobileNav />
      </div>
    );
  }

  const allCourses = Object.values(coursesBySkill).flat();
  const uniqueCourses = allCourses.filter((c, i, a) => a.findIndex(x => (x.referenceNumber || x.title) === (c.referenceNumber || c.title)) === i);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={null} />
      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <DashboardSidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="max-w-3xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🧭 Skills Navigator</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Analyse your skill gaps and get a personalised learning roadmap.</p>
            </div>

            <StepIndicator current={step} total={5} />

            {/* STEP 1 – About You */}
            {step === 1 && (
              <div className="card p-6 space-y-5 animate-fade-in">
                <h2 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>Step 1: Tell us about yourself</h2>

                {userType === 'student' ? (
                  <>
                    {/* STUDENT view */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Current Skills & Level</label>
                      <SkillWithLevelInput skills={form.currentSkills} onChange={skills => setForm(p => ({ ...p, currentSkills: skills }))} />
                      <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>e.g. Python, Excel, Data Analysis — select your self-assessed level for each</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                        Internship / Relevant Work Experience{' '}
                        <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
                      </label>
                      <textarea
                        className="input"
                        rows={4}
                        value={form.internshipText}
                        onChange={e => setForm(p => ({ ...p, internshipText: e.target.value }))}
                        placeholder="Describe any internship or relevant work experience while studying…"
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* WORKING ADULT / OTHER view */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Your Current Job Role *</label>
                      <input className="input" value={form.currentRole} onChange={e => setForm(p => ({ ...p, currentRole: e.target.value }))} placeholder="e.g. Programme Manager, Business Analyst, Senior Developer" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Years of Experience</label>
                      <select className="input" value={form.yearsExperience} onChange={e => setForm(p => ({ ...p, yearsExperience: e.target.value }))}>
                        {['0-1', '1', '2', '3', '4', '5', '7', '10', '15+'].map(v => <option key={v} value={v}>{v} year{v === '1' ? '' : 's'}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Current Skills & Level</label>
                      <SkillWithLevelInput skills={form.currentSkills} onChange={skills => setForm(p => ({ ...p, currentSkills: skills }))} />
                      <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>e.g. Agile, Python, Project Management — select your self-assessed level for each</p>
                    </div>
                  </>
                )}

                {career && (
                  <div className="flex items-center justify-between p-3 rounded-xl text-sm"
                    style={{ background: 'var(--primary-light)', border: '1px solid rgba(0,120,212,0.2)' }}>
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--primary)' }}>Target: </span>
                      <span style={{ color: 'var(--foreground)' }}>{career.job_role_name} · {career.industry_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-medium"
                      style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Change →
                    </button>
                  </div>
                )}

                <button
                  onClick={career ? runAnalysis : () => setStep(2)}
                  disabled={(userType !== 'student' && !form.currentRole) || analyzing}
                  className="btn-primary"
                  style={{ opacity: (userType !== 'student' && !form.currentRole) ? 0.5 : 1 }}
                >
                  {analyzing
                    ? <><LoadingSpinner size="sm" /> Analysing with AI…</>
                    : career
                      ? 'Analyse Skill Gaps →'
                      : 'Next: Set Target →'}
                </button>

                {analysisError && (
                  <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                    {analysisError}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 – Target Role */}
            {step === 2 && (
              <div className="card p-6 space-y-5 animate-fade-in">
                <h2 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>Step 2: Where do you want to go?</h2>

                {career && (
                  <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid rgba(0,120,212,0.2)' }}>
                    🎯 Career goal pre-filled from your settings: <strong>{career.job_role_name}</strong> in <strong>{career.industry_name}</strong>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Target Sector *</label>
                  <select
                    className="input"
                    value={selectedIndustryId}
                    onChange={e => {
                      const id = e.target.value;
                      setSelectedIndustryId(id);
                      const ind = industries.find(i => String(i.id) === id);
                      setTargetIndustry(ind?.name || '');
                      setTargetRole('');
                    }}
                  >
                    <option value="">— Select a sector —</option>
                    {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Target Job Role *</label>
                  <select
                    className="input"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                    disabled={!selectedIndustryId}
                  >
                    <option value="">— {selectedIndustryId ? 'Select a job role' : 'Select a sector first'} —</option>
                    {step2JobRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                  {selectedIndustryId && step2JobRoles.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Loading roles…</p>
                  )}
                </div>

                {analysisError && (
                  <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                    {analysisError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-ghost">← Back</button>
                  <button
                    onClick={runAnalysis}
                    disabled={!targetRole || !targetIndustry || analyzing}
                    className="btn-primary flex-1 justify-center"
                    style={{ opacity: (!targetRole || !targetIndustry) ? 0.5 : 1 }}
                  >
                    {analyzing ? <><LoadingSpinner size="sm" /> Analysing with AI…</> : 'Analyse Skill Gaps →'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 – AI Analysis Results */}
            {step === 3 && analysis && (
              <div className="space-y-5 animate-fade-in">
                <div className="card p-5">
                  <h2 className="font-semibold text-lg mb-3" style={{ color: 'var(--foreground)' }}>Step 3: AI Skills Gap Analysis</h2>
                  <p className="text-sm p-3 rounded-lg mb-4" style={{ background: 'var(--primary-light)', color: 'var(--foreground)', borderLeft: `4px solid var(--primary)` }}>
                    {analysis.summary}
                  </p>

                  {analysis.current_strengths.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--teal)' }}>✅ Your Current Strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.current_strengths.map(s => <span key={s} className="badge badge-teal">{s}</span>)}
                      </div>
                    </div>
                  )}

                  <p className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>🔍 Identified Skill Gaps</p>
                  <div className="space-y-2">
                    {analysis.skill_gaps.map(gap => (
                      <div key={gap.skill} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                        <span className={`badge ${gap.priority === 'high' ? 'badge-high' : gap.priority === 'medium' ? 'badge-medium' : 'badge-low'} shrink-0 mt-0.5`}>
                          {gap.priority}
                        </span>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{gap.skill}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{gap.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(career ? 1 : 2)} className="btn-ghost">← Back</button>
                  <button onClick={() => setStep(4)} className="btn-primary flex-1 justify-center">
                    {fetchingCourses ? <><LoadingSpinner size="sm" /> Loading Courses…</> : 'View SkillsFuture Courses →'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 – Course Recommendations */}
            {step === 4 && (
              <div className="space-y-5 animate-fade-in">
                <div className="card p-5">
                  <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Step 4: Recommended SkillsFuture Courses</h2>
                  <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                    {uniqueCourses.filter(c => c.referenceNumber).length > 0
                      ? `${uniqueCourses.filter(c => c.referenceNumber).length} courses found for your skill gaps`
                      : `${Object.keys(coursesBySkill).length} skill topics — click to search on SkillsFuture`}
                  </p>

                  {fetchingCourses ? (
                    <div className="py-8"><LoadingSpinner label="Searching SkillsFuture courses…" /></div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(coursesBySkill).map(([skill, courses]) => {
                        const liveCourses = courses.filter(c => c.referenceNumber);
                        const searchLinks = courses.filter(c => !c.referenceNumber);
                        return (
                          <div key={skill}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>{skill}</p>

                            {/* Live course cards */}
                            {liveCourses.length > 0 && (
                              <div className="space-y-2">
                                {liveCourses.slice(0, 3).map(course => {
                                  const key = course.referenceNumber;
                                  const isTracked = trackingIds.has(key);
                                  return (
                                    <div key={key} className="p-4 rounded-xl" style={{ background: 'var(--muted-bg)', border: isTracked ? '2px solid var(--teal)' : '1px solid var(--card-border)' }}>
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <a href={course.url} target="_blank" rel="noopener noreferrer"
                                            className="font-medium text-sm no-underline hover:underline block" style={{ color: 'var(--foreground)' }}>
                                            {course.title}
                                          </a>
                                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{course.providerName}</p>
                                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                                            <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                                              SGD ${course.totalCostOfTrainingPerTrainee?.toLocaleString() || '–'}
                                            </span>
                                            {course.subsidisedFee && course.subsidisedFee > 0 && (
                                              <span className="badge badge-teal">After subsidy: SGD ${course.subsidisedFee}</span>
                                            )}
                                            {course.modeOfTraining && (
                                              <span className="badge badge-blue">{course.modeOfTraining}</span>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => isTracked ? null : trackCourse(course, skill)}
                                          className={isTracked ? 'btn-ghost text-xs' : 'btn-secondary text-xs shrink-0'}
                                          style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', color: isTracked ? 'var(--teal)' : undefined }}
                                          disabled={isTracked}
                                        >
                                          {isTracked ? '✅ Tracked' : '+ Track'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* No live data — search chip */}
                            {liveCourses.length === 0 && searchLinks.length > 0 && (
                              <a
                                href={searchLinks[0].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium no-underline transition-opacity hover:opacity-80"
                                style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)' }}
                              >
                                🔍 Search &ldquo;{skill}&rdquo; on SkillsFuture
                              </a>
                            )}
                          </div>
                        );
                      })}

                      {Object.keys(coursesBySkill).length === 0 && (
                        <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>No courses loaded yet.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="btn-ghost">← Back</button>
                  <button onClick={generateRoadmap} disabled={generatingRoadmap} className="btn-primary flex-1 justify-center">
                    {generatingRoadmap ? <><LoadingSpinner size="sm" /> Generating Roadmap…</> : 'Generate My Roadmap →'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5 – Roadmap */}
            {step === 5 && roadmap && (() => {
              const totalGaps = analysis?.skill_gaps?.length || 0;
              const coveredSkills = new Set(
                trackedCourses
                  .filter(c => c.status === 'completed' && c.skill_name && analysis?.skill_gaps?.some(g => g.skill === c.skill_name))
                  .map(c => c.skill_name)
              );
              const progressPct = totalGaps > 0 ? Math.round((coveredSkills.size / totalGaps) * 100) : 0;
              return (
              <div className="space-y-5 animate-fade-in" id="roadmap">
                {/* Progress bar */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>🎯 Skill Gap Progress</h3>
                    <span className="text-lg font-bold" style={{ color: progressPct === 100 ? 'var(--teal)' : 'var(--primary)' }}>{progressPct}%</span>
                  </div>
                  <div className="w-full rounded-full h-3 mb-2" style={{ background: 'var(--muted-bg)' }}>
                    <div
                      className="h-3 rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%`, background: progressPct === 100 ? 'var(--teal)' : 'var(--primary)' }}
                    />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {coveredSkills.size} of {totalGaps} skill gaps covered by completed courses
                    {progressPct === 100 && <span className="ml-2 font-semibold" style={{ color: 'var(--teal)' }}>🏆 All gaps covered!</span>}
                  </p>
                  {totalGaps > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {analysis!.skill_gaps.map(g => {
                        const done = coveredSkills.has(g.skill);
                        return (
                          <span key={g.skill} className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: done ? '#f0fdf4' : 'var(--muted-bg)', color: done ? '#16a34a' : 'var(--muted)', border: `1px solid ${done ? '#bbf7d0' : 'var(--card-border)'}` }}>
                            {done ? '✓ ' : ''}{g.skill}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="card p-5">
                  <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--foreground)' }}>
                    🗺️ Your Personalised Learning Roadmap
                  </h2>
                  <p className="text-sm mb-4" style={{ color: 'var(--foreground)', background: 'var(--primary-light)', padding: '0.75rem', borderRadius: '0.5rem', borderLeft: '4px solid var(--primary)' }}>
                    {roadmap.summary}
                  </p>

                  <div className="space-y-4">
                    {roadmap.months?.map(month => (
                      <div key={month.month} className="border rounded-xl p-4" style={{ borderColor: 'var(--card-border)' }}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                            M{month.month}
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{month.label}</p>
                            <p className="text-xs" style={{ color: 'var(--teal)' }}>🏁 {month.milestone}</p>
                          </div>
                        </div>

                        {month.skills?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Skills to acquire:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {month.skills.map(s => <span key={s} className="badge badge-blue">{s}</span>)}
                            </div>
                          </div>
                        )}

                        {month.courses?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Recommended courses:</p>
                            <div className="space-y-1.5">
                              {month.courses.slice(0, 2).map(course => {
                                const key = course.referenceNumber || course.title;
                                const isTracked = trackingIds.has(key);
                                return (
                                  <div key={course.referenceNumber} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{course.title}</p>
                                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{course.providerName} · SGD ${course.totalCostOfTrainingPerTrainee?.toLocaleString()}</p>
                                    </div>
                                    <button
                                      onClick={() => isTracked ? null : trackCourse(course, month.skills?.[0])}
                                      disabled={isTracked}
                                      style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', whiteSpace: 'nowrap', color: isTracked ? 'var(--teal)' : 'var(--primary)', background: isTracked ? '#f0fdfa' : 'var(--primary-light)', border: 'none', borderRadius: '0.375rem', cursor: isTracked ? 'default' : 'pointer', fontWeight: 600 }}
                                    >
                                      {isTracked ? '✅' : '+ Track'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Course tracker */}
                {trackedCourses.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>📚 My Course Tracker ({trackedCourses.length})</h3>
                    <div className="space-y-2">
                      {trackedCourses.map(course => (
                        <div key={course.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                          <span className="text-lg mt-0.5">{course.status === 'completed' ? '✅' : '📖'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{course.course_title}</p>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>
                              {course.provider_name || 'SkillsFuture'}
                              {course.skill_name && <span className="ml-2 badge badge-blue">{course.skill_name}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {course.status === 'in_progress' && (
                              <button onClick={() => updateCourseStatus(course.id, 'completed')} className="text-xs px-2 py-1 rounded font-medium" style={{ background: '#f0fdf4', color: 'var(--success)' }}>Mark done</button>
                            )}
                            <button onClick={() => removeCourse(course.id)} className="text-xs px-2 py-1 rounded" style={{ background: '#fef2f2', color: 'var(--danger)' }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(4)} className="btn-ghost">← Back</button>
                  <button onClick={() => {
                    sessionStorage.removeItem(SESSION_KEY);
                    setAnalysis(null); setCoursesBySkill({}); setRoadmap(null);
                    setStep(1);
                  }} className="btn-secondary">Start New Analysis</button>
                </div>
              </div>
              );
            })()}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
