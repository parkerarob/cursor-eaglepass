import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { RoleProvider } from "@/components/RoleProvider";
import { MonitoringProvider } from "@/components/MonitoringProvider";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { Analytics } from "@vercel/analytics/next";
import { GlobalEmergencyBanner } from '@/components/GlobalEmergencyBanner';

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
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <GlobalEmergencyBanner />
        <ThemeProvider>
          <MonitoringProvider>
            <AuthProvider>
              <SessionProvider>
                <RoleProvider>
                  {children}
                  <SessionTimeoutWarning />
                </RoleProvider>
              </SessionProvider>
            </AuthProvider>
          </MonitoringProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
