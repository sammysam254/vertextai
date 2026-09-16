import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LoadingSplash } from '@/components/ui/LoadingSplash';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  themeColor: '#0A0E1A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Contact Centre Insights - AI Voice & Intelligence',
  description: 'Enterprise AI-powered contact center, WebRTC dialer, and live voice automation platform',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-[#0A0E1A]">
      <body className={`${inter.className} bg-[#0A0E1A] text-white min-h-screen`}>
        <LoadingSplash />
        {children}
      </body>
    </html>
  );
}
