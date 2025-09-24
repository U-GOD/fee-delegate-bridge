import './globals.css';  // Import default resets
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';  // Default font
import Providers from './Providers';  // Client wrapper for Wagmi (create next)

const inter = Inter({ subsets: ['latin'] });  // Font setup for basic styling

export const metadata: Metadata = {
  title: 'FeeDelegate Bridge',  // Customized title for app tab
  description: 'Delegation-based fee minimizer on Monad',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Providers wraps the app with WagmiProvider—client-only to avoid SSR errors */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}