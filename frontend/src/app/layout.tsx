import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "大阪産業大学ホームカミングデー｜付属高校吹奏部演奏会 予約フォーム",
  description: "大阪産業大学ホームカミングデー・付属高校吹奏部演奏会の予約受付システムです。",
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
            font-size: 0 !important;
            text-align: center !important;
            white-space: pre-line !important;
          }

          .hero-title::before {
            content: "大阪産業大学ホームカミングデー\\A付属高校吹奏部演奏会";
            display: block;
            white-space: pre-line;
            font-size: 24px;
            line-height: 1.45;
          }

          .hero-subtitle {
            font-size: 0 !important;
            text-align: center !important;
          }

          .hero-subtitle::before {
            content: "申し込み受付";
            display: block;
            font-size: 18px;
          }

          .ticket-status:not(.checked-in) + div {
            font-size: 0 !important;
          }

          .ticket-status:not(.checked-in) + div::before {
            content: "お申し込みありがとうございます。\\A当日、受付担当者にこの画面を見せてください。";
            display: block;
            white-space: pre-line;
            font-size: 15px;
            line-height: 1.6;
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