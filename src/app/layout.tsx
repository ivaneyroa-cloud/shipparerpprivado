import type { Metadata } from 'next';
import '@fontsource/jetbrains-mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shippar Courier - Rastreo de Envios',
  description: 'Rastrea tus paquetes logísticos de forma inteligente.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
