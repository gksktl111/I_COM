import Link from "next/link";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { Button } from "@/components/ui/button";
export default function PolicyNotFound() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="mx-auto min-h-[60vh] max-w-3xl px-5 py-20 text-center"
      >
        <h1 className="text-2xl font-bold">정책을 찾을 수 없어요</h1>
        <p className="my-5 text-slate-500">
          주소가 변경되었거나 현재 안내 중인 정책이 아닐 수 있어요.
        </p>
        <Button asChild>
          <Link href="/policy">정책 둘러보기</Link>
        </Button>
      </main>
      <Footer />
    </>
  );
}
