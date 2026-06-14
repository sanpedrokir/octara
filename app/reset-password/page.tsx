'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../ui/Navbar';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  const hints = password.length > 0 ? [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(password), label: 'At least one capital letter' },
  ] : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const { error: err } = await res.json();
      if (err) setError(err);
      else {
        setDone(true);
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card w-full max-w-md p-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <img src="/octara-logo.png" alt="Octara" style={{ height: '80px', width: 'auto' }} />
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Set new password</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Choose a strong password for your account</p>
      </div>

      {done ? (
        <div className="text-center space-y-4">
          <div className="text-5xl">✅</div>
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>Password updated!</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Redirecting you to sign in…</p>
          <Link href="/login" className="btn-primary block text-center no-underline mt-4" style={{ padding: '0.6rem 1rem' }}>
            Sign in now
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
              {error}
              {error.includes('Invalid') || error.includes('expired') ? (
                <div className="mt-2">
                  <Link href="/forgot-password" style={{ color: 'var(--primary)', fontWeight: 600 }}>Request a new link →</Link>
                </div>
              ) : null}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="Enter new password"
                required
                autoFocus
                disabled={!token}
              />
              <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>Minimum 8 characters, with 1 capital letter</p>
              {hints.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {hints.map(h => (
                    <li key={h.label} className="flex items-center gap-1.5 text-xs" style={{ color: h.ok ? 'var(--success)' : 'var(--danger)' }}>
                      <span>{h.ok ? '✓' : '✗'}</span>{h.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="input"
                placeholder="Repeat new password"
                required
                disabled={!token}
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>✗ Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !token || hints.some(h => !h.ok) || password !== confirm}
              className="btn-primary w-full justify-center"
              style={{ opacity: (loading || !token) ? 0.7 : 1 }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={null} />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="card w-full max-w-md p-8 text-center" style={{ color: 'var(--muted)' }}>Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
