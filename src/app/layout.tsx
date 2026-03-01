import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FeyNav } from "@/components/fey/FeyNav";
import { ClientWatchlistPanel } from "@/components/client-watchlist-panel";
import { CommandPaletteProvider } from "@/components/command-palette";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { OfflineBanner } from "@/components/OfflineBanner";
import { GlobalShortcuts } from "@/components/global-shortcuts";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Speedy Finance AI",
  description: "Next-gen financial analysis platform powered by AI",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0D0D0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-black overflow-x-hidden`} suppressHydrationWarning>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-500 focus:text-black focus:font-bold focus:outline-none focus:ring-2 focus:ring-white"
          >
            Skip to main content
          </a>
          <ServiceWorkerRegistration />
          <OfflineBanner />
          <CommandPaletteProvider>
            <div className="flex flex-col min-h-screen" suppressHydrationWarning>
              <FeyNav />
              <main id="main-content" className="flex-1 flex flex-col relative" tabIndex={-1} aria-live="polite" suppressHydrationWarning>
                {children}
              </main>
                <ClientWatchlistPanel />
                <KeyboardShortcutsHelp />
                <GlobalShortcuts />
            </div>
          </CommandPaletteProvider>
        </body>
    </html>
  );
}
