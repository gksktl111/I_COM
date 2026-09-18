import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { Button } from "@/components/ui/button";
import { PolicyDetail } from "@/features/policy/components/PolicyDetail";
import { readPublicPolicies } from "@/features/policy/public-data";
export const metadata = { title: "정책 상세 안내 | 아이콤" };
export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  let result;
  try {
    result = await readPublicPolicies({ id });
  } catch {
    return (
      <>
        <Header />
        <main
          id="main-content"
          className="mx-auto min-h-[60vh] max-w-3xl px-5 py-20 text-center"
        >
          <h1 className="text-2xl font-bold">정책 정보를 불러오지 못했어요</h1>
          <p className="my-5 text-slate-500">잠시 후 다시 시도해 주세요.</p>
          <Button asChild>
            <Link href={`/policy/${id}`}>다시 시도</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/policy">정책 둘러보기</Link>
          </Button>
        </main>
        <Footer />
      </>
    );
  }
  if (!result.items[0]) notFound();
  return (
    <>
      <Header />
      <PolicyDetail policy={result.items[0]} />
      <Footer />
    </>
  );
}
