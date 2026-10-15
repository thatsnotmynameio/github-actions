# thatsnotmynameio/github-actions

Shared workflows and actions of thatsnotmynameio's repositories, and the checks the organization's rulesets require.

## Versions

Each merge to `main` that brings a `feat`, a `fix` or a breaking change publishes a release, `vX.Y.Z`, whose notes group the changes since the previous release as breaking changes, features and fixes. A merge that brings only `docs`, `ci`, `chore` or another type releases nothing: its change ships with the next release. The first release is `v0.1.0`. `.github/workflows/release.yml` cuts them. It can also be started by hand on `main` ("Run workflow", or `gh workflow run release.yml`), which releases everything merged since the last release.

A caller pins a release's commit, with its tag in the comment:

```yaml
uses: thatsnotmynameio/github-actions/.github/workflows/zizmor.yml@<sha> # vX.Y.Z
```

`<sha>` is the commit of the tag (`git rev-parse 'vX.Y.Z^{commit}'`). Dependabot's `github-actions` ecosystem then proposes each newer release, with its notes. A published release and its tag never move and are never deleted: a release that went wrong is followed by a fixed one.

A pull request's title becomes its squash commit's title, and decides the version:

- A breaking change, marked with `!` after the type (`feat!: …`, `fix!: …`), bumps the major. While the major is 0, it bumps the minor instead: leaving `0.x` is a deliberate change of its own.
- `feat` bumps the minor, `fix` the patch.

A change is breaking only when a caller must change something to keep working: a new required input, secret or permission; a renamed or removed workflow, job or check; or a configuration file whose format changes. A stricter check that starts failing code that used to pass is a `feat`. The description becomes the squash commit's body and is read too: `BREAKING CHANGE:` anywhere in it makes a breaking change, so it never appears there unless the title is marked with `!`, which is what puts the change under breaking changes in the notes.

A revert of a change that was released is titled `fix: revert <the reverted title, without its type>`, so it ships as a release. `revert: …` is only for a change that released nothing.

Each pull request's `release / version` check writes to its summary the version its merge would release, and the notes.

## Checks required by the organization

The organization's rulesets run these workflows on the pull requests of the repositories they target, pinned by SHA. A repository needs no file of its own, and a pull request cannot change or skip them. Their checks carry the `tnmn.io:` prefix, so they never share a name with a repository's own checks.

| Workflow | Check | What it does |
| --- | --- | --- |
| `.github/workflows/actionlint.yml` | `tnmn.io: actionlint` | actionlint over the workflows, with shellcheck on every `run:` script |
| `.github/workflows/zizmor.yml` | `tnmn.io: zizmor` | zizmor's security audit of the workflows, composite actions and Dependabot configuration |
| `.github/workflows/grype.yml` | `tnmn.io: grype` | Grype: vulnerable dependencies and malicious packages in every manifest |
| `.github/workflows/dependency-review.yml` | `tnmn.io: dependency-review` | the dependencies a pull request adds: a license off the organization's allowlist, except in the packages the workflow exempts, or a known vulnerability, fails it. A repository can exempt an advisory, not a package's license. Public repositories and private ones with `tier: private-licensed` only |
| `.github/workflows/go.yml` | `tnmn.io: go` | a Go module's checks on Linux and macOS: tidy `go.mod`, gofmt, vet, golangci-lint, tests with the race detector, the coverage floor and govulncheck; then a snapshot of the GoReleaser build. Go repositories only |
| `.github/workflows/python.yml` | `tnmn.io: python` | a Python project's checks on Linux: a current `uv.lock`, ruff's formatting and lint, mypy's type check, the tests with coverage and the coverage floor; then the build of its packages and its image. Python repositories only |
| `.github/workflows/typescript.yml` | `tnmn.io: typescript` | a TypeScript project's checks on Linux: an install under the organization's pnpm policy, oxfmt's formatting, the type check, oxlint, the production imports with knip, the Vitest tests with coverage and the coverage floor; then its build and its image. TypeScript repositories only |

A ruleset runs them only on `pull_request` and `merge_group`, and ignores their triggers' filters. GitHub does not allow CodeQL's `init` and `analyze` actions in a workflow a ruleset requires, so each repository calls CodeQL's workflow from its own workflows (see [CodeQL](#codeql)).

Each tool's configuration (`.github/actionlint.yaml`, `.github/zizmor.yml` or `zizmor.yml`, `.grype.yaml`, dependency review's advisory exceptions (`allow-ghsas`) in `.github/dependency-review.yml`, for Go `.github/go.yml`, `.golangci.yml`, for Python `.github/python.yml`, `ruff.toml`, `mypy.ini`, and for TypeScript `.github/typescript.yml`, the exceptions in `pnpm-workspace.yaml`, `.oxlintrc.json`, `.eslintignore`, `.oxfmtrc.json`, `.prettierignore`, `knip.json` and the root `tsconfig.json`'s file selection and strictness) comes from the pull request's base commit, never from the pull request itself: a pull request cannot turn a rule off for itself. A change to it applies once it merges.

zizmor honors no `# zizmor: ignore` comment and no `ignore` list in its configuration, which a pull request could use to hide its own finding: a rule turned off with `disable: true` in the configuration on `main` is the only way to silence zizmor in a repository. An exception to a single finding is a dismissal of its code scanning alert, which an organization owner or security manager approves.

### zizmor and code scanning

On a public repository, zizmor's findings go to code scanning under the category `zizmor`, and the ruleset's code scanning rule blocks a pull request that adds one. Code scanning compares the pull request with the analysis of `main`, so a public repository also runs zizmor on each push to `main`:

```yaml
# .github/workflows/security-main.yml
on:
  push:
    branches: [main]

permissions: {}

jobs:
  zizmor:
    permissions:
      contents: read
      security-events: write
    uses: thatsnotmynameio/github-actions/.github/workflows/zizmor.yml@<sha> # vX.Y.Z
```

A private repository without GitHub Code Security has no code scanning: there the findings only show in the job's log, the check never fails on them, and the repository needs no file.

## CodeQL

`.github/workflows/codeql.yml` runs CodeQL's advanced setup with the `security-extended` suite. It analyzes the Go module, test files included, when the repository has `go.mod`, the Python project when it has `pyproject.toml`, the JavaScript and TypeScript project when it has `package.json`, and the workflows always. No ruleset can require it, so a repository calls it from its own workflow, on every pull request, on each push to `main` and daily:

```yaml
# .github/workflows/security.yml
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: "41 5 * * *"

permissions: {}

jobs:
  codeql:
    permissions:
      contents: read
      security-events: write
    uses: thatsnotmynameio/github-actions/.github/workflows/codeql.yml@<sha> # vX.Y.Z
```

Its checks are `codeql / codeql (go)`, `codeql / codeql (python)`, `codeql / codeql (javascript-typescript)` and `codeql / codeql (actions)`, for a caller job named `codeql`, and the repository's ruleset requires them. CodeQL's configuration (`.github/codeql/codeql-config.yml`) comes from the base commit. Without one, the suite runs as is. Code scanning tells analyses apart by the caller's workflow and job, the category and the matrix values: renaming any of them leaves the old analysis's alerts open on `main`.

## Go

A Go repository's pull requests get `tnmn.io: go`. What the pull request builds and tests is its own (`go.mod`, the code, `.goreleaser.yaml`, the Compose file of the test services); the settings that could turn a check off come from the base commit:

- `.golangci.yml` (or `.yaml`): golangci-lint's configuration. Without one, golangci-lint runs with its defaults.
- `.github/go.yml`: the systems the tests run on, the coverage floor, and the services the tests need:

```yaml
# The systems the tests run on, linux and macos (both by default).
systems: [linux, macos]
# The coverage floor: the least total coverage, in percent, of the statements
# go test covers on Linux (go tool cover -func's total), generated files left
# out. None by default.
coverage: 90
# Docker Compose services started before the tests, on Linux only (the macOS
# runners have no Docker), with the environment that points the tests at them.
services: [test-postgres]
env:
  MY_TEST_DATABASE_URL: postgres://postgres:postgres@127.0.0.1:5433/test?sslmode=disable
```

A generated file is one with Go's `// Code generated ... DO NOT EDIT.` line before the package clause, as golangci-lint and gopls recognize it, so code from `buf generate`, `stringer` or `mockgen` needs no setting of its own.

govulncheck is the module's own when `go.mod` declares it as a tool, so the version it pins is the one that runs.

golangci-lint's findings go to code scanning under the category `golangci-lint`. Code scanning compares a pull request with the analysis of `main`, so a Go repository also runs the workflow on each push to `main`:

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]

permissions: {}

jobs:
  go:
    permissions:
      contents: read
      security-events: write
    uses: thatsnotmynameio/github-actions/.github/workflows/go.yml@<sha> # vX.Y.Z
```

### Releases

`.github/workflows/go-release.yml` releases a Go module with GoReleaser, as the version its `VERSION` file names, and attests every archive and binary with GitHub's artifact attestations. A repository calls it from a workflow it starts by hand on `main`:

```yaml
# .github/workflows/release.yml
on:
  workflow_dispatch:

permissions: {}

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    permissions:
      contents: write
      id-token: write
      attestations: write
    uses: thatsnotmynameio/github-actions/.github/workflows/go-release.yml@<sha> # vX.Y.Z
```

The attestations are signed by this repository's workflow, so a release is verified with:

```sh
gh attestation verify <file> --repo <owner>/<repo> \
  --signer-workflow thatsnotmynameio/github-actions/.github/workflows/go-release.yml \
  --source-ref refs/heads/main
```

## Python

A Python repository's pull requests get `tnmn.io: python`. What the pull request builds and tests is its own (`pyproject.toml`, `uv.lock`, the code, the `Dockerfile`); the settings that could turn a check off come from the base commit:

- `ruff.toml` (or `.ruff.toml`): ruff's configuration. ruff never reads `[tool.ruff]` in `pyproject.toml` here, since the pull request owns that file: keep ruff's configuration in `ruff.toml`. Without one, ruff runs with its defaults.
- `mypy.ini` (or `.mypy.ini`): mypy's configuration, which turns the type check on. mypy never reads `[tool.mypy]` in `pyproject.toml` here, for the same reason: keep mypy's configuration in `mypy.ini`. Without one, mypy does not run.
- `.github/python.yml`: the coverage floor and Trunk's test collections:

```yaml
# The coverage floor: the least total coverage, in percent, of the statements
# and branches the tests cover (coverage report's total). None by default.
coverage: 90
# Trunk Flaky Tests' test collections, by their 8-character IDs, each with the
# pytest arguments that pick its tests (all of them without any). None by
# default.
trunk:
  - collection: AbC12345
    pytest: [tests/integration]
  - collection: XyZ98765
    pytest: [--ignore=tests/integration]
```

Everything runs on Linux. A project must commit its `uv.lock`: the check fails without it, and fails when it no longer matches `pyproject.toml`. The tests run with the project's own pytest, from its locked dependencies; a project without test files passes. Coverage measures `src/` in a src layout, the whole tree otherwise, and the coverage job checks the floor over every test job's data. The build job runs `uv build` when `pyproject.toml` has a `[build-system]`, and `docker build` when the repository has a `Dockerfile`. Known vulnerabilities in the dependencies are `tnmn.io: grype`'s, which reads `uv.lock`.

mypy runs at the workflow's version over the project's locked environment, so it follows the imports and loads the plugins its configuration names (such as `pydantic.mypy`) from `uv.lock`. It checks the configuration's `files`, or `src/` in a src layout and the whole tree otherwise. Its findings are annotations on the pull request's lines; they do not go to code scanning.

ruff's findings go to code scanning under the category `ruff`. Code scanning compares a pull request with the analysis of `main`, so a Python repository also runs the workflow on each push to `main`:

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]

permissions: {}

jobs:
  python:
    permissions:
      contents: read
      security-events: write
    uses: thatsnotmynameio/github-actions/.github/workflows/python.yml@<sha> # vX.Y.Z
    # For Trunk Flaky Tests (below): main's results go to Trunk too.
    secrets:
      TRUNK_API_TOKEN: ${{ secrets.TRUNK_API_TOKEN }}
```

### Trunk Flaky Tests

With `trunk`, the tests run in a job of their own for each collection (`tnmn.io: python (test <collection>)`), pytest with that collection's arguments: the repository decides how its tests split, by directory, marker or anything pytest selects, and that no test lands in two collections or in none. A collection whose arguments select no test passes. Each job's JUnit report then goes to its collection through Trunk's uploader (`trunk-io/analytics-uploader`), in a job of its own (`tnmn.io: python (trunk <collection>)`): the only job that holds Trunk's token, and it runs none of the pull request's code. Without `trunk`, the tests run in one job (`tnmn.io: python (test)`) and nothing goes to Trunk.

The collections are created in Trunk's app, which holds their monitors, quarantining and ticketing. The organization holds Trunk's token in the `TRUNK_API_TOKEN` secret and its slug in the `TRUNK_ORG_URL_SLUG` variable. Without them (on a Dependabot or a fork's pull request, for instance), nothing is sent, and a failed upload never fails the check.

## TypeScript

A TypeScript repository's pull requests get `tnmn.io: typescript`. A project is one package at the repository root, with `package.json`, `pnpm-lock.yaml` and `tsconfig.json`: the check fails without the last two, and fails when a pull request removes `package.json` from a project. What the pull request builds and tests is its own (`package.json`, `pnpm-lock.yaml`, the code, the `Dockerfile`); the settings that could turn a check off come from the base commit:

- `.oxlintrc.json`: oxlint's configuration, with oxlint's built-in rules only. A base whose configuration declares `jsPlugins` or `extends`, or leaves the `typescript` plugin out of `plugins`, fails, and so does one kept in code (`oxlint.config.ts`), which would run in the job. `.eslintignore` lists the files oxlint leaves out.
- `.oxfmtrc.json`: oxfmt's configuration. `.prettierignore` lists the files oxfmt leaves out.
- `knip.json`: knip's configuration. knip never reads `package.json`'s `knip` field here, since the pull request owns that file.
- `tsconfig.json`, at the root: the files it selects and the stricter checks it turns on (below).
- `pnpm-workspace.yaml`: the exceptions to pnpm's policy (below).
- `.github/typescript.yml`: the coverage floor and its provider, Trunk's test collections, and the dependencies that come from outside the registry:

```yaml
# The coverage floor: the least total coverage, in percent, of the lines the
# tests cover. None by default.
coverage: 90
# The coverage provider, v8 or istanbul (v8 by default). The project installs
# it (@vitest/coverage-v8 or @vitest/coverage-istanbul).
coverage-provider: v8
# Trunk Flaky Tests' test collections, by their 8-character IDs, each with the
# vitest arguments that pick its tests (all of them without any). None by
# default.
trunk:
  - collection: AbC12345
    vitest: [test/worker]
  - collection: XyZ98765
    vitest: [--exclude=test/worker/**]
# The dependencies pnpm-lock.yaml may resolve outside the registry, each by its
# exact source: a git repository at one commit, or a tarball (a URL, or a
# committed file:) with its integrity. None by default.
exotic-dependencies:
  - repo: https://github.com/someone/foo.git
    commit: 0123456789abcdef0123456789abcdef01234567
  - tarball: https://codeload.github.com/someone/bar/tar.gz/0123456789abcdef0123456789abcdef01234567
    integrity: sha512-...
```

Everything runs on Linux, with the Node of `.node-version` (24 without one). The project's Node version goes in `.node-version`, not in `package.json`'s `devEngines.runtime`, which can leave grype's SBOM empty (anchore/syft#5241).

### The install

pnpm's policy is the workflow's, set in the environment, which wins over the project's `pnpm-workspace.yaml`:

- Every version in `pnpm-lock.yaml` is at least a day old (`minimumReleaseAge: 1440`), and none has weaker trust evidence than the versions published before it (`trustPolicy: no-downgrade`). pnpm checks the lockfile's entries again on each install, so a lockfile written under a looser policy fails. Dependabot's pull requests follow the same rule, security updates included: a version younger than a day fails, and passes on a re-run once it is old enough.
- A dependency's install scripts run only when the base's `allowBuilds` allows its package; any other is skipped with a warning. The lint job's install runs none.
- No pnpmfile runs, and the pnpm version is the workflow's: the project's `packageManager` or `devEngines.packageManager` neither switches it nor fails the check.
- The check fails when the pull request's `pnpm-workspace.yaml` declares `configDependencies`, a `pnpmfile` or `dangerouslyAllowAllBuilds: true`, or when it or `.npmrc` sets a registry the base does not.
- A dependency from a git repository, a tarball URL or a committed tarball (`file:`), direct or not, has no publish time or provenance to check: it fails unless the base's `.github/typescript.yml` lists its exact source under `exotic-dependencies`. The failure gives the entry to add.

The exceptions come from the base's `pnpm-workspace.yaml`, so a pull request that adds one gets it once it merges: `minimumReleaseAgeExclude`, `trustPolicyExclude`, `trustPolicyIgnoreAfter` and `allowBuilds`. A pull request that adds a package to `allowBuilds` installs without running its scripts until that change merges.

### Format, types and lint

oxfmt and oxlint run at the workflow's versions, over every file git tracks, so the pull request's `.gitignore` hides none. oxlint's nested configurations are off, and the pull request's `oxlint-suppressions.json` is deleted. `any` (`typescript/no-explicit-any`) and `@ts-ignore` or `@ts-nocheck` (`typescript/ban-ts-comment`) are errors whatever the configuration says, and a comment that turns either rule off fails the check, as does a disable comment that names no rule, which turns them all off. Other disable comments are the pull request's, as `# noqa` is in Python.

The type check runs the project's own TypeScript, from its lockfile, on each `tsconfig.json` git tracks, a Worker's `test/tsconfig.json` included, and on each configuration they reach through `references`, as a solution-style `tsconfig.json` does. Each file keeps the pull request's settings (`paths`, module resolution, `types`) with the strictness imposed over them: `strict` and every option of its family, `noCheck: false`, and the stricter checks the base's root `tsconfig.json` turns on (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`). At the root, the files checked are those the base selects and those the pull request selects, and the files left out are the base's `exclude`. Its findings are annotations on the pull request's lines.

The project needs TypeScript 7 for oxlint's type-aware rules. Below 7, the check warns, the type check runs with the project's TypeScript, and oxlint runs without its type-aware rules; a pull request cannot lower TypeScript below 7 once the base is at 7.

knip fails the check when production code imports a package declared only in `devDependencies`: a bundle ships it all the same.

### Tests, coverage and build

The tests run with the project's own Vitest; a project without test files passes. Coverage, with the base's provider, measures `src/` when the project has it and the whole project otherwise, test, declaration and configuration files left out, whatever the project's Vitest configuration includes, excludes or names as its provider. The coverage job checks the floor over every test job's data, and fails when there is none: a floor needs tests. A threshold in the project's Vitest configuration plays no part. The build job runs the `build` script when `package.json` has one, and `docker build` when the repository has a `Dockerfile`. Known vulnerabilities in the dependencies are `tnmn.io: grype`'s, which reads `pnpm-lock.yaml`.

oxlint's findings go to code scanning under the category `oxlint`, from a job of their own (`tnmn.io: typescript (code scanning)`): the lint job runs the project's TypeScript and knip loads the project's configuration files, so it holds no write permission. Code scanning compares a pull request with the analysis of `main`, so a TypeScript repository also runs the workflow on each push to `main`:

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]

permissions: {}

jobs:
  typescript:
    permissions:
      contents: read
      security-events: write
    uses: thatsnotmynameio/github-actions/.github/workflows/typescript.yml@<sha> # vX.Y.Z
    # For Trunk Flaky Tests: main's results go to Trunk too.
    secrets:
      TRUNK_API_TOKEN: ${{ secrets.TRUNK_API_TOKEN }}
```

With `trunk`, the tests run and go to Trunk as they do for Python (see [Trunk Flaky Tests](#trunk-flaky-tests)), with each collection's `vitest` arguments, in jobs named `tnmn.io: typescript (test <collection>)` and `tnmn.io: typescript (trunk <collection>)`.

The tools the workflow runs (oxlint, tsgolint, oxfmt, knip) are locked in `.github/typescript`, which each job checks out at the workflow's commit and installs under the same policy. Dependabot proposes their new versions as `fix`, so each bump ships as a release.
