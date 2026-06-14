'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '../ui/Navbar';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const { error: err } = await res.json();
      if (err) setError(err);
      else setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={null} />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <img src="/octara-logo.png" alt="Octara" style={{ height: '80px', width: 'auto' }} />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Forgot your password?</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Enter your email and we&apos;ll send you a reset link</p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📬</div>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>Check your inbox</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                If <strong>{email}</strong> has an account, you&apos;ll receive a reset link shortly. Check your spam folder too.
              </p>
              <Link href="/login" className="btn-primary block text-center no-underline mt-4" style={{ padding: '0.6rem 1rem' }}>
                Back to Sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center" style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                Remember it?{' '}
                <Link href="/login" className="font-semibold" style={{ color: 'var(--primary)' }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
