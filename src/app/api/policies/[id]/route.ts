import { readPublicPolicies } from "../../../../features/policy/public-data.ts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return Response.json(
      { error: "invalid-policy-id" },
      { status: 400, headers },
    );
  try {
    const { items } = await readPublicPolicies({ id });
    return items[0]
      ? Response.json({ policy: items[0] }, { headers })
      : Response.json({ error: "policy-not-found" }, { status: 404, headers });
  } catch {
    return Response.json(
      { error: "policy-data-unavailable" },
      { status: 503, headers },
    );
  }
}
