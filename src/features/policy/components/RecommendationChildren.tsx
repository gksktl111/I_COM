"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { ChildProfile } from "../recommendation/intake";

export function RecommendationChildren({
  profiles,
  onChange,
  onAdd,
}: {
  profiles: ChildProfile[];
  onChange: (profiles: ChildProfile[]) => void;
  onAdd: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 1900 + 1 },
    (_, index) => currentYear - index,
  );
  function update(id: string, patch: Partial<ChildProfile>) {
    onChange(
      profiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile,
      ),
    );
  }
  return (
    <fieldset className="mt-10 min-w-0">
      <legend className="mb-4 w-full border-b border-[#dce3de] pb-3 text-xl font-semibold text-[#182c29]">
        자녀 정보{" "}
        <span className="text-primary text-sm font-medium">
          한 명 이상 추가
        </span>
      </legend>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        추천받을 자녀를 입력해 주세요. 성별·출생연도는 모르면 비워둘 수 있어요.
      </p>
      <div className="space-y-4">
        {profiles.map((profile, index) => (
          <section
            key={profile.id}
            aria-label={`자녀 ${index + 1} 정보`}
            className="rounded-lg border border-[#dce3de] bg-white p-4 sm:p-5"
          >
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 className="font-semibold text-slate-900">자녀 {index + 1}</h2>
              <button
                type="button"
                aria-label={`자녀 ${index + 1} 삭제`}
                className="focus-visible:outline-primary flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() =>
                  onChange(profiles.filter((child) => child.id !== profile.id))
                }
              >
                <Trash2 size={16} aria-hidden="true" />
                삭제
              </button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p
                  id={`${profile.id}-sex-label`}
                  className="mb-2 text-sm font-semibold text-slate-800"
                >
                  성별
                </p>
                <div
                  role="group"
                  aria-labelledby={`${profile.id}-sex-label`}
                  className="flex gap-2"
                >
                  {(
                    [
                      { value: "MALE", label: "남" },
                      { value: "FEMALE", label: "여" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={profile.sex === option.value}
                      onClick={() =>
                        update(profile.id, {
                          sex:
                            profile.sex === option.value ? null : option.value,
                        })
                      }
                      className={`focus-visible:outline-primary flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border px-3 py-3 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${profile.sex === option.value ? "border-primary ring-primary bg-[#e8f3ef] font-semibold text-[#164b46] ring-1" : "hover:border-primary border-[#7b8d87] bg-white text-slate-800 hover:bg-[#f1f3f0]"}`}
                    >
                      {option.label}
                      {profile.sex === option.value && (
                        <Check size={15} aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  선택한 항목을 다시 누르면 해제돼요.
                </p>
              </div>
              <div className="min-w-0 space-y-2">
                <label
                  htmlFor={`${profile.id}-birth-year`}
                  className="block text-sm font-semibold text-slate-800"
                >
                  출생연도
                </label>
                <Select
                  id={`${profile.id}-birth-year`}
                  className="h-12 border-[#7b8d87] text-base shadow-none"
                  value={
                    profile.birthYear === null ? "" : String(profile.birthYear)
                  }
                  searchable
                  searchPlaceholder="출생연도 검색"
                  onChange={(event) =>
                    update(profile.id, {
                      birthYear: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">모름 / 선택 안 함</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </section>
        ))}
        {!profiles.length && (
          <p
            role="status"
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"
          >
            입력된 자녀가 없어요. 아래에서 자녀를 추가해 주세요.
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={profiles.length >= 30}
        onClick={onAdd}
        className="text-primary hover:border-primary focus-visible:outline-primary border-primary mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-sm border bg-white px-4 py-3 text-base font-semibold transition-colors hover:bg-[#e8f3ef] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={18} aria-hidden="true" />
        자녀 추가{profiles.length >= 30 ? " (최대 30명)" : ""}
      </button>
    </fieldset>
  );
}
