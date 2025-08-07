import type { Metadata } from "next";
import "./globals.css";

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
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}