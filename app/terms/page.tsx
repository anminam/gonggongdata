import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = { title: "이용약관 | 공공데이터 API 공지 알림" };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" updated="2026년 11월 7일">
      <section>
        <h2>제1조 (목적)</h2>
        <p>
          이 약관은 개인 개발자 안훈민(이하 &ldquo;운영자&rdquo;)이 제공하는 공공데이터 API 공지 알림(https://gonggongdata.anminam.com, 이하 &ldquo;서비스&rdquo;)의
          이용 조건과 절차, 운영자와 이용자의 권리·의무를 정합니다.
        </p>
      </section>

      <section>
        <h2>제2조 (서비스 내용)</h2>
        <ul>
          <li>공공데이터포털(data.go.kr)에 공개된 API 공지사항을 하루 한 번 모아 유형별로 정리합니다.</li>
          <li>이용자가 등록한 키워드·기관·공지 유형에 맞는 공지를 이메일로 알려 드립니다.</li>
          <li>서비스는 무료이며, 공공데이터포털의 공식 서비스가 아닙니다.</li>
        </ul>
      </section>

      <section>
        <h2>제3조 (가입과 승인)</h2>
        <ol>
          <li>이용자는 Google 또는 카카오 계정으로 로그인해 가입을 요청합니다.</li>
          <li>이메일 정보가 없는 계정은 알림을 받을 이메일을 인증해야 합니다.</li>
          <li>운영자는 가입 요청을 승인하거나 거절할 수 있으며, 승인된 이용자만 서비스를 쓸 수 있습니다.</li>
          <li>가입하면 이 약관과 개인정보처리방침에 동의한 것으로 봅니다.</li>
        </ol>
      </section>

      <section>
        <h2>제4조 (이용자의 의무)</h2>
        <ul>
          <li>본인이 받을 수 있는 이메일 주소만 수신 주소로 등록해야 합니다. 다른 사람의 주소를 동의 없이 등록하면 안 됩니다.</li>
          <li>서비스의 메일 발송 기능을 스팸이나 남용 목적으로 쓰면 안 됩니다.</li>
          <li>서비스에 비정상적인 부하를 주거나 보안을 우회하려 해서는 안 됩니다.</li>
        </ul>
      </section>

      <section>
        <h2>제5조 (이용 제한)</h2>
        <p>이용자가 제4조를 어기면 운영자는 미리 알리고(급한 경우 사후에 알리고) 이용을 정지하거나 승인을 취소할 수 있습니다.</p>
      </section>

      <section>
        <h2>제6조 (서비스의 변경·중단)</h2>
        <ul>
          <li>운영자는 서비스 내용을 바꾸거나 점검·장애·공공데이터포털 구조 변경 등으로 서비스를 일시 중단할 수 있습니다.</li>
          <li>서비스를 완전히 끝낼 때에는 30일 전에 서비스 화면에 알립니다.</li>
        </ul>
      </section>

      <section>
        <h2>제7조 (책임의 한계)</h2>
        <ul>
          <li>
            서비스가 보내는 공지 요약(유형·영향·조치)은 공지 내용을 자동으로 분류한 참고 정보입니다. 정확한 내용은 반드시 공공데이터포털 원문을 확인해야 합니다.
          </li>
          <li>
            서비스는 무료로 제공되며, 운영자는 고의 또는 중대한 과실이 없는 한 공지 누락·지연·분류 오류, 메일 미수신으로 생긴 손해에 책임을 지지 않습니다.
          </li>
          <li>공공데이터포털이 제공하는 공지의 내용과 정확성은 공공데이터포털에 책임이 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2>제8조 (탈퇴)</h2>
        <p>
          이용자는 언제든지 &ldquo;설정 &gt; 회원 탈퇴&rdquo;에서 탈퇴할 수 있습니다. 탈퇴하면 서비스의 이용자 데이터는 바로 삭제되며, 자세한 내용은 개인정보처리방침을 따릅니다.
        </p>
      </section>

      <section>
        <h2>제9조 (약관의 변경)</h2>
        <p>운영자는 약관을 바꿀 수 있으며, 시행 7일 전(이용자에게 불리한 변경은 30일 전)에 이 페이지에 알립니다.</p>
      </section>

      <section>
        <h2>제10조 (준거법)</h2>
        <p>이 약관은 대한민국 법을 따르며, 분쟁은 민사소송법에 따른 관할 법원에서 해결합니다.</p>
      </section>

      <section>
        <h2>문의</h2>
        <p>
          <a className="underline" href="mailto:minamhunmin@gmail.com">minamhunmin@gmail.com</a>
        </p>
      </section>
    </LegalPage>
  );
}
