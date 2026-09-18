import { NextResponse } from "next/server";
import { readPublicPolicies } from "@/features/policy/public-data";
export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("offset") ?? "0";
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 100000
  )
    return NextResponse.json({ error: "invalid-offset" }, { status: 400 });
  try {
    return NextResponse.json(
      await readPublicPolicies({ offset: Number(value) }),
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "policy-data-unavailable" },
      { status: 503 },
    );
  }
}
