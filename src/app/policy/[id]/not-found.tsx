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
        className="min-h-[60vh] bg-[#faf8f5] px-5 py-20 max-[359px]:px-4"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-[28px] leading-snug font-bold">
            정책을 찾을 수 없어요
          </h1>
          <p className="my-5 text-base leading-7 text-slate-600">
            주소가 변경되었거나 현재 공개 중인 정책이 아닐 수 있어요.
          </p>
          <Button asChild>
            <Link href="/policy">정책 둘러보기</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
