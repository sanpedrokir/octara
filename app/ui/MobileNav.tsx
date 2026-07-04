'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const items = [
  { href: '/dashboard', label: 'Home',    shortLabel: 'Home',   icon: '📊' },
  { href: '/career',    label: 'Career',  shortLabel: 'Career', icon: '🎯' },
  { href: '/gap-analysis', label: 'Gap Analysis', shortLabel: 'Gaps', icon: '📊' },
  { href: '/skill-quiz',   label: 'Quiz',   shortLabel: 'Quiz',  icon: '🧠' },
  { href: '/profile',      label: 'Profile', shortLabel: 'Me',   icon: '👤' },
];

export default function MobileNav({ role: roleProp }: { role?: string }) {
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
  const allItems = role === 'admin'
    ? [...items, { href: '/admin', label: 'Admin', shortLabel: 'Admin', icon: '⚙️' }]
    : items;
  const compact = allItems.length > 5;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
      style={{ background: 'white', borderColor: 'var(--card-border)' }}
    >
      {allItems.map(item => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 no-underline transition-colors"
            style={{ color: active ? 'var(--primary)' : 'var(--muted)' }}
          >
            <span className={compact ? 'text-lg' : 'text-xl'}>{item.icon}</span>
            <span className="text-xs font-medium leading-none">{compact ? item.shortLabel : item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
