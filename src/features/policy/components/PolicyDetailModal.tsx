"use client";

import { useEffect, useId, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safePolicyUrl, type PublicPolicy } from "../public/types";
import { PolicyAccordion } from "./PolicyAccordion";

function PolicyField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="mb-2 text-sm font-semibold text-slate-800">{label}</dt>
      <dd className="text-sm leading-7 [overflow-wrap:anywhere] break-keep whitespace-pre-wrap text-slate-600">
        {value?.trim()
          ? value
          : `${label} 정보가 제공되지 않았어요. 공식 안내나 소관 기관에서 확인해 주세요.`}
      </dd>
    </div>
  );
}

export function PolicyDetailModal({
  policy,
  onClose,
  tags = [],
}: {
  policy: PublicPolicy | null;
  onClose: () => void;
  tags?: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = policy !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  const sourceUrl = safePolicyUrl(policy?.source_url);
  const applicationUrl = safePolicyUrl(policy?.application_url);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-lg border border-[#dce3de] bg-white p-0 text-[#182c29] shadow-[0_8px_24px_rgb(24_44_41_/_12%)] backdrop:bg-[#182c29]/40"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3 sm:px-7">
        <span className="text-sm font-semibold text-slate-600">
          정책 상세 안내
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="정책 상세 닫기"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {policy && (
        <div key={policy.id} className="space-y-5 p-5 sm:p-7">
          <header className="space-y-4">
            {!!tags.length && (
              <div className="flex flex-wrap gap-2">
                {[...new Set(tags)].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h2
              id={titleId}
              className="text-2xl leading-snug font-bold [overflow-wrap:anywhere] break-keep whitespace-pre-wrap sm:text-3xl"
            >
              {policy.name}
            </h2>
            <dl className="divide-y border-y border-slate-200">
              <div className="py-4">
                <PolicyField label="소관 기관" value={policy.provider_name} />
              </div>
              <div className="py-4">
                <PolicyField
                  label="정책 소개"
                  value={policy.summary || policy.purpose_text}
                />
              </div>
            </dl>
          </header>

          <PolicyAccordion title="지원 내용" defaultOpen>
            <dl>
              <PolicyField label="지원 혜택" value={policy.benefit_text} />
            </dl>
          </PolicyAccordion>
          <PolicyAccordion title="지원 대상 및 선정 기준">
            <dl className="space-y-5">
              <PolicyField label="지원 대상" value={policy.target_text} />
              <PolicyField label="선정 기준" value={policy.criteria_text} />
            </dl>
          </PolicyAccordion>
          <PolicyAccordion title="신청 기간 및 방법">
            <dl className="space-y-5">
              <PolicyField
                label="신청 기간"
                value={policy.application_period_text}
              />
              <PolicyField
                label="신청 방법"
                value={policy.application_method_text}
              />
              <PolicyField label="접수 기관" value={policy.reception_text} />
            </dl>
          </PolicyAccordion>
          <PolicyAccordion title="구비 서류">
            <dl>
              <PolicyField
                label="필요한 서류"
                value={policy.required_documents_text}
              />
            </dl>
          </PolicyAccordion>
          <PolicyAccordion title="문의처 및 정보 변경일">
            <dl className="space-y-5">
              <PolicyField label="문의처" value={policy.contact_text} />
              <PolicyField label="저장 정보 변경일" value={policy.updated_at} />
            </dl>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              저장 정보 변경일은 공식 검수일이나 신청 기간과 다를 수 있어요.
            </p>
          </PolicyAccordion>

          <section
            className="space-y-4 border-t border-slate-200 pt-5"
            aria-label="공식 안내 및 신청"
          >
            <p className="text-sm leading-6 text-slate-600">
              최신 신청 일정과 지원 기준은 공식 안내를 확인해 주세요. 최종 지원
              대상과 지급액은 소관 기관의 심사로 결정돼요.
            </p>
            <div className="flex flex-wrap gap-3">
              {sourceUrl && (
                <Button asChild variant="outline">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    공식 원문 보기<span className="sr-only"> (새 창)</span>
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              )}
              {applicationUrl && (
                <Button asChild>
                  <a
                    href={applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    신청 사이트로 이동<span className="sr-only"> (새 창)</span>
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              )}
            </div>
            {!sourceUrl && (
              <p className="text-xs leading-5 text-slate-500">
                이용 가능한 공식 출처 링크가 제공되지 않았어요.
              </p>
            )}
            {!applicationUrl && (
              <p className="text-xs leading-5 text-slate-500">
                온라인 신청 링크가 제공되지 않았어요. 신청 방법과 문의처를
                확인해 주세요.
              </p>
            )}
          </section>
        </div>
      )}
    </dialog>
  );
}
