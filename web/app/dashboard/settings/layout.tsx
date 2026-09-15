import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/dashboard/settings/ai', label: 'AI Configuration' },
  { href: '/dashboard/settings/voice', label: 'Voice Models' },
  { href: '/dashboard/settings/twilio', label: 'Twilio Credentials' },
  { href: '/dashboard/settings/escalation', label: 'Escalation Rules' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
