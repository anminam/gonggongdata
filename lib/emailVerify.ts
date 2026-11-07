import { createHash, randomInt, timingSafeEqual } from "node:crypto";

// 이메일 인증 코드 규칙 (카카오처럼 이메일 없이 가입한 사용자용)
export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
export const RESEND_GAP_MS = 60_000;
export const DAY_MS = 24 * 60 * 60_000;
export const MAX_PER_DAY = 10;
// 카카오 계정을 여러 개 만들어 관리자 Gmail로 아무 주소에나 코드를 보내는 것을 막는 전체 제한
export const HOUR_MS = 60 * 60_000;
export const MAX_SENDERS_PER_HOUR = 20; // 최근 1시간 동안 코드를 받은 (다른) 계정 수
export const MAX_OTHERS_SAME_EMAIL_PER_DAY = 2; // 같은 주소로 최근 24시간에 코드를 보낸 다른 계정 수

export type VerificationRow = {
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  sent_at: string;
  window_start: string;
  window_count: number;
};

export function normalizeEmail(s: string) {
  const e = s.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

export const makeCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

// shortcut: 소금 없는 SHA-256(사용자 id + 코드). 표는 service role만 읽을 수 있고 시도 횟수를 막으므로 충분, 표가 공개되면 HMAC로 바꿀 것
export const hashCode = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

/** 지금 새 코드를 보내도 되는지. 안 되면 사용자에게 보일 이유를 돌려준다. 되면 저장할 횟수 창을 돌려준다 */
export function sendWindow(prev: VerificationRow | null, now: number): { error: string } | { window_start: string; window_count: number } {
  if (!prev) return { window_start: new Date(now).toISOString(), window_count: 1 };
  const wait = Date.parse(prev.sent_at) + RESEND_GAP_MS - now;
  if (wait > 0) return { error: `${Math.ceil(wait / 1000)}초 후에 다시 보낼 수 있어요.` };
  if (now - Date.parse(prev.window_start) >= DAY_MS) return { window_start: new Date(now).toISOString(), window_count: 1 };
  if (prev.window_count >= MAX_PER_DAY) return { error: "오늘은 인증 코드를 더 보낼 수 없어요. 내일 다시 시도해 주세요." };
  return { window_start: prev.window_start, window_count: prev.window_count + 1 };
}

/** 계정 여러 개를 이용한 남용인지. 막아야 하면 사용자에게 보일 이유를 돌려준다 */
export function abuseCheck({ othersLastHour, othersSameEmailToday }: { othersLastHour: number; othersSameEmailToday: number }): string | null {
  if (othersSameEmailToday >= MAX_OTHERS_SAME_EMAIL_PER_DAY) return "이 주소로는 오늘 더 보낼 수 없어요. 다른 주소를 쓰거나 내일 다시 시도해 주세요.";
  if (othersLastHour >= MAX_SENDERS_PER_HOUR) return "지금은 인증 요청이 많아요. 잠시 후 다시 시도해 주세요.";
  return null;
}

/** 입력한 코드 확인 결과 */
export function checkCode(row: VerificationRow | null, userId: string, code: string, now: number): "ok" | "none" | "expired" | "locked" | "wrong" {
  if (!row) return "none";
  if (Date.parse(row.expires_at) <= now) return "expired";
  if (row.attempts >= MAX_ATTEMPTS) return "locked";
  const a = Buffer.from(hashCode(userId, code.trim()));
  const b = Buffer.from(row.code_hash);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "wrong";
}
