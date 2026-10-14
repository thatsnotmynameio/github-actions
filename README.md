# thatsnotmynameio/github-actions

Shared workflows and actions of thatsnotmynameio's repositories, and the checks the organization's rulesets require.

## Checks required by the organization

The organization's rulesets run these workflows on the pull requests of the repositories they target, pinned by SHA. A repository needs no file of its own, and a pull request cannot change or skip them. Their checks carry the `tnmn.io:` prefix, so they never share a name with a repository's own checks.

| Workflow | Check | What it does |
| --- | --- | --- |
| `.github/workflows/actionlint.yml` | `tnmn.io: actionlint` | actionlint over the workflows, with shellcheck on every `run:` script |
| `.github/workflows/zizmor.yml` | `tnmn.io: zizmor` | zizmor's security audit of the workflows, composite actions and Dependabot configuration |
| `.github/workflows/grype.yml` | `tnmn.io: grype` | Grype: vulnerable dependencies and malicious packages in every manifest |
| `.github/workflows/dependency-review.yml` | `tnmn.io: dependency-review` | the dependencies a pull request adds: a license off the organization's allowlist, or a known vulnerability, fails it. Public repositories and private ones with `tier: private-licensed` only |
| `.github/workflows/go.yml` | `tnmn.io: go` | a Go module's checks on Linux and macOS: tidy `go.mod`, gofmt, vet, golangci-lint, tests with the race detector, the coverage floor and govulncheck; then a snapshot of the GoReleaser build. Go repositories only |
| `.github/workflows/python.yml` | `tnmn.io: python` | a Python project's checks on Linux and macOS: a current `uv.lock`, ruff's formatting and lint, the tests with coverage and the coverage floor; then the build of its packages and its image. Python repositories only |

A ruleset runs them only on `pull_request` and `merge_group`, and ignores their triggers' filters. GitHub does not allow CodeQL's `init` and `analyze` actions in a workflow a ruleset requires, so each repository calls CodeQL's workflow from its own workflows (see [CodeQL](#codeql)).

Each tool's configuration (`.github/actionlint.yaml`, `.github/zizmor.yml` or `zizmor.yml`, `.grype.yaml`, dependency review's exceptions in `.github/dependency-review.yml`, for Go `.github/go.yml`, `.golangci.yml`, and for Python `.github/python.yml`, `ruff.toml`) comes from the pull request's base commit, never from the pull request itself: a pull request cannot turn a rule off for itself. A change to it applies once it merges.

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
    uses: thatsnotmynameio/github-actions/.github/workflows/zizmor.yml@<sha> # main
```

A private repository without GitHub Code Security has no code scanning: there the findings only show in the job's log, the check never fails on them, and the repository needs no file.

## CodeQL

`.github/workflows/codeql.yml` runs CodeQL's advanced setup with the `security-extended` suite. It analyzes the Go module, test files included, when the repository has `go.mod`, the Python project when it has `pyproject.toml`, and the workflows always. No ruleset can require it, so a repository calls it from its own workflow, on every pull request, on each push to `main` and daily:

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
    uses: thatsnotmynameio/github-actions/.github/workflows/codeql.yml@<sha> # main
```

Its checks are `codeql / codeql (go)`, `codeql / codeql (python)` and `codeql / codeql (actions)`, for a caller job named `codeql`, and the repository's ruleset requires them. CodeQL's configuration (`.github/codeql/codeql-config.yml`) comes from the base commit. Without one, the suite runs as is. Code scanning tells analyses apart by the caller's workflow and job, the category and the matrix values: renaming any of them leaves the old analysis's alerts open on `main`.

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
    uses: thatsnotmynameio/github-actions/.github/workflows/go.yml@<sha> # main
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
    uses: thatsnotmynameio/github-actions/.github/workflows/go-release.yml@<sha> # main
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
- `.github/python.yml`: the systems the tests run on and the coverage floor:

```yaml
# The systems the tests run on, linux and macos (both by default).
systems: [linux]
# The coverage floor: the least total coverage, in percent, of the statements
# and branches the tests cover on Linux (coverage report's total). None by default.
coverage: 90
```

A project must commit its `uv.lock`: the check fails without it, and fails when it no longer matches `pyproject.toml`. The tests run with the project's own pytest, from its locked dependencies; a project without test files passes. Coverage measures `src/` in a src layout, the whole tree otherwise. The build job runs `uv build` when `pyproject.toml` has a `[build-system]`, and `docker build` when the repository has a `Dockerfile`. Known vulnerabilities in the dependencies are `tnmn.io: grype`'s, which reads `uv.lock`.

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
    uses: thatsnotmynameio/github-actions/.github/workflows/python.yml@<sha> # main
```
