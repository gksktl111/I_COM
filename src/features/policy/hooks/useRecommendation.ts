"use client";

import { useEffect, useMemo, useState } from "react";
import {
  activateAnswers,
  evaluateRecommendation,
} from "../recommendation/index";
import { educationFixture } from "../recommendation/education.fixture";
import type { QuestionDefinition, Request } from "../recommendation/types";
import type { RecommendationResponse } from "../server/recommendation-service";

export function useRecommendation(
  request: Request,
  enabled: boolean,
  testMode: boolean,
) {
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState<{
    request: Request;
    attempt: number;
    data?: RecommendationResponse;
    error?: string;
  } | null>(null);
  const [definitions, setDefinitions] = useState<QuestionDefinition[]>([]);
  useEffect(() => {
    if (!enabled || testMode) return;
    const controller = new AbortController();
    let current = true;
    const timer = window.setTimeout(() => controller.abort(), 20000);
    const { mode: _mode, evaluatedAt: _at, ...wire } = request;
    void _mode;
    void _at;
    // Send only facts in the current scope. Retain the full history in browser memory.
    wire.answers = activateAnswers(request, definitions).filter(
      (a) => a.active,
    );
    void fetch("/api/policy-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wire),
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(response.status === 400 ? "invalid" : "unavailable");
        const data = (await response.json()) as RecommendationResponse;
        if (
          data.result.revision !== request.revision ||
          data.result.mode !== "PUBLIC"
        )
          throw new Error("stale");
        if (current) {
          setDefinitions(data.questions);
          setRemote({ request, attempt, data });
        }
      })
      .catch((error: unknown) => {
        if (!current) return;
        setRemote({
          request,
          attempt,
          error:
            error instanceof Error && error.message === "invalid"
              ? "질문 정보가 변경됐을 수 있어요. 처음부터 다시 시작해 주세요."
              : "추천 정보를 불러오지 못했어요. 답변은 유지되니 잠시 후 다시 시도해 주세요.",
        });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      current = false;
      controller.abort();
      window.clearTimeout(timer);
    };
    // Definitions belong to the last accepted response; receiving one must not resend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, enabled, testMode, attempt]);

  const fixture = useMemo(() => {
    if (!testMode || !enabled) return null;
    try {
      return {
        result: evaluateRecommendation(educationFixture, request),
        error: null,
      };
    } catch {
      return {
        result: null,
        error:
          "답변을 계산하지 못했어요. 이전 단계로 돌아가거나 처음부터 다시 시도해 주세요.",
      };
    }
  }, [testMode, enabled, request]);
  const accepted =
    enabled && remote?.request === request && remote.attempt === attempt
      ? remote
      : null;
  return {
    result: testMode
      ? (fixture?.result ?? null)
      : (accepted?.data?.result ?? null),
    error: testMode ? (fixture?.error ?? null) : (accepted?.error ?? null),
    pending: enabled && !testMode && !accepted,
    questions: testMode ? educationFixture.questions : (definitions ?? []),
    policies: accepted?.data?.policies ?? [],
    coverage: testMode ? ("READY" as const) : accepted?.data?.coverage,
    retry: () => setAttempt((a) => a + 1),
  };
}
