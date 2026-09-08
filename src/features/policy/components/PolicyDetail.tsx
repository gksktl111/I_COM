"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  ExternalLink,
  FileText,
  Gift,
  MapPin,
  Phone,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PolicyBookmark, PolicyNotice } from "./PolicyShared";
import type { PublicPolicy } from "../public/types";
export function PolicyDetail({ policy }: { policy: PublicPolicy }) {
  const [external, setExternal] = useState<string | null>(null);
  const [message, setMessage] = useState("");
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
  const sections = [
    {
      id: "eligibility",
      title: "지원 대상 및 선정 기준",
      Icon: Users,
      fields: [
        ["지원 대상", policy.target_text],
        ["선정 기준", policy.criteria_text],
      ],
    },
    {
      id: "benefits",
      title: "지원 내용",
      Icon: Gift,
      fields: [["어떤 지원을 받을 수 있나요?", policy.benefit_text]],
    },
    {
      id: "application",
      title: "신청 기간 및 방법",
      Icon: CalendarDays,
      fields: [
        ["신청 기간", policy.application_period_text],
        ["신청 방법", policy.application_method_text],
        ["접수 기관", policy.reception_text],
      ],
    },
    {
      id: "documents",
      title: "구비 서류",
      Icon: ClipboardList,
      fields: [["신청 전 준비해 주세요", policy.required_documents_text]],
    },
    {
      id: "contact",
      title: "문의 및 공식 출처",
      Icon: Phone,
      fields: [
        ["소관 기관", policy.provider_name],
        ["문의처", policy.contact_text],
      ],
    },
  ];
  return (
    <main id="main-content" className="bg-slate-50/60 pb-16">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-[1200px] px-5 py-7 md:px-8">
          <Link
            href="/policy"
            className="hover:text-primary inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"
          >
            <ArrowLeft className="size-4" />
            정책 둘러보기
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-primary rounded bg-teal-50 px-2 py-1 font-medium">
              공공 지원 정책
            </span>
            <span className="text-slate-500">
              {policy.provider_name || "소관 기관 확인 필요"}
            </span>
            <span className="ml-auto rounded bg-slate-100 px-2 py-1 text-slate-600">
              자격 요건 추가 확인 필요
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl text-[28px] leading-snug font-bold">
            {policy.name}
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
            {policy.summary ||
              policy.purpose_text ||
              "아래 지원 대상과 신청 방법을 확인해 주세요."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {policy.updated_at && !Number.isNaN(Date.parse(policy.updated_at))
                ? `저장 정보 변경일 ${new Date(policy.updated_at).toLocaleDateString("ko-KR")}`
                : "정보 변경일 확인 필요"}{" "}
              · 공식 검수일과 다를 수 있어요
            </p>
            <div className="flex gap-2">
              <PolicyBookmark id={policy.id} />
              <Button variant="ghost" onClick={share}>
                <Share2 />
                공유
              </Button>
            </div>
          </div>
          <p role="status" className="text-primary text-right text-xs">
            {message}
          </p>
        </div>
      </div>
      <nav
        aria-label="정책 상세 항목"
        className="sticky top-[var(--app-header-visible-height)] z-20 overflow-x-auto border-b bg-white transition-[top] duration-180"
      >
        <div className="mx-auto flex max-w-[1200px] gap-5 px-5 md:px-8">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="hover:border-primary hover:text-primary flex min-h-14 shrink-0 items-center border-b-2 border-transparent text-sm font-medium text-slate-500"
            >
              {section.title}
            </a>
          ))}
        </div>
      </nav>
      <div className="mx-auto grid max-w-[1200px] items-start gap-7 px-5 pt-7 md:px-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-6">
            <h2 className="mb-5 text-lg font-bold">지원 내용 한눈에 보기</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                ["지원 대상", policy.target_text, Users],
                ["신청 기간", policy.application_period_text, CalendarDays],
                ["소관 기관", policy.provider_name, MapPin],
              ].map(([label, text, Icon]) => {
                const SummaryIcon = Icon as typeof Users;
                return (
                  <div key={String(label)}>
                    <SummaryIcon className="text-primary mb-3 size-5" />
                    <h3 className="text-xs text-slate-500">
                      {label as string}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 font-medium">
                      {(text as string) || "공식 안내 확인 필요"}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 border-t pt-4 text-xs leading-6 text-slate-500">
              자세한 내용은 아래 원문을 확인해 주세요. 개인별 지원 금액과 자격
              여부는 자동으로 산정하지 않아요.
            </p>
          </section>
          {sections.map(({ id, title, Icon, fields }, index) => (
            <section
              id={id}
              key={id}
              className="scroll-mt-36 rounded-xl border bg-white p-6 md:scroll-mt-48 md:p-7"
            >
              <h2 className="mb-6 flex items-center gap-3 text-lg font-bold">
                <Icon className="text-primary size-5" />
                <span>
                  {index + 1}. {title}
                </span>
              </h2>
              <div className="space-y-6">
                {fields.map(([label, text]) => (
                  <div key={label}>
                    <h3 className="mb-2 text-sm font-semibold">{label}</h3>
                    <p className="text-sm leading-7 break-words whitespace-pre-wrap text-slate-600">
                      {text ||
                        "수집된 원문에 정보가 없어요. 소관 기관이나 공식 안내에서 확인해 주세요."}
                    </p>
                  </div>
                ))}
              </div>
              {id === "eligibility" && (
                <div className="mt-6 flex gap-2 border-y py-4 text-sm leading-6 text-slate-500">
                  <CircleHelp className="text-primary mt-1 size-4 shrink-0" />
                  거주 기간, 소득 산정 방식, 자녀 연령 및 예외 조건은 원문을
                  함께 확인해야 해요. 일부 조건이 맞아도 최종 자격이 확정되지는
                  않아요.
                </div>
              )}
              {id === "contact" && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {policy.source_url ? (
                    <Button
                      variant="outline"
                      onClick={() => setExternal(policy.source_url)}
                    >
                      <FileText />
                      정책 원문 출처
                      <ExternalLink />
                    </Button>
                  ) : (
                    <p className="text-sm text-slate-500">
                      제공된 공식 출처 링크가 없어요. 위 문의처를 이용해 주세요.
                    </p>
                  )}
                </div>
              )}
            </section>
          ))}
          <PolicyNotice />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-48">
          <section className="border-primary/25 rounded-xl border bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <ShieldCheck className="text-primary size-5" />
              신청 전 확인해 주세요
            </h2>
            <p className="mb-5 text-sm leading-6 text-slate-500">
              공식 안내에서 최신 접수 일정과 구비 서류를 확인한 뒤 신청해
              주세요.
            </p>
            {policy.application_url ? (
              <Button
                className="w-full"
                onClick={() => setExternal(policy.application_url)}
              >
                신청 사이트로 이동
                <ExternalLink />
              </Button>
            ) : policy.source_url ? (
              <Button
                className="w-full"
                onClick={() => setExternal(policy.source_url)}
              >
                공식 원문 확인하기
                <ExternalLink />
              </Button>
            ) : (
              <p className="border-y py-3 text-sm text-slate-500">
                온라인 신청 링크가 제공되지 않았어요. 신청 방법과 문의처를
                확인해 주세요.
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500">
              외부 사이트에서 본인 인증이 필요할 수 있어요.
            </p>
          </section>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-semibold">신청 준비 체크</h2>
            {[
              "지원 대상 및 선정 기준 확인",
              "신청 기간과 접수 기관 확인",
              "필요한 구비 서류 준비",
            ].map((text, index) => (
              <label
                key={text}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  aria-label={`${index + 1}. ${text}`}
                />
                {text}
              </label>
            ))}
            <p className="mt-3 border-t pt-3 text-xs leading-5 text-slate-500">
              체크 목록은 신청 준비를 돕기 위한 메모예요. 신청 완료를 의미하지
              않아요.
            </p>
          </section>
          <div className="border-y py-5">
            <h2 className="text-sm font-semibold">다른 지원도 궁금하신가요?</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              우리 가족의 관심 분야로 정책을 찾아보세요.
            </p>
            <Button asChild variant="link" className="mt-2 px-0">
              <Link href="/policy/match">
                맞춤 정책 찾기
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
      <Dialog
        open={external !== null}
        onClose={() => setExternal(null)}
        title="외부 안내 사이트로 이동"
      >
        {external && (
          <>
            <ExternalLink className="text-primary mb-4 size-7" />
            <p className="text-sm leading-7">
              이 정책의 원문에서 제공한{" "}
              <strong className="break-all">
                {new URL(external).hostname}
              </strong>{" "}
              사이트로 이동해요. 해당 사이트에서 최신 안내와 신청 요건을 확인해
              주세요.
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
                  <ExternalLink />
                </a>
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </main>
  );
}
