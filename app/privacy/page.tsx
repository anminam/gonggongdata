import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = { title: "개인정보처리방침 | 공공데이터 API 공지 알림" };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updated="2026년 11월 7일">
      <section>
        <p>
          공공데이터 API 공지 알림(https://gonggongdata.anminam.com, 이하 &ldquo;서비스&rdquo;)은 안미남인더하우스(대표 안훈민, 이하 &ldquo;운영자&rdquo;)가
          운영합니다. 운영자는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을 원활하게 처리하기 위해 다음과 같이 개인정보처리방침을 둡니다.
        </p>
      </section>

      <section>
        <h2>1. 처리하는 개인정보 항목과 목적</h2>
        <table>
          <thead>
            <tr><th>구분</th><th>항목</th><th>목적</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Google 로그인</td>
              <td>이메일 주소, 이름, 프로필 사진, Google 계정 식별자</td>
              <td>회원 식별, 로그인, 가입 승인</td>
            </tr>
            <tr>
              <td>카카오 로그인</td>
              <td>카카오 회원번호, 닉네임, 프로필 사진·이메일 주소(선택 항목에 동의한 경우)</td>
              <td>회원 식별, 로그인</td>
            </tr>
            <tr>
              <td>이메일 인증 (이메일이 없는 계정)</td>
              <td>이메일 주소, 인증 코드의 해시값, 시도 횟수, 발송 시각</td>
              <td>알림을 받을 이메일 확인, 메일 남용 방지</td>
            </tr>
            <tr>
              <td>알림 설정</td>
              <td>알림 수신 이메일 주소, 관심 키워드, 구독 기관, 받을 공지 유형, 알림 수신 여부, 선택한 프로필 이미지</td>
              <td>조건에 맞는 공지 알림 메일 발송</td>
            </tr>
            <tr>
              <td>발송 이력</td>
              <td>보낸 공지, 알림 사유, 받은 이메일 주소, 발송 시각</td>
              <td>중복 발송 방지, 이용자의 발송 이력 조회</td>
            </tr>
            <tr>
              <td>자동 생성 정보</td>
              <td>접속 IP 주소, 접속 시각, 브라우저 정보(호스팅·인증 서비스의 서버 기록)</td>
              <td>보안, 장애 대응, 부정 이용 방지</td>
            </tr>
          </tbody>
        </table>
        <p>서비스는 주민등록번호, 전화번호, 결제 정보 등은 수집하지 않습니다.</p>
      </section>

      <section>
        <h2>2. Google 사용자 데이터의 이용</h2>
        <ul>
          <li>일반 이용자의 Google 로그인은 기본 프로필 정보(이메일, 이름, 프로필 사진)만 요청하며, 위 1번의 목적에만 씁니다.</li>
          <li>
            운영자(관리자) 한 명은 알림 메일을 보내기 위해 자신의 Gmail 계정에 <strong>메일 보내기 권한(gmail.send)</strong>을 연결합니다.
            이 권한으로는 서비스의 알림 메일과 이메일 인증 메일을 보내기만 하며, 메일함을 읽거나 저장·수정·삭제하지 않습니다.
            연결에 쓰는 갱신 토큰은 서버에만 저장되고 브라우저로 보내지 않습니다.
          </li>
          <li>
            서비스가 Google API로 받은 정보의 사용과 다른 앱으로의 전송은{" "}
            <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API 서비스 사용자 데이터 정책
            </a>
            (제한적 사용 요건 포함)을 따릅니다. Google 사용자 데이터를 광고, 판매, AI 모델 학습에 쓰지 않습니다.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. 보유 및 이용 기간</h2>
        <ul>
          <li>회원 정보, 알림 설정, 발송 이력: 회원 탈퇴 시까지. 탈퇴하면 바로 삭제합니다.</li>
          <li>이메일 인증 기록: 인증이 끝나면 바로 삭제하며, 끝나지 않은 기록은 다음 인증 요청 때 덮어씁니다.</li>
          <li>서버 접속 기록: 호스팅·인증 서비스 제공자의 보관 정책에 따름 (보통 수일~수십 일).</li>
          <li>승인이 거절된 계정은 같은 계정의 재가입 요청을 막기 위해 탈퇴 또는 삭제 요청 전까지 보관합니다.</li>
        </ul>
      </section>

      <section>
        <h2>4. 제3자 제공</h2>
        <p>운영자는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 요구되는 경우는 예외로 합니다.</p>
      </section>

      <section>
        <h2>5. 처리 위탁 및 국외 이전</h2>
        <p>서비스 운영을 위해 아래 업체에 개인정보 처리를 맡기며, 일부는 국외에 저장됩니다. 이전은 서비스 이용 시 네트워크를 통해 수시로 이루어집니다.</p>
        <table>
          <thead>
            <tr><th>업체 (국가)</th><th>맡기는 일</th><th>이전 항목</th><th>보유 기간</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase, Inc. (서버: 인도 뭄바이)<br />support@supabase.com</td>
              <td>데이터베이스, 로그인 처리</td>
              <td>1번의 모든 항목</td>
              <td>회원 탈퇴 시까지</td>
            </tr>
            <tr>
              <td>Vercel Inc. (미국, 실행 서버: 대한민국 서울)<br />privacy@vercel.com</td>
              <td>웹사이트 호스팅, 정기 실행</td>
              <td>접속 기록, 요청 처리 중 지나가는 정보</td>
              <td>Vercel 보관 정책에 따름</td>
            </tr>
            <tr>
              <td>Google LLC (미국)</td>
              <td>Google 로그인, Gmail 발송</td>
              <td>Google 계정 정보, 수신 이메일 주소와 메일 내용</td>
              <td>Google 보관 정책에 따름</td>
            </tr>
            <tr>
              <td>(주)카카오 (대한민국)</td>
              <td>카카오 로그인</td>
              <td>카카오 회원번호, 닉네임, 프로필 사진·이메일 주소(동의한 경우)</td>
              <td>카카오 보관 정책에 따름</td>
            </tr>
          </tbody>
        </table>
        <p>국외 이전을 원하지 않으면 서비스에 가입하지 않거나 탈퇴하면 됩니다. 이 경우 서비스를 이용할 수 없습니다.</p>
      </section>

      <section>
        <h2>6. 파기 절차와 방법</h2>
        <p>
          보유 기간이 끝나거나 탈퇴하면 데이터베이스에서 지체 없이 삭제하며, 되살릴 수 없게 지웁니다. 종이로 출력한 개인정보는 없습니다.
        </p>
        <p>
          참고: 서비스의 로그인 처리(Supabase 인증)는 같은 운영자의 다른 서비스와 함께 쓰고 있어, 탈퇴해도 로그인 기록 자체(계정 식별자, 로그인 제공자, 이메일)는
          남을 수 있습니다. 이 기록까지 완전히 지우고 싶으면 아래 연락처로 요청해 주세요. 확인 후 10일 안에 삭제합니다.
        </p>
      </section>

      <section>
        <h2>7. 이용자의 권리와 행사 방법</h2>
        <ul>
          <li>이용자는 언제든지 자신의 개인정보를 조회·수정·삭제하거나 처리 정지를 요구할 수 있습니다.</li>
          <li>알림 설정과 수신 주소는 서비스의 &ldquo;알림 설정&rdquo;·&ldquo;설정&rdquo; 화면에서 직접 고칠 수 있습니다.</li>
          <li>&ldquo;설정 &gt; 회원 탈퇴&rdquo;에서 직접 탈퇴할 수 있으며, 탈퇴하면 서비스의 내 데이터가 모두 삭제됩니다.</li>
          <li>로그인할 수 없거나 승인 전인 경우 아래 연락처로 메일을 보내면 처리해 드립니다.</li>
        </ul>
      </section>

      <section>
        <h2>8. 안전성 확보 조치</h2>
        <ul>
          <li>모든 통신은 HTTPS로 암호화합니다.</li>
          <li>데이터베이스는 행 단위 접근 제어(RLS)로 본인 데이터만 읽고 고칠 수 있게 합니다.</li>
          <li>이메일 인증 코드는 원문이 아닌 해시값으로만 저장하고, 비밀 키는 서버 환경변수에만 둡니다.</li>
          <li>관리자 권한은 운영자 한 명에게만 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2>9. 쿠키 등 자동 수집 장치</h2>
        <p>
          서비스는 로그인 상태 유지와 화면 테마 저장을 위해 브라우저 저장소(쿠키·로컬 저장소)를 씁니다. 광고·분석용 쿠키는 쓰지 않습니다.
          브라우저 설정에서 저장을 막을 수 있지만, 그러면 로그인을 유지할 수 없습니다.
        </p>
      </section>

      <section>
        <h2>10. 만 14세 미만 아동</h2>
        <p>서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 알면서 수집하지 않습니다.</p>
      </section>

      <section>
        <h2>11. 개인정보 보호책임자</h2>
        <ul>
          <li>성명: 안훈민 (안미남인더하우스 대표)</li>
          <li>이메일: <a className="underline" href="mailto:minamhunmin@gmail.com">minamhunmin@gmail.com</a></li>
        </ul>
        <p>
          개인정보 침해에 대한 상담이 필요하면 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118),
          개인정보분쟁조정위원회(www.kopico.go.kr, 1833-6972)에 문의할 수 있습니다.
        </p>
      </section>

      <section>
        <h2>12. 방침의 변경</h2>
        <p>이 방침을 바꾸면 시행 7일 전에 이 페이지에 알립니다. 이용자 권리에 중요한 변경은 30일 전에 알립니다.</p>
      </section>
    </LegalPage>
  );
}
