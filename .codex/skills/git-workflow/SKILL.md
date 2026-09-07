---
name: git-workflow
description: Apply this repository's lightweight Git/GitHub workflow.
---

# Git/GitHub Workflow

## Core

- Write commits, issues, PRs, and user-facing GitHub content in Korean.
- Inspect the current branch, status, and relevant diff before Git writes.
- Never revert user changes or stage unrelated files.
- Never work directly on `main`.
- Require approval before destructive or shared-history rewriting operations.

## Workflow

Use the lightest workflow that safely fits the change.

- Small, local, low-risk change → work directly on `dev`.
- Work needing isolation, review, or rollback → `<type>/<short-description>` branch → PR to `dev`.
- Issues are optional; use them only when tracking, discussion, deferred work, or multiple PRs make them useful.
- Reference an existing issue with `Refs #<issue>`.

Keep `dev` current before starting new work.

## Commits

Format:

```text
type(scope) : 한국어 메시지
```

Use one of: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `chore`, `release`.

Use the owning domain as the scope.

## Pull Requests

- Default base: `dev`.
- Summarize purpose, key changes, and actual verification.
- Prefer squash merge.
- Recheck base/head, CI, and mergeability after creation.

## Verification

Run only relevant existing checks, normally `npm run lint` and `npm run build`, and report only checks actually run.

## Release

Release through a `dev -> main` PR.

Version policy:

- feature → MINOR
- fix/refactor/perf/small UI change → PATCH
- docs/chore only → no change
- breaking → MINOR on `0.x`, MAJOR on `1.x+`

When the version changes, update package versions with:

```bash
npm version <version> --no-git-tag-version
```

Release PR title:

```text
release(app) : v<version> 변경사항을 main에 반영
```
