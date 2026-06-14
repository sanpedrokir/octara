'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavbarProps {
  user?: { name: string; email: string; role: string } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const APP_ROUTES = ['/dashboard', '/career', '/skills-navigator', '/profile', '/my-courses', '/admin'];
  const isAppRoute = APP_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  const navLinks = user
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/career', label: 'Career' },
        { href: '/my-courses', label: 'My Courses' },
        { href: '/skills-navigator', label: 'Skills Navigator' },
        { href: '/profile', label: 'Profile' },
        ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
      ]
    : [];

  return (
    <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', color: 'var(--foreground)' }} className="sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href={user || isAppRoute ? '/dashboard' : '/'} className="flex items-center no-underline">
            <img src="/octara-logo.png" alt="Octara" style={{ height: '72px', width: 'auto' }} />
          </Link>

          {/* Desktop nav — only shown when no sidebar (logged-out) */}
          {!user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline"
                  style={{
                    color: pathname === link.href ? 'var(--primary)' : 'var(--muted)',
                    background: pathname === link.href ? 'var(--primary-light)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {user.role === 'admin' ? (
                  <Link href="/admin" className="text-sm font-medium no-underline" style={{ color: 'var(--primary)' }}>{user.name}</Link>
                ) : (
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user.name}</span>
                )}
                <button onClick={handleLogout} className="btn-ghost text-sm">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium no-underline" style={{ color: 'var(--muted)' }}>Sign in</Link>
                <Link href="/register" className="btn-primary text-sm no-underline">
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg"
            style={{ color: 'var(--foreground)' }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: 'white', borderTop: '1px solid #e2e8f0' }} className="md:hidden px-4 pb-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium no-underline"
              style={{ color: pathname === link.href ? 'var(--primary)' : 'var(--muted)', background: pathname === link.href ? 'var(--primary-light)' : 'transparent' }}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <button onClick={handleLogout} className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: 'var(--muted)' }}>
              Sign out ({user.name})
            </button>
          ) : (
            <div className="pt-2 space-y-2">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium no-underline" style={{ color: 'var(--muted)' }}>Sign in</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary block text-center no-underline text-sm">Get started free</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
