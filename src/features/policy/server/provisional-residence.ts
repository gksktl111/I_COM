import { DISTRICTS_BY_REGION } from "../public/districts.ts";
import type { PublicPolicy } from "../public/types.ts";

const aliases: Record<string, string[]> = {
  서울특별시: ["서울특별시", "서울시", "서울"],
  부산광역시: ["부산광역시", "부산시", "부산"],
  대구광역시: ["대구광역시", "대구시", "대구"],
  인천광역시: ["인천광역시", "인천시", "인천"],
  전남광주통합특별시: [
    "전남광주통합특별시",
    "광주광역시",
    "광주시",
    "광주",
    "전라남도",
    "전남",
  ],
  대전광역시: ["대전광역시", "대전시", "대전"],
  울산광역시: ["울산광역시", "울산시", "울산"],
  세종특별자치시: ["세종특별자치시", "세종시", "세종"],
  경기도: ["경기도", "경기"],
  강원특별자치도: ["강원특별자치도", "강원도", "강원"],
  충청북도: ["충청북도", "충북"],
  충청남도: ["충청남도", "충남"],
  전북특별자치도: ["전북특별자치도", "전라북도", "전북"],
  경상북도: ["경상북도", "경북"],
  경상남도: ["경상남도", "경남"],
  제주특별자치도: ["제주특별자치도", "제주도", "제주"],
};
function jurisdiction(text: string) {
  const value = text.trim();
  for (const [region, names] of Object.entries(aliases)) {
    const name = names.find((name) =>
      new RegExp(`^${name}(?=$|\\s|[·(/]|교육청)`).test(value),
    );
    if (!name) continue;
    const rest = value.slice(name.length).trim();
    const district = DISTRICTS_BY_REGION[region].find((district) =>
      new RegExp(`^${district}(?=$|\\s|[·(/])`).test(rest),
    );
    return { region, district };
  }
  return null;
}
/** Geographic relevance for the provisional catalog, not a finding of eligibility.
 * Provider jurisdiction is a fallback while structured, reviewed coverage is absent.
 * Do not scan arbitrary body mentions: school locations and duplicate-aid exclusions
 * can name other regions without defining the applicant's residence.
 */
export function matchesProvisionalResidence(
  policy: PublicPolicy,
  residence?: { region: string; district: string },
): boolean {
  if (!residence?.region) return true;
  const scope =
    jurisdiction(policy.provider_name ?? "") ?? jurisdiction(policy.name);
  if (!scope) return true;
  return (
    scope.region === residence.region &&
    (!residence.district ||
      !scope.district ||
      scope.district === residence.district)
  );
}
