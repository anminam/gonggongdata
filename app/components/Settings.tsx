"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, UserRoundPen, UserX } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LegalLinks } from "./LegalPage";
import { findAvatar } from "@/lib/avatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import AvatarPicker from "./AvatarPicker";
import { EnabledCard, RecipientsCard } from "./Alerts";
import { SenderCard } from "./Admin";
import { AppSettingsCards } from "./AdminSettings";
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
        {!profile.is_admin && <WithdrawCard ctx={ctx} />}
      </div>
      <LegalLinks className="mt-8" />

      {profile.is_admin && (
        <section className="mt-8 space-y-4">
          <Separator />
          <div>
            <h2 className="text-lg font-semibold">관리자 설정</h2>
            <p className="text-sm text-muted-foreground">관리자 계정에만 보이는 설정이에요.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SenderCard ctx={ctx} selfLoad />
            <AppSettingsCards ctx={ctx} />
          </div>
        </section>
      )}
    </>
  );
}

/** 회원 탈퇴: 이 서비스의 내 데이터를 모두 지우고 로그아웃 */
function WithdrawCard({ ctx }: { ctx: Ctx }) {
  const { supabase, session } = ctx;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    setBusy(true);
    const r = await fetch("/api/me/delete", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !j.ok) {
      toast.error(j.error || `탈퇴 실패 (${r.status})`);
      return;
    }
    toast.success("탈퇴했어요. 그동안 이용해 주셔서 고마워요.");
    await supabase.auth.signOut();
  };

  return (
    <SectionCard title="회원 탈퇴" description="알림 설정, 키워드, 수신 주소, 발송 이력이 모두 지워지고 되돌릴 수 없어요.">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="text-destructive"><UserX /> 회원 탈퇴</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정말 탈퇴할까요?</DialogTitle>
            <DialogDescription>
              이 서비스에 저장된 내 데이터가 모두 바로 지워지고 알림 메일도 더 이상 가지 않아요. 다시 쓰려면 새로 가입 승인을 받아야 해요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>취소</Button>
            <Button variant="destructive" onClick={withdraw} disabled={busy}>{busy ? "처리 중…" : "탈퇴하기"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
