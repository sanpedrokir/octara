'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Industry, JobRole } from '@/lib/types';

type Tab = 'overview' | 'industries' | 'job-roles' | 'catalog' | 'skills-mapping';

type CatalogRow = {
  id: number;
  sector: string;
  track: string | null;
  job_role: string;
  job_role_description: string | null;
  performance_expectation: string | null;
};

type CatalogUpload = { filename: string | null; row_count: number; skipped_count: number; created_at: string };

type MappingRow = {
  id: number;
  skill_code: string | null;
  skill_title: string;
  skill_desc: string | null;
  skill_proficiency_level: string | null;
  proficiency_level_desc: string | null;
  previous_skill_title: string | null;
  previous_sfs_status: string | null;
  previous_casl_status: string | null;
  previous_skill_type: string | null;
  updated_skill_title: string | null;
  updated_skill_sfs_status: string | null;
  updated_casl_status: string | null;
  updated_skill_type: string | null;
  updated_sector_tagging: string | null;
};

type SyncMeta = {
  totalIndustries: number;
  totalRoles: number;
  industriesAdded: number;
  rolesAdded: number;
  errors: string[] | null;
};

function timeAgo(isoDate: string): string {
  const secs = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)} days ago`;
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<{ meta: SyncMeta; at: string } | null>(null);

  const [newIndustry, setNewIndustry] = useState({ name: '', description: '' });
  const [newRole, setNewRole] = useState({ name: '', description: '', skill_keywords: '' });

  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [catalogUploading, setCatalogUploading] = useState(false);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogSectors, setCatalogSectors] = useState<string[]>([]);
  const [catalogLastUpload, setCatalogLastUpload] = useState<CatalogUpload | null>(null);
  const [catalogSectorFilter, setCatalogSectorFilter] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(0);
  const CATALOG_PAGE_SIZE = 50;

  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [mappingUploading, setMappingUploading] = useState(false);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [mappingTotal, setMappingTotal] = useState(0);
  const [mappingSectors, setMappingSectors] = useState<string[]>([]);
  const [mappingLastUpload, setMappingLastUpload] = useState<CatalogUpload | null>(null);
  const [mappingSectorFilter, setMappingSectorFilter] = useState('');
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingPage, setMappingPage] = useState(0);
  const MAPPING_PAGE_SIZE = 50;

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(''), type === 'error' ? 30000 : 6000);
  };

  const loadIndustries = useCallback(async () => {
    const res = await fetch('/api/industries');
    const { data } = await res.json();
    if (data) setIndustries(data);
  }, []);

  const loadLastSync = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sync-ssg');
      const { data } = await res.json();
      if (data?.metadata) {
        const meta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
        setLastSync({ meta, at: data.created_at });
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadIndustries(); loadLastSync(); }, [loadIndustries, loadLastSync]);

  useEffect(() => {
    if (!selectedIndustry) { setJobRoles([]); return; }
    fetch(`/api/job-roles?industry_id=${selectedIndustry}`)
      .then(r => r.json())
      .then(({ data }) => { if (data) setJobRoles(data); });
  }, [selectedIndustry]);

  async function initDb() {
    setLoading(true);
    const res = await fetch('/api/admin/init-db', { method: 'POST' });
    const { data, error } = await res.json();
    showMsg(error || data?.message || 'Done', error ? 'error' : 'success');
    setLoading(false);
  }

  async function seedData() {
    setLoading(true);
    const res = await fetch('/api/admin/seed', { method: 'POST' });
    const { data, error } = await res.json();
    showMsg(error || data?.message || 'Done', error ? 'error' : 'success');
    if (!error) loadIndustries();
    setLoading(false);
  }

  async function addIndustry(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/industries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIndustry),
    });
    const { data, error } = await res.json();
    if (error) showMsg(error, 'error');
    else {
      setIndustries(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewIndustry({ name: '', description: '' });
      showMsg('Sector added!');
    }
  }

  async function deleteIndustry(id: number) {
    if (!confirm('Delete this sector and all its job roles?')) return;
    await fetch(`/api/industries?id=${id}`, { method: 'DELETE' });
    setIndustries(prev => prev.filter(i => i.id !== id));
    showMsg('Sector deleted');
  }

  async function addJobRole(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIndustry) return;
    const keywords = newRole.skill_keywords.split(',').map(s => s.trim()).filter(Boolean);
    const res = await fetch('/api/job-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRole, industry_id: selectedIndustry, skill_keywords: keywords }),
    });
    const { data, error } = await res.json();
    if (error) showMsg(error, 'error');
    else {
      setJobRoles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRole({ name: '', description: '', skill_keywords: '' });
      showMsg('Job role added!');
    }
  }

  async function deleteJobRole(id: number) {
    await fetch(`/api/job-roles?id=${id}`, { method: 'DELETE' });
    setJobRoles(prev => prev.filter(r => r.id !== id));
    showMsg('Job role deleted');
  }

  const loadCatalog = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(CATALOG_PAGE_SIZE),
      offset: String(catalogPage * CATALOG_PAGE_SIZE),
    });
    if (catalogSectorFilter) params.set('sector', catalogSectorFilter);
    if (catalogSearch) params.set('q', catalogSearch);
    const res = await fetch(`/api/admin/job-catalog?${params}`);
    const { data } = await res.json();
    if (data) {
      setCatalogRows(data.rows);
      setCatalogTotal(data.total);
      setCatalogSectors(data.sectors);
      setCatalogLastUpload(data.lastUpload);
    }
  }, [catalogPage, catalogSectorFilter, catalogSearch]);

  useEffect(() => { if (tab === 'catalog') loadCatalog(); }, [tab, loadCatalog]);

  async function uploadCatalog(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogFile) return;
    if (!confirm('This will REPLACE the entire job role catalog with the contents of this file. Continue?')) return;
    setCatalogUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', catalogFile);
      const res = await fetch('/api/admin/job-catalog/upload', { method: 'POST', body: formData });
      const { data, error } = await res.json();
      if (error) {
        showMsg(error, 'error');
      } else {
        showMsg(data.message, 'success');
        setCatalogFile(null);
        setCatalogPage(0);
        loadCatalog();
      }
    } catch (err) {
      showMsg('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setCatalogUploading(false);
    }
  }

  const loadMapping = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(MAPPING_PAGE_SIZE),
      offset: String(mappingPage * MAPPING_PAGE_SIZE),
    });
    if (mappingSectorFilter) params.set('sector', mappingSectorFilter);
    if (mappingSearch) params.set('q', mappingSearch);
    const res = await fetch(`/api/admin/jobs-skills-mapping?${params}`);
    const { data } = await res.json();
    if (data) {
      setMappingRows(data.rows);
      setMappingTotal(data.total);
      setMappingSectors(data.sectors);
      setMappingLastUpload(data.lastUpload);
    }
  }, [mappingPage, mappingSectorFilter, mappingSearch]);

  useEffect(() => { if (tab === 'skills-mapping') loadMapping(); }, [tab, loadMapping]);

  async function uploadMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!mappingFile) return;
    if (!confirm('This will REPLACE the entire jobs & skills mapping with the contents of this file. Continue?')) return;
    setMappingUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', mappingFile);
      const res = await fetch('/api/admin/jobs-skills-mapping/upload', { method: 'POST', body: formData });
      const { data, error } = await res.json();
      if (error) {
        showMsg(error, 'error');
      } else {
        showMsg(data.message, 'success');
        setMappingFile(null);
        setMappingPage(0);
        loadMapping();
      }
    } catch (err) {
      showMsg('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setMappingUploading(false);
    }
  }

  const [syncSuccess, setSyncSuccess] = useState(false);
  type SkillEntry = { status: number; ok: boolean; snippet: string; error?: string };
  const [ssgDiag, setSsgDiag] = useState<{ hasCredentials: boolean; hasToken: boolean; tokenStatus: number; tokenError?: string; skillResults: Record<string, SkillEntry> } | null>(null);

  async function testSsgConnection() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/test-ssg');
      const { data, error } = await res.json();
      if (error) showMsg(error, 'error');
      else setSsgDiag(data);
    } catch (e) {
      showMsg('Test failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function syncSsg() {
    setLoading(true);
    setSyncSuccess(false);
    showMsg('Syncing from SSG Skills Framework API… this may take up to 30 seconds.', 'success');
    try {
      const res = await fetch('/api/admin/sync-ssg', { method: 'POST' });
      const { data, error } = await res.json();
      if (error) {
        showMsg(error, 'error');
      } else {
        showMsg(data?.message || 'Sync complete!', 'success');
        setSyncSuccess(true);
        loadIndustries();
        loadLastSync();
      }
    } catch (e) {
      showMsg('Sync failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '⚙️' },
    { id: 'catalog', label: 'Job Role Catalog (SSG XLS Upload)', icon: '📁' },
    { id: 'skills-mapping', label: 'Jobs & Skills Mapping (SSG XLS Upload)', icon: '🧩' },
    { id: 'industries', label: 'Sectors (Non SSG)', icon: '🏭' },
    { id: 'job-roles', label: 'Job Roles (Non SSG)', icon: '👔' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>⚙️ Admin Panel</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Manage platform data, sectors, and job roles</p>
      </div>

      {message && (
        <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: msgType === 'success' ? '#f0fdf4' : '#fef2f2', color: msgType === 'success' ? 'var(--success)' : 'var(--danger)' }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'var(--muted-bg)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t.id ? 'var(--card)' : 'transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--muted)',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="card p-5 space-y-4" style={{ border: '2px solid var(--primary)', background: 'var(--primary-light)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--primary)' }}>🔄 Sync from SSG Skills Framework API</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                  Replace seeded sectors and job roles with live data directly from the SkillsFuture Skills Framework API.
                  Existing entries are updated; new ones are added. Your career aspirations are preserved.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {['SubSectors → Sectors', 'Occupations → Job Roles', 'Live from SSG API'].map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,120,212,0.1)', color: 'var(--primary)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            {syncSuccess && lastSync && (
              <div className="p-4 rounded-lg" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}>
                <p className="font-semibold text-sm" style={{ color: 'var(--success)' }}>✅ Live sync successful — data is from SSG Skills Framework API</p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                  <span>📊 <strong>{lastSync.meta.totalIndustries}</strong> sectors in database</span>
                  <span>👔 <strong>{lastSync.meta.totalRoles}</strong> job roles in database</span>
                  <span>🕒 Just now</span>
                </div>
              </div>
            )}

            {!syncSuccess && lastSync ? (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>
                <span className="font-medium">✅ Last synced from SSG — {timeAgo(lastSync.at)}</span>
                <span style={{ color: 'var(--muted)' }}>·</span>
                <span style={{ color: 'var(--muted)' }}>{lastSync.meta.totalIndustries} sectors</span>
                <span style={{ color: 'var(--muted)' }}>·</span>
                <span style={{ color: 'var(--muted)' }}>{lastSync.meta.totalRoles} job roles</span>
                {lastSync.meta.errors && (
                  <>
                    <span style={{ color: 'var(--muted)' }}>·</span>
                    <span style={{ color: 'var(--warning)' }}>{lastSync.meta.errors.length} skipped</span>
                  </>
                )}
              </div>
            ) : !syncSuccess ? (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--warning)' }}>
                ⚠️ Never synced — using seeded data. Click the button below to pull live SSG data.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button onClick={syncSsg} disabled={loading} className="btn-primary">
                {loading ? '⏳ Syncing from SSG…' : '🔄 Sync Sectors & Job Roles from SSG'}
              </button>
              <button onClick={testSsgConnection} disabled={loading} className="btn-secondary text-sm">
                🔍 Test SSG Connection
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Tip: run this once a day. Courses are already fetched live from SSG on every search — no sync needed for courses.
            </p>

            {ssgDiag && (
              <div className="mt-2 p-3 rounded-lg text-xs font-mono space-y-2" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                <p className="font-semibold text-sm font-sans">SSG Connection Diagnostic</p>
                <p style={{ color: ssgDiag.hasCredentials ? 'var(--muted)' : 'var(--danger)' }}>
                  Credentials: {ssgDiag.hasCredentials ? '✅ present in .env.local' : '❌ missing from .env.local'}
                </p>
                <p style={{ color: ssgDiag.hasToken ? 'var(--success)' : 'var(--danger)' }}>
                  OAuth token (public-api.ssg-wsg.sg): {ssgDiag.hasToken
                    ? `✅ obtained (HTTP ${ssgDiag.tokenStatus})`
                    : `❌ failed (HTTP ${ssgDiag.tokenStatus}) — ${ssgDiag.tokenError ?? 'unknown'}`}
                </p>
                {Object.keys(ssgDiag.skillResults).length > 0 && (
                  <>
                    <p className="font-sans font-semibold mt-1" style={{ color: 'var(--muted)' }}>API endpoints:</p>
                    {Object.entries(ssgDiag.skillResults).map(([path, r]) => (
                      <div key={path} className="flex items-start gap-2 flex-wrap">
                        <span style={{ color: r.ok ? 'var(--success)' : 'var(--danger)' }}>{r.ok ? '✅' : '❌'}</span>
                        <span className="shrink-0" style={{ color: 'var(--muted)' }}>{r.status || '---'}</span>
                        <span className="break-all" style={{ color: 'var(--muted)' }}>{path}</span>
                        {r.error && <span className="break-all" style={{ color: 'var(--danger)' }}>— {r.error}</span>}
                        {r.ok && r.snippet && <span className="break-all opacity-60 font-sans">{r.snippet.slice(0, 80)}</span>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>🗄️ Database Management</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Run this once during initial setup of the platform, or after a schema change.</p>
            <button onClick={initDb} disabled={loading} className="btn-secondary">
              {loading ? 'Running…' : '📋 Initialise Database Schema'}
            </button>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>🌱 Seed Sectors & Job Roles (Non SSG)</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Populates sectors and job roles from the local seed data — use this only if you don&apos;t want to sync from the live SSG API above.</p>
            <button onClick={seedData} disabled={loading} className="btn-primary">
              {loading ? 'Seeding…' : '🌱 Seed Sectors & Job Roles'}
            </button>
          </div>
        </div>
      )}

      {/* Sectors Tab */}
      {tab === 'industries' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Add Sector</h3>
            <form onSubmit={addIndustry} className="space-y-3">
              <input className="input" placeholder="Sector name *" value={newIndustry.name} onChange={e => setNewIndustry(p => ({ ...p, name: e.target.value }))} required />
              <textarea className="input" rows={2} placeholder="Description" value={newIndustry.description} onChange={e => setNewIndustry(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
              <button type="submit" className="btn-primary text-sm">Add Sector</button>
            </form>
          </div>

          <div className="space-y-2">
            {industries.map(ind => (
              <div key={ind.id} className="card p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>{ind.name}</p>
                  {ind.description && <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{ind.description}</p>}
                </div>
                <button onClick={() => deleteIndustry(ind.id)} className="btn-ghost text-sm shrink-0" style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            ))}
            {industries.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
                <p>No sectors yet. Use the Seed Data button on the Overview tab to populate.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Roles Tab */}
      {tab === 'job-roles' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Add Job Role</h3>
            <form onSubmit={addJobRole} className="space-y-3">
              <select className="input" value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)} required>
                <option value="">— Select sector —</option>
                {industries.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className="input" placeholder="Job role name *" value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} required />
                <input className="input" placeholder="Key skills (comma separated)" value={newRole.skill_keywords} onChange={e => setNewRole(p => ({ ...p, skill_keywords: e.target.value }))} />
              </div>
              <textarea className="input" rows={2} placeholder="Description" value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
              <button type="submit" disabled={!selectedIndustry} className="btn-primary text-sm" style={{ opacity: selectedIndustry ? 1 : 0.5 }}>Add Job Role</button>
            </form>
          </div>

          <div>
            <select className="input mb-4" value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)}>
              <option value="">— Filter by sector —</option>
              {industries.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
            </select>

            <div className="space-y-2">
              {jobRoles.map(role => (
                <div key={role.id} className="card p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>{role.name}</p>
                    {role.description && <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{role.description}</p>}
                    {role.skill_keywords && role.skill_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {role.skill_keywords.map(k => <span key={k} className="badge badge-blue">{k}</span>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteJobRole(role.id)} className="btn-ghost text-sm shrink-0" style={{ color: 'var(--danger)' }}>Delete</button>
                </div>
              ))}
              {selectedIndustry && jobRoles.length === 0 && (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>No job roles for this sector yet.</p>
              )}
              {!selectedIndustry && (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>Select a sector to view its job roles.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job Role Catalog Tab */}
      {tab === 'catalog' && (
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>📁 Upload Job Role Catalog</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Upload the master Excel/CSV file (Sector, Track, Job Role, Job Role Description, Performance Expectation).
                Each upload <strong>replaces the entire catalog</strong> — use this for your periodic (monthly / 6-monthly) refresh.
              </p>
            </div>
            <form onSubmit={uploadCatalog} className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => setCatalogFile(e.target.files?.[0] ?? null)}
                className="input"
              />
              <button type="submit" disabled={!catalogFile || catalogUploading} className="btn-primary text-sm shrink-0" style={{ opacity: !catalogFile || catalogUploading ? 0.5 : 1 }}>
                {catalogUploading ? 'Uploading…' : '⬆️ Upload & Replace Catalog'}
              </button>
            </form>
            {catalogLastUpload && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Last upload: <strong>{catalogLastUpload.filename || 'file'}</strong> — {catalogLastUpload.row_count} rows
                {catalogLastUpload.skipped_count > 0 && `, ${catalogLastUpload.skipped_count} skipped`} — {timeAgo(catalogLastUpload.created_at)}
              </p>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Browse Catalog ({catalogTotal})</h3>
              <div className="flex flex-wrap gap-2">
                <select
                  className="input text-sm"
                  value={catalogSectorFilter}
                  onChange={e => { setCatalogSectorFilter(e.target.value); setCatalogPage(0); }}
                >
                  <option value="">— All sectors —</option>
                  {catalogSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  className="input text-sm"
                  placeholder="Search job role…"
                  value={catalogSearch}
                  onChange={e => { setCatalogSearch(e.target.value); setCatalogPage(0); }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {catalogRows.map(row => (
                <div key={row.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="badge badge-blue">{row.sector}</span>
                    {row.track && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.track}</span>}
                  </div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>{row.job_role}</p>
                  {row.job_role_description && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{row.job_role_description}</p>}
                  {row.performance_expectation && (
                    <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}><strong>Performance Expectation:</strong> {row.performance_expectation}</p>
                  )}
                </div>
              ))}
              {catalogRows.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No catalog data yet. Upload a file above to populate it.</p>
              )}
            </div>

            {catalogTotal > CATALOG_PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setCatalogPage(p => Math.max(0, p - 1))}
                  disabled={catalogPage === 0}
                  className="btn-secondary text-sm"
                  style={{ opacity: catalogPage === 0 ? 0.5 : 1 }}
                >
                  ← Previous
                </button>
                <span style={{ color: 'var(--muted)' }}>
                  Page {catalogPage + 1} of {Math.ceil(catalogTotal / CATALOG_PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setCatalogPage(p => p + 1)}
                  disabled={(catalogPage + 1) * CATALOG_PAGE_SIZE >= catalogTotal}
                  className="btn-secondary text-sm"
                  style={{ opacity: (catalogPage + 1) * CATALOG_PAGE_SIZE >= catalogTotal ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs & Skills Mapping Tab */}
      {tab === 'skills-mapping' && (
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>🧩 Upload Jobs & Skills Mapping</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Upload the SkillsFuture TSC-to-Unique-Skills mapping file (Skill Code, Skill Title, Proficiency Level, Previous/Updated Skill mapping, Sector Tagging, etc.).
                Each upload <strong>replaces the entire mapping table</strong>.
              </p>
            </div>
            <form onSubmit={uploadMapping} className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={e => setMappingFile(e.target.files?.[0] ?? null)}
                className="input"
              />
              <button type="submit" disabled={!mappingFile || mappingUploading} className="btn-primary text-sm shrink-0" style={{ opacity: !mappingFile || mappingUploading ? 0.5 : 1 }}>
                {mappingUploading ? 'Uploading…' : '⬆️ Upload & Replace Mapping'}
              </button>
            </form>
            {mappingLastUpload && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Last upload: <strong>{mappingLastUpload.filename || 'file'}</strong> — {mappingLastUpload.row_count} rows
                {mappingLastUpload.skipped_count > 0 && `, ${mappingLastUpload.skipped_count} skipped`} — {timeAgo(mappingLastUpload.created_at)}
              </p>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Browse Mapping ({mappingTotal})</h3>
              <div className="flex flex-wrap gap-2">
                <select
                  className="input text-sm"
                  value={mappingSectorFilter}
                  onChange={e => { setMappingSectorFilter(e.target.value); setMappingPage(0); }}
                >
                  <option value="">— All sectors —</option>
                  {mappingSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  className="input text-sm"
                  placeholder="Search skill title or code…"
                  value={mappingSearch}
                  onChange={e => { setMappingSearch(e.target.value); setMappingPage(0); }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {mappingRows.map(row => (
                <div key={row.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {row.skill_code && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.skill_code}</span>}
                    {row.updated_sector_tagging && <span className="badge badge-blue">{row.updated_sector_tagging}</span>}
                    {row.updated_skill_type && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.updated_skill_type.toUpperCase()}</span>}
                  </div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>{row.updated_skill_title || row.skill_title}</p>
                  {row.skill_desc && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{row.skill_desc}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                    {row.skill_proficiency_level && <span>PL: <strong>{row.skill_proficiency_level}</strong></span>}
                    {row.updated_skill_sfs_status && <span>SFS: <strong>{row.updated_skill_sfs_status}</strong></span>}
                    {row.updated_casl_status && <span>CASL: <strong>{row.updated_casl_status}</strong></span>}
                  </div>
                </div>
              ))}
              {mappingRows.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No mapping data yet. Upload a file above to populate it.</p>
              )}
            </div>

            {mappingTotal > MAPPING_PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setMappingPage(p => Math.max(0, p - 1))}
                  disabled={mappingPage === 0}
                  className="btn-secondary text-sm"
                  style={{ opacity: mappingPage === 0 ? 0.5 : 1 }}
                >
                  ← Previous
                </button>
                <span style={{ color: 'var(--muted)' }}>
                  Page {mappingPage + 1} of {Math.ceil(mappingTotal / MAPPING_PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setMappingPage(p => p + 1)}
                  disabled={(mappingPage + 1) * MAPPING_PAGE_SIZE >= mappingTotal}
                  className="btn-secondary text-sm"
                  style={{ opacity: (mappingPage + 1) * MAPPING_PAGE_SIZE >= mappingTotal ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
