import Link from "next/link";
import type { ReactNode } from "react";

/** 개인정보처리방침·이용약관 공통 틀 (로그인 없이 누구나 볼 수 있는 페이지) */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← 공공데이터 API 공지 알림</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">시행일: {updated}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p+p]:mt-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
        <LegalLinks className="mt-12 border-t pt-6" />
      </div>
    </main>
  );
}

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ${className ?? ""}`}>
      <Link href="/privacy" className="hover:text-foreground hover:underline">개인정보처리방침</Link>
      <Link href="/terms" className="hover:text-foreground hover:underline">이용약관</Link>
      <a href="mailto:minamhunmin@gmail.com" className="hover:text-foreground hover:underline">문의 minamhunmin@gmail.com</a>
    </nav>
  );
}
