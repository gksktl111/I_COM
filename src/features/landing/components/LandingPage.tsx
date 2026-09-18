import { HeroSection } from "./HeroSection";
import { PolicyInfoSection } from "./PolicyInfoSection";
import { Footer } from "@/components/common/Footer";

export function LandingPage() {
  return (
    <>
      <main id="main-content" className="bg-card">
        <HeroSection />
        <PolicyInfoSection />
      </main>
      <Footer />
    </>
  );
}
