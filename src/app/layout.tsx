import type { Metadata } from "next";
import { Geist_Mono, Hubot_Sans, Martian_Mono, Mona_Sans } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dashboard fonts (see .sk-app in globals.css).
const monaSans = Mona_Sans({ variable: "--font-mona", subsets: ["latin"] });
const hubotSans = Hubot_Sans({ variable: "--font-hubot", subsets: ["latin"] });
const martianMono = Martian_Mono({ variable: "--font-martian", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Signal Kit",
  description:
    "Live stream events from Twitch, YouTube and X, normalized into one format and delivered over a single WebSocket.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} ${monaSans.variable} ${hubotSans.variable} ${martianMono.variable} h-full antialiased`}>
      <body className="isolate flex min-h-dvh flex-col bg-white text-neutral-950">
        {children}
      </body>
    </html>
  );
}
