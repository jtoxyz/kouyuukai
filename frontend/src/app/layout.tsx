import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "大阪産業大学ホームカミングデー｜付属高校吹奏楽部演奏会 予約フォーム",
  description: "大阪産業大学ホームカミングデー・付属高校吹奏楽部演奏会の事前予約および当日受付確認システムです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <style>{`
          .hero-title {
            font-size: 0;
            text-align: center;
          }

          .hero-title::before {
            content: "大阪産業大学ホームカミングデー\\A付属高校吹奏楽部演奏会";
            display: block;
            white-space: pre-line;
            font-size: 24px;
            line-height: 1.45;
          }

          .hero-subtitle {
            font-size: 0;
            text-align: center;
          }

          .hero-subtitle::before {
            content: "予約受付中";
            display: block;
            font-size: 18px;
          }

          @media (min-width: 600px) {
            .hero-title::before {
              font-size: 30px;
            }

            .hero-subtitle::before {
              font-size: 20px;
            }
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
