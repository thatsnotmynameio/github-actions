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

A ruleset runs them only on `pull_request` and `merge_group`, and ignores their triggers' filters.

Each tool's configuration (`.github/actionlint.yaml`, `.github/zizmor.yml` or `zizmor.yml`, `.grype.yaml`, and dependency review's exceptions in `.github/dependency-review.yml`) comes from the pull request's base commit, never from the pull request itself: a pull request cannot turn a rule off for itself. A change to it applies once it merges.

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
