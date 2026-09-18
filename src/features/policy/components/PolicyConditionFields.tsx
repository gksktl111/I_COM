"use client";
import { Baby, GraduationCap, Heart, Home, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  FAMILY,
  HOUSEHOLD,
  INTERESTS,
  questionProfile,
  selectInterest,
  type PolicyConditions,
} from "../public/types";
import { useId, type ReactNode } from "react";
import { DISTRICTS_BY_REGION } from "../public/districts";
export function FieldSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card role="group" aria-label={title} className="p-5 shadow-none md:p-7">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {description && (
        <p className="mb-5 text-sm leading-6 text-slate-500">{description}</p>
      )}
      {children}
    </Card>
  );
}
function MultiChoice({
  options,
  values,
  onChange,
  exclusive = [],
}: {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  exclusive?: string[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const selected = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(
                selected
                  ? values.filter((value) => value !== option)
                  : exclusive.includes(option)
                    ? [option]
                    : [
                        ...values.filter((value) => !exclusive.includes(value)),
                        option,
                      ],
              )
            }
            className={`flex min-h-16 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm ${selected ? "border-primary text-primary bg-teal-50/60 font-semibold" : "hover:border-primary bg-white"}`}
          >
            <span>{option}</span>
            <span
              aria-hidden="true"
              className={`flex size-4 shrink-0 items-center justify-center rounded border text-xs ${selected ? "border-primary bg-primary text-white" : "border-slate-300"}`}
            >
              {selected ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
export function PolicyConditionFields({
  value,
  onChange,
  step,
}: {
  value: PolicyConditions;
  onChange: (value: PolicyConditions) => void;
  step: 1 | 2;
}) {
  const fieldId = useId();
  const profile = questionProfile(value);
  const districts = DISTRICTS_BY_REGION[value.region] ?? [];
  const set = <K extends keyof PolicyConditions>(
    key: K,
    next: PolicyConditions[K],
  ) => onChange({ ...value, [key]: next });
  if (step === 1)
    return (
      <div className="space-y-5">
        <FieldSection
          title="관심 있는 지원 분야를 선택해 주세요"
          description="관심 분야를 하나 선택해 주세요. (필수)"
        >
          <div
            role="radiogroup"
            aria-label="관심 있는 지원 분야"
            aria-required="true"
            className="grid gap-3 sm:grid-cols-2"
          >
            {INTERESTS.map((interest, index) => {
              const Icon = [Baby, Heart, Heart, Heart, GraduationCap, Home][
                index
              ];
              const selected = value.interests.includes(interest);
              return (
                <label
                  key={interest}
                  className={`focus-within:ring-primary/30 flex min-h-24 cursor-pointer items-start gap-3 rounded-lg border p-4 text-left focus-within:ring-2 ${selected ? "border-primary text-primary bg-teal-50/60" : "hover:border-primary"}`}
                >
                  <Icon className="mt-1 size-5" />
                  <span className="text-sm font-semibold">
                    {interest}
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {
                        [
                          "임신 준비부터 출산 지원까지",
                          "아이의 성장을 위한 양육 지원",
                          "함께 돌보는 든든한 일상",
                          "가족의 건강을 위한 지원",
                          "아이의 교육비와 학습을 위한 지원",
                          "안정적인 생활을 위한 지원",
                        ][index]
                      }
                    </span>
                  </span>
                  <input
                    type="radio"
                    name={`${fieldId}-interest`}
                    aria-label={interest}
                    value={interest}
                    checked={selected}
                    required
                    className="accent-primary mt-1 ml-auto size-4 shrink-0"
                    onChange={() => onChange(selectInterest(value, interest))}
                  />
                </label>
              );
            })}
          </div>
        </FieldSection>
        {value.interests.length > 0 && (
          <>
            <FieldSection
              title="주민등록상 거주지"
              description="지원 정책의 지역 기준을 확인하기 위한 정보예요. 상세 주소는 입력하지 않아도 돼요."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                  <label htmlFor={`${fieldId}-region`}>시·도</label>
                  <Select
                    id={`${fieldId}-region`}
                    value={value.region}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        region: event.target.value,
                        district: "",
                      })
                    }
                  >
                    <option value="">잘 모름 / 건너뛰기</option>
                    {Object.keys(DISTRICTS_BY_REGION).map((region) => (
                      <option key={region}>{region}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                  <label htmlFor={`${fieldId}-district`}>시·군·구</label>
                  <Select
                    id={`${fieldId}-district`}
                    value={value.district}
                    onChange={(event) => set("district", event.target.value)}
                    disabled={!districts.length}
                    searchable
                    searchPlaceholder="시·군·구 검색"
                  >
                    <option value="">
                      {!value.region
                        ? "시·도를 먼저 선택해 주세요"
                        : !districts.length
                          ? "시·군·구 구분 없음"
                          : "선택 안 함 / 건너뛰기"}
                    </option>
                    {districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                실거주지와 주민등록상 주소가 다른 경우, 정책별 기준을 확인해
                주세요.
              </p>
            </FieldSection>
          </>
        )}
      </div>
    );
  return (
    <div className="space-y-5">
      {value.interests.includes("임신·출산") && (
        <FieldSection
          title="현재 어떤 가족 상황에 해당하시나요?"
          description="현재 가장 해당하는 가족 상황 하나를 선택해 주세요."
        >
          <div
            role="radiogroup"
            aria-label="현재 가족 상황"
            className="grid gap-3 sm:grid-cols-2"
          >
            {FAMILY.map((family) => {
              const selected = value.family[0] === family;
              return (
                <label
                  key={family}
                  className={`focus-within:ring-primary/30 flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm focus-within:ring-2 ${selected ? "border-primary text-primary bg-teal-50/60 font-semibold" : "hover:border-primary bg-white"}`}
                >
                  <span>{family}</span>
                  <input
                    type="radio"
                    name={`${fieldId}-family`}
                    value={family}
                    checked={selected}
                    className="accent-primary size-4 shrink-0"
                    onChange={() =>
                      onChange({
                        ...value,
                        family: [family],
                        birthTiming:
                          family === "임신 중" ? value.birthTiming : "unknown",
                        pregnancy:
                          family === "임신 중"
                            ? "yes"
                            : value.pregnancy === "yes"
                              ? "unknown"
                              : value.pregnancy,
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        </FieldSection>
      )}
      {value.interests[0] === "임신·출산" &&
        value.family.includes("임신 중") && (
          <FieldSection
            title="출산 준비 정보"
            description="알고 있는 정보만 선택해 주세요. 모든 항목은 건너뛸 수 있어요."
          >
            <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              <label htmlFor={`${fieldId}-birthTiming`}>출산 예정 시기</label>
              <Select
                id={`${fieldId}-birthTiming`}
                value={value.birthTiming}
                onChange={(event) => set("birthTiming", event.target.value)}
              >
                <option value="unknown">잘 모름 / 건너뛰기</option>
                <option value="within3months">3개월 이내</option>
                <option value="3to6months">3~6개월</option>
                <option value="after6months">6개월 이후</option>
              </Select>
            </div>
          </FieldSection>
        )}
      {value.interests[0] === "돌봄" && (
        <FieldSection
          title="필요한 돌봄"
          description="필요한 지원을 선택해 주세요. 모든 항목은 건너뛸 수 있어요."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              <label htmlFor={`${fieldId}-careTime`}>돌봄이 필요한 시간</label>
              <Select
                id={`${fieldId}-careTime`}
                value={value.careTime}
                onChange={(event) => set("careTime", event.target.value)}
              >
                <option value="unknown">잘 모름 / 건너뛰기</option>
                <option value="weekday">평일 낮</option>
                <option value="evening">저녁·야간</option>
                <option value="weekend">주말·공휴일</option>
                <option value="irregular">일정하지 않음</option>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              <label htmlFor={`${fieldId}-careType`}>돌봄 유형</label>
              <Select
                id={`${fieldId}-careType`}
                value={value.careType}
                onChange={(event) => set("careType", event.target.value)}
              >
                <option value="unknown">잘 모름 / 건너뛰기</option>
                <option value="visit">가정 방문 돌봄</option>
                <option value="center">시설·센터 돌봄</option>
                <option value="afterschool">방과 후 돌봄</option>
                <option value="emergency">긴급·일시 돌봄</option>
              </Select>
            </div>
          </div>
        </FieldSection>
      )}
      {value.interests[0] === "의료·건강" && (
        <FieldSection
          title="필요한 의료·건강 지원"
          description="필요한 지원을 선택해 주세요. 진단명 등 상세한 건강 정보는 입력하지 않아도 돼요."
        >
          <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
            <label htmlFor={`${fieldId}-healthNeed`}>의료·건강 지원 유형</label>
            <Select
              id={`${fieldId}-healthNeed`}
              value={value.healthNeed}
              onChange={(event) => set("healthNeed", event.target.value)}
            >
              <option value="unknown">잘 모름 / 건너뛰기</option>
              <option value="checkup">건강검진</option>
              <option value="vaccination">예방접종</option>
              <option value="treatment">진료·치료</option>
              <option value="medical-cost">의료비 지원</option>
              <option value="rehab">재활 지원</option>
            </Select>
          </div>
        </FieldSection>
      )}
      {value.interests[0] === "주거·생활지원" && (
        <FieldSection
          title="주거·생활 지원 정보"
          description="현재 상황과 필요한 지원을 선택해 주세요. 모든 항목은 건너뛸 수 있어요."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              <label htmlFor={`${fieldId}-housingType`}>현재 주거 형태</label>
              <Select
                id={`${fieldId}-housingType`}
                value={value.housingType}
                onChange={(event) => set("housingType", event.target.value)}
              >
                <option value="unknown">잘 모름 / 건너뛰기</option>
                <option value="owner">자가</option>
                <option value="jeonse">전세</option>
                <option value="monthly">월세</option>
                <option value="public">공공임대</option>
                <option value="other">기타</option>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              <label htmlFor={`${fieldId}-livingNeed`}>필요한 생활 지원</label>
              <Select
                id={`${fieldId}-livingNeed`}
                value={value.livingNeed}
                onChange={(event) => set("livingNeed", event.target.value)}
              >
                <option value="unknown">잘 모름 / 건너뛰기</option>
                <option value="rent">주거비·임대료</option>
                <option value="move">이사·주거 마련</option>
                <option value="utilities">공과금·에너지 비용</option>
                <option value="living">생활비</option>
              </Select>
            </div>
          </div>
        </FieldSection>
      )}
      {profile.children && (
        <FieldSection
          title="자녀 정보"
          description="정확한 생년월일을 모르면 출생월만 입력하거나 건너뛰어도 괜찮아요. 연령 경계는 추가 확인이 필요할 수 있어요."
        >
          <div className="space-y-4">
            {value.children.map((child, index) => (
              <div
                key={child.id}
                className="rounded-lg border bg-slate-50/60 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Baby className="text-primary size-4" />
                    자녀 {index + 1}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`자녀 ${index + 1} 삭제`}
                    onClick={() =>
                      set(
                        "children",
                        value.children.filter((item) => item.id !== child.id),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2 text-xs text-slate-600">
                    <label htmlFor={`${fieldId}-precision-${child.id}`}>
                      입력할 수 있는 정보
                    </label>
                    <Select
                      id={`${fieldId}-precision-${child.id}`}
                      value={child.precision}
                      onChange={(event) =>
                        set(
                          "children",
                          value.children.map((item) =>
                            item.id === child.id
                              ? {
                                  ...item,
                                  precision: event.target
                                    .value as typeof child.precision,
                                  birth: "",
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="date">정확한 생년월일</option>
                      <option value="month">출생 연월</option>
                      <option value="unknown">잘 모름 / 건너뛰기</option>
                    </Select>
                  </div>
                  {child.precision !== "unknown" && (
                    <div className="flex min-w-0 flex-col gap-2 text-xs text-slate-600">
                      <label htmlFor={`${fieldId}-birth-${child.id}`}>
                        {child.precision === "date" ? "생년월일" : "출생 연월"}
                      </label>
                      <Input
                        id={`${fieldId}-birth-${child.id}`}
                        type={child.precision}
                        max={new Date()
                          .toISOString()
                          .slice(0, child.precision === "date" ? 10 : 7)}
                        value={child.birth}
                        onChange={(event) =>
                          set(
                            "children",
                            value.children.map((item) =>
                              item.id === child.id
                                ? { ...item, birth: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                  {profile.childcare && (
                    <div className="flex min-w-0 flex-col gap-2 text-xs text-slate-600">
                      <label htmlFor={`${fieldId}-care-${child.id}`}>
                        보육·교육 이용 현황
                      </label>
                      <Select
                        id={`${fieldId}-care-${child.id}`}
                        value={child.care}
                        onChange={(event) =>
                          set(
                            "children",
                            value.children.map((item) =>
                              item.id === child.id
                                ? { ...item, care: event.target.value }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="unknown">잘 모름 / 건너뛰기</option>
                        <option value="home">가정 양육</option>
                        <option value="nursery">어린이집</option>
                        <option value="kindergarten">유치원</option>
                        <option value="school">학교</option>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            className="mt-4 w-full border-dashed"
            variant="outline"
            onClick={() =>
              set("children", [
                ...value.children,
                {
                  id: Date.now(),
                  precision: "date",
                  birth: "",
                  care: "unknown",
                },
              ])
            }
          >
            <Plus />
            자녀 추가하기
          </Button>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2 text-sm">
              <label htmlFor={`${fieldId}-totalChildren`}>
                실제 총자녀 수 (선택)
              </label>
              <Input
                id={`${fieldId}-totalChildren`}
                type="number"
                min={0}
                max={30}
                value={value.totalChildren}
                onChange={(event) => set("totalChildren", event.target.value)}
                placeholder="모르면 비워 두세요"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 text-sm">
              <label htmlFor={`${fieldId}-childrenComplete`}>
                모든 자녀를 입력했나요?
              </label>
              <Select
                id={`${fieldId}-childrenComplete`}
                value={value.childrenComplete}
                onChange={(event) =>
                  set("childrenComplete", event.target.value)
                }
              >
                <option value="unknown">확인 필요 / 건너뛰기</option>
                <option value="yes">예, 모두 입력했어요</option>
                <option value="no">아직 일부만 입력했어요</option>
              </Select>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            등록한 자녀 {value.children.length}명 · 등록된 수를 총자녀 수나
            출생순위로 판단하지 않아요.
          </p>
        </FieldSection>
      )}
      {profile.household && (
        <FieldSection
          title="가족 및 가구 특성"
          description="해당하는 항목을 함께 선택해 주세요. 선택만으로 공식 지원 자격이 인정되는 것은 아니에요."
        >
          <MultiChoice
            options={[...HOUSEHOLD, "해당 없음", "잘 모름 / 건너뛰기"]}
            values={value.household}
            onChange={(values) => set("household", values)}
            exclusive={["해당 없음", "잘 모름 / 건너뛰기"]}
          />
        </FieldSection>
      )}
      <FieldSection
        title="소득 및 복지 대상 여부"
        description="정책마다 소득 산정 방식이 달라요. 월급을 중위소득 비율로 자동 환산하지 않으며, 아는 정보만 입력해 주세요."
      >
        <h3 className="mb-3 text-sm font-semibold">
          법정 복지 대상 인정 여부 (복수 선택)
        </h3>
        <MultiChoice
          options={[
            "국민기초생활수급자",
            "차상위계층",
            "한부모가족지원법 대상",
            "해당 없음",
            "잘 모름 / 건너뛰기",
          ]}
          values={value.welfare}
          onChange={(values) => set("welfare", values)}
          exclusive={["해당 없음", "잘 모름 / 건너뛰기"]}
        />
        <div className="mt-6 space-y-4">
          <div className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
            <label htmlFor={`${fieldId}-incomeBasis`}>소득 산정 기준</label>
            <Select
              id={`${fieldId}-incomeBasis`}
              value={value.incomeBasis}
              onChange={(event) =>
                onChange({
                  ...value,
                  incomeBasis: event.target.value,
                  income: "unknown",
                })
              }
            >
              <option value="unknown">잘 모름 / 건너뛰기</option>
              <option value="median">기준 중위소득 비율</option>
            </Select>
          </div>
          {value.incomeBasis === "median" && (
            <div className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
              <label htmlFor={`${fieldId}-income`}>
                알고 있는 중위소득 구간
              </label>
              <Select
                id={`${fieldId}-income`}
                value={value.income}
                onChange={(event) => set("income", event.target.value)}
              >
                <option value="unknown">잘 모름 / 건너뛰기</option>
                <option value="under80">80% 이하</option>
                <option value="80to100">80% 초과 ~ 100% 이하</option>
                <option value="100to150">100% 초과 ~ 150% 이하</option>
                <option value="over150">150% 초과</option>
              </Select>
            </div>
          )}
          <p className="text-xs leading-5 text-slate-500">
            기준 연도, 가구원 수와 소득 인정액 산정 방식은 신청할 정책의 공식
            기준을 확인해 주세요.
          </p>
        </div>
      </FieldSection>
      <div className="border-y py-5 text-sm leading-6 text-slate-500">
        <strong className="block text-slate-700">
          정책별 추가 조건은 상세 화면에서 확인해 주세요
        </strong>
        거주 기간, 시설 이용 여부, 출생신고 등은 정책마다 달라요. 아직 검수되지
        않은 자격 기준은 추가 질문에 답하더라도 확정 판정하지 않아요.
      </div>
    </div>
  );
}
