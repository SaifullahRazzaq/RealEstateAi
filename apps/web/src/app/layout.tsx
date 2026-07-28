import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RealEstate CRM — Smart Lead Management',
  description: 'A powerful multi-tenant SaaS CRM for real estate agents and companies to manage leads, follow-ups, deals, and reports.',
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
