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
}

interface SsgSearchResult {
  skill_title: string;
  skill_code: string | null;
  sector: string | null;
  proficiency_level: string | null;
}

interface UserMeta {
  linkedin_url: string | null;
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

  // User metadata (LinkedIn URL, previous CV)
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [savingLinkedIn, setSavingLinkedIn] = useState(false);
  const [linkedInSaved, setLinkedInSaved] = useState(false);
  const [linkedInUrlError, setLinkedInUrlError] = useState('');

  // LinkedIn profile text paste
  const [linkedInText, setLinkedInText] = useState('');

  // Upload tab state
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extracted, setExtracted] = useState<ExtractedSkill[]>([]);
  const [extractedPage, setExtractedPage] = useState(0);
  const [ssgMatches, setSsgMatches] = useState<Record<string, SsgMatch[]>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  // Profile tab state
  const [profile, setProfile] = useState<CompetencyRow[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profilePage, setProfilePage] = useState(0);

  // Add missing skill state
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SsgSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const [manualSkill, setManualSkill] = useState('');
  const [manualProf, setManualProf] = useState<Proficiency>('intermediate');
  const [addingManual, setAddingManual] = useState(false);

  const [searchPage, setSearchPage] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
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
            linkedin_url: data.linkedin_url ?? null,
            resume_filename: data.resume_filename ?? null,
            resume_uploaded_at: data.resume_uploaded_at ?? null,
          });
          if (data.linkedin_url) setLinkedInUrl(data.linkedin_url);
        }
      })
      .catch(() => {});
  }, []);

  // ── Save LinkedIn URL ───────────────────────────────────────────────────────
  async function saveLinkedInUrl() {
    setLinkedInUrlError('');
    if (linkedInUrl.trim() && !linkedInUrl.includes('linkedin.com/in/')) {
      setLinkedInUrlError('Enter a valid LinkedIn profile URL (linkedin.com/in/…)');
      return;
    }
    setSavingLinkedIn(true);
    const res = await fetch('/api/user/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_url: linkedInUrl.trim() }),
    });
    const { error } = await res.json();
    if (error) {
      setLinkedInUrlError(error);
    } else {
      setUserMeta(prev => prev ? { ...prev, linkedin_url: linkedInUrl.trim() || null } : prev);
      setLinkedInSaved(true);
      setTimeout(() => setLinkedInSaved(false), 2000);
    }
    setSavingLinkedIn(false);
  }

  // ── File upload handler ─────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExtractError('');
    // Clear pasted text — file and paste are mutually exclusive
    setResumeText('');

    if (file.name.endsWith('.txt')) {
      const text = await file.text();
      setResumeText(text);
      (fileRef.current as HTMLInputElement & { _file?: File })._file = undefined;
    } else if (file.name.endsWith('.pdf')) {
      (fileRef.current as HTMLInputElement & { _file?: File })._file = file;
    } else {
      setExtractError('Supported formats: PDF, TXT. For DOCX, paste the text below.');
      setFileName('');
    }
  }

  // ── Paste text handler — clears any uploaded file ───────────────────────────
  function handleResumeTextChange(text: string) {
    setResumeText(text);
    if (text.trim()) {
      // Clear uploaded file so they don't conflict
      (fileRef.current as HTMLInputElement & { _file?: File })._file = undefined;
      if (fileRef.current) fileRef.current.value = '';
      setFileName('');
    }
  }

  // ── Extract competencies ────────────────────────────────────────────────────
  async function handleExtract() {
    setExtractError('');
    setExtracted([]);
    setSsgMatches({});
    setSaved(new Set());

    const pdfFile = (fileRef.current as HTMLInputElement & { _file?: File })?._file;

    if (!resumeText.trim() && !pdfFile && !linkedInText.trim()) {
      setExtractError('Please upload a CV, paste resume text, or add LinkedIn profile text.');
      return;
    }

    setExtracting(true);
    try {
      let res: Response;

      if (pdfFile && !resumeText.trim()) {
        const fd = new FormData();
        fd.append('file', pdfFile);
        if (linkedInText.trim()) fd.append('linkedInText', linkedInText.trim());
        res = await fetch('/api/competency/extract', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/competency/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: resumeText,
            linkedInText: linkedInText.trim() || undefined,
          }),
        });
      }

      const { data, error } = await res.json();
      if (error) { setExtractError(error); return; }
      const skills: ExtractedSkill[] = data.competencies ?? [];
      setExtracted(skills);
      setExtractedPage(0);
      setSsgMatches(data.ssgMatches ?? {});
      setSaved(new Set(skills.map(s => s.skill)));
      if (skills.length > 0) {
        // Refresh CV metadata shown in UI
        if (data.resumeFilename) {
          setUserMeta(prev => prev ? {
            ...prev,
            resume_filename: data.resumeFilename,
            resume_uploaded_at: new Date().toISOString(),
          } : prev);
        }
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
  const hasLinkedIn = linkedInText.trim().length > 0;
  const hasCV = !!(resumeText.trim() || fileName);
  const extractLabel = hasCV && hasLinkedIn
    ? '🔍 Extract from CV + LinkedIn'
    : hasLinkedIn
    ? '💼 Extract from LinkedIn'
    : '🔍 Extract from CV';

  const tabs = [
    { id: 'upload' as Tab, label: 'Upload Resume', icon: '📄' },
    { id: 'profile' as Tab, label: `My Competencies${profile.length > 0 ? ` (${profile.length})` : ''}`, icon: '🧩' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Competency Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Extract your competencies from your CV and LinkedIn profile.
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

            {/* Previous CV info */}
            {userMeta?.resume_filename && extracted.length === 0 && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm" style={{ background: '#f8fafc', border: '1px solid var(--card-border)' }}>
                <span>📎</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block" style={{ color: 'var(--foreground)' }}>
                    {userMeta.resume_filename}
                  </span>
                  {userMeta.resume_uploaded_at && (
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      Uploaded {formatDate(userMeta.resume_uploaded_at)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* File upload drop zone */}
            <div
              className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
              style={{ borderColor: fileName ? 'var(--primary)' : 'var(--card-border)' }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={handleFile}
              />
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

            {/* Replace notice */}
            {userMeta?.resume_filename && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Uploading a new CV will replace the previous one, even if the filename is different.
              </p>
            )}

            {/* Text paste */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                Or paste CV text here
              </label>
              <textarea
                className="input font-mono text-xs"
                rows={7}
                placeholder="Paste the full text of your CV here…"
                value={resumeText}
                onChange={e => handleResumeTextChange(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* ── Step 2: LinkedIn Profile ─────────────────────────────────── */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Step 2 — Add LinkedIn profile</h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#f3f4f6', color: '#6b7280' }}>Optional</span>
            </div>

            {/* LinkedIn URL */}
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Your LinkedIn profile URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  className="input flex-1"
                  placeholder="https://www.linkedin.com/in/your-name"
                  value={linkedInUrl}
                  onChange={e => { setLinkedInUrl(e.target.value); setLinkedInSaved(false); }}
                />
                <button
                  onClick={saveLinkedInUrl}
                  disabled={savingLinkedIn}
                  className="shrink-0 text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: linkedInSaved ? '#dcfce7' : 'var(--primary)', color: linkedInSaved ? '#15803d' : 'white', opacity: savingLinkedIn ? 0.7 : 1 }}
                >
                  {savingLinkedIn ? '…' : linkedInSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              {linkedInUrlError && (
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{linkedInUrlError}</p>
              )}
              {userMeta?.linkedin_url && (
                <a
                  href={userMeta.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium underline"
                  style={{ color: '#2563eb' }}
                >
                  View your LinkedIn profile ↗
                </a>
              )}
            </div>

            {/* LinkedIn text paste */}
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Paste your LinkedIn profile text
              </label>
              <div className="px-3 py-2.5 rounded-lg text-xs space-y-1" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                <p>LinkedIn blocks automated crawling. To include your LinkedIn data:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>Go to your LinkedIn profile</li>
                  <li>Copy your <strong>About</strong>, <strong>Experience</strong>, and <strong>Skills</strong> sections</li>
                  <li>Paste below — or export your profile as PDF (Profile → More → Save to PDF) and upload it above</li>
                </ol>
              </div>
              <textarea
                className="input font-mono text-xs"
                rows={6}
                placeholder="Paste your LinkedIn About, Experience, Skills sections here…"
                value={linkedInText}
                onChange={e => setLinkedInText(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* ── Step 3: Extract ──────────────────────────────────────────── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Step 3 — Extract competencies</h2>

            {hasCV && hasLinkedIn && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
                <span>✓</span>
                <span>Both CV and LinkedIn text detected — all sources will be combined for a richer profile.</span>
              </div>
            )}

            {extractError && (
              <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                {extractError}
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={extracting}
              className="btn-primary"
              style={{ opacity: extracting ? 0.7 : 1 }}
            >
              {extracting ? <><LoadingSpinner label="" /> Extracting…</> : extractLabel}
            </button>
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
                All competencies were saved automatically. Upload a new CV or add LinkedIn text anytime to refresh. Switch to "My Competencies" to review or edit.
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
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Competencies', value: profile.length, color: 'var(--primary)', bg: 'var(--primary-light)' },
                { label: 'SSG Framework Mapped', value: ssgCount, color: '#15803d', bg: '#f0fdf4' },
                { label: 'Self-Identified', value: profile.length - ssgCount, color: '#7c3aed', bg: '#f5f3ff' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Linked profile info */}
          {(userMeta?.linkedin_url || userMeta?.resume_filename) && (
            <div className="flex flex-wrap gap-3">
              {userMeta?.resume_filename && (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: '#f8fafc', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                  <span>📎</span>
                  <span>{userMeta.resume_filename}</span>
                  {userMeta.resume_uploaded_at && <span>· {formatDate(userMeta.resume_uploaded_at)}</span>}
                </div>
              )}
              {userMeta?.linkedin_url && (
                <a
                  href={userMeta.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full no-underline"
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb' }}
                >
                  <span>💼</span>
                  <span>LinkedIn profile ↗</span>
                </a>
              )}
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
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--muted-bg)' }}>
                      <span className="text-base">{CATEGORY_ICONS[c.category ?? ''] ?? '🔹'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.skill_title}</span>
                          {c.ssg_matched && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>SSG ✓</span>
                          )}
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {c.source === 'resume' ? '📄 CV'
                              : c.source === 'linkedin' ? '💼 LinkedIn'
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
