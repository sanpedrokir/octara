'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../../ui/Navbar';

// Placeholder list — to be replaced when admin loads Thai institution data via XLS
const TH_IHLS = [
  // Public Universities
  'Chulalongkorn University (CU)',
  'Mahidol University (MU)',
  'Thammasat University (TU)',
  'Kasetsart University (KU)',
  'Chiang Mai University (CMU)',
  'Prince of Songkla University (PSU)',
  'Khon Kaen University (KKU)',
  'King Mongkut\'s Institute of Technology Ladkrabang (KMITL)',
  'King Mongkut\'s University of Technology Thonburi (KMUTT)',
  'Silpakorn University',
  // Private / International
  'Bangkok University',
  'Assumption University (ABAC)',
  'Rangsit University',
  'Stamford International University',
  'Webster University Thailand',
];

const LEVELS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate', 'Others'];

type UserType = 'student' | 'working_adult' | 'other' | '';

const USER_TYPE_OPTIONS: { value: UserType; label: string; icon: string; desc: string }[] = [
  { value: 'student', label: 'Student', icon: '🎓', desc: 'Currently enrolled in a course or degree' },
  { value: 'working_adult', label: 'Working Adult', icon: '💼', desc: 'Employed and looking to upskill' },
  { value: 'other', label: 'Others', icon: '✨', desc: 'Career transition, freelancer, or other' },
];

export default function ThaiRegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('');

  const [institution, setInstitution] = useState('');
  const [institutionOther, setInstitutionOther] = useState('');
  const [level, setLevel] = useState('');

  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [otherDetails, setOtherDetails] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleUserTypeChange(type: UserType) {
    setUserType(type);
    setInstitution(''); setInstitutionOther(''); setLevel('');
    setCompany(''); setTitle(''); setOtherDetails('');
  }

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required'); return; }
    if (!userType) { setError('Please select what best describes you'); return; }

    if (userType === 'student') {
      if (!institution) { setError('Please select your institution'); return; }
      if (institution === 'Other' && !institutionOther.trim()) { setError('Please enter your institution name'); return; }
      if (!level) { setError('Please select your current level'); return; }
    } else {
      if (!company.trim()) { setError('Company name is required'); return; }
      if (!title.trim()) { setError('Job title is required'); return; }
    }

    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          userType,
          institution: institution === 'Other' ? institutionOther.trim() : institution,
          level,
          company: company.trim(),
          title: title.trim(),
          otherDetails: otherDetails.trim(),
          country: 'TH',
        }),
      });
      const { data, error: err } = await res.json();
      if (err) { setError(err); return; }
      if (data) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const pwHints = password.length > 0 ? [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(password), label: 'At least one uppercase letter' },
    { ok: confirmPassword.length > 0 && password === confirmPassword, label: 'Passwords match' },
  ] : [];

  const isStudent = userType === 'student';
  const showProfessional = userType === 'working_adult' || userType === 'other';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={null} />
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="card w-full max-w-lg p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img src="/octara-logo.png" alt="Octara" style={{ height: '100px', width: 'auto' }} />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span style={{ fontSize: '1.5rem' }}>🇹🇭</span>
              <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-faint, rgba(99,102,241,0.1))', color: 'var(--primary)' }}>Thailand</span>
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Create your account</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Start your career upskilling journey today</p>
          </div>

          {/* Note about placeholder data */}
          <div className="mb-5 p-3 rounded-lg text-xs" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
            Thai institution and sector data is being prepared. Some options may show as placeholders.
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  First Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input type="text" className="input" value={firstName} onChange={e => setFirstName(e.target.value)} required autoComplete="given-name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Last Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input type="text" className="input" value={lastName} onChange={e => setLastName(e.target.value)} required autoComplete="family-name" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                Email Address <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
                I am a… <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {USER_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleUserTypeChange(opt.value)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all"
                    style={{
                      border: userType === opt.value ? '2px solid var(--primary)' : '2px solid var(--border)',
                      background: userType === opt.value ? 'var(--primary-faint, rgba(99,102,241,0.08))' : 'var(--card)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-xs font-semibold" style={{ color: userType === opt.value ? 'var(--primary)' : 'var(--foreground)' }}>{opt.label}</span>
                    <span className="text-xs leading-tight" style={{ color: 'var(--muted)' }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {isStudent && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span>🏫</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Your education</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Institution Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select className="input" value={institution} onChange={e => setInstitution(e.target.value)} style={{ appearance: 'auto' }}>
                    <option value="">Select institution…</option>
                    <optgroup label="Public Universities">
                      {TH_IHLS.slice(0, 10).map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="Private / International">
                      {TH_IHLS.slice(10).map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <option value="Other">Other (please specify)</option>
                  </select>
                </div>

                {institution === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                      Institution Name (not in list) <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={institutionOther}
                      onChange={e => setInstitutionOther(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Current Level <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select className="input" value={level} onChange={e => setLevel(e.target.value)} style={{ appearance: 'auto' }}>
                    <option value="">Select level…</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            )}

            {showProfessional && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span>💼</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Your work</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Company Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input type="text" className="input" value={company} onChange={e => setCompany(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Job Title <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input type="text" className="input" value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Others <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea className="input" rows={2} value={otherDetails} onChange={e => setOtherDetails(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span>🔒</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Set your password</span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Confirm Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
              </div>

              {pwHints.length > 0 && (
                <ul className="space-y-1">
                  {pwHints.map(h => (
                    <li key={h.label} className="flex items-center gap-1.5 text-xs" style={{ color: h.ok ? 'var(--success)' : 'var(--danger)' }}>
                      <span>{h.ok ? '✓' : '✗'}</span>{h.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center" style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/th/login" className="font-semibold" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>
          <p className="mt-3 text-center text-xs" style={{ color: 'var(--muted)' }}>
            By registering, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
