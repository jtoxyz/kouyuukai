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
            .hero-title {
              font-size: clamp(23px, 6.1vw, 27px);
              line-height: 1.38;
            }
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
