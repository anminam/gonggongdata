"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AtSign, Building2, Eye, Mail, Plus, Search, Send, Sparkles, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { matchKeywords, NOTICE_TYPES, typeAllowed } from "@/lib/match";
import { suggestKeywords } from "@/lib/suggest";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ctx, notices, keywords, orgs, searchBody, notifyTypes, reload,
}: {
  ctx: Ctx; notices: Notice[]; keywords: ListItem[]; orgs: ListItem[]; searchBody: boolean; notifyTypes: string[] | null;
  reload: () => Promise<void>;
}) {
  const { supabase, session } = ctx;
  const uid = ctx.profile.user_id;
  const [rcCount, setRcCount] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [body, setBody] = useState(searchBody);
  const [types, setTypes] = useState<string[] | null>(notifyTypes);
  useEffect(() => setTypes(notifyTypes), [notifyTypes]);
  const [kwInput, setKwInput] = useState("");
  const [kwErr, setKwErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadLocal = useCallback(async () => {
    const s = await supabase.from("gd_user_settings").select("enabled, search_body").eq("user_id", uid).maybeSingle();
    if (s.data) {
      setEnabled(s.data.enabled);
      setBody(s.data.search_body);
    }
  }, [supabase, uid]);
  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  const saveSetting = async (patch: { search_body?: boolean; enabled?: boolean; notify_types?: string[] | null }) => {
    const { error } = await supabase.from("gd_user_settings").upsert({ user_id: uid, ...patch, updated_at: new Date().toISOString() });
    if (error) return toast.error(`저장 실패: ${error.message}`);
    toast.success("설정을 저장했어요");
    if (patch.search_body !== undefined || patch.notify_types !== undefined) reload();
  };

  const countOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of keywords)
      m.set(k.value, notices.filter((n) => typeAllowed(n, types) && matchKeywords(n, [k.value], body).length > 0).length);
    return m;
  }, [keywords, notices, body, types]);

  const draft = kwInput.trim();
  const previewAll = useMemo(() => (draft ? notices.filter((n) => matchKeywords(n, [draft], body).length > 0) : []), [draft, notices, body]);
  const preview = useMemo(() => previewAll.filter((n) => typeAllowed(n, types)), [previewAll, types]);

  const [showAllSuggest, setShowAllSuggest] = useState(false);
  const suggestions = useMemo(() => suggestKeywords(notices, keywords.map((k) => k.value), 20), [notices, keywords]);

  const addKeyword = async (value: string = draft) => {
    if (!value) return;
    const { error } = await supabase.from("gd_keywords").insert({ user_id: uid, keyword: value });
    if (error) return setKwErr(error.code === "23505" ? "이미 있는 키워드예요" : error.message);
    setKwErr(null);
    if (value === draft) setKwInput("");
    toast.success(`‘${value}’ 키워드를 추가했어요`);
    reload();
  };
  const removeKeyword = async (k: ListItem) => {
    await supabase.from("gd_keywords").delete().eq("id", k.id);
    toast(`‘${k.value}’ 키워드를 지웠어요`);
    reload();
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
      <PageHeader title="알림 설정" description="키워드나 구독 기관에 걸리는 새 공지 중, 받기로 한 유형만 매일 오후 2시에 메일로 보내요." />

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
                  <InputGroupButton variant="default" size="xs" onClick={() => addKeyword()} disabled={!draft}>
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
                <AlertTitle>
                  ‘{draft}’ 미리보기 · {preview.length}건 걸려요
                  {previewAll.length > preview.length && (
                    <span className="font-normal text-muted-foreground"> (받지 않는 유형 {previewAll.length - preview.length}건 제외)</span>
                  )}
                </AlertTitle>
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
              {!keywords.length && <p className="text-sm text-muted-foreground">아직 키워드가 없어요. 키워드와 구독 기관이 모두 없으면 메일이 가지 않아요.</p>}
            </div>

            {suggestions.length > 0 && (
              <div className="grid gap-2">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sparkles className="size-4" /> 추천 키워드 · 저장된 공지에 자주 나오는 말이에요. 누르면 바로 추가돼요.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(showAllSuggest ? suggestions : suggestions.slice(0, 10)).map((s) => (
                    <Button key={s} variant="secondary" size="sm" className="h-8 rounded-full" onClick={() => addKeyword(s)} aria-label={`${s} 키워드 추가`}>
                      <Plus /> {s}
                    </Button>
                  ))}
                  {suggestions.length > 10 && (
                    <Button variant="ghost" size="sm" className="h-8 rounded-full text-muted-foreground" onClick={() => setShowAllSuggest((v) => !v)}>
                      {showAllSuggest ? "접기" : `더보기 (+${suggestions.length - 10})`}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </FieldGroup>
        </SectionCard>

        <div className="grid content-start gap-4 lg:col-span-2">
          <RecipientsCard ctx={ctx} onCount={setRcCount} />

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
                <Button variant="outline" onClick={testSend} disabled={sending || !rcCount}>
                  {sending ? <Spinner /> : <Send />} 테스트 메일 보내기
                </Button>
                <FieldDescription>최근 7일 공지 중 내 알림 조건에 걸린 공지로 보내요. 없으면 최신 1건을 샘플로 보내요.</FieldDescription>
              </Field>
            </FieldGroup>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <OrgsCard className="lg:col-span-3" ctx={ctx} notices={notices} orgs={orgs} types={types} reload={reload} />
        <TypesCard
          className="lg:col-span-2"
          notices={notices}
          types={types}
          onChange={(next) => {
            setTypes(next);
            saveSetting({ notify_types: next });
          }}
        />
      </div>

      {keywords.length + orgs.length > 0 && (
        <SectionCard title="조건별 최근 매칭" description="키워드·구독 기관마다 가장 최근에 걸린 공지 (받는 유형만)">
          <ItemGroup>
            {[
              ...keywords.map((k) => ({ key: `k${k.id}`, label: k.value, org: false })),
              ...orgs.map((o) => ({ key: `o${o.id}`, label: o.value, org: true })),
            ].map((c, i) => {
              const latest = notices.find(
                (n) => typeAllowed(n, types) && (c.org ? n.org === c.label : matchKeywords(n, [c.label], body).length > 0),
              );
              return (
                <div key={c.key}>
                  {i > 0 && <ItemSeparator />}
                  <Item>
                    <Badge variant={c.org ? "outline" : "secondary"} className="shrink-0">
                      {c.org && <Building2 data-icon="inline-start" />}
                      {c.label}
                    </Badge>
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

/** 기관 구독: 공지에 나온 기관 목록에서 체크로 구독 (기관명이 정확히 같은 공지만 알림) */
function OrgsCard({
  ctx, notices, orgs, types, reload, className,
}: {
  ctx: Ctx; notices: Notice[]; orgs: ListItem[]; types: string[] | null; reload: () => Promise<void>; className?: string;
}) {
  const { supabase } = ctx;
  const uid = ctx.profile.user_id;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const subscribed = useMemo(() => new Map(orgs.map((o) => [o.value, o.id])), [orgs]);

  // 공지에 나온 기관과 건수 (받는 유형 기준), 많은 순
  const all = useMemo(() => {
    const m = new Map<string, { total: number; allowed: number }>();
    for (const n of notices) {
      if (!n.org) continue;
      const c = m.get(n.org) ?? { total: 0, allowed: 0 };
      c.total++;
      if (typeAllowed(n, types)) c.allowed++;
      m.set(n.org, c);
    }
    // 구독했지만 아직 공지가 없는 기관도 목록에 보이게
    for (const o of orgs) if (!m.has(o.value)) m.set(o.value, { total: 0, allowed: 0 });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "ko"));
  }, [notices, orgs, types]);

  const needle = q.trim();
  const list = all.filter(([o]) => !needle || o.toLowerCase().includes(needle.toLowerCase()));
  const exact = all.some(([o]) => o === needle);

  const toggle = async (org: string, on: boolean) => {
    setBusy(org);
    try {
      const { error } = on
        ? await supabase.from("gd_org_subscriptions").insert({ user_id: uid, org })
        : await supabase.from("gd_org_subscriptions").delete().eq("id", subscribed.get(org)!);
      if (error) return toast.error(error.code === "23505" ? "이미 구독한 기관이에요" : `실패: ${error.message}`);
      toast.success(on ? `‘${org}’ 구독을 시작했어요` : `‘${org}’ 구독을 해지했어요`);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard
      className={className}
      title="기관 구독"
      description="체크한 기관의 공지는 키워드가 없어도 알려드려요"
      action={orgs.length ? <Badge variant="secondary">{orgs.length}곳 구독 중</Badge> : undefined}
    >
      <div className="space-y-3">
        {orgs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {orgs.map((o) => (
              <Badge key={o.id} variant="outline" className="h-8 gap-1.5 rounded-full pr-1 pl-3 text-sm">
                <Building2 data-icon="inline-start" />
                {o.value}
                <Button variant="ghost" size="icon-xs" className="rounded-full" disabled={busy === o.value} onClick={() => toggle(o.value, false)} aria-label={`${o.value} 구독 해지`}>
                  <X />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        <InputGroup>
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput placeholder="기관 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="기관 검색" />
          {needle && !exact && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="default" size="xs" onClick={() => toggle(needle, true).then(() => setQ(""))}>
                <Plus /> ‘{needle}’ 구독
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <ScrollArea className="h-64 rounded-lg border">
          {list.length ? (
            <ul className="divide-y">
              {list.map(([org, c]) => {
                const on = subscribed.has(org);
                return (
                  <li key={org}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                      <Checkbox checked={on} disabled={busy === org} onCheckedChange={(v) => toggle(org, v === true)} />
                      <span className="flex-1 truncate">{org}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {c.allowed === c.total ? `${c.total}건` : `${c.allowed}/${c.total}건`}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              {needle ? "목록에 없는 기관이에요. 위 버튼으로 이름 그대로 구독할 수 있어요." : "아직 수집된 공지가 없어요."}
            </p>
          )}
        </ScrollArea>
        <p className="text-xs text-muted-foreground">숫자는 지금 저장된 공지 수예요. “2/5건”은 받는 유형만 2건이라는 뜻이에요.</p>
      </div>
    </SectionCard>
  );
}

const IMPORTANT_TYPES = ["제공 중단/종료", "URL 변경", "API 변경"];

/** 받을 공지 유형 선택. 모두 선택이면 null로 저장(앞으로 새 유형이 생겨도 받음) */
function TypesCard({
  notices, types, onChange, className,
}: {
  notices: Notice[]; types: string[] | null; onChange: (next: string[] | null) => void; className?: string;
}) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notices) m.set(n.notice_type || "기타", (m.get(n.notice_type || "기타") ?? 0) + 1);
    return m;
  }, [notices]);
  const total = notices.length || 1;
  const isOn = (t: string) => !types || types.includes(t);
  const set = (t: string, on: boolean) => {
    const cur = types ?? [...NOTICE_TYPES];
    const next = on ? [...new Set([...cur, t])] : cur.filter((x) => x !== t);
    onChange(next.length === NOTICE_TYPES.length ? null : next);
  };
  const preset = (list: string[] | null) => onChange(list);
  const noneSelected = !!types && types.length === 0;
  const maint = counts.get("일시 중단(점검)") ?? 0;

  return (
    <SectionCard title="받을 공지 유형" description="체크한 유형의 공지만 메일로 보내요">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={!types ? "default" : "outline"} onClick={() => preset(null)}>전체</Button>
          <Button
            size="sm"
            variant={types && types.length === IMPORTANT_TYPES.length && IMPORTANT_TYPES.every((t) => types.includes(t)) ? "default" : "outline"}
            onClick={() => preset(IMPORTANT_TYPES)}
          >
            중요한 것만
          </Button>
        </div>
        <ul className="space-y-1">
          {NOTICE_TYPES.map((t) => (
            <li key={t}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                <Checkbox checked={isOn(t)} onCheckedChange={(v) => set(t, v === true)} />
                <TypeBadge type={t} />
                <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {counts.get(t) ?? 0}건 · {Math.round(((counts.get(t) ?? 0) / total) * 100)}%
                </span>
              </label>
            </li>
          ))}
        </ul>
        {noneSelected ? (
          <Alert variant="destructive">
            <AlertTitle>선택한 유형이 없어요</AlertTitle>
            <AlertDescription>이대로면 메일이 하나도 가지 않아요.</AlertDescription>
          </Alert>
        ) : (
          maint > 0 && isOn("일시 중단(점검)") && (
            <p className="text-xs text-muted-foreground">
              저장된 공지의 {Math.round((maint / total) * 100)}%가 점검 공지예요. 점검 소식이 필요 없으면 “중요한 것만”을 눌러 보세요.
            </p>
          )
        )}
      </div>
    </SectionCard>
  );
}

/** 수신 메일주소 카드 (알림 설정·설정 페이지 공용). 주소를 직접 읽고 고친다 */
export function RecipientsCard({ ctx, onCount }: { ctx: Ctx; onCount?: (n: number) => void }) {
  const { supabase } = ctx;
  const uid = ctx.profile.user_id;
  const [recipients, setRecipients] = useState<ListItem[]>([]);
  const [rcInput, setRcInput] = useState("");
  const [rcErr, setRcErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await supabase.from("gd_recipients").select("id, email").eq("user_id", uid).order("id");
    const list = (r.data ?? []).map((x) => ({ id: x.id, value: x.email }));
    setRecipients(list);
    onCount?.(list.length);
  }, [supabase, uid, onCount]);
  useEffect(() => {
    load();
  }, [load]);

  const addRecipient = async (value: string = rcInput) => {
    const v = value.trim();
    if (!v) return;
    if (!EMAIL_RE.test(v)) return setRcErr("메일주소 형식이 아니에요");
    const { error } = await supabase.from("gd_recipients").insert({ user_id: uid, email: v });
    if (error) return setRcErr(error.code === "23505" ? "이미 있는 주소예요" : error.message);
    setRcErr(null);
    setRcInput("");
    toast.success("수신 주소를 추가했어요");
    load();
  };
  const removeRecipient = async (r: ListItem) => {
    await supabase.from("gd_recipients").delete().eq("id", r.id);
    toast(`${r.value} 주소를 지웠어요`);
    load();
  };

  return (
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
              <InputGroupButton variant="default" size="xs" onClick={() => addRecipient()} disabled={!rcInput.trim()}>
                <Plus /> 추가
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {rcErr && <FieldError>{rcErr}</FieldError>}
        </Field>
        {!recipients.length ? (
          <Alert variant="destructive">
            <Mail />
            <AlertTitle>수신 주소가 없어서 메일이 안 가요</AlertTitle>
            <AlertDescription>
              <p>받을 메일주소를 하나 이상 넣어 주세요.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => addRecipient(ctx.profile.email)}>
                <Plus /> 로그인 메일({ctx.profile.email})로 받기
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
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
          </ItemGroup>
        )}
      </FieldGroup>
    </SectionCard>
  );
}

/** '알림 받기' 켜기/끄기 카드 (설정 페이지용) */
export function EnabledCard({ ctx }: { ctx: Ctx }) {
  const { supabase } = ctx;
  const uid = ctx.profile.user_id;
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.from("gd_user_settings").select("enabled").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setEnabled(data ? data.enabled : true));
  }, [supabase, uid]);
  const save = async (v: boolean) => {
    setEnabled(v);
    const { error } = await supabase.from("gd_user_settings").upsert({ user_id: uid, enabled: v, updated_at: new Date().toISOString() });
    if (error) {
      setEnabled(!v);
      return toast.error(`저장 실패: ${error.message}`);
    }
    toast.success("설정을 저장했어요");
  };
  return (
    <SectionCard title="메일 알림">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="settings-enabled">알림 받기</FieldLabel>
          <FieldDescription>끄면 매일 발송에서 빠져요. 키워드·기관·유형은 ‘알림 설정’에서 바꿔요.</FieldDescription>
        </FieldContent>
        <Switch id="settings-enabled" checked={!!enabled} disabled={enabled === null} onCheckedChange={save} />
      </Field>
    </SectionCard>
  );
}
