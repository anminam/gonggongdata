"use client";

import { useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { browserClient } from "@/lib/supabase";

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

// 공지 유형 → 배지 색. 색만으로 구분하지 않도록 항상 글자와 함께 쓴다.
const TYPE_TONE: Record<string, string> = {
  "제공 중단/종료": "crit",
  "URL 변경": "serious",
  "일시 중단(점검)": "warn",
  "API 변경": "info",
  "신규/추가": "good",
};
export const NOTICE_TYPES = ["제공 중단/종료", "URL 변경", "API 변경", "일시 중단(점검)", "신규/추가", "기타"];

export function TypeBadge({ type }: { type: string | null }) {
  const t = type || "기타";
  return <span className={`badge ${TYPE_TONE[t] ?? ""}`}>{t}</span>;
}

export function Card({ title, sub, action, children, flush }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={`card-body${flush ? " flush" : ""}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function PageHead({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kw({ list }: { list: string[] }) {
  return (
    <>
      {list.map((k) => (
        <span key={k} className="kw">{k}</span>
      ))}
    </>
  );
}

/** 단일 계열 세로 막대 (일별 추이). 막대마다 마우스를 올리면 값이 보인다. */
export function ColumnChart({ data, height = 180, unit = "건" }: { data: { label: string; value: number; tick?: string }[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 28, r: 4, t: 8, b: 22 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const ticks = nice <= 4 ? Array.from({ length: nice + 1 }, (_, i) => i) : [0, nice / 4, nice / 2, (nice * 3) / 4, nice];
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / data.length;
  const bw = Math.max(2, Math.min(18, slot - 2));
  const y = (v: number) => pad.t + ih - (v / nice) * ih;
  const r = Math.min(4, bw / 2);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="일별 공지 수 막대 차트">
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "base-line" : "grid-line"} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          const top = y(d.value);
          const h = pad.t + ih - top;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect className="hit" x={pad.l + i * slot} y={pad.t} width={slot} height={ih} />
              {d.value > 0 && (
                <path
                  className={`bar${hover !== null && hover !== i ? " dim" : ""}`}
                  d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${top + h} Z`}
                />
              )}
              {d.tick && (
                <text className="axis" x={x + bw / 2} y={H - 6} textAnchor="middle">{d.tick}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          {data[hover].label} · <b>{data[hover].value}{unit}</b>
        </div>
      )}
    </div>
  );
}

/** 가로 막대 (항목별 크기). 이름·숫자를 항상 글자로 같이 보여준다. */
export function HBars({ data, onPick }: { data: { label: string; value: number }[]; onPick?: (label: string) => void }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d) => (
        <div
          key={d.label}
          className="hbar"
          title={`${d.label}: ${d.value}건`}
          style={onPick ? { cursor: "pointer" } : undefined}
          onClick={onPick ? () => onPick(d.label) : undefined}
        >
          <span className="name">{d.label}</span>
          <span className="track"><span className="fill" style={{ width: `${(d.value / max) * 100}%`, display: "block" }} /></span>
          <span className="num">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
