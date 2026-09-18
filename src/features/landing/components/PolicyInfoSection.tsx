const policyInformation = [
  {
    term: "지원 대상",
    description: "연령·가구·지역 등 공개된 대상 조건",
  },
  {
    term: "지원 내용",
    description: "지원 방식과 제공 범위",
  },
  {
    term: "신청 정보",
    description: "신청 기간·방법·담당 기관과 공식 원문",
  },
];

export function PolicyInfoSection() {
  return (
    <section
      className="bg-card py-10 sm:py-14"
      aria-labelledby="policy-information-heading"
    >
      <div className="page-container">
        <h2
          id="policy-information-heading"
          className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
        >
          정책에서 확인할 수 있는 정보
        </h2>

        <dl className="border-border mt-6 grid border-y md:grid-cols-3 md:divide-x">
          {policyInformation.map(({ term, description }) => (
            <div
              key={term}
              className="border-border border-b py-5 last:border-b-0 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0"
            >
              <dt className="text-accent-foreground font-semibold">{term}</dt>
              <dd className="text-foreground mt-1 text-sm leading-6">
                {description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
