'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../ui/Navbar';

type UserType = 'student' | 'working_adult' | 'other' | '';

export default function ProfileSetupPage() {
  const [bio, setBio] = useState('');
  const [userType, setUserType] = useState<UserType>('');
  const [institution, setInstitution] = useState('');
  const [program, setProgram] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userType) { setError('Please select what best describes you'); return; }
    if (!institution.trim()) { setError('Institution name is required'); return; }
    if (!program.trim()) { setError('Program / course is required'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, userType, institution, program }),
      });
      const { error: err } = await res.json();
      if (err) { setError(err); return; }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const userTypeOptions: { value: UserType; label: string; icon: string; desc: string }[] = [
    { value: 'student', label: 'Student', icon: '🎓', desc: 'Currently enrolled in a course or degree' },
    { value: 'working_adult', label: 'Working Adult', icon: '💼', desc: 'Employed and looking to upskill' },
    { value: 'other', label: 'Other', icon: '✨', desc: 'Career transition, freelancer, or other' },
  ];

  const isStudent = userType === 'student';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={null} />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card w-full max-w-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">👤</div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Complete your profile</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Help us personalise your career journey</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                Bio <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                className="input"
                rows={3}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="A brief intro about yourself and your career goals…"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* User Type */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
                What best describes you? <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {userTypeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUserType(opt.value)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all"
                    style={{
                      border: userType === opt.value ? '2px solid var(--primary)' : '2px solid var(--border)',
                      background: userType === opt.value ? 'var(--primary-faint, rgba(99,102,241,0.08))' : 'var(--card)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <span className="text-sm font-semibold" style={{ color: userType === opt.value ? 'var(--primary)' : 'var(--foreground)' }}>
                      {opt.label}
                    </span>
                    <span className="text-xs leading-tight" style={{ color: 'var(--muted)' }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Education fields — shown once a type is selected */}
            {userType && (
              <div className="space-y-4 pt-2">
                <div
                  className="flex items-center gap-2 pb-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span className="text-base">{isStudent ? '🏫' : '🎓'}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {isStudent ? 'Current education' : 'Highest education'}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    {isStudent ? 'Current institution' : 'Institution name'}{' '}
                    <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={institution}
                    onChange={e => setInstitution(e.target.value)}
                    placeholder={isStudent ? 'e.g. National University of Singapore' : 'e.g. Nanyang Technological University'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    {isStudent ? 'Program / course' : 'Program / qualification'}{' '}
                    <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={program}
                    onChange={e => setProgram(e.target.value)}
                    placeholder="e.g. Bachelor in Computer Science"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !userType}
                className="btn-primary w-full justify-center"
                style={{ opacity: loading || !userType ? 0.6 : 1 }}
              >
                {loading ? 'Saving…' : 'Save & continue →'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="btn-ghost w-full justify-center text-sm"
                style={{ color: 'var(--muted)' }}
              >
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
