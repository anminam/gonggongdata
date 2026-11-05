"use client";

import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRightLeft, Building2, CircleOff, Info, Sparkles, Wrench } from "lucide-react";
import { ORG_PREFIX } from "@/lib/match";
import type { browserClient } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SB = ReturnType<typeof browserClient>;

export type Profile = {
  user_id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  is_admin: boolean;
  created_at: string;
};

export type Notice = {
  notice_id: string;
  org: string | null;
  title: string;
  api_names: string | null;
  registered_at: string | null;
  body: string | null;
  notice_type: string | null;
  url: string;
  crawled_at: string;
};

export type Ctx = { supabase: SB; session: Session; profile: Profile };

const KST = { timeZone: "Asia/Seoul" } as const;
export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("ko-KR", { ...KST, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtShort = (s: string) =>
  new Date(s).toLocaleString("ko-KR", { ...KST, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
/** 오늘(KST) 기준 n일 전 날짜를 YYYY-MM-DD로 */
export const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toLocaleDateString("sv-SE", KST);

export { NOTICE_TYPES } from "@/lib/match";

// 공지 유형별 배지 모양. 색만으로 구분하지 않도록 아이콘·글자를 같이 쓴다.
const TYPE_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  "제공 중단/종료": { icon: CircleOff, className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
  "URL 변경": { icon: ArrowRightLeft, className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  "일시 중단(점검)": { icon: Wrench, className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  "API 변경": { icon: AlertTriangle, className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  "신규/추가": { icon: Sparkles, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
};

export function TypeBadge({ type, className }: { type: string | null; className?: string }) {
  const t = type || "기타";
  const s = TYPE_STYLE[t] ?? { icon: Info, className: "bg-muted text-muted-foreground" };
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      <Icon data-icon="inline-start" />
      {t}
    </Badge>
  );
}

export function Kw({ list }: { list: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.map((k) =>
        k.startsWith(ORG_PREFIX) ? (
          <Badge key={k} variant="outline" className="font-normal">
            <Building2 data-icon="inline-start" />
            {k.slice(ORG_PREFIX.length)}
          </Badge>
        ) : (
          <Badge key={k} variant="secondary" className="font-normal">
            {k}
          </Badge>
        ),
      )}
    </span>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon }) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardDescription className="font-medium">{label}</CardDescription>
        <CardAction>
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title, description, action, children, contentClassName, className,
}: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; contentClassName?: string; className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
