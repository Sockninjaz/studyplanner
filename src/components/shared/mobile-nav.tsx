'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const navItems = [
  {
    href: '/home',
    label: 'Home',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: 'Schedule',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: '/chat',
    label: 'Chat',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/exams',
    label: 'Exams',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isProfileActive = pathname.startsWith('/profile');
  const initials = session?.user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[rgb(54,65,86)] border-t border-white/10 safe-area-pb">
      <div className="flex items-center h-20">

        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href) || (item.href === '/home' && pathname === '/today');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors h-full ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/15' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Profile */}
        <Link
          href="/profile"
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors h-full ${
            isProfileActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${isProfileActive ? 'bg-white/15' : ''}`}>
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt="Profile"
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            )}
          </div>
          <span className="text-[11px] font-medium leading-none">Profile</span>
        </Link>

      </div>
    </nav>
  );
}
