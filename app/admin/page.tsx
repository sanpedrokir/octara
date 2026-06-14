'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Industry, JobRole } from '@/lib/types';

type Tab = 'overview' | 'industries' | 'job-roles';

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
      showMsg('Industry added!');
    }
  }

  async function deleteIndustry(id: number) {
    if (!confirm('Delete this industry and all its job roles?')) return;
    await fetch(`/api/industries?id=${id}`, { method: 'DELETE' });
    setIndustries(prev => prev.filter(i => i.id !== id));
    showMsg('Industry deleted');
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
    { id: 'industries', label: 'Industries', icon: '🏭' },
    { id: 'job-roles', label: 'Job Roles', icon: '👔' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>⚙️ Admin Panel</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Manage platform data, industries, and job roles</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>📊 Current Stats</h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Industries: <strong>{industries.length}</strong></p>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>🗄️ Database Management</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Run these once during initial setup of the platform.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={initDb} disabled={loading} className="btn-secondary">
                {loading ? 'Running…' : '📋 Initialise Database Schema'}
              </button>
              <button onClick={seedData} disabled={loading} className="btn-primary">
                {loading ? 'Seeding…' : '🌱 Seed Industries & Job Roles'}
              </button>
            </div>
          </div>

          <div className="card p-5 space-y-4" style={{ border: '2px solid var(--primary)', background: 'var(--primary-light)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--primary)' }}>🔄 Sync from SSG Skills Framework API</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                  Replace seeded industries and job roles with live data directly from the SkillsFuture Skills Framework API.
                  Existing entries are updated; new ones are added. Your career aspirations are preserved.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {['SubSectors → Industries', 'Occupations → Job Roles', 'Live from SSG API'].map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,120,212,0.1)', color: 'var(--primary)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            {syncSuccess && lastSync && (
              <div className="p-4 rounded-lg" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}>
                <p className="font-semibold text-sm" style={{ color: 'var(--success)' }}>✅ Live sync successful — data is from SSG Skills Framework API</p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                  <span>📊 <strong>{lastSync.meta.totalIndustries}</strong> industries in database</span>
                  <span>👔 <strong>{lastSync.meta.totalRoles}</strong> job roles in database</span>
                  <span>🕒 Just now</span>
                </div>
              </div>
            )}

            {!syncSuccess && lastSync ? (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>
                <span className="font-medium">✅ Last synced from SSG — {timeAgo(lastSync.at)}</span>
                <span style={{ color: 'var(--muted)' }}>·</span>
                <span style={{ color: 'var(--muted)' }}>{lastSync.meta.totalIndustries} industries</span>
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
                {loading ? '⏳ Syncing from SSG…' : '🔄 Sync Industries & Job Roles from SSG'}
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
        </div>
      )}

      {/* Industries Tab */}
      {tab === 'industries' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Add Industry</h3>
            <form onSubmit={addIndustry} className="space-y-3">
              <input className="input" placeholder="Industry name *" value={newIndustry.name} onChange={e => setNewIndustry(p => ({ ...p, name: e.target.value }))} required />
              <textarea className="input" rows={2} placeholder="Description" value={newIndustry.description} onChange={e => setNewIndustry(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
              <button type="submit" className="btn-primary text-sm">Add Industry</button>
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
                <p>No industries yet. Use the Seed Data button on the Overview tab to populate.</p>
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
                <option value="">— Select industry —</option>
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
              <option value="">— Filter by industry —</option>
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
                <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>No job roles for this industry yet.</p>
              )}
              {!selectedIndustry && (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>Select an industry to view its job roles.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
