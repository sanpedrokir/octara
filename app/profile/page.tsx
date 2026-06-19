'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import Navbar from '../ui/Navbar';
import DashboardSidebar from '../ui/DashboardSidebar';
import MobileNav from '../ui/MobileNav';
import type { Education, WorkExperience } from '@/lib/types';

type Tab = 'basic' | 'education' | 'experience';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 + 5 }, (_, i) => CURRENT_YEAR + 5 - i);

function fmtMonth(val: string): string {
  if (!val) return '';
  const [y, m] = val.split('-');
  if (!y || !m) return val;
  const month = new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short' });
  return `${month} ${y}`;
}

// Placeholder — to be replaced when admin loads Thai institution data via XLS
const TH_IHLS = [
  'Chulalongkorn University (CU)',
  'Mahidol University (MU)',
  'Thammasat University (TU)',
  'Kasetsart University (KU)',
  'Chiang Mai University (CMU)',
  'Prince of Songkla University (PSU)',
  'Khon Kaen University (KKU)',
  "King Mongkut's Institute of Technology Ladkrabang (KMITL)",
  "King Mongkut's University of Technology Thonburi (KMUTT)",
  'Silpakorn University',
  'Bangkok University',
  'Assumption University (ABAC)',
  'Rangsit University',
  'Stamford International University',
  'Webster University Thailand',
];

const SG_IHLS = [
  // Autonomous Universities
  'National University of Singapore (NUS)',
  'Nanyang Technological University (NTU)',
  'Singapore Management University (SMU)',
  'Singapore University of Technology and Design (SUTD)',
  'Singapore Institute of Technology (SIT)',
  'Singapore University of Social Sciences (SUSS)',
  // Polytechnics
  'Singapore Polytechnic (SP)',
  'Ngee Ann Polytechnic (NP)',
  'Temasek Polytechnic (TP)',
  'Republic Polytechnic (RP)',
  'Nanyang Polytechnic (NYP)',
  // ITE
  'Institute of Technical Education (ITE) – College Central',
  'Institute of Technical Education (ITE) – College East',
  'Institute of Technical Education (ITE) – College West',
  // Arts
  'LASALLE College of the Arts',
  'Nanyang Academy of Fine Arts (NAFA)',
  // Private / International
  'SIM Global Education',
  'Kaplan Singapore',
  'PSB Academy',
  'James Cook University Singapore',
  'Curtin Singapore',
  'Management Development Institute of Singapore (MDIS)',
  'Murdoch University Singapore',
  'DigiPen Institute of Technology Singapore',
  'S P Jain School of Global Management',
  'INSEAD Singapore',
  'ESSEC Business School Singapore',
];

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
  const [country, setCountry] = useState<'SG' | 'TH'>('SG');

  const [basicForm, setBasicForm] = useState({ name: '', bio: '', phone: '', location: '', linkedin_url: '', resume_text: '' });
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', is_current: false });
  const [institutionSelect, setInstitutionSelect] = useState('');
  const [institutionOther, setInstitutionOther] = useState('');
  const [expForm, setExpForm] = useState({ company: '', title: '', start_date: '', end_date: '', is_current: false, description: '' });
  const [expIndustries, setExpIndustries] = useState<Array<{ id: number; name: string }>>([]);
  const [expSectorId, setExpSectorId] = useState('');
  const [expJobRoles, setExpJobRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [expJobRoleSelect, setExpJobRoleSelect] = useState('');
  const [expJobRoleOther, setExpJobRoleOther] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profileRes, eduRes, expRes, meRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/education'),
      fetch('/api/experience'),
      fetch('/api/user/me'),
    ]);
    const [profileJson, eduJson, expJson, meJson] = await Promise.all([profileRes.json(), eduRes.json(), expRes.json(), meRes.json()]);

    if (meJson.data?.country === 'TH') setCountry('TH');

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

  // Load industries (SSG sectors) for Experience form
  useEffect(() => {
    fetch('/api/industries')
      .then(r => r.json())
      .then(({ data }) => { if (data) setExpIndustries(data); });
  }, []);

  // Load job roles whenever sector changes
  useEffect(() => {
    if (!expSectorId) { setExpJobRoles([]); setExpJobRoleSelect(''); setExpForm(p => ({ ...p, title: '' })); return; }
    fetch(`/api/job-roles?industry_id=${expSectorId}`)
      .then(r => r.json())
      .then(({ data }) => { if (data) setExpJobRoles(data); setExpJobRoleSelect(''); setExpForm(p => ({ ...p, title: '' })); });
  }, [expSectorId]);

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
      setInstitutionSelect('');
      setInstitutionOther('');
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
      setExpSectorId(''); setExpJobRoleSelect(''); setExpJobRoleOther('');
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
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>LinkedIn URL <span className="font-normal text-xs" style={{ color: 'var(--muted)' }}>(Optional)</span></label>
                    <input className="input" value={basicForm.linkedin_url} onChange={e => setBasicForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Resume / Work Summary <span className="font-normal text-xs" style={{ color: 'var(--muted)' }}>(Optional)</span></label>
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
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Institution Name *</label>
                      <select
                        className="input"
                        value={institutionSelect}
                        onChange={e => {
                          setInstitutionSelect(e.target.value);
                          if (e.target.value !== 'Other') {
                            setEduForm(p => ({ ...p, institution: e.target.value }));
                            setInstitutionOther('');
                          } else {
                            setEduForm(p => ({ ...p, institution: '' }));
                          }
                        }}
                        required={institutionSelect !== 'Other'}
                      >
                        <option value="">Select institution…</option>
                        {country === 'TH' ? (
                          <>
                            <optgroup label="Public Universities">
                              {TH_IHLS.slice(0, 10).map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                            <optgroup label="Private / International">
                              {TH_IHLS.slice(10).map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                          </>
                        ) : (
                          <>
                            <optgroup label="Autonomous Universities">
                              {SG_IHLS.slice(0, 6).map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                            <optgroup label="Polytechnics">
                              {SG_IHLS.slice(6, 11).map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                            <optgroup label="Institute of Technical Education">
                              {SG_IHLS.slice(11, 14).map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                            <optgroup label="Arts Institutions">
                              {SG_IHLS.slice(14, 16).map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                            <optgroup label="Private / International">
                              {SG_IHLS.slice(16).map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                          </>
                        )}
                        <option value="Other">Other (please specify)</option>
                      </select>
                      {institutionSelect === 'Other' && (
                        <div>
                          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Institution Name (not in list) *</label>
                          <input
                            className="input"
                            placeholder="e.g. Harvard University"
                            value={institutionOther}
                            onChange={e => {
                              setInstitutionOther(e.target.value);
                              setEduForm(p => ({ ...p, institution: e.target.value }));
                            }}
                            required
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Courses / Program</label>
                        <input className="input" value={eduForm.degree} onChange={e => setEduForm(p => ({ ...p, degree: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Field of Study</label>
                        <input className="input" value={eduForm.field_of_study} onChange={e => setEduForm(p => ({ ...p, field_of_study: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Start Year</label>
                        <select className="input" value={eduForm.start_year} onChange={e => setEduForm(p => ({ ...p, start_year: e.target.value }))}>
                          <option value="">Select year…</option>
                          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>End Year</label>
                        <select className="input" value={eduForm.end_year} onChange={e => setEduForm(p => ({ ...p, end_year: e.target.value }))} disabled={eduForm.is_current}>
                          <option value="">Select year…</option>
                          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
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
                  <form onSubmit={addExperience} className="space-y-4">

                    {/* Sector */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Sector</label>
                      <select
                        className="input"
                        value={expSectorId}
                        onChange={e => setExpSectorId(e.target.value)}
                      >
                        <option value="">Select sector…</option>
                        {expIndustries.map(ind => (
                          <option key={ind.id} value={String(ind.id)}>{ind.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Job Role */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Job Role *</label>
                      <select
                        className="input"
                        value={expJobRoleSelect}
                        onChange={e => {
                          setExpJobRoleSelect(e.target.value);
                          if (e.target.value !== 'Other') {
                            setExpForm(p => ({ ...p, title: e.target.value }));
                            setExpJobRoleOther('');
                          } else {
                            setExpForm(p => ({ ...p, title: '' }));
                          }
                        }}
                        required={expJobRoleSelect !== 'Other'}
                      >
                        <option value="">Select job role…</option>
                        {expJobRoles.map(jr => (
                          <option key={jr.id} value={jr.name}>{jr.name}</option>
                        ))}
                        <option value="Other">Other (please specify)</option>
                      </select>
                      {expJobRoleSelect === 'Other' && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Job Title (not in list) *</label>
                          <input
                            className="input"
                            placeholder="e.g. Product Manager"
                            value={expJobRoleOther}
                            onChange={e => { setExpJobRoleOther(e.target.value); setExpForm(p => ({ ...p, title: e.target.value })); }}
                            required
                            autoFocus
                          />
                        </div>
                      )}
                    </div>

                    {/* Company */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Company *</label>
                      <input className="input" value={expForm.company} onChange={e => setExpForm(p => ({ ...p, company: e.target.value }))} required />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Start Date</label>
                        <input className="input" type="month" value={expForm.start_date} onChange={e => setExpForm(p => ({ ...p, start_date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>End Date</label>
                        <input className="input" type="month" value={expForm.end_date} onChange={e => setExpForm(p => ({ ...p, end_date: e.target.value }))} disabled={expForm.is_current} />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                      <input type="checkbox" checked={expForm.is_current} onChange={e => setExpForm(p => ({ ...p, is_current: e.target.checked }))} className="rounded" />
                      Current role
                    </label>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Key Responsibilities & Achievements</label>
                      <textarea className="input" rows={3} value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
                    </div>

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
                            {fmtMonth(exp.start_date ?? '')}{exp.end_date ? ` – ${fmtMonth(exp.end_date)}` : exp.is_current ? ' – Present' : ''}
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
