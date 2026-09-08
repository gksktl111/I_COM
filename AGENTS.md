## Tool-call and verification efficiency

- Batch independent searches and reads with parallel tools; inspect each result.
  Keep combined output focused; if it truncates, narrow or split the read,
  preserving decisive evidence and expanding only for a specific gap.
  Keep dependent edits/checks sequential. Review the completed diff once unless
  complexity or a concrete failure calls for an earlier check.
- For reversible, low-impact copy/style/docs/config edits, do not add tests by
  default. Avoid assertions that merely mirror tunable style values. Use diff
  review and only a useful existing or visual check. Honor explicit user requests
  and required repository/release gates.
- Add regression coverage for a concrete behavior bug, meaningful new behavior,
  or material data/security/concurrency risk. Prefer existing suites; verify the
  actual trigger and outcome, not copied formulas or incidental implementation.
  Do not create test infrastructure merely to validate a small edit.
- Select the smallest checks that answer remaining questions. Omit checks already
  included in a planned build/aggregate unless needed for an earlier decision.
  Reuse passes across agents and follow-ups when relevant inputs are unchanged;
  stop when selected checks and required gates pass.
- After a failure, diagnose/fix it and rerun the affected case/file first; broaden
  only if integration coverage is needed. For repeated failures of one pattern,
  inspect the affected file and batch confirmed fixes before another full run.
- Do not change unrelated product code or weaken assertions to fix an environment
  or fixture failure. Establish the behavior contract or environment difference.

## Subagent routing

Delegate bounded independent work when it saves time, removes substantial noise,
or adds a useful independent check. Include startup, handoff, and review cost.
Keep quick lookups and short edits/checks local, including follow-ups to an existing
agent. Keep tightly coupled work local when delegation would delay the next decision.

### Roles and models

- Default to `agent_type = "astra_worker"` for bounded implementation, code
  investigation, and reviews requiring judgment. Its config supplies Astra medium;
  omit model/effort overrides.
- Use Luna only through `agent_type = "luna_runner"` for supplied commands/scripts
  whose runtime or output warrants handoff, with known inputs, outputs and completion
  criteria. Its config supplies Luna xhigh; omit model/effort overrides.
- Keep investigation, validation design, and interpretation with the parent or Astra.
  Delegate to Luna only when the executable handoff is already simple; do not create
  extra planning or scripts just to use Luna.
- Choose by remaining decisions and impact at handoff. Keep difficult diagnosis,
  architecture, security, and data-loss decisions with the parent or specialist.
  When substantial independent work or review justifies another agent at that level,
  use an appropriate role inheriting the parent's model and effort.
- Respect role scope. Never use `luna_runner` for implementation or persistently
  override built-in roles or existing specialists. If a configured role is unavailable,
  keep the work local rather than silently substituting a model.

### Handoff and completion

- Assign one outcome per agent, using the fewest needed. Add independent lanes
  while the parent has useful work; avoid automatic agent chains and nested
  delegation unless explicitly assigned. Do not duplicate exploration or jobs.
- Give exact cwd, owned files/commands, objective, constraints, acceptance evidence,
  and stop condition. For implementation, include before/after behavior and the
  smallest useful verification; do not automatically request new tests.
- Prefer `fork_turns = "none"` for self-contained work with needed context.
  Use history only when needed; explicit model/effort overrides require `"none"`
  or a supported recent-turn fork. Reuse agents for substantive follow-ups while
  context helps. Finish the old job before starting a fresh handoff for a new
  phase with excessive history.
- Tell editors they share the codebase and must preserve others' changes.
  Give shared result files one writer and an agreed format. Serialize overlapping
  edits and work sharing mutable outputs/ports/services. Settle validation inputs
  first; later edits invalidate only affected evidence.
- Assign one monitor per job with an accessible handle/log, whole-job completion
  criteria, exit evidence, deadline, cadence and cancellation ownership. Others
  use its reports; transfer ownership before taking over monitoring. Phase success
  or 100% progress alone is insufficient. Failed or unfinished prerequisites block
  dependent checks; safe independent checks may continue.
- A worker needing broader scope, a new policy, weaker assertions, or new error
  exceptions returns a precise blocker. The parent resolves it before that change.
  Keep destructive/external mutations and fresh-approval decisions with the parent.
- Do useful work instead of polling; otherwise use completion notifications or
  30-60 second waits within tool limits. Return concise evidence once; use interim
  messages only for actionable findings, not duplicate app-task completion reports.
- The parent reviews the diff and decisive results without redoing successful work.
  Retry only for a named fix or explicit bounded transient-retry policy.

### Repository workflows

- For Git/GitHub operations, apply the repository-specific workflow in `.codex/skills/git-workflow/SKILL.md`.
- When creating an issue, follow the repository's issue template if one exists.
