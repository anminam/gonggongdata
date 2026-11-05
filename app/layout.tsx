import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공공데이터 API 공지 알림",
  description: "공공데이터포털 API 공지사항 키워드 알림",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
