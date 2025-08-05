import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "노래방 가사 번역기",
  description: "실시간 노래방 스타일 가사 표시 및 번역 (라이브 스트리밍용)",
  keywords: ["노래방", "가사", "번역", "OBS", "스트리밍", "방송"],
  authors: [{ name: "가사 번역기 팀" }],
  openGraph: {
    title: "노래방 가사 번역기",
    description: "실시간 노래방 스타일 가사 표시 및 번역",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}