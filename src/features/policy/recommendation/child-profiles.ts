import type { ChildProfile } from "./intake.ts";
import type { Request } from "./types.ts";

export const emptyChildProfile = (id: string): ChildProfile => ({
  id,
  sex: null,
  birthYear: null,
});

/** Keep identity separate from row order; edits must not reuse answers from an old profile. */
export function withChildProfiles(
  request: Request,
  profiles: ChildProfile[],
): Request {
  const retained = new Set(
    profiles
      .filter((profile) => {
        const previous = request.childProfiles?.find(
          (child) => child.id === profile.id,
        );
        return (
          previous &&
          previous.sex === profile.sex &&
          previous.birthYear === profile.birthYear
        );
      })
      .map((profile) => profile.id),
  );
  return {
    ...request,
    childProfiles: profiles.map((profile) => ({ ...profile })),
    selectedChildren: profiles.map((profile) => profile.id),
    answers: request.answers.filter(
      (answer) =>
        answer.key.subject.kind === "HOUSEHOLD" ||
        retained.has(answer.key.subject.id),
    ),
  };
}
