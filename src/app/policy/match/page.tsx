import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { CategoryRecommendation } from "@/features/policy/components/CategoryRecommendation";
export const metadata = { title: "맞춤 정책 찾기 | 아이콤" };
export default function PolicyMatchPage() {
  return (
    <>
      <Header />
      <CategoryRecommendation />
      <Footer />
    </>
  );
}
