import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'CallPulse - AI Call Center & SMS Platform',
  description: 'Multi-tenant AI-powered call center and SMS automation platform',
  icons: {
    icon: '/favicon.ico',
  },
};

import { LoadingSplash } from '@/components/ui/LoadingSplash';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <LoadingSplash />
        {children}
      </body>
    </html>
  );
}
