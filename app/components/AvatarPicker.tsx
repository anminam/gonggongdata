"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { AVATARS, findAvatar } from "@/lib/avatars";
import type { SB } from "./shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AvatarPicker({ open, onOpenChange, current, supabase, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; current: string | undefined;
  supabase: SB; onSaved: (id: string) => void;
}) {
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const avatar = findAvatar(selected);

  useEffect(() => {
    if (open) {
      setSelected(current);
      setError("");
    }
  }, [open, current]);

  async function save() {
    if (!avatar || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ data: { gd_avatar: avatar.id } });
      if (error) throw error;
      onSaved(avatar.id);
      onOpenChange(false);
    } catch {
      setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl p-6" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">나를 닮은 프로필을 골라보세요</DialogTitle>
          <DialogDescription>{AVATARS.length}개의 동물 프로필 중 마음에 드는 이미지를 선택하세요.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 py-3 sm:grid-cols-5 sm:gap-4" role="group" aria-label="프로필 이미지 선택">
          {AVATARS.map((item) => (
            <button key={item.id} type="button" aria-label={item.label} aria-pressed={selected === item.id}
              disabled={saving} onClick={() => { setSelected(item.id); setError(""); }}
              className={`group relative rounded-xl text-center outline-none transition-transform motion-safe:hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 disabled:opacity-60 ${selected === item.id ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : ""}`}>
              <img src={item.src} alt="" width={256} height={256} className="aspect-square w-full rounded-xl object-cover" />
              {selected === item.id && <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Check className="size-4" /></span>}
              <span className="block py-1.5 text-xs text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground" aria-live="polite">{avatar ? `${avatar.label} 선택됨` : "마음에 드는 친구를 선택하세요"}</span>
          <Button disabled={!avatar || saving} onClick={save}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "저장 중…" : "이 프로필로 할게요"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
