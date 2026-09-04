import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cendre-survie.hugoat2003.chatgpt.site'),
  title: 'Cendre — Survivre ensemble',
  description: 'Un jeu de survie sociale multijoueur, autour de la même table.',
  applicationName: 'Cendre',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Cendre' },
  openGraph: {
    title: 'Cendre — Survivre ensemble',
    description: 'Les vivres sont comptés. Les choix restent.',
    type: 'website',
    locale: 'fr_FR',
    images: [{ url: '/og.png', width: 1733, height: 907, alt: 'Cendre — Survivre ensemble' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cendre — Survivre ensemble',
    description: 'Les vivres sont comptés. Les choix restent.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
