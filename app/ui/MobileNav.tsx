'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'Home', icon: '📊' },
  { href: '/career', label: 'Career', icon: '🎯' },
  { href: '/skills-navigator', label: 'Skills', icon: '🧭' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
      style={{ background: 'white', borderColor: 'var(--card-border)' }}
    >
      {items.map(item => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 no-underline transition-colors"
            style={{ color: active ? 'var(--primary)' : 'var(--muted)' }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
