import { FileSearch, ListFilter, Signpost } from "lucide-react";

const benefits = [
  {
    icon: FileSearch,
    title: "흩어진 정책을 한곳에서",
    description:
      "정부와 지자체의 공개 정책을 모아 필요한 정보를 찾는 수고를 줄입니다.",
  },
  {
    icon: ListFilter,
    title: "관심 분야 중심으로",
    description:
      "거주 지역과 가족 상황, 관심 지원을 바탕으로 관련 정책을 좁혀 봅니다.",
  },
  {
    icon: Signpost,
    title: "신청 안내까지 이어서",
    description:
      "지원 내용과 대상, 신청 기간을 살펴보고 제공 기관의 안내로 이동합니다.",
  },
];

export function TrustSection() {
  return (
    <section
      className="border-border bg-card border-b py-12 sm:py-16"
      aria-labelledby="benefits-heading"
    >
      <div className="page-container">
        <div className="max-w-2xl">
          <h2
            id="benefits-heading"
            className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
          >
            찾는 시간은 줄이고, 확인할 내용은 또렷하게
          </h2>
          <p className="text-muted-foreground mt-3 text-base leading-7">
            정책을 발견하는 순간부터 실제 신청 정보를 확인하는 데 필요한 흐름을
            차분하게 이어 드립니다.
          </p>
        </div>
        <div className="mt-8 grid gap-7 md:grid-cols-3 md:gap-8">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article key={title} className="border-primary border-t-2 pt-5">
              <Icon aria-hidden="true" className="text-primary size-6" />
              <h3 className="text-foreground mt-4 text-lg leading-7 font-semibold sm:text-xl">
                {title}
              </h3>
              <p className="text-muted-foreground mt-2 text-base leading-7">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
