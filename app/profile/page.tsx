'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Navbar from '../ui/Navbar';
import DashboardSidebar from '../ui/DashboardSidebar';
import MobileNav from '../ui/MobileNav';
import type { Education, WorkExperience } from '@/lib/types';

type Tab = 'basic' | 'education' | 'experience';

interface UserData {
  name: string;
  email: string;
  profile: {
    bio?: string;
    phone?: string;
    location?: string;
    linkedin_url?: string;
    resume_text?: string;
  } | null;
}

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('basic');
  const [user, setUser] = useState<UserData | null>(null);
  const [education, setEducation] = useState<Education[]>([]);
  const [experience, setExperience] = useState<WorkExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [basicForm, setBasicForm] = useState({ name: '', bio: '', phone: '', location: '', linkedin_url: '', resume_text: '' });
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', is_current: false });
  const [expForm, setExpForm] = useState({ company: '', title: '', start_date: '', end_date: '', is_current: false, description: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profileRes, eduRes, expRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/education'),
      fetch('/api/experience'),
    ]);
    const [profileJson, eduJson, expJson] = await Promise.all([profileRes.json(), eduRes.json(), expRes.json()]);

    if (profileJson.data) {
      setUser(profileJson.data);
      setBasicForm({
        name: profileJson.data.name || '',
        bio: profileJson.data.profile?.bio || '',
        phone: profileJson.data.profile?.phone || '',
        location: profileJson.data.profile?.location || '',
        linkedin_url: profileJson.data.profile?.linkedin_url || '',
        resume_text: profileJson.data.profile?.resume_text || '',
      });
    }
    if (eduJson.data) setEducation(eduJson.data);
    if (expJson.data) setExperience(expJson.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveBasic(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(basicForm) });
    const { error } = await res.json();
    setMessage(error || 'Profile saved successfully!');
    setSaving(false);
  }

  async function addEducation(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/education', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eduForm) });
    const { data } = await res.json();
    if (data) {
      setEducation(prev => [data, ...prev]);
      setEduForm({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', is_current: false });
    }
  }

  async function deleteEducation(id: number) {
    await fetch(`/api/education?id=${id}`, { method: 'DELETE' });
    setEducation(prev => prev.filter(e => e.id !== id));
  }

  async function addExperience(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/experience', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expForm) });
    const { data } = await res.json();
    if (data) {
      setExperience(prev => [data, ...prev]);
      setExpForm({ company: '', title: '', start_date: '', end_date: '', is_current: false, description: '' });
    }
  }

  async function deleteExperience(id: number) {
    await fetch(`/api/experience?id=${id}`, { method: 'DELETE' });
    setExperience(prev => prev.filter(e => e.id !== id));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <Navbar user={null} />
        <div className="flex flex-1 max-w-7xl mx-auto w-full">
          <DashboardSidebar />
          <main className="flex-1 flex items-center justify-center"><LoadingSpinner label="Loading profile…" /></main>
        </div>
        <MobileNav />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'basic', label: 'Basic Info', icon: '👤' },
    { id: 'education', label: 'Education', icon: '🎓' },
    { id: 'experience', label: 'Experience', icon: '💼' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={user ? { name: user.name, email: user.email, role: 'learner' } : null} />
      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <DashboardSidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>My Profile</h1>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--muted-bg)' }}>
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
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Basic Info Tab */}
            {tab === 'basic' && (
              <div className="card p-6 space-y-4">
                {message && (
                  <div className="p-3 rounded-lg text-sm" style={{ background: message.includes('success') ? '#f0fdf4' : '#fef2f2', color: message.includes('success') ? 'var(--success)' : 'var(--danger)' }}>
                    {message}
                  </div>
                )}
                <form onSubmit={saveBasic} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Full Name</label>
                    <input className="input" value={basicForm.name} onChange={e => setBasicForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Bio</label>
                    <textarea className="input" rows={3} value={basicForm.bio} onChange={e => setBasicForm(p => ({ ...p, bio: e.target.value }))} placeholder="Brief professional summary" style={{ resize: 'vertical' }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Phone</label>
                      <input className="input" value={basicForm.phone} onChange={e => setBasicForm(p => ({ ...p, phone: e.target.value }))} placeholder="+65 xxxx xxxx" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Location</label>
                      <input className="input" value={basicForm.location} onChange={e => setBasicForm(p => ({ ...p, location: e.target.value }))} placeholder="Singapore" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>LinkedIn URL</label>
                    <input className="input" value={basicForm.linkedin_url} onChange={e => setBasicForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Resume / Work Summary</label>
                    <textarea className="input" rows={5} value={basicForm.resume_text} onChange={e => setBasicForm(p => ({ ...p, resume_text: e.target.value }))} placeholder="Paste your resume text here for better AI skill analysis…" style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Used by AI to generate personalised skill gap analysis</p>
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                </form>
              </div>
            )}

            {/* Education Tab */}
            {tab === 'education' && (
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Add Education</h3>
                  <form onSubmit={addEducation} className="space-y-3">
                    <input className="input" placeholder="Institution *" value={eduForm.institution} onChange={e => setEduForm(p => ({ ...p, institution: e.target.value }))} required />
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input" placeholder="Degree" value={eduForm.degree} onChange={e => setEduForm(p => ({ ...p, degree: e.target.value }))} />
                      <input className="input" placeholder="Field of Study" value={eduForm.field_of_study} onChange={e => setEduForm(p => ({ ...p, field_of_study: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input" placeholder="Start Year" type="number" value={eduForm.start_year} onChange={e => setEduForm(p => ({ ...p, start_year: e.target.value }))} />
                      <input className="input" placeholder="End Year" type="number" value={eduForm.end_year} onChange={e => setEduForm(p => ({ ...p, end_year: e.target.value }))} disabled={eduForm.is_current} />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                      <input type="checkbox" checked={eduForm.is_current} onChange={e => setEduForm(p => ({ ...p, is_current: e.target.checked }))} className="rounded" />
                      Currently studying here
                    </label>
                    <button type="submit" className="btn-primary text-sm">Add Education</button>
                  </form>
                </div>

                {education.length > 0 && (
                  <div className="space-y-3">
                    {education.map(edu => (
                      <div key={edu.id} className="card p-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{edu.institution}</p>
                          {(edu.degree || edu.field_of_study) && (
                            <p className="text-sm" style={{ color: 'var(--muted)' }}>{[edu.degree, edu.field_of_study].filter(Boolean).join(' · ')}</p>
                          )}
                          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            {edu.start_year}{edu.end_year ? ` – ${edu.end_year}` : edu.is_current ? ' – Present' : ''}
                          </p>
                        </div>
                        <button onClick={() => deleteEducation(edu.id)} className="btn-ghost text-sm shrink-0" style={{ color: 'var(--danger)' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Experience Tab */}
            {tab === 'experience' && (
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Add Work Experience</h3>
                  <form onSubmit={addExperience} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input" placeholder="Company *" value={expForm.company} onChange={e => setExpForm(p => ({ ...p, company: e.target.value }))} required />
                      <input className="input" placeholder="Job Title *" value={expForm.title} onChange={e => setExpForm(p => ({ ...p, title: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input" placeholder="Start (e.g. Jan 2022)" value={expForm.start_date} onChange={e => setExpForm(p => ({ ...p, start_date: e.target.value }))} />
                      <input className="input" placeholder="End (e.g. Dec 2024)" value={expForm.end_date} onChange={e => setExpForm(p => ({ ...p, end_date: e.target.value }))} disabled={expForm.is_current} />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                      <input type="checkbox" checked={expForm.is_current} onChange={e => setExpForm(p => ({ ...p, is_current: e.target.checked }))} className="rounded" />
                      Current role
                    </label>
                    <textarea className="input" rows={2} placeholder="Key responsibilities and achievements…" value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
                    <button type="submit" className="btn-primary text-sm">Add Experience</button>
                  </form>
                </div>

                {experience.length > 0 && (
                  <div className="space-y-3">
                    {experience.map(exp => (
                      <div key={exp.id} className="card p-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{exp.title}</p>
                          <p className="text-sm font-medium" style={{ color: 'var(--primary)' }}>{exp.company}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {exp.start_date}{exp.end_date ? ` – ${exp.end_date}` : exp.is_current ? ' – Present' : ''}
                          </p>
                          {exp.description && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{exp.description}</p>}
                        </div>
                        <button onClick={() => deleteExperience(exp.id)} className="btn-ghost text-sm shrink-0" style={{ color: 'var(--danger)' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
