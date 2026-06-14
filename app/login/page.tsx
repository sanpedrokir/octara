'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const { data, error: err } = await res.json();

      if (err) {
        setError(err);
      } else if (data) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <img src="/octara-logo.png" alt="Octara" style={{ height: '120px', width: 'auto' }} />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Welcome back</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sign in to your Octara account</p>
          </div>

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
                placeholder=""
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Password</label>
                <Link href="/forgot-password" className="text-xs font-medium no-underline" style={{ color: 'var(--primary)' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder=""
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center" style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold" style={{ color: 'var(--primary)' }}>Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
