"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AtSign, Eye, Mail, Plus, Send, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { matchKeywords } from "@/lib/match";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Ctx, Notice, PageHeader, SectionCard, TypeBadge } from "./shared";

export type ListItem = { id: number; value: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Alerts({
  ctx, notices, keywords, searchBody, reload,
}: {
  ctx: Ctx; notices: Notice[]; keywords: ListItem[]; searchBody: boolean; reload: () => Promise<void>;
}) {
  const { supabase, session } = ctx;
  const uid = ctx.profile.user_id;
  const [recipients, setRecipients] = useState<ListItem[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [body, setBody] = useState(searchBody);
  const [kwInput, setKwInput] = useState("");
  const [kwErr, setKwErr] = useState<string | null>(null);
  const [rcInput, setRcInput] = useState("");
  const [rcErr, setRcErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadLocal = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase.from("gd_recipients").select("id, email").eq("user_id", uid).order("id"),
      supabase.from("gd_user_settings").select("enabled, search_body").eq("user_id", uid).maybeSingle(),
    ]);
    setRecipients((r.data ?? []).map((x) => ({ id: x.id, value: x.email })));
    if (s.data) {
      setEnabled(s.data.enabled);
      setBody(s.data.search_body);
    }
  }, [supabase, uid]);
  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  const saveSetting = async (patch: { search_body?: boolean; enabled?: boolean }) => {
    const { error } = await supabase.from("gd_user_settings").upsert({ user_id: uid, ...patch, updated_at: new Date().toISOString() });
    if (error) return toast.error(`저장 실패: ${error.message}`);
    toast.success("설정을 저장했어요");
    if (patch.search_body !== undefined) reload();
  };

  const countOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of keywords) m.set(k.value, notices.filter((n) => matchKeywords(n, [k.value], body).length > 0).length);
    return m;
  }, [keywords, notices, body]);

  const draft = kwInput.trim();
  const preview = useMemo(() => (draft ? notices.filter((n) => matchKeywords(n, [draft], body).length > 0) : []), [draft, notices, body]);

  const addKeyword = async () => {
    if (!draft) return;
    const { error } = await supabase.from("gd_keywords").insert({ user_id: uid, keyword: draft });
    if (error) return setKwErr(error.code === "23505" ? "이미 있는 키워드예요" : error.message);
    setKwErr(null);
    setKwInput("");
    toast.success(`‘${draft}’ 키워드를 추가했어요`);
    reload();
  };
  const removeKeyword = async (k: ListItem) => {
    await supabase.from("gd_keywords").delete().eq("id", k.id);
    toast(`‘${k.value}’ 키워드를 지웠어요`);
    reload();
  };

  const addRecipient = async () => {
    const v = rcInput.trim();
    if (!v) return;
    if (!EMAIL_RE.test(v)) return setRcErr("메일주소 형식이 아니에요");
    const { error } = await supabase.from("gd_recipients").insert({ user_id: uid, email: v });
    if (error) return setRcErr(error.code === "23505" ? "이미 있는 주소예요" : error.message);
    setRcErr(null);
    setRcInput("");
    toast.success("수신 주소를 추가했어요");
    loadLocal();
  };
  const removeRecipient = async (r: ListItem) => {
    await supabase.from("gd_recipients").delete().eq("id", r.id);
    toast(`${r.value} 주소를 지웠어요`);
    loadLocal();
  };

  const testSend = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/me/test-send", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json().catch(() => ({}));
      if (j.ok) toast.success(`테스트 메일을 ${j.recipients.length}곳에 보냈어요 (${j.count}건)`, { description: "스팸함도 확인해 주세요." });
      else toast.error("테스트 발송 실패", { description: String(j.error ?? res.status) });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader title="알림 설정" description="키워드 중 하나라도 걸리는 새 공지가 있으면 매일 오후 2시에 메일로 보내요." />

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard className="lg:col-span-3" title="키워드" description="하나라도 포함되면 알림 (OR 조건)">
          <FieldGroup>
            <Field data-invalid={!!kwErr || undefined}>
              <FieldLabel htmlFor="kw">새 키워드</FieldLabel>
              <InputGroup>
                <InputGroupAddon><Tag /></InputGroupAddon>
                <InputGroupInput
                  id="kw"
                  value={kwInput}
                  placeholder="예: 국토교통부, 기상청, 항공"
                  onChange={(e) => { setKwInput(e.target.value); setKwErr(null); }}
                  onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addKeyword()}
                  aria-invalid={!!kwErr}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton variant="default" size="xs" onClick={addKeyword} disabled={!draft}>
                    <Plus /> 추가
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>공지 제목·API명·기관명{body ? "·본문" : ""}에서 찾아요. 배지 옆 숫자는 지금 저장된 공지 중 걸리는 수예요.</FieldDescription>
              {kwErr && <FieldError>{kwErr}</FieldError>}
            </Field>

            {draft && (
              <Alert>
                <Eye />
                <AlertTitle>‘{draft}’ 미리보기 · {preview.length}건 걸려요</AlertTitle>
                <AlertDescription>
                  {preview.length ? (
                    <ul className="mt-1 space-y-1">
                      {preview.slice(0, 5).map((n) => (
                        <li key={n.notice_id} className="line-clamp-1">
                          <span className="tabular-nums text-muted-foreground">{n.registered_at}</span> {n.title}
                        </li>
                      ))}
                      {preview.length > 5 && <li className="text-muted-foreground">외 {preview.length - 5}건</li>}
                    </ul>
                  ) : (
                    "지금 저장된 공지 중엔 없어요. 앞으로 올라오는 공지에 걸리면 알려드려요."
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <Badge key={k.id} variant="outline" className="h-8 gap-1.5 rounded-full pr-1 pl-3 text-sm">
                  {k.value}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{countOf.get(k.value) ?? 0}</span>
                  <Button variant="ghost" size="icon-xs" className="rounded-full" onClick={() => removeKeyword(k)} aria-label={`${k.value} 삭제`}>
                    <X />
                  </Button>
                </Badge>
              ))}
              {!keywords.length && <p className="text-sm text-muted-foreground">아직 키워드가 없어요. 키워드가 없으면 메일이 가지 않아요.</p>}
            </div>
          </FieldGroup>
        </SectionCard>

        <div className="grid content-start gap-4 lg:col-span-2">
          <SectionCard title="수신 메일주소" description="여러 곳에 보낼 수 있어요">
            <FieldGroup>
              <Field data-invalid={!!rcErr || undefined}>
                <InputGroup>
                  <InputGroupAddon><AtSign /></InputGroupAddon>
                  <InputGroupInput
                    type="email"
                    value={rcInput}
                    placeholder="name@example.com"
                    onChange={(e) => { setRcInput(e.target.value); setRcErr(null); }}
                    onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                    aria-label="새 수신 메일주소"
                    aria-invalid={!!rcErr}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton variant="default" size="xs" onClick={addRecipient} disabled={!rcInput.trim()}>
                      <Plus /> 추가
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {rcErr && <FieldError>{rcErr}</FieldError>}
              </Field>
              <ItemGroup className="rounded-lg border">
                {recipients.map((r, i) => (
                  <div key={r.id}>
                    {i > 0 && <ItemSeparator />}
                    <Item size="sm">
                      <Mail className="size-4 text-muted-foreground" />
                      <ItemContent><ItemTitle className="font-normal">{r.value}</ItemTitle></ItemContent>
                      <ItemActions>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeRecipient(r)} aria-label={`${r.value} 삭제`}><X /></Button>
                      </ItemActions>
                    </Item>
                  </div>
                ))}
                {!recipients.length && <p className="p-3 text-sm text-muted-foreground">아직 수신 주소가 없어요.</p>}
              </ItemGroup>
            </FieldGroup>
          </SectionCard>

          <SectionCard title="옵션">
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="enabled">알림 받기</FieldLabel>
                  <FieldDescription>끄면 매일 발송에서 빠져요.</FieldDescription>
                </FieldContent>
                <Switch id="enabled" checked={enabled} onCheckedChange={(v) => { setEnabled(v); saveSetting({ enabled: v }); }} />
              </Field>
              <FieldSeparator />
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="body">본문까지 키워드 검사</FieldLabel>
                  <FieldDescription>더 많이 잡히지만 관련 없는 공지도 섞일 수 있어요.</FieldDescription>
                </FieldContent>
                <Switch id="body" checked={body} onCheckedChange={(v) => { setBody(v); saveSetting({ search_body: v }); }} />
              </Field>
              <FieldSeparator />
              <Field>
                <Button variant="outline" onClick={testSend} disabled={sending || !recipients.length}>
                  {sending ? <Spinner /> : <Send />} 테스트 메일 보내기
                </Button>
                <FieldDescription>최근 7일 공지 중 내 키워드에 걸린 공지로 보내요. 없으면 최신 1건을 샘플로 보내요.</FieldDescription>
              </Field>
            </FieldGroup>
          </SectionCard>
        </div>
      </div>

      {keywords.length > 0 && (
        <SectionCard title="키워드별 최근 매칭" description="키워드마다 가장 최근에 걸린 공지">
          <ItemGroup>
            {keywords.map((k, i) => {
              const latest = notices.find((n) => matchKeywords(n, [k.value], body).length > 0);
              return (
                <div key={k.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item>
                    <Badge variant="secondary" className="shrink-0">{k.value}</Badge>
                    <ItemContent>
                      {latest ? (
                        <>
                          <ItemTitle className="line-clamp-1">
                            <a href={latest.url} target="_blank" rel="noreferrer" className="hover:underline">{latest.title}</a>
                          </ItemTitle>
                          <ItemDescription>{latest.registered_at} · {latest.org ?? "기관 미상"}</ItemDescription>
                        </>
                      ) : (
                        <ItemDescription>아직 걸린 공지가 없어요</ItemDescription>
                      )}
                    </ItemContent>
                    {latest && <ItemActions><TypeBadge type={latest.notice_type} /></ItemActions>}
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        </SectionCard>
      )}
    </>
  );
}
