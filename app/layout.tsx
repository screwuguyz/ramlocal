// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import ErrorBoundary from "@/components/ErrorBoundary";

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
// const outfit = { variable: 'font-sans' }; // Temporary mock

export const metadata: Metadata = {
  title: "RAM Proje",
  description: "Rehberlik Araştırma Merkezi - Yük Dengelemeli Dosya Atama Sistemi",
  manifest: "/manifest.webmanifest",
  applicationName: "RAM Proje",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RAM Proje",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", type: "image/svg+xml" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d9488" },
    { media: "(prefers-color-scheme: dark)", color: "#2dd4bf" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={outfit.variable} suppressHydrationWarning>
      <head>
        {/* iOS PWA Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RAM Proje" />

        {/* Android PWA */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS Splash Screens - iPhone */}
        <link
          rel="apple-touch-startup-image"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1170 2532'><rect fill='%230d9488' width='1170' height='2532'/><text x='585' y='1266' text-anchor='middle' font-size='120' fill='white' font-family='system-ui'>📋</text><text x='585' y='1400' text-anchor='middle' font-size='48' fill='white' font-family='system-ui'>RAM Proje</text></svg>"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1284 2778'><rect fill='%230d9488' width='1284' height='2778'/><text x='642' y='1389' text-anchor='middle' font-size='120' fill='white' font-family='system-ui'>📋</text><text x='642' y='1530' text-anchor='middle' font-size='48' fill='white' font-family='system-ui'>RAM Proje</text></svg>"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />

        {/* Prevent pull-to-refresh on iOS */}
        <style>{`
          html, body {
            overscroll-behavior-y: contain;
          }
          /* iOS safe area padding */
          @supports (padding: env(safe-area-inset-top)) {
            body {
              padding-top: env(safe-area-inset-top);
              padding-bottom: env(safe-area-inset-bottom);
              padding-left: env(safe-area-inset-left);
              padding-right: env(safe-area-inset-right);
            }
          }
          /* iOS standalone mode adjustments */
          @media all and (display-mode: standalone) {
            body {
              -webkit-user-select: none;
              user-select: none;
            }
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-slate-50 antialiased selection:bg-teal-200 selection:text-teal-900">
        <ErrorBoundary>
          <ThemeProvider>
            <div className="relative z-10">{children}</div>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
