'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../ui/Navbar';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one capital letter';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwError = validatePassword(form.password);
    if (pwError) { setError(pwError); return; }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const { data, error: err } = await res.json();

      if (err) {
        setError(err);
      } else if (data) {
        router.push('/profile/setup');
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const pwHints = form.password.length > 0 ? [
    { ok: form.password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(form.password), label: 'At least one capital letter' },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={null} />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <img src="/octara-logo.png" alt="Octara" style={{ height: '120px', width: 'auto' }} />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Create your account</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Start your career upskilling journey today</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Full name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                className="input"
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                className="input"
                placeholder="Enter your password"
                required
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                Minimum 8 characters, with 1 Capital letter
              </p>
              {pwHints.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {pwHints.map(h => (
                    <li key={h.label} className="flex items-center gap-1.5 text-xs" style={{ color: h.ok ? 'var(--success)' : 'var(--danger)' }}>
                      <span>{h.ok ? '✓' : '✗'}</span>
                      {h.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center" style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>

          <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
            By registering, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
