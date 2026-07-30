import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RealEstate CRM — Smart Lead Management',
  description: 'A powerful multi-tenant SaaS CRM for real estate agents and companies to manage leads, follow-ups, deals, and reports.',
};

/**
 * Deliberately no `viewportFit: 'cover'`. Cover mode extends the layout under
 * the notch, the rounded corners and the home indicator, and then every bar
 * that touches an edge has to pay its own `env(safe-area-inset-*)` — the top
 * bar and the landscape left/right edges here did not, so the shell rendered
 * clipped on a real phone while looking correct in a desktop browser, where
 * those insets are always zero. The default keeps content inside the safe area
 * without anyone opting in. The `max(…, env(…))` paddings elsewhere fall back
 * to their first argument and stay correct either way.
 *
 * Zoom is left enabled — pinching to read a phone number is not ours to take away.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f9622a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#17181c',
                border: '1px solid #ececef',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(16,24,40,0.12)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
