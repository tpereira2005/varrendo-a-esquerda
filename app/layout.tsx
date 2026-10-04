import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Varrendo a Esquerda — Eleições 2026",
  description: "Resultados do TSE com a classificação política definida pelo autor do painel.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body className="antialiased">{children}</body>
    </html>
  );
}
