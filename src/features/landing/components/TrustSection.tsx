import { ClipboardList, ScanSearch, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/card";

const steps = [
  {
    icon: ClipboardList,
    title: "거주 지역 및 가족 상황 입력",
    description: "거주 지역, 자녀 연령, 가구 특성을 간단히 선택해 주세요.",
  },
  {
    icon: ScanSearch,
    title: "우리 가족에게 필요한 정책 탐색",
    description:
      "입력한 관심 분야와 관련된 중앙부처 및 지역의 지원 정보를 살펴봅니다.",
  },
  {
    icon: FileCheck2,
    title: "지원 요건과 신청 방법 확인",
    description:
      "정책별 지원 내용과 신청 안내를 확인하고 공식 신청처로 이동합니다.",
  },
];
export function TrustSection() {
  return (
    <section className="py-10 sm:py-12" aria-labelledby="steps-heading">
      <div className="mb-6 text-center">
        <p className="text-primary mb-1 text-xs font-semibold">이용 프로세스</p>
        <h2 id="steps-heading" className="text-xl font-bold">
          3단계로 빠르고 간편하게
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <Card key={title} className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="bg-accent text-primary rounded px-2 py-1 text-xs font-semibold">
                STEP 0{index + 1}
              </span>
              <Icon
                aria-hidden="true"
                className="text-muted-foreground size-5"
              />
            </div>
            <h3 className="mb-2 text-base font-semibold">{title}</h3>
            <p className="text-muted-foreground text-sm leading-6">
              {description}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
