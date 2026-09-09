import { readPublicPolicies } from "../../../features/policy/public-data.ts";
import {
  createCategoryRecommendationService,
  createCompletePublicCatalogLoader,
} from "../../../features/policy/server/category-recommendation.ts";
import { readRecommendationCatalog } from "../../../features/policy/server/recommendation-release.ts";
import {
  createRecommendationService,
  readRecommendationRequest,
  recommendationErrorResponse,
} from "../../../features/policy/server/recommendation-service.ts";

const recommend = createRecommendationService({
  loadCatalog: readRecommendationCatalog,
});
const recommendCategory = createCategoryRecommendationService({
  loadPolicies: createCompletePublicCatalogLoader(readPublicPolicies),
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
