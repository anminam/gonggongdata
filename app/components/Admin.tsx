"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Ctx, fmtDateTime, PageHead, Profile, Stat } from "./ui";

type RunLog = { id: number; started_at: string; finished_at: string | null; status: string; new_notices: number; emails_sent: number; error: string | null };
type Sender = { email: string; updated_at: string } | null;

export default function Admin({ ctx, onCrawled }: { ctx: Ctx; onCrawled: () => void }) {
  const { supabase, session } = ctx;
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [sender, setSender] = useState<Sender | undefined>(undefined);
  const [runMsg, setRunMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const [u, l] = await Promise.all([
      supabase.from("gd_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("gd_run_logs").select("*").order("started_at", { ascending: false }).limit(20),
    ]);
    setUsers((u.data ?? []) as Profile[]);
    setLogs((l.data ?? []) as RunLog[]);
  }, [supabase]);

  useEffect(() => {
    load();
    fetch("/api/admin/gmail", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((j) => setSender(j.sender ?? null))
      .catch(() => setSender(null));
  }, [load, session]);

  const setStatus = async (id: string, status: Profile["status"]) => {
    await supabase
      .from("gd_profiles")
      .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
      .eq("user_id", id);
    load();
  };

  const connectGmail = () => {
    localStorage.setItem("gd_gmail_connect", "1");
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/gmail.send",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const runNow = async () => {
    setRunning(true);
    setRunMsg({ text: "실행 중… (최대 1분)" });
    try {
      const res = await fetch("/api/admin/run", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json().catch(() => ({}));
      setRunMsg(j.ok ? { text: `완료: 신규 공지 ${j.newNotices}건, 메일 ${j.emailsSent}통` } : { text: `실패: ${j.error ?? res.status}`, err: true });
      load();
      onCrawled();
    } finally {
      setRunning(false);
    }
  };

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const lastRun = logs[0];

  return (
    <>
      <PageHead title="관리자" desc="사용자 승인, 메일 발송 계정, 크롤링 실행을 관리해요." />

      <div className="grid cols-4">
        <Stat label="승인된 사용자" value={approved.length} hint={`전체 ${users.length}명`} />
        <Stat label="승인 대기" value={pending.length} hint={pending.length ? "아래에서 수락·거절하세요" : "대기 없음"} />
        <Stat
          label="마지막 실행"
          value={
            lastRun ? (
              <span style={{ fontSize: 18 }}>
                <span className={`status-dot ${lastRun.status === "success" ? "good" : lastRun.status === "error" ? "crit" : "warn"}`} />
                {lastRun.status === "success" ? "성공" : lastRun.status === "error" ? "실패" : "실행 중"}
              </span>
            ) : "–"
          }
          hint={lastRun ? fmtDateTime(lastRun.started_at) : "실행 기록 없음"}
        />
        <Stat
          label="발송 계정"
          value={
            <span style={{ fontSize: 18 }}>
              <span className={`status-dot ${sender ? "good" : sender === null ? "crit" : ""}`} />
              {sender === undefined ? "확인 중" : sender ? "연결됨" : "미연결"}
            </span>
          }
          hint={sender ? sender.email : sender === null ? "연결해야 메일이 나가요" : ""}
        />
      </div>

      <div className="grid cols-2 mt">
        <Card title="메일 발송 계정" sub="이 Gmail 계정으로 알림 메일을 보내요">
          <p className="help" style={{ marginBottom: 14 }}>
            {sender === undefined
              ? "확인 중…"
              : sender
                ? `${sender.email} · 연결 ${fmtDateTime(sender.updated_at)}`
                : "연결된 Gmail 계정이 없어서 메일을 보낼 수 없어요."}
          </p>
          <button className={sender ? "" : "primary"} onClick={connectGmail}>{sender ? "다시 연결" : "Gmail 발송 계정 연결"}</button>
        </Card>
        <Card title="크롤링 실행" sub="매일 14:00(한국 시간)에 자동 실행돼요">
          <p className="help" style={{ marginBottom: 14 }}>지금 바로 새 공지를 수집하고, 키워드에 걸린 공지를 메일로 보내요.</p>
          <button className="primary" onClick={runNow} disabled={running}>지금 크롤링 실행</button>
          {runMsg && <div className={`msg${runMsg.err ? " err" : ""}`}>{runMsg.text}</div>}
        </Card>
      </div>

      {pending.length > 0 && (
        <div className="mt">
          <Card title={`승인 대기 (${pending.length})`} flush>
            <ul className="list">
              {pending.map((u) => (
                <li key={u.user_id}>
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{u.email}</div>
                    <div className="meta">요청 {fmtDateTime(u.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="primary sm" onClick={() => setStatus(u.user_id, "approved")}>수락</button>
                    <button className="sm" onClick={() => setStatus(u.user_id, "rejected")}>거절</button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <section className="card mt">
        <div className="card-head"><h2>사용자</h2></div>
        <div className="card-body flush">
          {!users.length ? (
            <div className="empty">사용자가 없어요.</div>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>이메일</th>
                    <th style={{ width: 110 }}>상태</th>
                    <th className="hide-sm" style={{ width: 160 }}>가입</th>
                    <th className="right" style={{ width: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id}>
                      <td>
                        {u.email} {u.is_admin && <span className="badge primary" style={{ marginLeft: 6 }}>관리자</span>}
                      </td>
                      <td>
                        <span className={`badge ${u.status === "approved" ? "good" : u.status === "rejected" ? "crit" : "warn"}`}>
                          {u.status === "approved" ? "승인됨" : u.status === "rejected" ? "거절됨" : "대기"}
                        </span>
                      </td>
                      <td className="hide-sm tnum nowrap" style={{ color: "var(--muted)" }}>{fmtDateTime(u.created_at)}</td>
                      <td className="right">
                        {!u.is_admin && u.status === "approved" && <button className="sm danger" onClick={() => setStatus(u.user_id, "rejected")}>차단</button>}
                        {!u.is_admin && u.status === "rejected" && <button className="sm" onClick={() => setStatus(u.user_id, "approved")}>승인</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card mt">
        <div className="card-head"><h2>실행 기록</h2><span className="sub">최근 20회</span></div>
        <div className="card-body flush">
          {!logs.length ? (
            <div className="empty">아직 실행 기록이 없어요.</div>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 160 }}>시작</th>
                    <th style={{ width: 90 }}>결과</th>
                    <th className="right" style={{ width: 90 }}>신규 공지</th>
                    <th className="right" style={{ width: 80 }}>메일</th>
                    <th className="hide-sm">오류</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="nowrap tnum">{fmtDateTime(l.started_at)}</td>
                      <td>
                        <span className={`badge ${l.status === "success" ? "good" : l.status === "error" ? "crit" : "warn"}`}>
                          {l.status === "success" ? "성공" : l.status === "error" ? "실패" : "실행 중"}
                        </span>
                      </td>
                      <td className="right tnum">{l.new_notices}</td>
                      <td className="right tnum">{l.emails_sent}</td>
                      <td className="hide-sm" style={{ color: "var(--crit)", fontSize: 13 }}>{l.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
