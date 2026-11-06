"use client";

import { useEffect, useState } from "react";
import { Globe, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppSettings, ApprovalMode, DEFAULT_SUBJECT, cleanSubject, fillSubject, loadAppSettings, normalizeDomain } from "@/lib/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Ctx, SectionCard } from "./shared";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/** 설정 화면 '관리자 설정' 영역의 카드 3개: 자동 발송, 가입 승인 방식, 메일 제목 (gd_app_settings, RLS로 관리자만) */
export function AppSettingsCards({ ctx }: { ctx: Ctx }) {
  const { supabase, profile } = ctx;
  const [s, setS] = useState<AppSettings | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    loadAppSettings(supabase)
      .then((v) => {
        setS(v);
        setSubject(v.subject_template ?? "");
      })
      .catch((e) => toast.error(`관리자 설정을 불러오지 못했어요: ${e.message}`));
  }, [supabase]);

  const save = async (patch: Partial<AppSettings>) => {
    if (!s) return;
    const prev = s;
    setS({ ...s, ...patch });
    const { error } = await supabase
      .from("gd_app_settings")
      .upsert({ id: 1, ...patch, updated_at: new Date().toISOString(), updated_by: profile.user_id });
    if (error) {
      setS(prev);
      return toast.error(`저장 실패: ${error.message}`);
    }
    toast.success("설정을 저장했어요");
  };

  const addDomain = () => {
    if (!s) return;
    const d = normalizeDomain(domainInput);
    if (!d) return toast.error("도메인 형식이 아니에요 (예: example.go.kr)");
    setDomainInput("");
    if (!s.approval_domains.includes(d)) save({ approval_domains: [...s.approval_domains, d] });
  };

  const saveSubject = () => {
    const v = cleanSubject(subject);
    setSubject(v);
    save({ subject_template: v || null });
  };

  return (
    <>
      <SectionCard title="알림 메일 발송">
        <div className="grid gap-3">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="admin-mail-enabled">자동 발송</FieldLabel>
              <FieldDescription>매일 오후 2시 수집 후 알림 메일을 보내요.</FieldDescription>
            </FieldContent>
            <Switch id="admin-mail-enabled" checked={!!s && !s.mail_paused} disabled={!s} onCheckedChange={(on) => save({ mail_paused: !on })} />
          </Field>
          {s?.mail_paused && (
            <Alert>
              <AlertDescription>자동 알림 메일이 나가지 않아요. 수집은 계속돼요. 다시 켜면 최근 7일 중 못 보낸 공지가 다음 실행 때 나가요.</AlertDescription>
            </Alert>
          )}
        </div>
      </SectionCard>

      <SectionCard title="가입 승인 방식" description="새로 가입하는 사람부터 적용돼요.">
        <div className="grid gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            value={s?.approval_mode}
            disabled={!s}
            onValueChange={(v) => v && save({ approval_mode: v as ApprovalMode })}
            aria-label="가입 승인 방식"
          >
            <ToggleGroupItem value="manual">수동 승인</ToggleGroupItem>
            <ToggleGroupItem value="domain">도메인 자동 승인</ToggleGroupItem>
            <ToggleGroupItem value="all">전원 자동 승인</ToggleGroupItem>
          </ToggleGroup>

          {s?.approval_mode === "domain" && (
            <Field>
              <FieldLabel htmlFor="admin-domain">자동 승인할 도메인</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {s.approval_domains.map((d) => (
                  <Badge key={d} variant="outline" className="h-8 gap-1.5 rounded-full pr-1 pl-3 text-sm">
                    {d}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="rounded-full"
                      onClick={() => save({ approval_domains: s.approval_domains.filter((x) => x !== d) })}
                      aria-label={`${d} 삭제`}
                    >
                      <X />
                    </Button>
                  </Badge>
                ))}
                {!s.approval_domains.length && <p className="text-sm text-muted-foreground">아직 도메인이 없어요. 없으면 아무도 자동 승인되지 않아요.</p>}
              </div>
              <InputGroup>
                <InputGroupAddon><Globe /></InputGroupAddon>
                <InputGroupInput
                  id="admin-domain"
                  value={domainInput}
                  placeholder="예: example.go.kr"
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addDomain()}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton variant="default" size="xs" onClick={addDomain} disabled={!domainInput.trim()}>
                    <Plus /> 추가
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          )}
        </div>
      </SectionCard>

      <SectionCard title="알림 메일 제목">
        <Field>
          <FieldLabel htmlFor="admin-subject">제목 양식</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="admin-subject"
              value={subject}
              maxLength={200}
              placeholder={DEFAULT_SUBJECT}
              disabled={!s}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && saveSubject()}
            />
            <Button variant="outline" onClick={saveSubject} disabled={!s || cleanSubject(subject) === (s.subject_template ?? "")}>
              저장
            </Button>
          </div>
          <FieldDescription>{"{건수}, {날짜} 칸을 쓸 수 있어요. 비우면 기본 제목을 써요."}</FieldDescription>
          <p className="truncate rounded-md bg-muted px-3 py-2 text-sm">미리보기: {fillSubject(cleanSubject(subject), 3, today())}</p>
        </Field>
      </SectionCard>
    </>
  );
}
