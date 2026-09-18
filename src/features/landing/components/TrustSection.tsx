const steps = [
  {
    title: "가족 상황 입력",
    description: "거주 지역과 찾고 있는 지원 분야를 선택합니다.",
  },
  {
    title: "관련 정책 확인",
    description: "입력한 내용과 관련된 정책부터 살펴봅니다.",
  },
  {
    title: "공식 안내 확인",
    description: "세부 자격과 신청 기간은 소관 기관에서 확인합니다.",
  },
];

export function TrustSection() {
  return (
    <section
      className="border-border bg-card border-b py-10 sm:py-12"
      aria-labelledby="steps-heading"
    >
      <div className="page-container">
        <h2
          id="steps-heading"
          className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
        >
          정책을 찾고 확인하는 순서
        </h2>
        <ol className="border-border mt-6 grid border-y md:grid-cols-3 md:divide-x">
          {steps.map(({ title, description }, index) => (
            <li
              key={title}
              className="border-border flex gap-4 border-b py-5 last:border-b-0 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0"
            >
              <span className="text-primary pt-0.5 text-sm font-semibold tabular-nums">
                {index + 1}
              </span>
              <div>
                <h3 className="text-foreground text-base font-semibold">
                  {title}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
