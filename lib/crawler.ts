import * as cheerio from "cheerio";

const BASE = "https://www.data.go.kr";
const LIST_URL = `${BASE}/bbs/ntc/selectNoticeListView.do?nttApiYn=Y&pageIndex=1&pageUnit=30&searchOrder=REGIST_DT`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export type ListItem = {
  notice_id: string;
  seq_no: number | null;
  org: string;
  title: string;
  api_names: string;
  registered_at: string | null;
  url: string;
};

export function detailUrl(noticeId: string) {
  return `${BASE}/bbs/ntc/selectNotice.do?originId=${encodeURIComponent(noticeId)}&nttApiYn=Y`;
}

async function get(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** API 공지사항 목록 1페이지(최신 30건) */
export async function fetchNoticeList(): Promise<ListItem[]> {
  const $ = cheerio.load(await get(LIST_URL));
  const items: ListItem[] = [];
  $("table tbody tr").each((_, tr) => {
    const row = $(tr);
    const href = row.find('td[data-label="제목"] a.title').attr("href") ?? "";
    const m = href.match(/fn_view\(\s*["']([^"']+)["']/);
    if (!m) return;
    const desc = row.find('td[data-label="제목"] .description').clone();
    desc.find("em").remove();
    const seq = parseInt(clean(row.find('td[data-label="번호"]').text()), 10);
    items.push({
      notice_id: m[1],
      seq_no: Number.isFinite(seq) ? seq : null,
      org: clean(row.find('td[data-label="기관명"]').text()),
      title: clean(row.find('td[data-label="제목"] a.title').text()),
      api_names: clean(desc.text()),
      registered_at: clean(row.find('td[data-label="등록일"]').text()) || null,
      url: detailUrl(m[1]),
    });
  });
  if (items.length === 0) throw new Error("공지 목록을 파싱하지 못했습니다 (페이지 구조 변경 가능성)");
  return items;
}

/** 상세 페이지 본문 텍스트 */
export async function fetchNoticeBody(noticeId: string): Promise<string> {
  const $ = cheerio.load(await get(detailUrl(noticeId)));
  $("script, style, header, footer, nav").remove();
  const text = clean($("body").text());
  // 본문은 "URL 복사하기" 뒤부터 "목록으로 돌아가기" 앞까지
  const start = text.indexOf("URL 복사하기");
  const end = text.indexOf("목록으로 돌아가기");
  const body = text.slice(start >= 0 ? start + "URL 복사하기".length : 0, end > 0 ? end : undefined);
  const apiList = body.lastIndexOf(" API 목록 ");
  return clean(apiList > 0 ? body.slice(0, apiList) : body).slice(0, 8000);
}
