import { readPublicPolicies } from "../../../features/policy/public-data.ts";
import {
  createCategoryRecommendationService,
  createCompletePublicCatalogLoader,
} from "../../../features/policy/server/category-recommendation.ts";
import { readReviewedRecommendationCatalog as readRecommendationCatalog } from "../../../features/policy/server/released-catalog.ts";
import { createGuidedRecommendationService } from "../../../features/policy/server/guided-recommendation.ts";
import {
  createRecommendationService,
  readRecommendationRequest,
  recommendationErrorResponse,
} from "../../../features/policy/server/recommendation-service.ts";

const recommend = createRecommendationService({
  loadCatalog: readRecommendationCatalog,
});
const recommendProvisional = createCategoryRecommendationService({
  loadPolicies: createCompletePublicCatalogLoader(readPublicPolicies),
});
const recommendCategory = createGuidedRecommendationService({
  loadCatalog: readRecommendationCatalog,
  recommendProvisional,
});
export async function POST(request: Request) {
  try {
    const input = await readRecommendationRequest(request);
    const categoryFlow =
      !!input &&
      typeof input === "object" &&
      "flow" in input &&
      input.flow === "CATEGORY_BANK_V1";
    return Response.json(
      await (categoryFlow ? recommendCategory(input) : recommend(input)),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return recommendationErrorResponse(error);
  }
}
