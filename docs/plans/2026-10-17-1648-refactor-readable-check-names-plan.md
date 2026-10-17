---
title: Readable check names - Plan
type: feat
date: 2026-10-17
topic: readable-check-names
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Readable check names - Plan

## Goal Capsule

- **Objective:** anyone reading a pull request's checks can tell from each check's name what it runs and, when one fails, which group of tests failed, without opening its log or knowing a Trunk collection ID.
- **Means:** rename the jobs of the shared workflows (`python.yml`, `typescript.yml`, `go.yml`, `codeql.yml`), with the setup jobs handing each test group a ready-made label (KTD1). No job is added, removed or changed in what it does.
- **Product authority:** this plan covers job names only. How results reach Trunk stays as it is (one upload job per collection, through Trunk's action). The Product Contract wins on behavior; the KTDs win on mechanism.
- **Execution profile:** workflow YAML, `jq` in the setup jobs, and docs, in this repository. No test harness exists here; the names are proven on real runs (Verification Contract).
- **Stop conditions:** stop and report if GitHub shows a matrix job's name unevaluated even when the job runs, or if a name built from `matrix.label` differs between the check run and the required-check context.
- **Who finishes:** the implementer opens one pull request in this repository, titled `feat!: …` (KTD3). Updating the calling repositories' required CodeQL checks in thatsnotmynameio/admin (KTD4) and moving the organization rulesets' pins are follow-up work.
- **Open blockers:** none.

---

## Product Contract

Product Contract preservation: unchanged, except that the two questions deferred to planning are resolved by KTD1 and KTD4 and removed from Outstanding Questions, and AE1 now quotes corvo's current test layout (`tests/unit/corvo/...`, changed in corvo #58).

### Summary

Every test job is named after the command and the paths it runs (`tnmn.io: pytest / tests/integration`), and each Trunk upload after the same paths (`tnmn.io: trunk / upload / tests/integration`). Every other job of the shared workflows switches from parentheses to ` / ` (`tnmn.io: python / lint`), and CodeQL's jobs are named by language alone (`codeql / python`).

### Problem Frame

A pull request in corvo shows 16 checks from `tnmn.io: python`. Twelve of them are named by Trunk's 8-character collection IDs: six `tnmn.io: python (test YJ9od0SO)`-style test jobs and six `tnmn.io: python (trunk YJ9od0SO)`-style upload jobs. The ID says nothing about which tests ran. To find out which part of the suite failed, a reader opens the log or maps the ID back through `.github/python.yml` by hand. `typescript.yml` copied the same naming, so any TypeScript repository that names collections will have the same problem.

The parentheses are also inconsistent with how GitHub itself nests names (`<caller job> / <job>`), and the brainstorm settled on one separator for every shared workflow.

### Key Decisions

- **Keep one test job per collection, running in parallel.** (session-settled: user-directed — chosen over one test job that runs every collection in sequence, and over only renaming: a failing check should name the failing group.) Governs R1, R4.
- **The name comes from the paths in the group's arguments, not a new configuration field.** (session-settled: user-directed — chosen over a required `name` per collection and over restructuring `.github/python.yml` into named test groups: no repository has to change its configuration.) Governs R1, R2, R3.
- **The Trunk upload keeps its mechanism: one job per collection, through Trunk's action.** (session-settled: user-directed — chosen over a single upload job that calls Trunk's CLI in a loop, which would reproduce what the action does, and over uploading from the test job, which would put Trunk's token next to the pull request's code.) Governs R4.
- **` / ` replaces the parentheses in every shared workflow, Go and CodeQL included.** (session-settled: user-directed — chosen over renaming only the workflows that send results to Trunk.) Governs R6, R7, R8.
- **CodeQL is renamed despite its checks being required by name.** (session-settled: user-directed — chosen over leaving CodeQL out of the rename; the cost is a ruleset update in each calling repository.) Governs R8, R10.
- **Keep ` / ` although GitHub joins the workflow and the job with the same separator.** (session-settled: user-approved — the pull request's check list reads `tnmn.io: python / tnmn.io: pytest / tests/agents (pull_request)`, where the two separators look alike.) Governs R6.
- **Accept the raw expression in a skipped matrix job's name.** (session-settled: user-approved — GitHub does not evaluate the name of a matrix job it skips, and no expression fallback can fix that.) See Scope Boundaries.

### Requirements

**Test jobs**

- R1. Each test job of `python.yml` is named `tnmn.io: pytest / <paths>`, where `<paths>` is the group's `pytest:` arguments that are not options (do not start with `-`), in their written order, separated by spaces.
- R2. A test job whose group has no such argument is named `tnmn.io: pytest / tests`. This covers a repository that names no collections, and a collection with no `pytest:` arguments.
- R3. `typescript.yml` names its test jobs the same way, with `vitest` and the group's `vitest:` arguments: `tnmn.io: vitest / <paths>`, or `tnmn.io: vitest / tests` without paths.

**Trunk upload jobs**

- R4. The upload jobs keep their current behavior: one job per collection, after the test jobs, through `trunk-io/analytics-uploader`, the only job holding Trunk's token, and never failing the check. Each is named `tnmn.io: trunk / upload / <paths>`, with the same `<paths>` as its test job (R1, R2), in both `python.yml` and `typescript.yml`.
- R5. No job name in any shared workflow shows a Trunk collection ID.

**Other jobs**

- R6. Every other job whose name has a parenthesized part switches to ` / `:

| Workflow | Today | After |
|---|---|---|
| `python.yml` | `tnmn.io: python (setup)`, `(lint)`, `(coverage)`, `(build)` | `tnmn.io: python / setup`, `/ lint`, `/ coverage`, `/ build` |
| `typescript.yml` | `tnmn.io: typescript (setup)`, `(lint)`, `(code scanning)`, `(coverage)`, `(build)` | `tnmn.io: typescript / setup`, `/ lint`, `/ code scanning`, `/ coverage`, `/ build` |
| `go.yml` | `tnmn.io: go (setup)`, `(<os>)`, `(snapshot)` | `tnmn.io: go / setup`, `/ <os>`, `/ snapshot` |
| `codeql.yml` | `codeql (setup)`, `codeql (<language>)` | `setup`, `<language>` (R8) |

- R7. Job ids do not change. Code scanning keys its analyses by workflow, job id and category, so the ruff, oxlint and CodeQL alerts stay attached to the same analyses.
- R8. In a calling repository, CodeQL's checks read `<caller job> / setup` and `<caller job> / <language>`; for a caller job named `codeql`, `codeql / python`, `codeql / go`, `codeql / javascript-typescript` and `codeql / actions`.

**Documentation and rollout**

- R9. The README and the workflows' header comments show the new names wherever they quote a job name.
- R10. The README tells a calling repository that the release carrying this change renames CodeQL's checks, so its ruleset must require the new names (R8) when it moves its pin. The repositories affected today are corvo, crew, crew-actions and tnmn.

### Acceptance Examples

- AE1. **Covers R1, R2, R4, R6.** Given corvo's `.github/python.yml` (six collections: `tests/unit/corvo/agents`, `tests/unit/corvo/core`, `tests/integration`, `tests/unit/corvo/server`, `tests/unit/corvo/worker`, and the rest as `[tests, --ignore=tests/unit/corvo/agents, ...]`), a pull request shows:
  - `tnmn.io: python / setup`, `tnmn.io: python / lint`, `tnmn.io: python / build`, `tnmn.io: python / coverage`
  - `tnmn.io: pytest / tests/unit/corvo/agents` ... `tnmn.io: pytest / tests/unit/corvo/worker`, `tnmn.io: pytest / tests/integration`, and `tnmn.io: pytest / tests` for the rest
  - `tnmn.io: trunk / upload / tests/unit/corvo/agents` ... `tnmn.io: trunk / upload / tests/unit/corvo/worker`, `tnmn.io: trunk / upload / tests/integration`, and `tnmn.io: trunk / upload / tests`
- AE2. **Covers R2.** Given a Python repository whose `.github/python.yml` names no collections, its one test job is `tnmn.io: pytest / tests`, and no upload job runs.
- AE3. **Covers R1.** Given a collection with `pytest: [tests/abc/def/urrul]`, its test job is `tnmn.io: pytest / tests/abc/def/urrul`.
- AE4. **Covers R8, R10.** Given corvo moves its CodeQL pin to the release with this change while its `checks` ruleset still requires `codeql / codeql (python)`, its pull requests wait for a check that never comes. Once the ruleset requires `codeql / python` and `codeql / actions`, they can merge.

### Scope Boundaries

- Collapsing the upload jobs into one job that calls Trunk's CLI is deferred.
- Uploading from the test job is rejected: it would expose Trunk's token to the pull request's code and dependencies.
- Splitting tests by marker or by option values (`-m slow`) still runs, but such groups may share a name (`tests`, or the option's value). Validating that names are unique is out.
- The raw expression GitHub shows for a skipped matrix job (`tnmn.io: pytest / ${{ ... }}` in a Python repository with no `pyproject.toml`, `tnmn.io: trunk / upload / ${{ ... }}` with no collections) stays.
- The format of `.github/python.yml` and `.github/typescript.yml` does not change.
- Fetching collection names from Trunk is out: no documented API, and it would need the token in the setup job.
- Workflows whose job names have no parenthesized part (`actionlint.yml`, `grype.yml`, `zizmor.yml`, `dependency-review.yml`, `release.yml`, `go-release.yml`) are untouched.

#### Deferred to Follow-Up Work

- thatsnotmynameio/admin: the required CodeQL checks in `.github/repos/corvo.yml`, `crew.yml`, `crew-actions.yml` and `tnmn.yml`, one repository at a time, as KTD4 orders.
- corvo, crew, crew-actions and tnmn: the comment in `.github/workflows/security.yml` that quotes `codeql / codeql (<language>)` becomes `codeql / <language>`, in or right after each repository's CodeQL pin bump (Dependabot's bump changes only the pin).
- thatsnotmynameio/admin: the `tnmn.io:` rulesets' pins, moved by its bump-pins workflow once the release is out.

### Dependencies / Assumptions

- The organization rulesets `tnmn.io: python`, `tnmn.io: typescript` and `tnmn.io: go` require their workflow by path, not job names, so renaming those jobs breaks no requirement (verified on the rulesets).
- The repository rulesets named `checks` require CodeQL checks by name: corvo (`codeql / codeql (python)`, `codeql / codeql (actions)`), crew and crew-actions (`codeql / codeql (go)`, `codeql / codeql (actions)`), tnmn (`codeql / codeql (javascript-typescript)`, `codeql / codeql (actions)`).
- No repository runs both `python.yml` and `typescript.yml` with collections today (the Python ruleset targets corvo, the TypeScript ruleset targets tnmn, which has no `.github/typescript.yml`), so the shared `tnmn.io: trunk / upload / ...` names do not collide.

### Sources / Research

- Current names: `.github/workflows/python.yml:297` (test) and `:400` (trunk), `.github/workflows/typescript.yml:874` and `:1064`, `.github/workflows/codeql.yml:46` and `:77`, `.github/workflows/go.yml:45`, `:138`, `:284`. README quotes them at lines 93, 219, 287 and 308.
- corvo run 39060923500: 16 `tnmn.io: python` jobs, test and upload jobs named by collection ID.
- tnmn run 38824010003: the skipped upload job shows as `tnmn.io: typescript (trunk ${{ matrix.collection }})`.
- GitHub contexts reference: `jobs.<job_id>.name` can use `github`, `needs`, `strategy`, `matrix`, `vars`, `inputs`, and no special functions (https://docs.github.com/en/actions/reference/workflows-and-actions/contexts).
- Trunk: one upload goes to one collection (https://docs.trunk.io/flaky-tests/uploader, https://docs.trunk.io/flaky-tests/test-collections). The CLI identifies the source by `GITHUB_JOB` and the run URL, not the job (`trunk-io/analytics-cli` `context/src/env/parser.rs`), so today's upload jobs already reach Trunk with the same identity.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **The setup job writes the label into each matrix entry, and the job names only read it.** A job's `name` can use `matrix` and `needs` but no functions, so it cannot filter arguments. `python.yml`'s and `typescript.yml`'s setup jobs already build the `tests` matrix with `jq`; each entry gains a `label` built by R1 and R2's rule, the default single entry included. The test job reads `matrix.label`, and so does the upload job, whose matrix is the same `tests` output. Governs R1-R4.
- KTD2. **Only `name:` fields and the comments that quote them change.** Job ids, `needs`, matrix keys other than the new `label`, artifact names and concurrency groups stay as they are, so code scanning's analyses (R7) and the coverage and JUnit artifacts (`coverage-<index>`, `junit-<index>`) are untouched.
- KTD3. **The pull request is a breaking change: `feat!: …`.** The README's versioning rules call a renamed check breaking, and CodeQL's checks are required by name in calling repositories (R8). While the major is 0, `release.yml` turns it into a minor bump, and the notes list it under breaking changes.
- KTD4. **Each calling repository switches its required CodeQL checks in the same moment it takes the new pin.** Its required checks live in thatsnotmynameio/admin's `.github/repos/<repo>.yml`, applied by safe-settings. The admin change that swaps `codeql / codeql (<language>)` for `codeql / <language>` (and fixes the file's comment that quotes the old name) merges right before the repository's CodeQL pin bump. Requiring old and new names together would block every pull request, since a run produces only one of them. Open pull requests on the old pin then need their branch updated, which admin's README already describes for any bump. The comment in each repository's `.github/workflows/security.yml` that quotes the old names is fixed with the bump. Governs R10.
- KTD5. **Follow `python.yml` in `typescript.yml`.** The label is built the same way in both setup jobs, with the argument key being `pytest` or `vitest`, so the two workflows stay copies of each other.

### Assumptions

- GitHub evaluates a matrix job's `name` from `matrix.label` for every job that runs, and uses that evaluated name as the check-run name that rulesets match. The existing `tnmn.io: go (${{ matrix.os }})` and `codeql (${{ matrix.language }})` checks, the latter required by name today, already rely on this.

### Risks & Dependencies

| Risk | Mitigation |
| --- | --- |
| A calling repository takes the new CodeQL pin before its admin change, and its pull requests wait forever | KTD4's order, and the README note (R10) that Dependabot's bump pull request links to through the release notes |
| A Dependabot bump of `codeql.yml` opens in each repository on its own schedule | The bump pull request itself stays blocked until the admin change merges, which is the signal to do it |
| The label differs between `python.yml` and `typescript.yml` for the same arguments | KTD5, and U1's and U2's scenarios use the same argument lists |

---

## Implementation Units

### U1. `python.yml`: labels and names

**Goal:** every job of `python.yml` gets its new name, with the test and upload jobs named after their group's paths.

**Requirements:** R1, R2, R4, R5, R6, R7; KTD1, KTD2.

**Dependencies:** none.

**Files:**
- `.github/workflows/python.yml`

**Approach:**
1. In the setup job's `config` step, add `label` to each entry of `trunk` before it becomes `tests`, and to the default single entry: the `pytest` arguments that do not start with `-`, joined by a space, or `tests` when none is left.
2. Rename the jobs: `tnmn.io: python / setup`, `/ lint`, `/ coverage`, `/ build`; the test job `tnmn.io: pytest / ${{ matrix.label }}`; the upload job `tnmn.io: trunk / upload / ${{ matrix.label }}`.
3. Update the comments that describe the naming: the header's Trunk paragraph and the `.github/python.yml` example block above the setup job, which say each collection runs "in a job of its own".

**Patterns to follow:** the setup job's existing `jq` validation and `to_entries | map(...)` shape; `go.yml`'s matrix-driven job name.

**Test scenarios:**
- Covers AE1. corvo's configuration gives labels `tests/unit/corvo/agents`, `tests/unit/corvo/core`, `tests/integration`, `tests/unit/corvo/server`, `tests/unit/corvo/worker` and, for `[tests, --ignore=tests/unit/corvo/agents, ...]`, `tests`.
- Covers AE2. No `.github/python.yml`, or one without `trunk`, gives one entry labeled `tests`.
- Covers AE3. `pytest: [tests/abc/def/urrul]` gives `tests/abc/def/urrul`.
- A collection with no `pytest` key gives `tests`.
- `pytest: [tests/a, tests/b, -x]` gives `tests/a tests/b`.
- The upload job of each collection carries the same label as its test job.

**Verification:** actionlint and zizmor pass, and a pull request run on a repository with collections shows the AE1-shaped names, with the coverage and upload jobs still finding their artifacts.

### U2. `typescript.yml`: labels and names

**Goal:** every job of `typescript.yml` gets its new name, built exactly as in `python.yml`.

**Requirements:** R3, R4, R5, R6, R7; KTD1, KTD2, KTD5.

**Dependencies:** U1, whose label expression this copies.

**Files:**
- `.github/workflows/typescript.yml`

**Approach:**
1. Add `label` in the setup job's `config` step as in U1, from the `vitest` arguments.
2. Rename: `tnmn.io: typescript / setup`, `/ lint`, `/ code scanning`, `/ coverage`, `/ build`; the test job `tnmn.io: vitest / ${{ matrix.label }}`; the upload job `tnmn.io: trunk / upload / ${{ matrix.label }}`.
3. Update the header's Trunk paragraph and the `.github/typescript.yml` example block's comment.

**Patterns to follow:** U1's expression, character for character apart from the argument key.

**Test scenarios:**
- The header example's collections (`[test/worker]`, `[--exclude=test/worker/**]`) give `test/worker` and `tests`.
- No `trunk` gives one entry labeled `tests`.
- The same argument lists as U1's scenarios give the same labels.

**Verification:** actionlint and zizmor pass, and tnmn's next pull request run (no collections) shows `tnmn.io: vitest / tests` and the other renamed jobs.

### U3. `go.yml` and `codeql.yml`: names

**Goal:** Go's and CodeQL's jobs switch to the new separator, and CodeQL's jobs are named by language alone.

**Requirements:** R6, R7, R8; KTD2.

**Dependencies:** none.

**Files:**
- `.github/workflows/go.yml`
- `.github/workflows/codeql.yml`

**Approach:**
1. `go.yml`: `tnmn.io: go / setup`, `tnmn.io: go / ${{ matrix.os }}`, `tnmn.io: go / snapshot`.
2. `codeql.yml`: `setup` and `${{ matrix.language }}`; leave the job ids, the matrix, the category and the concurrency group alone.
3. `codeql.yml`'s header: the list of checks becomes `<caller job> / go`, `/ python`, `/ javascript-typescript`, `/ actions`, and it says that the release with this change renamed them, so a caller updates its required checks (R10).

**Test expectation:** none -- names only; proven by the runs in the Verification Contract.

**Verification:** actionlint and zizmor pass; a caller's run shows `codeql / python` (or its language) and `codeql / setup`, and code scanning shows no new analysis next to the existing `/language:<language>` one.

### U4. README

**Goal:** the README shows the new names and tells callers what the CodeQL rename asks of them.

**Requirements:** R9, R10.

**Dependencies:** U1, U2, U3.

**Files:**
- `README.md`

**Approach:**
1. CodeQL section: the new check names, and one paragraph saying the release with this change renamed them and the caller's required checks must change when it takes the pin (KTD4's order).
2. Trunk Flaky Tests: the jobs are `tnmn.io: pytest / <paths>` and `tnmn.io: trunk / upload / <paths>`, named by the arguments that are not options, `tests` without any; give an option its value with `=` (`--ignore=tests/x`) so the value stays out of the name; groups split by marker share the name `tests`.
3. TypeScript: the `code scanning` job's name, and the Trunk sentence with `tnmn.io: vitest / <paths>`.

**Test expectation:** none -- documentation.

**Verification:** no `(test`, `(trunk`, `(setup`, `(lint`, `(build`, `(coverage`, `(snapshot`, `(code scanning` or `codeql (` job name remains in the README or in any workflow's comments.

---

## Verification Contract

| Gate | What proves it | Applies to |
| --- | --- | --- |
| Workflow lint | actionlint (with shellcheck) and zizmor `--persona=regular --no-ignores` report nothing, as `actionlint.yml` and `zizmor.yml` run them | U1-U3 |
| Label expression | U1's `jq` run locally on each scenario's configuration gives the stated labels, and U2's on the same inputs gives the same ones | U1, U2 |
| Python run | a Python repository with collections (a scratch one, or a corvo branch calling this branch's `python.yml` through `workflow_call`) shows AE1's names, the coverage job finds its data and each upload job finds its report | U1 |
| TypeScript and Go runs | a scratch repository per stack calling this branch's workflow shows the renamed jobs | U2, U3 |
| CodeQL run | a caller of this branch's `codeql.yml` shows `<caller job> / <language>` and code scanning keeps one analysis per language | U3 |

The pull request body lists what ran where, as PRs #13, #21 and #24 did.

## Definition of Done

- Every unit's verification holds, and AE1-AE3 were seen on a real run.
- actionlint and zizmor report nothing on every changed workflow.
- No old parenthesized job name remains in a workflow's `name:`, its comments or the README.
- No experimental steps, debugging output or dead branches remain in the diff.
- The pull request is titled `feat!: …`, its description explains the CodeQL rename for callers, and its `release / version` check shows the minor bump.
- The pull request names the follow-up: the admin changes in KTD4's order, and the rulesets' pin bump.
