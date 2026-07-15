import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "大阪産業大学ホームカミングデー｜付属高校吹奏部演奏会 お申し込み受付",
  description: "大阪産業大学ホームカミングデー・付属高校吹奏部演奏会のお申し込み受付システムです。",
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
          @media (max-width: 599px) {
            .hero {
              min-height: 280px;
            }

            .hero-overlay {
              padding-left: 8px;
              padding-right: 8px;
            }

            .hero-title {
              font-size: clamp(30px, 8.5vw, 34px);
              line-height: 1.32;
              letter-spacing: -0.04em;
              margin-bottom: 12px;
            }
          }

          /* 管理画面の予約者一覧を横に広く使い、操作ボタンを見切れさせない */
          @media (min-width: 900px) {
            body:has(.admin-table) .container {
              max-width: 1280px !important;
            }
          }

          .admin-table {
            min-width: 980px;
          }

          .admin-table th:last-child,
          .admin-table td:last-child {
            min-width: 118px;
            width: 118px;
            text-align: center;
            white-space: nowrap;
          }

          .admin-table td:last-child .btn {
            min-width: 96px;
            width: 100% !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            white-space: nowrap;
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
