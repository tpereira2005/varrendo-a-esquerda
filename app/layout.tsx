import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Varrendo a Esquerda · 2.ª volta 2026',
  description: 'Flávio Bolsonaro × Lula: resultados oficiais do TSE em tempo real, vistos por quem torce pelo Flávio.',
  icons: { icon: '/favicon.svg', apple: '/emoji/humor-10.png' },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Varrendo', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1015' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT">
      <body className="antialiased">{children}</body>
    </html>
  );
}
