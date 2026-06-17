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
};

type CwfEntry = { critical_work_function: string; key_tasks: string[] };
type SkillEntry = { skill_title: string; skill_type: string | null; proficiency_level: string | null; skill_code: string | null };

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
            <th className="text-left py-2 px-3" style={{ color: 'var(--foreground)' }}>Code</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
              <td className="py-2 px-3 font-medium" style={{ color: 'var(--primary)' }}>{row.skill_title}</td>
              <td className="py-2 px-3" style={{ color: 'var(--muted)' }}>{row.proficiency_level ? `Level ${row.proficiency_level}` : '—'}</td>
              <td className="py-2 px-3" style={{ color: 'var(--muted)' }}>{row.skill_code}</td>
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

  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [tracks, setTracks] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);

  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<CatalogRole[]>([]);
  const [keyword, setKeyword] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [selectedRole, setSelectedRole] = useState<CatalogRole | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cwf, setCwf] = useState<CwfEntry[]>([]);
  const [tsc, setTsc] = useState<SkillEntry[]>([]);
  const [ccs, setCcs] = useState<SkillEntry[]>([]);

  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sectorsRes, careerRes] = await Promise.all([
      fetch('/api/job-role-catalog/sectors'),
      fetch('/api/career'),
    ]);
    const [sectorsJson, careerJson] = await Promise.all([sectorsRes.json(), careerRes.json()]);

    if (sectorsJson.data) setSectors(sectorsJson.data);
    if (careerJson.data) {
      setCurrent(careerJson.data);
      setNotes('');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!selectedRole) { setCwf([]); setTsc([]); setCcs([]); return; }
    setDetailsLoading(true);
    const params = new URLSearchParams({ sector: selectedRole.sector, job_role: selectedRole.job_role });
    if (selectedRole.track) params.set('track', selectedRole.track);
    fetch(`/api/job-role-catalog/details?${params}`)
      .then(r => r.json())
      .then(({ data }) => {
        setCwf(data?.cwf ?? []);
        setTsc(data?.tsc ?? []);
        setCcs(data?.ccs ?? []);
      })
      .finally(() => setDetailsLoading(false));
  }, [selectedRole]);

  useEffect(() => {
    setSelectedTracks([]);
    setTracks([]);
    if (!selectedSector) return;
    fetch(`/api/job-role-catalog/tracks?sector=${encodeURIComponent(selectedSector)}`)
      .then(r => r.json())
      .then(json => { if (json.data) setTracks(json.data); });
  }, [selectedSector]);

  async function handleSearch() {
    if (!selectedSector) return;
    setSearching(true);
    setHasSearched(true);
    setSelectedRole(null);
    const params = new URLSearchParams({ sector: selectedSector, limit: '500' });
    if (selectedTracks.length > 0) params.set('tracks', selectedTracks.join(','));
    const res = await fetch(`/api/job-role-catalog/roles?${params}`);
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

  async function handleSetGoal() {
    if (!selectedRole) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/career', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog_job_role_id: selectedRole.id, notes }),
      });
      const { data, error } = await res.json();
      if (data) {
        setSaved(true);
        setCurrent(data);
        setTimeout(() => router.push('/skills-navigator'), 800);
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
                <span>✅</span> Career goal saved! Taking you to Skills Navigator…
              </div>
            )}

            {saveError && (
              <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                {saveError}
              </div>
            )}

            {current && !saved && (
              <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: 'var(--primary-light)', border: '1px solid rgba(0,120,212,0.2)' }}>
                <p className="font-medium" style={{ color: 'var(--primary)' }}>Current Goal</p>
                <p className="mt-1" style={{ color: 'var(--foreground)' }}>
                  {current.job_role_name} · {current.industry_name}{current.catalog_track ? ` · ${current.catalog_track}` : ''}
                </p>
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
                  Showing {visibleResults.length} result(s). Select a role to view more details.
                </p>
                <input
                  className="input text-sm"
                  placeholder="Enter keyword to search"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <th
                          className="text-left py-2 pr-4 cursor-pointer select-none"
                          style={{ color: 'var(--foreground)' }}
                          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                        >
                          Job Role {sortDir === 'asc' ? '↑' : '↓'}
                        </th>
                        <th className="text-left py-2 pr-4" style={{ color: 'var(--foreground)' }}>Sector</th>
                        <th className="text-left py-2" style={{ color: 'var(--foreground)' }}>Track</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleResults.map(role => (
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
              </div>
            )}

            {selectedRole && (
              <div className="card p-6 mt-5 space-y-4">
                <div>
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

                {detailsLoading && (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading role details…</p>
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
                    <h4 className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>TSC (Technical Skills and Competencies)</h4>
                    <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Showing {tsc.length} skill(s).</p>
                    <SkillTable rows={tsc} emptyText="This job role does not have any associated TSC (Technical Skills and Competencies)" />
                  </div>
                )}

                {!detailsLoading && (
                  <div>
                    <h4 className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>CCS (Critical Core Skills)</h4>
                    <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Showing {ccs.length} skill(s).</p>
                    <SkillTable rows={ccs} emptyText="This job role does not have any associated CCS (Critical Core Skills)" />
                  </div>
                )}

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

                <button
                  type="button"
                  onClick={handleSetGoal}
                  disabled={saving || saved}
                  className="btn-primary w-full justify-center"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : saved ? '✅ Saved! Taking you to Skills Navigator…' : current ? 'Update Career Goal →' : 'Set Career Goal →'}
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
