import "./globals.css";
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

// 본문·제목 모두 Noto Sans KR (제목은 굵게)
const noto = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-noto" });

export const metadata: Metadata = {
  title: "공공데이터 API 공지 알림",
  description: "공공데이터포털 API 공지사항 키워드 알림",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn("font-sans", noto.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
