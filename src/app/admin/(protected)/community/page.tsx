import { requireAdmin } from "@/features/admin/server/auth";
import { CommunityConsole } from "@/features/admin/components/CommunityConsole";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab } = await searchParams;
  return <CommunityConsole key={tab ?? "reports"} initialTab={tab} />;
}
