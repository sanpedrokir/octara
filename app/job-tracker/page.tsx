'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

type Status = 'applied' | 'interview' | 'offer' | 'rejected';

interface JobApplication {
  id: number;
  company: string;
  role: string;
  status: Status;
  applied_date: string | null;
  job_url: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string; border: string }> = {
  applied:   { label: 'Applied',    bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  interview: { label: 'Interview',  bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  offer:     { label: '🎉 Offer',   bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  rejected:  { label: 'Rejected',   bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

const STATUSES: Status[] = ['applied', 'interview', 'offer', 'rejected'];

export default function JobTrackerPage() {
  const [apps, setApps]           = useState<JobApplication[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [filterStatus, setFilter] = useState<Status | 'all'>('all');
  const [editNotes, setEditNotes] = useState<Record<number, string>>({});

  const [form, setForm] = useState({
    company: '', role: '', status: 'applied' as Status,
    applied_date: '', job_url: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/job-tracker');
    const { data } = await res.json();
    if (data) setApps(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    setAdding(true);
    const res = await fetch('/api/job-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: form.company, role: form.role, status: form.status,
        applied_date: form.applied_date || null,
        job_url: form.job_url || null, notes: form.notes || null,
      }),
    });
    const { data } = await res.json();
    if (data) {
      setApps(prev => [data, ...prev]);
      setForm({ company: '', role: '', status: 'applied', applied_date: '', job_url: '', notes: '' });
      setShowForm(false);
    }
    setAdding(false);
  }

  async function updateStatus(id: number, status: Status) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await fetch(`/api/job-tracker/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteApp(id: number) {
    setApps(prev => prev.filter(a => a.id !== id));
    await fetch(`/api/job-tracker/${id}`, { method: 'DELETE' });
  }

  async function saveNotes(id: number) {
    const notes = editNotes[id] ?? '';
    await fetch(`/api/job-tracker/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setApps(prev => prev.map(a => a.id === id ? { ...a, notes } : a));
    setEditNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  const filtered = filterStatus === 'all' ? apps : apps.filter(a => a.status === filterStatus);

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: apps.filter(a => a.status === s).length }), {} as Record<Status, number>);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>📌 Job Application Tracker</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Track every role you apply for and monitor your pipeline.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm shrink-0">
          {showForm ? '✕ Cancel' : '+ Add Application'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <div key={s} className="card p-4 text-center" style={{ border: `1.5px solid ${cfg.border}`, background: cfg.bg }}>
              <p className="text-2xl font-bold" style={{ color: cfg.color }}>{counts[s] ?? 0}</p>
              <p className="text-xs mt-0.5 font-medium" style={{ color: cfg.color }}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card p-5 space-y-4" style={{ border: '1.5px solid var(--primary)', background: '#f8faff' }}>
          <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>New Application</h3>
          <form onSubmit={addApplication} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Company *</label>
                <input className="input" placeholder="e.g. Google Singapore" required value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Role *</label>
                <input className="input" placeholder="e.g. Senior Software Engineer" required value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Status</label>
                <select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Date Applied</label>
                <input type="date" className="input" value={form.applied_date} onChange={e => setForm(p => ({ ...p, applied_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Job URL</label>
                <input className="input" placeholder="https://…" value={form.job_url} onChange={e => setForm(p => ({ ...p, job_url: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Notes</label>
              <textarea className="input" rows={2} placeholder="Referral, contact name, next steps…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <button type="submit" disabled={adding} className="btn-primary text-sm" style={{ opacity: adding ? 0.7 : 1 }}>
              {adding ? 'Adding…' : '+ Add Application'}
            </button>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
            style={{
              background: filterStatus === s ? 'var(--primary)' : 'var(--muted-bg)',
              color: filterStatus === s ? 'white' : 'var(--foreground)',
              border: '1px solid',
              borderColor: filterStatus === s ? 'var(--primary)' : 'var(--card-border)',
            }}
          >
            {s === 'all' ? `All (${apps.length})` : `${STATUS_CONFIG[s].label} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner label="Loading applications…" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center space-y-2">
          <p className="text-3xl">📋</p>
          <p className="font-semibold" style={{ color: 'var(--foreground)' }}>No applications yet</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Click "+ Add Application" to start tracking your job search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => {
            const cfg = STATUS_CONFIG[app.status];
            const isEditingNotes = editNotes[app.id] !== undefined;
            return (
              <div key={app.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{app.role}</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--primary)' }}>{app.company}</p>
                    {app.applied_date && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        Applied {new Date(app.applied_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Status update + actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={app.status}
                    onChange={e => updateStatus(app.id, e.target.value as Status)}
                    className="text-xs px-2 py-1 rounded-lg border"
                    style={{ border: '1px solid var(--card-border)', color: 'var(--foreground)', background: 'white' }}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                  {app.job_url && (
                    <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--primary)', border: '1px solid var(--card-border)' }}>
                      Open JD ↗
                    </a>
                  )}
                  <button
                    onClick={() => setEditNotes(prev => ({ ...prev, [app.id]: app.notes ?? '' }))}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}
                  >
                    📝 Notes
                  </button>
                  <button onClick={() => deleteApp(app.id)} className="text-xs px-2 py-1 rounded-lg ml-auto" style={{ color: 'var(--danger)', background: '#fef2f2', border: '1px solid #fecaca' }}>
                    Remove
                  </button>
                </div>

                {/* Notes */}
                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotes[app.id]}
                      onChange={e => setEditNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                      rows={3}
                      className="w-full text-sm rounded-lg p-2 border"
                      style={{ border: '1.5px solid var(--primary)', color: 'var(--foreground)', background: 'white', resize: 'vertical' }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveNotes(app.id)} className="btn-primary text-xs px-3">Save</button>
                      <button onClick={() => setEditNotes(prev => { const n = { ...prev }; delete n[app.id]; return n; })} className="btn-secondary text-xs px-3">Cancel</button>
                    </div>
                  </div>
                ) : app.notes ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>📝 {app.notes}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
