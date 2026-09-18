"use client";

import { Check, MapPin } from "lucide-react";
import { Select } from "@/components/ui/select";
import { DISTRICTS_BY_REGION } from "../public/districts";
import {
  RECOMMENDATION_FIELDS,
  type ResidenceScope,
} from "../recommendation/intake";

export function RecommendationIntake({
  residence,
  category,
  onResidence,
  onCategory,
}: {
  residence: ResidenceScope;
  category: string;
  onResidence: (value: ResidenceScope) => void;
  onCategory: (value: string) => void;
}) {
  const districts = DISTRICTS_BY_REGION[residence.region] ?? [];
  return (
    <div className="mt-8 space-y-10">
      <fieldset>
        <legend className="mb-5 flex w-full flex-wrap items-center gap-2 border-b border-[#dce3de] pb-3 text-xl font-semibold text-[#182c29]">
          <MapPin size={18} aria-hidden="true" />
          현재 주민등록상 거주지{" "}
          <span className="text-sm font-normal text-slate-600">선택</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="recommendation-region"
              className="block text-sm font-semibold text-slate-800"
            >
              시·도
            </label>
            <Select
              id="recommendation-region"
              className="h-12 border-[#7b8d87] text-base shadow-none"
              value={residence.region}
              onChange={(event) =>
                onResidence({
                  ...residence,
                  region: event.target.value,
                  district: "",
                })
              }
            >
              <option value="">잘 모름 / 나중에 입력</option>
              {Object.keys(DISTRICTS_BY_REGION).map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="recommendation-district"
              className="block text-sm font-semibold text-slate-800"
            >
              시·군·구
            </label>
            <Select
              id="recommendation-district"
              className="h-12 border-[#7b8d87] text-base shadow-none"
              value={residence.district}
              disabled={!districts.length}
              searchable
              searchPlaceholder="시·군·구 검색"
              onChange={(event) =>
                onResidence({ ...residence, district: event.target.value })
              }
            >
              <option value="">
                {!residence.region
                  ? "시·도를 먼저 선택해 주세요"
                  : !districts.length
                    ? "시·군·구 구분 없음"
                    : "선택 안 함 / 나중에 입력"}
              </option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          상세 주소는 입력하지 않아도 돼요. 정책에 따라 거주 기준일을 추가로
          확인할 수 있어요.
        </p>
      </fieldset>
      <fieldset>
        <legend className="mb-5 w-full border-b border-[#dce3de] pb-3 text-xl font-semibold text-[#182c29]">
          지원 분야{" "}
          <span className="text-primary text-sm font-medium">
            필수 · 한 개 선택
          </span>
        </legend>
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="group"
          aria-label="지원 분야 선택"
        >
          {RECOMMENDATION_FIELDS.map((field) => (
            <button
              key={field.id}
              type="button"
              aria-pressed={category === field.id}
              onClick={() => onCategory(category === field.id ? "" : field.id)}
              className={`focus-visible:outline-primary flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-sm border px-4 py-3 text-left text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${category === field.id ? "border-primary ring-primary bg-[#e8f3ef] font-semibold text-[#164b46] ring-1" : "hover:border-primary border-[#7b8d87] bg-white text-slate-800 hover:bg-[#f1f3f0]"}`}
            >
              {field.label}
              <Check
                size={20}
                aria-hidden="true"
                className={
                  category === field.id ? "shrink-0" : "invisible shrink-0"
                }
              />
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          먼저 살펴볼 분야를 골라 주세요. 선택한 분야에 필요한 정보부터
          여쭤볼게요.
        </p>
      </fieldset>
    </div>
  );
}
