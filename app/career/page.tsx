'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../ui/LoadingSpinner';
import Navbar from '../ui/Navbar';
import DashboardSidebar from '../ui/DashboardSidebar';
import MobileNav from '../ui/MobileNav';
import type { CareerAspiration } from '@/lib/types';

type CatalogRole = {
  id: number;
  sector: string;
  track: string | null;
  job_role: string;
  job_role_description: string | null;
  performance_expectation: string | null;
  esco_uri?: string | null;
};

type CwfEntry = { critical_work_function: string; key_tasks: string[] };
type SkillEntry = { skill_title: string; skill_type: string | null; proficiency_level: string | null; skill_code: string | null };
type MarketSkill = { name: string; category: string; importance: 'high' | 'medium' | 'low'; frequency: number };

const DEMAND_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  high:   { label: 'High demand', bg: '#dcfce7', color: '#15803d' },
  medium: { label: 'Moderate',    bg: '#fef3c7', color: '#92400e' },
  low:    { label: 'Niche',       bg: '#f1f5f9', color: '#64748b' },
};

function TrackMultiSelect({
  tracks,
  selected,
  onChange,
  disabled,
}: {
  tracks: string[];
  selected: string[];
  onChange: (tracks: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = tracks.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const available = filtered.filter(t => !selected.includes(t));
  const selectedFiltered = filtered.filter(t => selected.includes(t));

  function toggle(track: string) {
    onChange(selected.includes(track) ? selected.filter(t => t !== track) : [...selected, track]);
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className="input flex items-center justify-between cursor-pointer"
        style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span className="truncate" style={{ color: selected.length ? 'var(--foreground)' : 'var(--muted)' }}>
          {selected.length ? selected.join('; ') : disabled ? 'Select a sector first' : 'Select a track'}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange([]); }}
            className="shrink-0 ml-2"
            style={{ color: 'var(--muted)' }}
            aria-label="Clear selected tracks"
          >
            ✕
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-10 mt-1 w-full card p-3" style={{ maxHeight: '320px', overflowY: 'auto' }}>
          <input
            autoFocus
            className="input text-sm mb-3"
            placeholder="Enter keyword to search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {selectedFiltered.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--primary)' }}>Selected ({selectedFiltered.length})</p>
              <div className="space-y-1 mb-3">
                {selectedFiltered.map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                    <input type="checkbox" checked readOnly onChange={() => toggle(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </>
          )}

          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--primary)' }}>Available Options ({available.length})</p>
          <div className="space-y-1">
            {available.map(t => (
              <label key={t} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input type="checkbox" checked={false} onChange={() => toggle(t)} />
                {t}
              </label>
            ))}
            {available.length === 0 && selectedFiltered.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>No tracks match.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillTable({ rows, emptyText }: { rows: SkillEntry[]; emptyText: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg p-4 text-sm text-center" style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
        {emptyText}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--card-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
            <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Skill Title</th>
            <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Proficiency Level</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
              <td className="py-2 px-3 font-medium" style={{ color: 'var(--primary)' }}>{row.skill_title}</td>
              <td className="py-2 px-3" style={{ color: 'var(--muted)' }}>{row.proficiency_level ? `Level ${row.proficiency_level}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CareerPage() {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<CareerAspiration | null>(null);
  const [userCountry, setUserCountry] = useState('SG');

  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [tracks, setTracks] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);

  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<CatalogRole[]>([]);
  const [keyword, setKeyword] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const [selectedRole, setSelectedRole] = useState<CatalogRole | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cwf, setCwf] = useState<CwfEntry[]>([]);
  const [tsc, setTsc] = useState<SkillEntry[]>([]);
  const [ccs, setCcs] = useState<SkillEntry[]>([]);

  const [activeTab, setActiveTab] = useState<'market' | 'ssg'>('market');
  const [marketSkills, setMarketSkills] = useState<MarketSkill[]>([]);
  const [marketJobCount, setMarketJobCount] = useState(0);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');

  const router = useRouter();
  const suppressSectorEffect = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [meRes, sectorsResSG, careerRes] = await Promise.all([
      fetch('/api/user/me'),
      fetch('/api/job-role-catalog/sectors'),
      fetch('/api/career'),
    ]);
    const [meJson, sectorsSGJson, careerJson] = await Promise.all([
      meRes.json(), sectorsResSG.json(), careerRes.json(),
    ]);

    const country: string = meJson.data?.country ?? 'SG';
    setUserCountry(country);
    const isSG = country === 'SG';
    const apiBase = isSG ? '/api/job-role-catalog' : '/api/esco-catalog';

    // For non-SG users fetch ESCO sectors separately
    let sectorsData: string[] = sectorsSGJson.data ?? [];
    if (!isSG) {
      const escoSectorsRes = await fetch('/api/esco-catalog/sectors');
      const escoSectorsJson = await escoSectorsRes.json();
      sectorsData = escoSectorsJson.data ?? [];
    }
    setSectors(sectorsData);

    if (careerJson.data) {
      const career: CareerAspiration = careerJson.data;
      setCurrent(career);
      setNotes('');

      const sectorName = career.industry_name;
      if (sectorName) {
        const savedTrack = career.catalog_track ?? '';
        const rolesParams = new URLSearchParams({ sector: sectorName, limit: '500' });
        if (savedTrack) rolesParams.set('tracks', savedTrack);

        const [tracksRes, rolesRes] = await Promise.all([
          fetch(`${apiBase}/tracks?sector=${encodeURIComponent(sectorName)}`),
          fetch(`${apiBase}/roles?${rolesParams}`),
        ]);
        const [tracksJson, rolesJson] = await Promise.all([tracksRes.json(), rolesRes.json()]);

        const fetchedTracks: string[] = tracksJson.data ?? [];
        const fetchedRoles: CatalogRole[] = rolesJson.data?.rows ?? [];

        suppressSectorEffect.current = true;
        setSelectedSector(sectorName);
        setTracks(fetchedTracks);
        if (savedTrack && fetchedTracks.includes(savedTrack)) setSelectedTracks([savedTrack]);
        setResults(fetchedRoles);
        setHasSearched(true);

        const match = fetchedRoles.find(r => r.job_role === career.job_role_name);
        if (match) setSelectedRole(match);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const apiBase = userCountry === 'SG' ? '/api/job-role-catalog' : '/api/esco-catalog';

  useEffect(() => {
    if (!selectedRole) {
      setCwf([]); setTsc([]); setCcs([]);
      setMarketSkills([]); setMarketJobCount(0); setMarketError('');
      return;
    }

    // Reset tab to Market Skills whenever a new role is selected
    setActiveTab('market');
    setMarketSkills([]); setMarketJobCount(0); setMarketError('');

    // Fetch SSG/ESCO details (for SSG tab)
    setDetailsLoading(true);
    const isSG = userCountry === 'SG';
    const params = new URLSearchParams({ sector: selectedRole.sector, job_role: selectedRole.job_role });
    if (isSG && selectedRole.track) params.set('track', selectedRole.track);
    if (!isSG && selectedRole.esco_uri) params.set('esco_uri', selectedRole.esco_uri);
    fetch(`${apiBase}/details?${params}`)
      .then(r => r.json())
      .then(({ data }) => {
        setCwf(data?.cwf ?? []);
        setTsc(data?.tsc ?? []);
        setCcs(data?.ccs ?? []);
      })
      .finally(() => setDetailsLoading(false));

    // Fetch live market skills (for Market Skills tab)
    setMarketLoading(true);
    fetch('/api/market-skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: selectedRole.job_role }),
    })
      .then(r => r.json())
      .then(({ data, error: e }) => {
        if (e) setMarketError(e);
        else { setMarketSkills(data?.skills ?? []); setMarketJobCount(data?.jobCount ?? 0); }
      })
      .catch(() => setMarketError('Failed to fetch market skills'))
      .finally(() => setMarketLoading(false));
  }, [selectedRole, userCountry, apiBase]);

  useEffect(() => {
    if (suppressSectorEffect.current) {
      suppressSectorEffect.current = false;
      return;
    }
    setSelectedTracks([]);
    setTracks([]);
    if (!selectedSector) return;
    fetch(`${apiBase}/tracks?sector=${encodeURIComponent(selectedSector)}`)
      .then(r => r.json())
      .then(json => { if (json.data) setTracks(json.data); });
  }, [selectedSector, apiBase]);

  async function handleSearch() {
    if (!selectedSector) return;
    setSearching(true);
    setHasSearched(true);
    setSelectedRole(null);
    setPage(0);
    const params = new URLSearchParams({ sector: selectedSector, limit: '500' });
    if (selectedTracks.length > 0) params.set('tracks', selectedTracks.join(','));
    const res = await fetch(`${apiBase}/roles?${params}`);
    const { data } = await res.json();
    setResults(data?.rows ?? []);
    setSearching(false);
  }

  const visibleResults = useMemo(() => {
    let rows = results;
    if (keyword) rows = rows.filter(r => r.job_role.toLowerCase().includes(keyword.toLowerCase()));
    rows = [...rows].sort((a, b) => sortDir === 'asc' ? a.job_role.localeCompare(b.job_role) : b.job_role.localeCompare(a.job_role));
    return rows;
  }, [results, keyword, sortDir]);

  const pageCount = Math.max(1, Math.ceil(visibleResults.length / PAGE_SIZE));
  const pagedResults = visibleResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function handleSetGoal() {
    if (!selectedRole) return;
    setSaving(true);
    setSaveError('');
    try {
      const body = userCountry === 'SG'
        ? { catalog_job_role_id: selectedRole.id, notes }
        : { esco_occupation_id: selectedRole.id, notes };
      const res = await fetch('/api/career', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const { data, error } = await res.json();
      if (data) {
        setSaved(true);
        setCurrent(data);
        setTimeout(() => router.push('/gap-analysis'), 800);
      } else {
        setSaveError(error || 'Failed to save. Please try again.');
      }
    } catch {
      setSaveError('Network error. Please try again.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <Navbar user={null} />
        <div className="flex flex-1 max-w-7xl mx-auto w-full">
          <DashboardSidebar />
          <main className="flex-1 flex items-center justify-center"><LoadingSpinner label="Loading career options…" /></main>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={null} />
      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <DashboardSidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="max-w-3xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🎯 Career Aspiration</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Find and choose your target job role to power personalised recommendations.</p>
            </div>

            {saved && (
              <div className="mb-5 p-4 rounded-xl text-sm flex items-center gap-2" style={{ background: '#f0fdf4', color: 'var(--success)', border: '1px solid #bbf7d0' }}>
                <span>✅</span> Career goal saved! Taking you to Gap Analysis…
              </div>
            )}

            {saveError && (
              <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                {saveError}
              </div>
            )}

            {current && !saved && (
              <div className="mb-5 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,120,212,0.2)' }}>
                <div className="p-4 text-sm" style={{ background: 'var(--primary-light)' }}>
                  <p className="font-medium" style={{ color: 'var(--primary)' }}>Current Goal</p>
                  <p className="mt-0.5 font-semibold" style={{ color: 'var(--foreground)' }}>
                    {current.job_role_name} · {current.industry_name}{current.catalog_track ? ` · ${current.catalog_track}` : ''}
                  </p>
                </div>
                <div className="px-4 py-2.5 flex items-start gap-2 text-xs" style={{ background: '#fffbeb', borderTop: '1px solid #fde68a' }}>
                  <span className="shrink-0">⚠️</span>
                  <p style={{ color: '#92400e', fontWeight: 700 }}>
                    Browsing does not change your goal. Only click "Update Career Goal" when you are sure — this will replace your current goal and reset your Gap Analysis and course recommendations.
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>You can change your career goal here.</p>

            <div className="card p-6 space-y-5">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>🎛️ Find Job Roles by Sector</h3>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Sector</label>
                <select
                  className="input"
                  value={selectedSector}
                  onChange={e => setSelectedSector(e.target.value)}
                >
                  <option value="">— Select a sector —</option>
                  {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {sectors.length === 0 && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--warning)' }}>⚠️ No sectors found. Admin needs to upload the Job Role Catalog first.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Filter by Track</label>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 w-full">
                    <TrackMultiSelect tracks={tracks} selected={selectedTracks} onChange={setSelectedTracks} disabled={!selectedSector} />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={!selectedSector || searching}
                    className="btn-primary shrink-0"
                    style={{ opacity: !selectedSector || searching ? 0.5 : 1 }}
                  >
                    {searching ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </div>
            </div>

            {hasSearched && (
              <div className="card p-6 mt-5 space-y-4">
                <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Job Roles</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {visibleResults.length} result{visibleResults.length !== 1 ? 's' : ''} found. Select a role to view more details.
                </p>
                <input
                  className="input text-sm"
                  placeholder="Enter keyword to search"
                  value={keyword}
                  onChange={e => { setKeyword(e.target.value); setPage(0); }}
                />

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <th
                          className="text-left py-2 pr-4 cursor-pointer select-none"
                          style={{ color: 'var(--foreground)' }}
                          onClick={() => { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(0); }}
                        >
                          Job Role {sortDir === 'asc' ? '↑' : '↓'}
                        </th>
                        <th className="text-left py-2 pr-4" style={{ color: 'var(--foreground)' }}>Sector</th>
                        <th className="text-left py-2" style={{ color: 'var(--foreground)' }}>Track</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedResults.map(role => (
                        <tr
                          key={role.id}
                          onClick={() => setSelectedRole(role)}
                          className="cursor-pointer"
                          style={{
                            borderBottom: '1px solid var(--card-border)',
                            background: selectedRole?.id === role.id ? 'var(--primary-light)' : 'transparent',
                          }}
                        >
                          <td className="py-2.5 pr-4 font-medium" style={{ color: 'var(--primary)' }}>{role.job_role}</td>
                          <td className="py-2.5 pr-4" style={{ color: 'var(--muted)' }}>{role.sector}</td>
                          <td className="py-2.5" style={{ color: 'var(--muted)' }}>{role.track}</td>
                        </tr>
                      ))}
                      {visibleResults.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-8" style={{ color: 'var(--muted)' }}>No job roles found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {visibleResults.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visibleResults.length)} of {visibleResults.length} roles
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(p => p - 1)}
                        disabled={page === 0}
                        className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{
                          background: page === 0 ? 'var(--muted-bg)' : 'var(--primary-light)',
                          color: page === 0 ? 'var(--muted)' : 'var(--primary)',
                          cursor: page === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ← Prev
                      </button>
                      {pageCount <= 10 ? (
                        <div className="flex gap-1">
                          {Array.from({ length: pageCount }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => setPage(i)}
                              className="w-8 h-8 rounded-lg text-xs font-semibold transition-colors"
                              style={{
                                background: i === page ? 'var(--primary)' : 'var(--muted-bg)',
                                color: i === page ? 'white' : 'var(--muted)',
                              }}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs px-2" style={{ color: 'var(--muted)' }}>
                          Page {page + 1} of {pageCount}
                        </span>
                      )}
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= pageCount - 1}
                        className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{
                          background: page >= pageCount - 1 ? 'var(--muted-bg)' : 'var(--primary-light)',
                          color: page >= pageCount - 1 ? 'var(--muted)' : 'var(--primary)',
                          cursor: page >= pageCount - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedRole && (
              <div className="card p-6 mt-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Selected Job Role</p>
                    <p className="text-lg font-semibold mt-1" style={{ color: 'var(--foreground)' }}>{selectedRole.job_role}</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>{selectedRole.sector}{selectedRole.track ? ` · ${selectedRole.track}` : ''}</p>
                    {selectedRole.job_role_description && (
                      <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>{selectedRole.job_role_description}</p>
                    )}
                    {selectedRole.performance_expectation && (
                      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}><strong>Performance Expectation:</strong> {selectedRole.performance_expectation}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSetGoal}
                    disabled={saving || saved}
                    className="btn-primary shrink-0"
                    style={{ opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'Saving…' : saved ? '✅ Saved!' : current ? 'Update Career Goal →' : 'Set Career Goal →'}
                  </button>
                </div>

                {/* ── Tabs ──────────────────────────────────────────── */}
                <div>
                  <div className="flex border-b" style={{ borderColor: 'var(--card-border)' }}>
                    {([
                      { id: 'market' as const, label: '🌐 Market Skills' },
                      { id: 'ssg'    as const, label: userCountry === 'SG' ? '📋 SSG Framework' : '📋 ESCO Framework' },
                    ]).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
                        style={{
                          borderColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                          color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted)',
                          background: 'transparent',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Market Skills tab ─────────────────────────── */}
                  {activeTab === 'market' && (
                    <div className="pt-4 space-y-5">
                      {marketLoading && (
                        <div className="flex items-center gap-2 py-4" style={{ color: 'var(--muted)' }}>
                          <LoadingSpinner label="" />
                          <span className="text-sm">Searching live listings on MyCareersFuture…</span>
                        </div>
                      )}
                      {marketError && !marketLoading && (
                        <p className="text-sm py-2" style={{ color: 'var(--muted)' }}>No Listing available</p>
                      )}
                      {!marketLoading && !marketError && marketSkills.length === 0 && (
                        <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>No Listing available</p>
                      )}
                      {!marketLoading && !marketError && marketSkills.length > 0 && (() => {
                        const tscCategories = new Set(['technical', 'tools & platforms', 'domain knowledge']);
                        const tscSkills = marketSkills.filter(s => tscCategories.has((s.category ?? '').toLowerCase()));
                        const ccsSkills = marketSkills.filter(s => !tscCategories.has((s.category ?? '').toLowerCase()));
                        return (
                          <>
                            {/* TSC section */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>TSC (Technical Skills and Competencies)</h4>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{tscSkills.length}</span>
                              </div>
                              {tscSkills.length === 0 ? (
                                <div className="rounded-lg p-4 text-sm text-center" style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                                  No technical skills found.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--card-border)' }}>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
                                        <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Skill Title</th>
                                        <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Demand</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tscSkills.map((skill, i) => {
                                        const badge = DEMAND_BADGE[skill.importance] ?? DEMAND_BADGE.low;
                                        return (
                                          <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                            <td className="py-2 px-3 font-medium" style={{ color: 'var(--primary)' }}>{skill.name}</td>
                                            <td className="py-2 px-3">
                                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* CCS section */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>CCS (Critical Core Skills)</h4>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#15803d' }}>{ccsSkills.length}</span>
                              </div>
                              {ccsSkills.length === 0 ? (
                                <div className="rounded-lg p-4 text-sm text-center" style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                                  No critical core skills found.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--card-border)' }}>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
                                        <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Skill Title</th>
                                        <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Demand</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ccsSkills.map((skill, i) => {
                                        const badge = DEMAND_BADGE[skill.importance] ?? DEMAND_BADGE.low;
                                        return (
                                          <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                            <td className="py-2 px-3 font-medium" style={{ color: 'var(--primary)' }}>{skill.name}</td>
                                            <td className="py-2 px-3">
                                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── SSG / ESCO Framework tab ──────────────────── */}
                  {activeTab === 'ssg' && (
                    <div className="pt-4 space-y-4">
                      {detailsLoading && (
                        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading framework details…</p>
                      )}
                      {!detailsLoading && cwf.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Critical Work Function and Key Tasks</h4>
                          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--card-border)' }}>
                            <table className="w-full text-sm">
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
                                  <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Critical Work Function</th>
                                  <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Key Tasks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cwf.map(entry => (
                                  <tr key={entry.critical_work_function} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <td className="py-2.5 px-3 font-medium align-top" style={{ color: 'var(--foreground)' }}>{entry.critical_work_function}</td>
                                    <td className="py-2.5 px-3" style={{ color: 'var(--muted)' }}>
                                      <ul className="list-disc pl-4 space-y-1">
                                        {entry.key_tasks.map((task, i) => <li key={i}>{task}</li>)}
                                      </ul>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {!detailsLoading && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                              {userCountry === 'SG' ? 'TSC (Technical Skills and Competencies)' : 'Essential Skills'}
                            </h4>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{tsc.length}</span>
                          </div>
                          <SkillTable rows={tsc} emptyText="No skills found for this occupation." />
                        </div>
                      )}
                      {!detailsLoading && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                              {userCountry === 'SG' ? 'CCS (Critical Core Skills)' : 'Optional Skills'}
                            </h4>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#15803d' }}>{ccs.length}</span>
                          </div>
                          <SkillTable rows={ccs} emptyText="No optional skills found for this occupation." />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Notes (optional)</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any specific goals or constraints…"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {current && (
                  <p className="text-xs px-1" style={{ color: '#b45309' }}>
                    ⚠️ Saving will replace <strong>{current.job_role_name}</strong> as your career goal and reset your Gap Analysis.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSetGoal}
                  disabled={saving || saved}
                  className="btn-primary w-full justify-center"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : saved ? '✅ Saved! Taking you to Gap Analysis…' : current ? 'Update Career Goal →' : 'Set Career Goal →'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
