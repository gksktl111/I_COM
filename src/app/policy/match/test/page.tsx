import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { RecommendationPlayground } from "@/features/policy/components/RecommendationPlayground";
export const metadata = {
  title: "맞춤 진단 체험 | 아이콤",
  robots: { index: false, follow: false },
};
export default function RecommendationTestPage() {
  return (
    <>
      <Header />
      <RecommendationPlayground testMode />
      <Footer />
    </>
  );
}
