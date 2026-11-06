import { ImageResponse } from "next/og";

// 카카오톡·SNS 공유 미리보기 이미지 (빌드 때 한 번 생성)
export const alt = "공공데이터 API 공지 알림";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "공공데이터 API 공지 알림";
const DESC = "관심 키워드가 담긴 공지를 메일로 바로 받아보세요";
const TAG = "공공데이터포털 공지 키워드 알림";

// 기본 폰트는 한글이 깨지므로 Noto Sans KR을 쓰는 글자만 받아온다
async function loadFont(text: string) {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@800&text=${encodeURIComponent(text)}`)
  ).text();
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("OG 이미지용 한글 폰트를 불러오지 못했습니다");
  return (await fetch(url)).arrayBuffer();
}

export default async function Image() {
  const font = await loadFont(TITLE + DESC + TAG);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", background: "#0A0A0A", color: "#fff", fontFamily: "Noto" }}>
        <svg width="96" height="96" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#fff" />
          <path d="M16 6.5a1.3 1.3 0 0 1 1.3 1.3v.5c3 .6 5 3.2 5 6.3v3.2l1.7 2.6c.3.5 0 1.1-.6 1.1H8.6c-.6 0-.9-.6-.6-1.1l1.7-2.6v-3.2c0-3.1 2-5.7 5-6.3v-.5A1.3 1.3 0 0 1 16 6.5z" fill="#0A0A0A" />
          <path d="M13.6 23.2h4.8a2.4 2.4 0 0 1-4.8 0z" fill="#0A0A0A" />
        </svg>
        <div style={{ marginTop: 48, fontSize: 28, color: "#818CF8" }}>{TAG}</div>
        <div style={{ marginTop: 12, fontSize: 76, lineHeight: 1.2 }}>{TITLE}</div>
        <div style={{ marginTop: 20, fontSize: 36, color: "#A3A3A3" }}>{DESC}</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Noto", data: font, weight: 800 }] },
  );
}
