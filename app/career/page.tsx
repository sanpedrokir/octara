'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../ui/LoadingSpinner';
import Navbar from '../ui/Navbar';
import DashboardSidebar from '../ui/DashboardSidebar';
import MobileNav from '../ui/MobileNav';
import type { Industry, JobRole, CareerAspiration } from '@/lib/types';

export default function CareerPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [current, setCurrent] = useState<CareerAspiration | null>(null);

  const [form, setForm] = useState({
    industry_id: '',
    job_role_id: '',
    notes: '',
  });

  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [indRes, careerRes] = await Promise.all([
      fetch('/api/industries'),
      fetch('/api/career'),
    ]);
    const [indJson, careerJson] = await Promise.all([indRes.json(), careerRes.json()]);

    if (indJson.data) setIndustries(indJson.data);
    if (careerJson.data) {
      setCurrent(careerJson.data);
      setForm({
        industry_id: String(careerJson.data.industry_id),
        job_role_id: String(careerJson.data.job_role_id),
        notes: careerJson.data.notes || '',
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!form.industry_id) { setJobRoles([]); return; }
    fetch(`/api/job-roles?industry_id=${form.industry_id}`)
      .then(r => r.json())
      .then(json => { if (json.data) setJobRoles(json.data); });
  }, [form.industry_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/career', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          <div className="max-w-xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🎯 Career Aspiration</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Choose your target industry and role to power personalised recommendations.</p>
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
                <p className="mt-1" style={{ color: 'var(--foreground)' }}>{current.job_role_name} · {current.industry_name}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="card p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Target Industry *</label>
                <select
                  className="input"
                  value={form.industry_id}
                  onChange={e => setForm(p => ({ ...p, industry_id: e.target.value, job_role_id: '' }))}
                  required
                >
                  <option value="">— Select an industry —</option>
                  {industries.map(ind => (
                    <option key={ind.id} value={ind.id}>{ind.name}</option>
                  ))}
                </select>
                {industries.length === 0 && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--warning)' }}>⚠️ No industries found. Admin needs to seed the database first.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Target Job Role *</label>
                <select
                  className="input"
                  value={form.job_role_id}
                  onChange={e => setForm(p => ({ ...p, job_role_id: e.target.value }))}
                  required
                  disabled={!form.industry_id}
                >
                  <option value="">— {form.industry_id ? 'Select a role' : 'Select industry first'} —</option>
                  {jobRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Notes (optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any specific goals or constraints…"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button type="submit" disabled={saving || saved} className="btn-primary w-full justify-center" style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : saved ? '✅ Saved! Taking you to Skills Navigator…' : current ? 'Update Career Goal →' : 'Set Career Goal →'}
              </button>
            </form>

            {jobRoles.length > 0 && form.job_role_id && (
              <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: 'var(--muted-bg)' }}>
                {(() => {
                  const role = jobRoles.find(r => String(r.id) === form.job_role_id);
                  if (!role?.skill_keywords?.length) return null;
                  return (
                    <>
                      <p className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>Key skills for this role:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {role.skill_keywords.map(k => (
                          <span key={k} className="badge badge-blue">{k}</span>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
