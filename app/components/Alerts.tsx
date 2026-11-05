"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { matchKeywords } from "@/lib/match";
import { Card, Ctx, Notice, PageHead, TypeBadge } from "./ui";

export type Item = { id: number; value: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Alerts({
  ctx, notices, keywords, searchBody, reload,
}: {
  ctx: Ctx; notices: Notice[]; keywords: Item[]; searchBody: boolean; reload: () => Promise<void>;
}) {
  const { supabase, session } = ctx;
  const uid = ctx.profile.user_id;
  const [recipients, setRecipients] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [body, setBody] = useState(searchBody);
  const [kwInput, setKwInput] = useState("");
  const [kwErr, setKwErr] = useState<string | null>(null);
  const [rcInput, setRcInput] = useState("");
  const [rcErr, setRcErr] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<{ text: string; err?: boolean } | null>(null);
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
    await supabase.from("gd_user_settings").upsert({ user_id: uid, ...patch, updated_at: new Date().toISOString() });
    if (patch.search_body !== undefined) reload();
  };

  // 키워드별 매칭 수
  const countOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of keywords) m.set(k.value, notices.filter((n) => matchKeywords(n, [k.value], body).length > 0).length);
    return m;
  }, [keywords, notices, body]);

  // 입력 중인 키워드 미리보기
  const draft = kwInput.trim();
  const preview = useMemo(
    () => (draft ? notices.filter((n) => matchKeywords(n, [draft], body).length > 0) : []),
    [draft, notices, body],
  );

  const addKeyword = async () => {
    if (!draft) return;
    const { error } = await supabase.from("gd_keywords").insert({ user_id: uid, keyword: draft });
    if (error) return setKwErr(error.code === "23505" ? "이미 있는 키워드예요" : error.message);
    setKwErr(null);
    setKwInput("");
    reload();
  };
  const removeKeyword = async (id: number) => {
    await supabase.from("gd_keywords").delete().eq("id", id);
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
    loadLocal();
  };
  const removeRecipient = async (id: number) => {
    await supabase.from("gd_recipients").delete().eq("id", id);
    loadLocal();
  };

  const testSend = async () => {
    setSending(true);
    setSendMsg({ text: "발송 중…" });
    try {
      const res = await fetch("/api/me/test-send", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json().catch(() => ({}));
      setSendMsg(
        j.ok
          ? { text: `테스트 메일을 ${j.recipients.length}곳에 보냈어요 (${j.count}건). 스팸함도 확인해 주세요.` }
          : { text: `실패: ${j.error ?? res.status}`, err: true },
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHead title="알림 설정" desc="키워드 중 하나라도 걸리는 새 공지가 있으면 매일 오후 2시에 메일로 보내요." />

      <div className="grid cols-2">
        <Card title="키워드" sub="하나라도 포함되면 알림 (OR 조건)">
          <p className="help">공지 제목·API명·기관명{body ? "·본문" : ""}에서 찾아요. 칩 옆 숫자는 지금 저장된 공지 중 걸리는 수예요.</p>
          <div className="add-row">
            <input
              value={kwInput}
              placeholder="예: 국토교통부, 기상청, 항공"
              onChange={(e) => { setKwInput(e.target.value); setKwErr(null); }}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addKeyword()}
              aria-label="새 키워드"
            />
            <button className="primary" onClick={addKeyword} disabled={!draft}>추가</button>
          </div>
          {kwErr && <div className="msg err">{kwErr}</div>}
          {draft && (
            <div className="preview-box">
              <div className="head">‘{draft}’ 미리보기 · {preview.length}건 걸려요</div>
              {preview.length ? (
                <ul>
                  {preview.slice(0, 5).map((n) => (
                    <li key={n.notice_id}>
                      <span style={{ color: "var(--muted)" }} className="tnum">{n.registered_at}</span> {n.title}
                    </li>
                  ))}
                  {preview.length > 5 && <li style={{ listStyle: "none", color: "var(--muted)" }}>외 {preview.length - 5}건</li>}
                </ul>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>지금 저장된 공지 중엔 없어요. 앞으로 올라오는 공지에 걸리면 알려드려요.</div>
              )}
            </div>
          )}
          <ul className="chips" style={{ marginTop: 14 }}>
            {keywords.map((k) => (
              <li key={k.id} className="chip">
                {k.value} <span className="count">{countOf.get(k.value) ?? 0}</span>
                <button aria-label={`${k.value} 삭제`} onClick={() => removeKeyword(k.id)}>×</button>
              </li>
            ))}
            {!keywords.length && <li style={{ color: "var(--muted)" }}>아직 키워드가 없어요. 키워드가 없으면 메일이 가지 않아요.</li>}
          </ul>
        </Card>

        <div className="grid" style={{ alignContent: "start" }}>
          <Card title="수신 메일주소" sub="여러 곳에 보낼 수 있어요">
            <div className="add-row">
              <input
                type="email"
                value={rcInput}
                placeholder="name@example.com"
                onChange={(e) => { setRcInput(e.target.value); setRcErr(null); }}
                onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                aria-label="새 수신 메일주소"
              />
              <button className="primary" onClick={addRecipient} disabled={!rcInput.trim()}>추가</button>
            </div>
            {rcErr && <div className="msg err">{rcErr}</div>}
            <ul className="chips" style={{ marginTop: 14 }}>
              {recipients.map((r) => (
                <li key={r.id} className="chip">
                  {r.value}
                  <button aria-label={`${r.value} 삭제`} onClick={() => removeRecipient(r.id)}>×</button>
                </li>
              ))}
              {!recipients.length && <li style={{ color: "var(--muted)" }}>아직 수신 주소가 없어요.</li>}
            </ul>
          </Card>

          <Card title="옵션">
            <label className="option">
              <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); saveSetting({ enabled: e.target.checked }); }} />
              <span>
                <div>알림 받기</div>
                <div className="desc">끄면 매일 발송에서 빠져요.</div>
              </span>
            </label>
            <label className="option">
              <input type="checkbox" checked={body} onChange={(e) => { setBody(e.target.checked); saveSetting({ search_body: e.target.checked }); }} />
              <span>
                <div>공지 본문까지 키워드 검사</div>
                <div className="desc">더 많이 잡히지만 관련 없는 공지도 섞일 수 있어요.</div>
              </span>
            </label>
            <div className="option" style={{ display: "block" }}>
              <button onClick={testSend} disabled={sending || !recipients.length}>테스트 메일 보내기</button>
              <div className="desc" style={{ marginTop: 6 }}>최근 7일 공지 중 내 키워드에 걸린 공지로 보내요. 없으면 최신 1건을 샘플로 보내요.</div>
              {sendMsg && <div className={`msg${sendMsg.err ? " err" : ""}`}>{sendMsg.text}</div>}
            </div>
          </Card>
        </div>
      </div>

      {keywords.length > 0 && (
        <div className="mt">
          <Card title="키워드별 최근 매칭" sub="키워드마다 가장 최근에 걸린 공지" flush>
            <ul className="list">
              {keywords.map((k) => {
                const latest = notices.find((n) => matchKeywords(n, [k.value], body).length > 0);
                return (
                  <li key={k.id}>
                    <div className="grow">
                      <span className="kw">{k.value}</span>
                      {latest ? (
                        <a href={latest.url} target="_blank" rel="noreferrer">{latest.title}</a>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>아직 걸린 공지가 없어요</span>
                      )}
                      {latest && <div className="meta">{latest.registered_at} · {latest.org ?? "기관 미상"}</div>}
                    </div>
                    {latest && <TypeBadge type={latest.notice_type} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
