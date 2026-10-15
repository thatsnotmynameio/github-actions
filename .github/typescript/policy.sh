#!/bin/bash
# pnpm's install policy, for each job of typescript.yml that installs.
#
#   policy.sh env    writes to $GITHUB_ENV the store and cache under
#                    $RUNNER_TEMP, and the base's exceptions, which the setup
#                    job hands over in POLICY, a JSON object in base64:
#                    minimumReleaseAgeExclude, trustPolicyExclude,
#                    trustPolicyIgnoreAfter and allowBuilds.
#   policy.sh check  run in the project, after the install: fails when pnpm's
#                    effective value of a pnpm_config_* setting is not the
#                    one the environment gives. pnpm drops a malformed or
#                    empty value with no error, and the project's
#                    pnpm-workspace.yaml would then apply.
set -euo pipefail

case "${1:-}" in
  env)
    exceptions="$(base64 -d <<< "$POLICY")"
    {
      echo "pnpm_config_store_dir=$RUNNER_TEMP/pnpm-store"
      echo "pnpm_config_cache_dir=$RUNNER_TEMP/pnpm-cache"
      echo "pnpm_config_minimum_release_age_exclude=$(jq -c .minimumReleaseAgeExclude <<< "$exceptions")"
      echo "pnpm_config_trust_policy_exclude=$(jq -c .trustPolicyExclude <<< "$exceptions")"
      echo "pnpm_config_trust_policy_ignore_after=$(jq -c .trustPolicyIgnoreAfter <<< "$exceptions")"
      echo "pnpm_config_allow_builds=$(jq -c .allowBuilds <<< "$exceptions")"
    } >> "$GITHUB_ENV"
    ;;
  check)
    status=0
    while IFS= read -r name; do
      key="${name#pnpm_config_}"
      key="${key//_/-}"
      want="$(jq -cS . <<< "${!name}" 2> /dev/null || jq -cn --arg v "${!name}" '$v')"
      got="$(pnpm config get "$key" --json | jq -cS .)"
      if [ "$got" != "$want" ]; then
        echo "::error::pnpm's $key is $got, not $want: the environment's value did not apply."
        status=1
      fi
    done < <(compgen -e | grep '^pnpm_config_' | sort)
    exit "$status"
    ;;
  *)
    echo "usage: policy.sh env|check" >&2
    exit 2
    ;;
esac
