import Link from "next/link";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { Card } from "@/components/ui/card";

export default function GuidePage() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-container py-12">
        <h1 className="mb-3 text-[1.75rem] font-bold">아이콤 이용 안내</h1>
        <p className="text-muted-foreground mb-8">
          우리 가족의 복지 정보를 살펴보기 전에 알아두세요.
        </p>
        <div className="max-w-3xl space-y-6">
          <Card id="faq" className="scroll-mt-36">
            <h2 className="mb-4 text-xl font-bold">자주 묻는 질문</h2>
            <h3 className="font-semibold">로그인 없이 이용할 수 있나요?</h3>
            <p className="text-muted-foreground mt-2">
              정책 탐색과 주변 시설 찾기는 로그인 없이 이용할 수 있습니다. 회원
              로그인과 커뮤니티 글 작성은 준비 중입니다.
            </p>
            <h3 className="mt-5 font-semibold">
              정책을 찾으면 바로 지원받을 수 있나요?
            </h3>
            <p className="text-muted-foreground mt-2">
              검색 결과는 정보 탐색을 돕는 안내입니다. 소득·거주 기간 등 세부
              기준과 신청 시점에 따라 결과가 달라질 수 있습니다. 공식 신청처에서
              최종 자격을 확인해 주세요.
            </p>
          </Card>
          <Card id="sources" className="scroll-mt-36">
            <h2 className="mb-4 text-xl font-bold">공공데이터 출처 안내</h2>
            <p className="text-muted-foreground">
              정책별 상세 화면에서 제공 기관과 원문 링크를 확인할 수 있습니다.
              수집 시점과 실제 정책 시행 시점은 다를 수 있습니다.
            </p>
            <div className="text-primary mt-4 flex flex-wrap gap-5 underline underline-offset-4">
              <a
                href="https://www.data.go.kr/"
                target="_blank"
                rel="noreferrer"
              >
                공공데이터포털
              </a>
              <a
                href="https://www.bokjiro.go.kr/"
                target="_blank"
                rel="noreferrer"
              >
                복지로
              </a>
              <a href="https://www.gov.kr/" target="_blank" rel="noreferrer">
                정부24
              </a>
            </div>
          </Card>
          <Card id="privacy" className="scroll-mt-36">
            <h2 className="mb-4 text-xl font-bold">개인정보 이용 안내</h2>
            <p className="text-muted-foreground">
              지도에서 현재 위치 사용을 허용하면 주변 시설 검색에 위치 좌표가
              사용됩니다. 위치 권한은 브라우저 설정에서 철회할 수 있습니다.
              입력한 정책 탐색 조건에 주민등록번호, 연락처 등 직접 식별 정보는
              입력하지 마세요.
            </p>
            <p className="text-muted-foreground mt-3">
              글자 크기 설정은 이 브라우저에 저장됩니다. 회원 가입 기능은 현재
              제공하지 않습니다.
            </p>
          </Card>
          <Card id="principles" className="scroll-mt-36">
            <h2 className="mb-4 text-xl font-bold">서비스 취지 및 원칙</h2>
            <p className="text-muted-foreground">
              아이콤은 분산된 정책과 육아 시설 정보를 쉽게 찾아보도록 돕습니다.
              공식 행정기관을 대신해 신청을 접수하거나 수혜 자격을 확정하지
              않습니다.
            </p>
          </Card>
          <Card id="notice" className="scroll-mt-36">
            <h2 className="mb-4 text-xl font-bold">
              정책 정보 이용 시 유의사항
            </h2>
            <p className="text-muted-foreground">
              지원 금액, 신청 기간, 예산 및 대상 기준은 변경될 수 있습니다.
              안내가 없거나 추가 확인이 필요한 항목은 정책 원문 또는 담당
              기관에서 확인해 주세요.
            </p>
            <Link
              href="/policy"
              className="text-primary mt-4 inline-block font-semibold"
            >
              정책 둘러보기 →
            </Link>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
