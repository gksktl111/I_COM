import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { PolicyFinder } from "@/features/policy/components";
export const metadata = { title: "정책 둘러보기 | 아이콤" };
export default function PolicyPage() {
  return (
    <>
      <Header />
      <PolicyFinder />
      <Footer />
    </>
  );
}
