import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "ホームカミングデー 大産大学高校吹奏楽部演奏会 予約フォーム",
  description: "大産大学高校吹奏楽部演奏会の事前予約および当日受付確認システムです。ホームカミングデースペシャルコンサートを会場でお楽しみください！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}

