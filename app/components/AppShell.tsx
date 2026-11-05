"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import {
  Bell, ChevronsUpDown, FileText, History as HistoryIcon, LayoutDashboard, LogOut, Monitor, Moon, Shield, Sun,
} from "lucide-react";
import type { browserClient } from "@/lib/supabase";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarInset, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail,
  SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Notice, Profile } from "./shared";
import Overview from "./Overview";
import Notices from "./Notices";
import Alerts, { type ListItem } from "./Alerts";
import History from "./History";
import Admin from "./Admin";

export type Page = "overview" | "notices" | "alerts" | "history" | "admin";
export type NoticeFilter = { type?: string; mine?: boolean };

const NAV: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "대시보드", icon: LayoutDashboard },
  { id: "notices", label: "공지 목록", icon: FileText },
  { id: "alerts", label: "알림 설정", icon: Bell },
  { id: "history", label: "발송 이력", icon: HistoryIcon },
];

export default function AppShell({
  supabase, session, profile, onLogout,
}: {
  supabase: ReturnType<typeof browserClient>; session: Session; profile: Profile; onLogout: () => void;
}) {
  const [page, setPage] = useState<Page>("overview");
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [keywords, setKeywords] = useState<ListItem[]>([]);
  const [searchBody, setSearchBody] = useState(false);
  const [noticeFilter, setNoticeFilter] = useState<NoticeFilter>({});

  const loadNotices = useCallback(async () => {
    const { data } = await supabase
      .from("gd_notices")
      .select("notice_id, org, title, api_names, registered_at, body, notice_type, url, crawled_at")
      .order("registered_at", { ascending: false })
      .order("crawled_at", { ascending: false })
      .limit(1000);
    setNotices((data ?? []) as Notice[]);
  }, [supabase]);

  const loadMine = useCallback(async () => {
    const [k, s] = await Promise.all([
      supabase.from("gd_keywords").select("id, keyword").eq("user_id", profile.user_id).order("id"),
      supabase.from("gd_user_settings").select("search_body").eq("user_id", profile.user_id).maybeSingle(),
    ]);
    setKeywords((k.data ?? []).map((x) => ({ id: x.id, value: x.keyword })));
    setSearchBody(!!s.data?.search_body);
  }, [supabase, profile.user_id]);

  useEffect(() => {
    loadNotices();
    loadMine();
  }, [loadNotices, loadMine]);

  const ctx = { supabase, session, profile };
  const kw = keywords.map((k) => k.value);
  const go = (p: Page, filter: NoticeFilter = {}) => {
    setNoticeFilter(filter);
    setPage(p);
    window.scrollTo(0, 0);
  };
  const current = [...NAV, { id: "admin" as Page, label: "관리자" }].find((n) => n.id === page)!;

  return (
    <SidebarProvider>
      <AppSidebar page={page} go={go} profile={profile} onLogout={onLogout} noticeCount={notices?.length} keywordCount={keywords.length} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <span className="text-sm text-muted-foreground">공공데이터 알림</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">{current.label}</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-8">
          {page === "overview" && <Overview ctx={ctx} notices={notices} keywords={kw} searchBody={searchBody} go={go} />}
          {page === "notices" && <Notices notices={notices} keywords={kw} searchBody={searchBody} initial={noticeFilter} />}
          {page === "alerts" && <Alerts ctx={ctx} notices={notices ?? []} keywords={keywords} searchBody={searchBody} reload={loadMine} />}
          {page === "history" && <History ctx={ctx} />}
          {page === "admin" && profile.is_admin && <Admin ctx={ctx} onCrawled={loadNotices} />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar({
  page, go, profile, onLogout, noticeCount, keywordCount,
}: {
  page: Page; go: (p: Page) => void; profile: Profile; onLogout: () => void; noticeCount?: number; keywordCount: number;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const nav = (p: Page) => {
    go(p);
    if (isMobile) setOpenMobile(false);
  };
  const badge: Partial<Record<Page, number | undefined>> = { notices: noticeCount, alerts: keywordCount || undefined };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => nav("overview")}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Bell className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">공공데이터 알림</span>
                <span className="truncate text-xs text-muted-foreground">API 공지 모니터링</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton isActive={page === n.id} tooltip={n.label} onClick={() => nav(n.id)}>
                    <n.icon />
                    <span>{n.label}</span>
                  </SidebarMenuButton>
                  {badge[n.id] !== undefined && <SidebarMenuBadge>{badge[n.id]}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {profile.is_admin && (
          <SidebarGroup>
            <SidebarGroupLabel>관리</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={page === "admin"} tooltip="관리자" onClick={() => nav("admin")}>
                    <Shield />
                    <span>관리자</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu profile={profile} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function UserMenu({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const initial = profile.email.slice(0, 1).toUpperCase();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{profile.email.split("@")[0]}</span>
                <span className="truncate text-xs text-muted-foreground">{profile.is_admin ? "관리자" : "사용자"}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="font-normal">
              <div className="grid text-sm leading-tight">
                <span className="font-medium">{profile.email}</span>
                <span className="text-xs text-muted-foreground">{profile.is_admin ? "관리자 계정" : "승인된 사용자"}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">테마</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light"><Sun />라이트</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark"><Moon />다크</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system"><Monitor />시스템 설정</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label="테마 전환">
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? "라이트 모드로" : "다크 모드로"}</TooltipContent>
    </Tooltip>
  );
}
