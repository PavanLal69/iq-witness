import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WitnessIQ | AI-Powered Incident Reconstruction",
  description: "Reconstruct the truth from fragmented digital evidence. Correlate CCTV footage, audio logs, chats, and documents into a unified, chronological investigation timeline.",
  keywords: "digital forensics, AI incident reconstruction, timeline correlation, evidence analytics, investigation dashboard",
  authors: [{ name: "WitnessIQ Team" }]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0B0F19] text-[#F1F5F9] font-sans antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
