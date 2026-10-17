import type { Metadata } from 'next';
import './globals.css';
import './taste.css';
import './craft.css';
import './interactions.css';
import './welcome.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Paper City — Understand Toronto’s housing promises',
  description: 'Understand Toronto’s affordable housing pipeline before the 2026 municipal election. Start with a guided example, check a housing headline, and explore the City’s project records.',
  openGraph: { title: 'Paper City', description: 'Follow the homes, not the headlines. An independent field guide to Toronto housing data.', type: 'website' },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
