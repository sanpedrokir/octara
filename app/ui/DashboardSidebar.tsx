'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/dashboard',        label: 'Overview',              icon: '📊' },
  { href: '/career-coach',     label: 'Career Coach',          icon: '🎓' },
  { href: '/career',           label: 'Career Goal',           icon: '🎯' },
  { href: '/competency',       label: 'Competency Profile',    icon: '🧩' },
  { href: '/gap-analysis',     label: 'Gap Analysis',          icon: '📊' },
  { href: '/skill-quiz',       label: 'Work Knowledge Quiz',   icon: '🧠' },
  { href: '/profile',          label: 'My Profile',            icon: '👤' },
];

export default function DashboardSidebar({ role: roleProp }: { role?: string }) {
  const pathname = usePathname();
  const [fetchedRole, setFetchedRole] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (roleProp !== undefined) return;
    fetch('/api/user/me')
      .then(r => r.json())
      .then(({ data }) => { if (data?.role) setFetchedRole(data.role); })
      .catch(() => {});
  }, [roleProp]);

  const role = roleProp ?? fetchedRole;

  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 border-r pt-6 pb-8 px-3 gap-1"
      style={{ background: 'white', borderColor: 'var(--card-border)', minHeight: 'calc(100vh - 64px)' }}
    >
      {navItems.map(item => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
            style={{
              background: active ? 'var(--primary-light)' : 'transparent',
              color: active ? 'var(--primary)' : '#1e293b',
              fontWeight: active ? '600' : '500',
            }}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
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
