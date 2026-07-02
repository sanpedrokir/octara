'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

type NavItem = { href: string; label: string; icon: string };

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Overview', icon: '📊' },
    ],
  },
  {
    label: 'Career Path',
    items: [
      { href: '/career',     label: 'Career Goal',        icon: '🎯' },
      { href: '/competency', label: 'Competency Profile', icon: '🧩' },
      { href: '/gap-analysis', label: 'Gap Analysis',     icon: '📈' },
    ],
  },
  {
    label: 'Career Tools',
    items: [
      { href: '/salary-benchmark', label: 'Salary Benchmark', icon: '💰' },
      { href: '/resume-builder',   label: 'Resume Builder',   icon: '📄' },
      { href: '/linkedin-scorer',  label: 'LinkedIn Scorer',  icon: '🔗' },
    ],
  },
  {
    label: 'Learning',
    items: [
      { href: '/career-coach', label: 'Career Coach',        icon: '🎓' },
      { href: '/skill-quiz',   label: 'Work Knowledge Quiz', icon: '🧠' },
    ],
  },
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

  function NavLink({ href, label, icon }: NavItem) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
        style={{
          background: active ? 'var(--primary-light)' : 'transparent',
          color: active ? 'var(--primary)' : '#1e293b',
          fontWeight: active ? '600' : '500',
        }}
      >
        <span className="text-base">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 border-r pt-4 pb-8 px-3 gap-0"
      style={{ background: 'white', borderColor: 'var(--card-border)', minHeight: 'calc(100vh - 64px)' }}
    >
      {navSections.map((section, i) => (
        <div key={section.label} className={i === 0 ? 'mb-1' : 'mt-1 mb-1'}>
          {i > 0 && (
            <div className="mt-3 mb-1 border-t" style={{ borderColor: 'var(--card-border)' }} />
          )}
          <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            {section.label}
          </p>
          {section.items.map(item => <NavLink key={item.href} {...item} />)}
        </div>
      ))}

      {/* My Profile + Admin (last section) */}
      <div className="mt-1">
        <div className="mt-3 mb-1 border-t" style={{ borderColor: 'var(--card-border)' }} />
        <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Account</p>
        <NavLink href="/profile" label="My Profile" icon="👤" />
        {role === 'admin' && (
          <NavLink href="/admin" label="Admin Panel" icon="⚙️" />
        )}
      </div>
    </aside>
  );
}
