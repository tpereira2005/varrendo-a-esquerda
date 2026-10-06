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
  themeColor: '#f3f4ef',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Layout raiz da app: a fonte vale para todas as páginas (o aviso do lint é do antigo pages/). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600;700;800&display=swap"
        />
        {/* Aplica as preferências (tema e animações) antes de pintar a página, sem piscar. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;if(localStorage.getItem('varrendo.tema')==='escuro')d.dataset.theme='dark';if(localStorage.getItem('varrendo.animacoes')==='0')d.dataset.motion='off'}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
