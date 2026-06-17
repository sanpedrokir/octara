'use client';

import { useState, useEffect, useCallback } from 'react';

type Entry = {
  id: number;
  category: 'certification' | 'training';
  title: string;
  organisation: string | null;
  date_obtained: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
};

type Category = 'certification' | 'training';

const CATEGORY_META: Record<Category, { label: string; icon: string; titleLabel: string; orgLabel: string; color: string; bg: string; border: string }> = {
  certification: {
    label: 'Certification',
    icon: '🏆',
    titleLabel: 'Certificate Name',
    orgLabel: 'Issuing Organisation',
    color: '#92400e',
    bg: '#fefce8',
    border: '#fde68a',
  },
  training: {
    label: 'Training',
    icon: '📖',
    titleLabel: 'Course Name',
    orgLabel: 'Training Organisation',
    color: '#5b21b6',
    bg: '#ede9fe',
    border: '#c4b5fd',
  },
};

const BLANK_FORM = { category: 'certification' as Category, title: '', organisation: '', date_obtained: '', expiry_date: '', notes: '' };

function formatDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CertificationsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<Category>('certification');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/certifications');
    const { data } = await res.json();
    if (Array.isArray(data)) setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const certifications = entries.filter(e => e.category === 'certification');
  const trainings = entries.filter(e => e.category === 'training');

  async function handleSave() {
    if (!form.title.trim()) { setSaveError('Title is required.'); return; }
    setSaving(true);
    setSaveError('');
    const res = await fetch('/api/certifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const { data, error } = await res.json();
    if (data) {
      setEntries(prev => [data, ...prev]);
      setForm(BLANK_FORM);
      setShowForm(false);
      setActiveTab(form.category);
    } else {
      setSaveError(error || 'Failed to save. Please try again.');
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    setDeleting(prev => new Set([...prev, id]));
    await fetch(`/api/certifications?id=${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
    setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  const meta = CATEGORY_META[form.category];
  const tabMeta = CATEGORY_META[activeTab];
  const tabItems = activeTab === 'certification' ? certifications : trainings;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🏆 Certifications & Training</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Record your certificates and training courses to build a full picture of your credentials.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setSaveError(''); }}
            className="btn-primary shrink-0"
          >
            + Add New Entry
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card p-6 space-y-4" style={{ border: '2px solid var(--primary)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>New Entry</h2>
            <button onClick={() => { setShowForm(false); setSaveError(''); setForm(BLANK_FORM); }} style={{ color: 'var(--muted)' }}>✕</button>
          </div>

          {/* Category toggle */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Category</label>
            <div className="flex gap-2">
              {(['certification', 'training'] as Category[]).map(cat => {
                const m = CATEGORY_META[cat];
                const active = form.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat, expiry_date: cat === 'training' ? '' : f.expiry_date }))}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: active ? m.bg : 'transparent',
                      color: active ? m.color : 'var(--muted)',
                      border: `2px solid ${active ? m.border : 'var(--card-border)'}`,
                    }}
                  >
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>{meta.titleLabel} *</label>
              <input
                className="input"
                placeholder={`e.g. ${form.category === 'certification' ? 'AWS Certified Solutions Architect' : 'C++ Programming Fundamentals'}`}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>{meta.orgLabel}</label>
              <input
                className="input"
                placeholder={`e.g. ${form.category === 'certification' ? 'Amazon Web Services' : 'Coursera / Udemy'}`}
                value={form.organisation}
                onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                {form.category === 'certification' ? 'Date Obtained' : 'Completion Date'}
              </label>
              <input
                type="date"
                className="input"
                value={form.date_obtained}
                onChange={e => setForm(f => ({ ...f, date_obtained: e.target.value }))}
              />
            </div>

            {form.category === 'certification' && (
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Expiry Date <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="date"
                  className="input"
                  value={form.expiry_date}
                  onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                />
              </div>
            )}

            <div className={form.category === 'certification' ? '' : 'sm:col-span-2'}>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Notes <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className="input"
                rows={2}
                placeholder="e.g. credential ID, score, link..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {saveError && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{saveError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
            <button onClick={() => { setShowForm(false); setSaveError(''); setForm(BLANK_FORM); }} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary counts */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {(['certification', 'training'] as Category[]).map(cat => {
            const m = CATEGORY_META[cat];
            const count = cat === 'certification' ? certifications.length : trainings.length;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className="card p-5 flex items-center gap-4 text-left transition-all"
                style={{
                  border: activeTab === cat ? `2px solid ${m.border}` : '1px solid var(--card-border)',
                  background: activeTab === cat ? m.bg : 'white',
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: m.bg }}>
                  {m.icon}
                </div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: m.color }}>{count}</p>
                  <p className="text-sm font-medium" style={{ color: m.color }}>{m.label}{count !== 1 ? 's' : ''}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs + list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl skeleton" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="text-5xl block mb-4">🎓</span>
          <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>No credentials added yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Add your certifications and training courses to showcase your credentials.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Add Your First Entry</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b" style={{ borderColor: 'var(--card-border)' }}>
            {(['certification', 'training'] as Category[]).map(cat => {
              const m = CATEGORY_META[cat];
              const count = cat === 'certification' ? certifications.length : trainings.length;
              const active = activeTab === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className="flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors"
                  style={{
                    color: active ? m.color : 'var(--muted)',
                    borderBottom: active ? `2px solid ${m.border}` : '2px solid transparent',
                    background: active ? m.bg : 'transparent',
                  }}
                >
                  {m.icon} {m.label}s
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs"
                    style={{ background: active ? m.border : 'var(--muted-bg)', color: active ? m.color : 'var(--muted)' }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
            {tabItems.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  No {tabMeta.label.toLowerCase()}s added yet.{' '}
                  <button onClick={() => { setForm(f => ({ ...f, category: activeTab })); setShowForm(true); }} style={{ color: 'var(--primary)' }}>
                    Add one now →
                  </button>
                </p>
              </div>
            ) : (
              tabItems.map(entry => {
                const m = CATEGORY_META[entry.category];
                const busy = deleting.has(entry.id);
                const isExpired = entry.expiry_date && new Date(entry.expiry_date) < new Date();
                return (
                  <div key={entry.id} className="p-5 flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 mt-0.5"
                      style={{ background: m.bg }}
                    >
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{entry.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {isExpired && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                              Expired
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={busy}
                            className="text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{ color: 'var(--muted)', opacity: busy ? 0.5 : 1 }}
                            title="Remove"
                          >
                            {busy ? '…' : '✕'}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        {entry.organisation && <span>{m.orgLabel}: <strong style={{ color: 'var(--foreground)' }}>{entry.organisation}</strong></span>}
                        {entry.date_obtained && <span>Date: <strong style={{ color: 'var(--foreground)' }}>{formatDate(entry.date_obtained)}</strong></span>}
                        {entry.expiry_date && <span>Expires: <strong style={{ color: isExpired ? '#dc2626' : 'var(--foreground)' }}>{formatDate(entry.expiry_date)}</strong></span>}
                      </div>
                      {entry.notes && (
                        <p className="text-xs mt-1.5 italic" style={{ color: 'var(--muted)' }}>{entry.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
