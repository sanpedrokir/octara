'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard',        label: 'Overview',              icon: '📊' },
  { href: '/career',           label: 'Career Goal',           icon: '🎯' },
  { href: '/competency',       label: 'Competency Profile',    icon: '🧩' },
  { href: '/gap-analysis',     label: 'Gap Analysis',          icon: '📊' },
  { href: '/certifications',   label: 'My Credentials',        icon: '🏆' },
  { href: '/skill-quiz',       label: 'Work Knowledge Quiz',   icon: '🧠' },
  { href: '/profile',          label: 'My Profile',            icon: '👤' },
  { href: '/skills-navigator', label: 'Skills Navigator',      icon: '🧭', muted: true },
  { href: '/my-courses',       label: 'My Courses',            icon: '📚', muted: true },
];

export default function DashboardSidebar({ role }: { role?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 border-r pt-6 pb-8 px-3 gap-1"
      style={{ background: 'white', borderColor: 'var(--card-border)', minHeight: 'calc(100vh - 64px)' }}
    >
      {navItems.map(item => {
        const active = pathname === item.href;
        const muted = (item as { muted?: boolean }).muted;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
            style={{
              background: active ? 'var(--primary-light)' : 'transparent',
              color: active ? 'var(--primary)' : muted ? '#94a3b8' : '#1e293b',
              fontWeight: active ? '600' : '500',
              opacity: muted ? 0.7 : 1,
            }}
          >
            <span className="text-base">{item.icon}</span>
            <span>
              {item.label}
              {muted && <span className="block text-xs font-normal" style={{ color: '#94a3b8' }}>(Ignore for now)</span>}
            </span>
          </Link>
        );
      })}

      {role === 'admin' && (
        <>
          <div className="my-3 border-t" style={{ borderColor: 'var(--card-border)' }} />
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
            style={{
              background: pathname === '/admin' ? 'var(--primary-light)' : 'transparent',
              color: pathname === '/admin' ? 'var(--primary)' : '#1e293b',
              fontWeight: pathname === '/admin' ? '600' : '500',
            }}
          >
            <span className="text-base">⚙️</span>
            Admin Panel
          </Link>
        </>
      )}
    </aside>
  );
}
