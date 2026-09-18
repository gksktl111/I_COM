"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PolicyAccordion } from "./PolicyAccordion";
import { PolicyBookmark, PolicyNotice } from "./PolicyShared";
import { safePolicyUrl, type PublicPolicy } from "../public/types";
import styles from "./policy-public.module.css";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{label}</h3>
      <p className="text-sm leading-7 break-words whitespace-pre-wrap text-slate-600">
        {value ||
          "수집된 원문에 정보가 없습니다. 공식 안내나 소관 기관에서 확인해 주세요."}
      </p>
    </div>
  );
}

export function PolicyDetail({ policy }: { policy: PublicPolicy }) {
  const [external, setExternal] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const sourceUrl = safePolicyUrl(policy.source_url);
  const applicationUrl = safePolicyUrl(policy.application_url);

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("정책 주소를 복사했어요.");
    } catch {
      setMessage(
        "주소를 복사하지 못했어요. 브라우저 주소창의 주소를 복사해 주세요.",
      );
    }
  }

  return (
    <main id="main-content" className={`${styles.page} pb-16`}>
      <div className="border-b bg-white">
        <div className="mx-auto max-w-[1200px] px-5 py-7 max-[359px]:px-4 md:px-8">
          <Link
            href="/policy"
            className="hover:text-primary inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            정책 둘러보기
          </Link>
          <p className="mt-4 text-sm text-slate-500">
            {policy.provider_name || "소관 기관 확인 필요"}
          </p>
          <h1 className="mt-2 max-w-4xl text-[28px] leading-snug font-bold">
            {policy.name}
          </h1>
          <p className={`${styles.bodyCopy} mt-3 max-w-[760px]`}>
            {policy.summary ||
              policy.purpose_text ||
              "지원 대상과 신청 방법을 확인해 주세요."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {policy.updated_at && !Number.isNaN(Date.parse(policy.updated_at))
                ? `저장 정보 변경일 ${new Date(policy.updated_at).toLocaleDateString("ko-KR")}`
                : "정보 변경일 확인 필요"}{" "}
              · 공식 검수일과 다를 수 있습니다
            </p>
            <div className="flex gap-2">
              <PolicyBookmark id={policy.id} />
              <Button variant="ghost" onClick={share}>
                <Share2 aria-hidden="true" />
                공유
              </Button>
            </div>
          </div>
          <p role="status" className="text-primary text-right text-xs">
            {message}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] items-start gap-8 px-5 pt-8 max-[359px]:px-4 md:px-8 lg:grid-cols-[minmax(0,760px)_minmax(240px,300px)] lg:justify-between">
        <div className="space-y-5">
          <section className="border-y bg-white py-6">
            <h2 className="mb-5 text-xl font-bold">핵심 정보</h2>
            <dl className="grid gap-5 sm:grid-cols-3">
              {[
                ["지원 대상", policy.target_text],
                ["신청 기간", policy.application_period_text],
                ["소관 기관", policy.provider_name],
              ].map(([label, text]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-2 text-sm leading-6 font-medium break-words">
                    {text || "공식 안내 확인 필요"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <PolicyAccordion title="지원 내용" defaultOpen>
            <DetailField label="지원 혜택" value={policy.benefit_text} />
          </PolicyAccordion>
          <PolicyAccordion title="지원 대상 및 선정 기준">
            <div className="space-y-6">
              <DetailField label="지원 대상" value={policy.target_text} />
              <DetailField label="선정 기준" value={policy.criteria_text} />
              <p className="border-y py-4 text-sm leading-6 text-slate-500">
                거주 기간, 소득 산정 방식, 자녀 연령과 예외 조건은 원문을 함께
                확인해야 합니다. 일부 조건이 맞아도 최종 자격이 확정되지는
                않습니다.
              </p>
            </div>
          </PolicyAccordion>
          <PolicyAccordion title="신청 기간 및 방법">
            <div className="space-y-6">
              <DetailField
                label="신청 기간"
                value={policy.application_period_text}
              />
              <DetailField
                label="신청 방법"
                value={policy.application_method_text}
              />
              <DetailField label="접수 기관" value={policy.reception_text} />
            </div>
          </PolicyAccordion>
          <PolicyAccordion title="구비 서류">
            <DetailField
              label="필요한 서류"
              value={policy.required_documents_text}
            />
          </PolicyAccordion>
          <PolicyAccordion title="문의 및 공식 출처">
            <div className="space-y-6">
              <DetailField label="소관 기관" value={policy.provider_name} />
              <DetailField label="문의처" value={policy.contact_text} />
              {sourceUrl ? (
                <Button
                  variant="outline"
                  onClick={() => setExternal(sourceUrl)}
                >
                  정책 원문 출처
                  <ExternalLink aria-hidden="true" />
                </Button>
              ) : (
                <p className="text-sm text-slate-500">
                  제공된 공식 출처 링크가 없습니다. 위 문의처를 이용해 주세요.
                </p>
              )}
            </div>
          </PolicyAccordion>
          <PolicyNotice />
        </div>

        <aside className="lg:sticky lg:top-32">
          <section className="border-primary/25 border bg-white p-5">
            <h2 className="font-bold">공식 안내 확인</h2>
            <p className="my-4 text-sm leading-6 text-slate-500">
              최신 접수 일정과 구비 서류를 확인한 뒤 신청해 주세요.
            </p>
            {applicationUrl ? (
              <Button
                className="w-full"
                onClick={() => setExternal(applicationUrl)}
              >
                신청 사이트로 이동
                <ExternalLink aria-hidden="true" />
              </Button>
            ) : sourceUrl ? (
              <Button className="w-full" onClick={() => setExternal(sourceUrl)}>
                공식 원문 확인하기
                <ExternalLink aria-hidden="true" />
              </Button>
            ) : (
              <p className="border-y py-3 text-sm text-slate-500">
                온라인 신청 링크가 없습니다. 신청 방법과 문의처를 확인해 주세요.
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500">
              외부 사이트에서 본인 인증이 필요할 수 있습니다.
            </p>
          </section>
        </aside>
      </div>

      <Dialog
        open={external !== null}
        onClose={() => setExternal(null)}
        title="외부 안내 사이트로 이동"
      >
        {external && (
          <>
            <p className="text-sm leading-7">
              원문에서 제공한 <strong>{new URL(external).hostname}</strong>{" "}
              사이트로 이동합니다. 최신 안내와 신청 요건을 확인해 주세요.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setExternal(null)}>
                머무르기
              </Button>
              <Button asChild>
                <a
                  href={external}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setExternal(null)}
                >
                  새 창으로 이동
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </main>
  );
}
