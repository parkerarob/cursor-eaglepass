import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { MonitoringProvider } from "@/components/MonitoringProvider";
import { Analytics } from "@vercel/analytics/next";
import { GlobalEmergencyBanner } from '@/components/GlobalEmergencyBanner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eagle Pass",
  description: "Digital hall pass system for schools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalEmergencyBanner />
        <ThemeProvider>
          <MonitoringProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </MonitoringProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
