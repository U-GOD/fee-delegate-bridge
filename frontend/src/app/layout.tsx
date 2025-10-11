// import './globals.css';  // Import default resets
// import type { Metadata } from 'next';
// import Providers from './Providers';  // Client wrapper for Wagmi

// export const metadata: Metadata = {
//   title: 'FeeDelegate Bridge',  // Customized title for app tab
//   description: 'Delegation-based fee minimizer on Base Sepolia',
// };

// export default function RootLayout({
//   children,
// }: Readonly<{ children: React.ReactNode }>) {
//   return (
//     <html lang="en">
//       <body>
//         {/* Providers wraps the app with WagmiProvider—client-only to avoid SSR errors */}
//         <Providers>{children}</Providers>
//       </body>
//     </html>
//   );
// }


import './globals.css';
import type { Metadata } from 'next';
import Providers from './Providers';

export const metadata: Metadata = {
  title: 'FeeDelegate Bridge',
  description: 'Automated cross-chain bridging',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}