import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Signal Kit",
  description:
    "Twitch EventSub, YouTube Live Chat, or both as one developer-friendly WebSocket. OAuth once, get a relay token, build whatever you want.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="isolate flex min-h-dvh flex-col bg-white text-neutral-950">
        {children}
      </body>
    </html>
  );
}
