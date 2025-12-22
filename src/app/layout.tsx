import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FeyNav } from "@/components/fey/FeyNav";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Speedy Finance AI",
  description: "Next-gen financial analysis platform powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-black overflow-x-hidden`}>
          <div className="flex flex-col min-h-screen">
            <FeyNav />
            <main className="flex-1 flex flex-col relative">
              {children}
            </main>
          </div>
        </body>
    </html>
  );
}
