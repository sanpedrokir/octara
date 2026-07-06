'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

type Tab = 'upload' | 'profile';
type Proficiency = 'basic' | 'intermediate' | 'advanced' | 'expert';

interface ExtractedSkill {
  skill: string;
  proficiency: string;
  category: string;
}

interface SsgMatch {
  skill_title: string;
  skill_code: string | null;
  sector: string | null;
}

interface CompetencyRow {
  id: number;
  skill_title: string;
  skill_code: string | null;
  proficiency_level: string;
  category: string | null;
  source: string;
  ssg_matched: boolean;
  ssg_sector: string | null;
  created_at: string | null;
}

function skillFreshness(createdAt: string | null): { label: string; bg: string; color: string } | null {
  if (!createdAt) return null;
  const months = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (months < 12) return null;
  if (months < 30) return { label: 'Aging', bg: '#fffbeb', color: '#92400e' };
  return { label: 'Stale', bg: '#fef2f2', color: '#b91c1c' };
}

interface SsgSearchResult {
  skill_title: string;
  skill_code: string | null;
  sector: string | null;
  proficiency_level: string | null;
}

interface UserMeta {
  resume_filename: string | null;
  resume_uploaded_at: string | null;
}

const PROFICIENCY_COLORS: Record<string, { bg: string; color: string }> = {
  basic:        { bg: '#f3f4f6', color: '#6b7280' },
  intermediate: { bg: '#eff6ff', color: '#2563eb' },
  advanced:     { bg: '#f0fdf4', color: '#15803d' },
  expert:       { bg: '#fdf4ff', color: '#7c3aed' },
};

const CATEGORY_ICONS: Record<string, string> = {
  technical:  '💻',
  domain:     '🏢',
  leadership: '👥',
  soft:       '🤝',
  tool:       '🔧',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CompetencyPage() {
  const [tab, setTab] = useState<Tab>('upload');

  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);

  // Upload tab state
  const [fileName, setFileName]             = useState('');
  const [pendingFile, setPendingFile]       = useState<File | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm]   = useState(false);
  const [removingCv, setRemovingCv]         = useState(false);
  const [extracting, setExtracting]         = useState(false);
  const [extractError, setExtractError]     = useState('');
  const [extracted, setExtracted]           = useState<ExtractedSkill[]>([]);
  const [extractedPage, setExtractedPage]   = useState(0);
  const [ssgMatches, setSsgMatches]         = useState<Record<string, SsgMatch[]>>({});
  const [saving, setSaving]                 = useState<Set<string>>(new Set());
  const [saved, setSaved]                   = useState<Set<string>>(new Set());

  // Profile tab state
  const [profile, setProfile]               = useState<CompetencyRow[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profilePage, setProfilePage]       = useState(0);

  // Add missing skill state
  const [searchQ, setSearchQ]               = useState('');
  const [searchResults, setSearchResults]   = useState<SsgSearchResult[]>([]);
  const [searching, setSearching]           = useState(false);
  const [addingSkill, setAddingSkill]       = useState<string | null>(null);
  const [manualSkill, setManualSkill]       = useState('');
  const [manualProf, setManualProf]         = useState<Proficiency>('intermediate');
  const [addingManual, setAddingManual]     = useState(false);
  const [searchPage, setSearchPage]         = useState(0);

  const fileRef   = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    const res = await fetch('/api/competency/profile');
    const { data } = await res.json();
    if (data) setProfile(data);
    setLoadingProfile(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          setUserMeta({
            resume_filename: data.resume_filename ?? null,
            resume_uploaded_at: data.resume_uploaded_at ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  // ── File upload handler ─────────────────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
      setExtractError('Supported formats: PDF or TXT. For DOCX, export as PDF first.');
      return;
    }
    setExtractError('');

    if (userMeta?.resume_filename) {
      setPendingFile(file);
      setShowReplaceConfirm(true);
      return;
    }

    applyFile(file);
  }

  function applyFile(file: File) {
    setFileName(file.name);
    (fileRef.current as HTMLInputElement & { _file?: File })._file = file;
  }

  function confirmReplace() {
    if (!pendingFile) return;
    applyFile(pendingFile);
    setPendingFile(null);
    setShowReplaceConfirm(false);
  }

  function cancelReplace() {
    setPendingFile(null);
    setShowReplaceConfirm(false);
  }

  // ── Remove CV ───────────────────────────────────────────────────────────────
  async function confirmRemoveCv() {
    setRemovingCv(true);
    await fetch('/api/competency/profile?all=true', { method: 'DELETE' });
    await fetch('/api/user/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_resume: true }),
    });
    setUserMeta(prev => prev ? { ...prev, resume_filename: null, resume_uploaded_at: null } : prev);
    setProfile([]);
    setExtracted([]);
    setFileName('');
    if (fileRef.current) {
      (fileRef.current as HTMLInputElement & { _file?: File })._file = undefined;
    }
    setShowRemoveConfirm(false);
    setRemovingCv(false);
  }

  // ── Extract competencies ────────────────────────────────────────────────────
  async function handleExtract() {
    setExtractError('');
    setExtracted([]);
    setSsgMatches({});
    setSaved(new Set());

    const cvFile = (fileRef.current as HTMLInputElement & { _file?: File })?._file;

    if (!cvFile) {
      setExtractError('Please upload a CV file first.');
      return;
    }

    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', cvFile);
      const res = await fetch('/api/competency/extract', { method: 'POST', body: fd });

      const { data, error } = await res.json();
      if (error) { setExtractError(error); return; }
      const skills: ExtractedSkill[] = data.competencies ?? [];
      setExtracted(skills);
      setExtractedPage(0);
      setSsgMatches(data.ssgMatches ?? {});
      setSaved(new Set(skills.map(s => s.skill)));
      if (skills.length > 0) {
        fetch('/api/user/me')
          .then(r => r.json())
          .then(({ data: meta }) => {
            if (meta) setUserMeta({
              resume_filename: meta.resume_filename ?? null,
              resume_uploaded_at: meta.resume_uploaded_at ?? null,
            });
          })
          .catch(() => {});
        loadProfile();
        setTab('upload');
      }
    } catch {
      setExtractError('Something went wrong. Please try again.');
    } finally {
      setExtracting(false);
    }
  }

  // ── Save a single extracted skill ───────────────────────────────────────────
  async function saveSkill(skill: ExtractedSkill) {
    if (saving.has(skill.skill) || saved.has(skill.skill)) return;
    setSaving(prev => new Set([...prev, skill.skill]));

    const match = ssgMatches[skill.skill]?.[0];
    await fetch('/api/competency/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill_title: skill.skill,
        skill_code: match?.skill_code ?? null,
        proficiency_level: skill.proficiency,
        category: skill.category,
        source: 'resume',
        ssg_matched: !!match,
        ssg_sector: match?.sector ?? null,
      }),
    });

    setSaved(prev => new Set([...prev, skill.skill]));
    setSaving(prev => { const n = new Set(prev); n.delete(skill.skill); return n; });
    loadProfile();
  }

  // ── Search SSG skills ───────────────────────────────────────────────────────
  useEffect(() => {
    setSearchPage(0);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/competency/search-skills?q=${encodeURIComponent(searchQ)}`);
      const { data } = await res.json();
      const seen = new Set<string>();
      const deduped = (data ?? []).filter((s: SsgSearchResult) =>
        seen.has(s.skill_title.toLowerCase()) ? false : (seen.add(s.skill_title.toLowerCase()), true)
      );
      setSearchResults(deduped);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function addSsgSkill(s: SsgSearchResult) {
    if (addingSkill === s.skill_title) return;
    setAddingSkill(s.skill_title);
    await fetch('/api/competency/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill_title: s.skill_title,
        skill_code: s.skill_code,
        proficiency_level: 'intermediate',
        source: 'ssg',
        ssg_matched: true,
        ssg_sector: s.sector,
      }),
    });
    setAddingSkill(null);
    setSearchQ('');
    setSearchResults([]);
    loadProfile();
  }

  async function addManual(overrideSkill?: string) {
    const skillName = (overrideSkill ?? manualSkill).trim();
    if (!skillName) return;
    setAddingManual(true);
    await fetch('/api/competency/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_title: skillName, proficiency_level: manualProf, source: 'manual' }),
    });
    if (!overrideSkill) setManualSkill('');
    setAddingManual(false);
    loadProfile();
  }

  async function deleteSkill(id: number) {
    await fetch(`/api/competency/profile?id=${id}`, { method: 'DELETE' });
    setProfile(prev => prev.filter(c => c.id !== id));
  }

  async function updateProficiency(id: number, proficiency: string) {
    const row = profile.find(c => c.id === id);
    if (!row) return;
    await fetch('/api/competency/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...row, skill_title: row.skill_title, proficiency_level: proficiency }),
    });
    setProfile(prev => prev.map(c => c.id === id ? { ...c, proficiency_level: proficiency } : c));
  }

  const ssgCount = profile.filter(c => c.ssg_matched).length;
  const hasCV    = !!fileName;

  const tabs = [
    { id: 'upload' as Tab, label: 'Upload Resume', icon: '📄' },
    { id: 'profile' as Tab, label: `My Competencies${profile.length > 0 ? ` (${profile.length})` : ''}`, icon: '🧩' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Competency Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Upload your CV to extract and manage your competencies.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--muted-bg)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t.id ? 'var(--card)' : 'transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--muted)',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Upload Tab ─────────────────────────────────────────────────────── */}
      {tab === 'upload' && (
        <div className="space-y-5">
          {profile.length > 0 && extracted.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
              <span>🧩</span>
              <span>
                You have <strong>{profile.length} competencies</strong> saved from your last upload.
                View or edit them in the <button onClick={() => setTab('profile')} className="underline font-medium" style={{ color: '#1d4ed8' }}>My Competencies</button> tab.
              </span>
            </div>
          )}

          {/* ── Step 1: CV Upload ────────────────────────────────────────── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Step 1 — Upload your CV</h2>

            {/* Previous CV info + Remove button */}
            {userMeta?.resume_filename && !showReplaceConfirm && !showRemoveConfirm && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ background: '#f8fafc', border: '1px solid var(--card-border)' }}>
                <span>📎</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block text-sm" style={{ color: 'var(--foreground)' }}>
                    {userMeta.resume_filename}
                  </span>
                  {userMeta.resume_uploaded_at && (
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      Uploaded {formatDate(userMeta.resume_uploaded_at)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                >
                  🗑 Remove CV
                </button>
              </div>
            )}

            {/* Remove CV confirmation */}
            {showRemoveConfirm && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <div className="flex items-start gap-2.5">
                  <span className="text-lg shrink-0">⚠️</span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold" style={{ color: '#9a3412' }}>Remove CV and all competencies?</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#c2410c' }}>
                      This will permanently delete <strong>{userMeta?.resume_filename}</strong> and clear
                      all <strong>{profile.length} competencies</strong> from your profile. You will need
                      to upload a new CV to extract competencies again.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRemoveConfirm(false)}
                    disabled={removingCv}
                    className="flex-1 text-sm py-2 rounded-lg font-medium"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRemoveCv}
                    disabled={removingCv}
                    className="flex-1 text-sm py-2 rounded-lg font-medium"
                    style={{ background: '#b91c1c', color: 'white', opacity: removingCv ? 0.7 : 1 }}
                  >
                    {removingCv ? 'Removing…' : 'Yes, Remove Everything'}
                  </button>
                </div>
              </div>
            )}

            {/* Replace confirmation dialog */}
            {showReplaceConfirm && pendingFile && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <div className="flex items-start gap-2.5">
                  <span className="text-lg shrink-0">⚠️</span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold" style={{ color: '#9a3412' }}>Replace existing CV?</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#c2410c' }}>
                      You have <strong>{userMeta?.resume_filename}</strong> on file. Replacing it will
                      permanently clear <strong>all competencies</strong> previously extracted. You will
                      need to re-extract after uploading.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cancelReplace}
                    className="flex-1 text-sm py-2 rounded-lg font-medium"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmReplace}
                    className="flex-1 text-sm py-2 rounded-lg font-medium"
                    style={{ background: '#ea580c', color: 'white' }}
                  >
                    Replace & Re-extract
                  </button>
                </div>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={handleFile}
            />

            {/* File upload drop zone */}
            {!showReplaceConfirm && !showRemoveConfirm && (
              <div
                className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
                style={{ borderColor: fileName ? 'var(--primary)' : 'var(--card-border)' }}
                onClick={() => fileRef.current?.click()}
              >
                <p className="text-2xl mb-2">📎</p>
                {fileName ? (
                  <>
                    <p className="text-sm font-medium" style={{ color: 'var(--primary)' }}>{fileName}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Click to change file</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Click to upload your CV</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>PDF or TXT · max 5 MB</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Step 2: Extract ──────────────────────────────────────────── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Step 2 — Extract competencies</h2>

            {extractError && (
              <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                {extractError}
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={extracting || (!hasCV && !userMeta?.resume_filename)}
              className="btn-primary"
              style={{ opacity: (extracting || (!hasCV && !userMeta?.resume_filename)) ? 0.5 : 1 }}
            >
              {extracting ? <><LoadingSpinner label="" /> Extracting…</> : '🔍 Extract from CV'}
            </button>
            {!hasCV && !userMeta?.resume_filename && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Upload a CV above to enable extraction.</p>
            )}
          </div>

          {/* Extracted results */}
          {extracted.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  Extracted competencies
                  <span className="ml-2 text-sm font-normal" style={{ color: 'var(--muted)' }}>({extracted.length} found)</span>
                </h2>
                <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>
                  ✓ Auto-saved to profile
                </span>
              </div>

              {(() => {
                const EX_PAGE_SIZE = 5;
                const exTotalPages = Math.ceil(extracted.length / EX_PAGE_SIZE);
                const pageSkills = extracted.slice(extractedPage * EX_PAGE_SIZE, (extractedPage + 1) * EX_PAGE_SIZE);
                return (
                  <div className="space-y-2">
                    {pageSkills.map(skill => {
                      const match = ssgMatches[skill.skill];
                      const isSaved = saved.has(skill.skill);
                      const isSaving = saving.has(skill.skill);
                      const prof = PROFICIENCY_COLORS[skill.proficiency] ?? PROFICIENCY_COLORS.intermediate;
                      return (
                        <div
                          key={skill.skill}
                          className="flex items-start gap-3 p-3 rounded-xl"
                          style={{ background: isSaved ? '#f0fdf4' : 'var(--muted-bg)', border: isSaved ? '1px solid #bbf7d0' : '1px solid transparent' }}
                        >
                          <span className="text-lg mt-0.5">{CATEGORY_ICONS[skill.category] ?? '🔹'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{skill.skill}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={prof}>
                                {skill.proficiency}
                              </span>
                              {match ? (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>
                                  ✓ SSG matched
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#9ca3af' }}>
                                  No SSG match
                                </span>
                              )}
                            </div>
                            {match && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                                SSG: {match[0].skill_title}
                                {match[0].sector ? ` · ${match[0].sector}` : ''}
                                {match[0].skill_code ? ` · ${match[0].skill_code}` : ''}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => saveSkill(skill)}
                            disabled={isSaved || isSaving}
                            className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                            style={isSaved
                              ? { background: '#dcfce7', color: '#15803d', cursor: 'default' }
                              : { background: 'var(--primary)', color: 'white', cursor: isSaving ? 'wait' : 'pointer' }
                            }
                          >
                            {isSaved ? '✓ Saved' : isSaving ? '…' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                    {exTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => setExtractedPage(p => Math.max(0, p - 1))}
                          disabled={extractedPage === 0}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ color: extractedPage === 0 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                        >
                          ← Previous
                        </button>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          Page {extractedPage + 1} of {exTotalPages} · {extracted.length} total
                        </span>
                        <button
                          onClick={() => setExtractedPage(p => Math.min(exTotalPages - 1, p + 1))}
                          disabled={extractedPage === exTotalPages - 1}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ color: extractedPage === exTotalPages - 1 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                All competencies were saved automatically. Switch to "My Competencies" to review or edit.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Profile Tab ────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-5">
          {/* Summary */}
          {profile.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Competencies', value: profile.length, color: 'var(--primary)', bg: 'var(--primary-light)' },
                { label: 'SSG Framework Mapped', value: ssgCount, color: '#15803d', bg: '#f0fdf4' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* CV info badge */}
          {userMeta?.resume_filename && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full w-fit" style={{ background: '#f8fafc', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
              <span>📎</span>
              <span>{userMeta.resume_filename}</span>
              {userMeta.resume_uploaded_at && <span>· {formatDate(userMeta.resume_uploaded_at)}</span>}
            </div>
          )}

          {/* Competency list */}
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>My Competencies</h2>

            {loadingProfile ? (
              <LoadingSpinner label="Loading…" />
            ) : profile.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">🧩</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No competencies yet — upload your CV to get started.</p>
                <button onClick={() => setTab('upload')} className="btn-primary mt-3 text-sm">Upload CV</button>
              </div>
            ) : (() => {
              const PROF_PAGE_SIZE = 5;
              const profTotalPages = Math.ceil(profile.length / PROF_PAGE_SIZE);
              const pageProfile = profile.slice(profilePage * PROF_PAGE_SIZE, (profilePage + 1) * PROF_PAGE_SIZE);
              return (
              <div className="space-y-2">
                {pageProfile.map(c => {
                  const prof = PROFICIENCY_COLORS[c.proficiency_level] ?? PROFICIENCY_COLORS.intermediate;
                  const fresh = skillFreshness(c.created_at ?? null);
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--muted-bg)' }}>
                      <span className="text-base">{CATEGORY_ICONS[c.category ?? ''] ?? '🔹'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.skill_title}</span>
                          {c.ssg_matched && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>SSG ✓</span>
                          )}
                          {fresh && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: fresh.bg, color: fresh.color }}>
                              ⚠ {fresh.label}
                            </span>
                          )}
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {c.source === 'resume' ? '📄 CV'
                              : c.source === 'ssg' ? '🏛 SSG'
                              : '✍️ manual'}
                          </span>
                        </div>
                        {(c.skill_code || c.ssg_sector) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {[c.skill_code, c.ssg_sector].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <select
                        className="text-xs px-2 py-1 rounded-lg font-medium border-0"
                        value={c.proficiency_level}
                        onChange={e => updateProficiency(c.id, e.target.value)}
                        style={{ ...prof, cursor: 'pointer' }}
                      >
                        {['basic', 'intermediate', 'advanced', 'expert'].map(p => (
                          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteSkill(c.id)}
                        className="shrink-0 text-xs px-2 py-1 rounded-lg"
                        style={{ color: 'var(--danger)', background: '#fef2f2' }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                {profTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setProfilePage(p => Math.max(0, p - 1))}
                      disabled={profilePage === 0}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ color: profilePage === 0 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                    >
                      ← Previous
                    </button>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      Page {profilePage + 1} of {profTotalPages} · {profile.length} total
                    </span>
                    <button
                      onClick={() => setProfilePage(p => Math.min(profTotalPages - 1, p + 1))}
                      disabled={profilePage === profTotalPages - 1}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ color: profilePage === profTotalPages - 1 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
              );
            })()}
          </div>

          {/* Add from SSG Framework */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Add missing competency from SSG Skills Framework
            </h2>
            <div className="relative">
              <input
                type="text"
                className="input pr-8"
                placeholder="Search SSG skills (e.g. Data Analytics, Risk Management)…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted)' }}>⏳</span>
              )}
            </div>

            {!searching && searchQ.trim() && searchResults.length === 0 && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e' }}>
                <span>No SSG match for &ldquo;{searchQ}&rdquo;</span>
                <button
                  onClick={() => { const q = searchQ; setSearchQ(''); addManual(q); }}
                  disabled={addingManual}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ background: '#92400e', color: 'white' }}
                >
                  {addingManual ? '…' : 'Add as custom skill →'}
                </button>
              </div>
            )}

            {searchResults.length > 0 && (() => {
              const PAGE_SIZE = 5;
              const totalPages = Math.ceil(searchResults.length / PAGE_SIZE);
              const pageItems = searchResults.slice(searchPage * PAGE_SIZE, (searchPage + 1) * PAGE_SIZE);
              return (
                <div className="space-y-1">
                  {pageItems.map((s, i) => (
                    <div key={`${s.skill_title}-${searchPage}-${i}`} className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{s.skill_title}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                          {[s.skill_code, s.sector].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        onClick={() => addSsgSkill(s)}
                        disabled={addingSkill === s.skill_title || profile.some(c => c.skill_title === s.skill_title)}
                        className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                        style={profile.some(c => c.skill_title === s.skill_title)
                          ? { background: '#dcfce7', color: '#15803d', cursor: 'default' }
                          : { background: 'var(--primary)', color: 'white' }
                        }
                      >
                        {profile.some(c => c.skill_title === s.skill_title) ? '✓' : addingSkill === s.skill_title ? '…' : '+ Add'}
                      </button>
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSearchPage(p => Math.max(0, p - 1))}
                        disabled={searchPage === 0}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ color: searchPage === 0 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                      >
                        ← Prev
                      </button>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {searchPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setSearchPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={searchPage === totalPages - 1}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ color: searchPage === totalPages - 1 ? 'var(--muted)' : 'var(--primary)', background: 'var(--muted-bg)' }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Manual add */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Or add a skill manually:</p>
              <div className="flex gap-2">
                <input
                  ref={manualRef}
                  type="text"
                  className="input flex-1"
                  placeholder="Skill name"
                  value={manualSkill}
                  onChange={e => setManualSkill(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManual()}
                />
                <select
                  className="input w-36"
                  value={manualProf}
                  onChange={e => setManualProf(e.target.value as Proficiency)}
                  style={{ appearance: 'auto' }}
                >
                  {(['basic', 'intermediate', 'advanced', 'expert'] as Proficiency[]).map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <button
                  onClick={() => addManual()}
                  disabled={addingManual || !manualSkill.trim()}
                  className="btn-primary shrink-0 text-sm"
                >
                  {addingManual ? '…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
