"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, UserRoundPen } from "lucide-react";
import { findAvatar } from "@/lib/avatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import AvatarPicker from "./AvatarPicker";
import { EnabledCard, RecipientsCard } from "./Alerts";
import { SenderCard } from "./Admin";
import { Ctx, PageHeader, SectionCard } from "./shared";

export default function Settings({ ctx, avatarId, onAvatarSaved }: { ctx: Ctx; avatarId?: string; onAvatarSaved: (id: string) => void }) {
  const { profile, supabase } = ctx;
  const [pickerOpen, setPickerOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const avatar = findAvatar(avatarId);

  return (
    <>
      <PageHeader title="설정" description="프로필, 화면 테마, 메일 알림을 한곳에서 바꿔요." />
      <AvatarPicker open={pickerOpen} onOpenChange={setPickerOpen} current={avatarId} supabase={supabase} onSaved={onAvatarSaved} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="프로필">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-16 rounded-2xl">
              {avatar && <AvatarImage src={avatar.src} alt={avatar.label} className="rounded-2xl" />}
              <AvatarFallback className="rounded-2xl text-xl">{profile.email.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{profile.email}</p>
              <p className="text-sm text-muted-foreground">{profile.is_admin ? "관리자 계정" : "승인된 사용자"}</p>
            </div>
            <Button variant="outline" onClick={() => setPickerOpen(true)}><UserRoundPen /> 프로필 이미지 변경</Button>
          </div>
        </SectionCard>

        <SectionCard title="화면 테마" description="시스템 설정을 고르면 기기 설정을 따라가요">
          <ToggleGroup type="single" variant="outline" value={theme} onValueChange={(v) => v && setTheme(v)} aria-label="화면 테마">
            <ToggleGroupItem value="light" aria-label="라이트"><Sun /> 라이트</ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="다크"><Moon /> 다크</ToggleGroupItem>
            <ToggleGroupItem value="system" aria-label="시스템 설정"><Monitor /> 시스템</ToggleGroupItem>
          </ToggleGroup>
        </SectionCard>

        <EnabledCard ctx={ctx} />
        <RecipientsCard ctx={ctx} />

        {profile.is_admin && <SenderCard ctx={ctx} selfLoad />}
      </div>
    </>
  );
}
