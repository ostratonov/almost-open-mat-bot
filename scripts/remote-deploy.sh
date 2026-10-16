#!/usr/bin/env bash
set -euo pipefail

# The checkout replaces this file mid-run; bash reads a function whole before running it.
main() {
  local repo="$HOME/almost-open-mat-bot"
  local target="${SSH_ORIGINAL_COMMAND:-${1:-}}"

  [[ "$target" =~ ^[0-9a-f]{7,40}$ ]] || { echo "deploy: expected a commit sha, got: ${target:-<nothing>}" >&2; exit 1; }

  cd "$repo"
  git fetch --quiet origin
  git checkout --quiet --detach "$target"
  echo "==> deploying $(git log -1 --format='%h %s')"

  docker compose up -d --build --remove-orphans
  docker image prune -f >/dev/null

  sleep 5
  local states
  states="$(docker compose ps --all --format '{{.State}}')"
  if [ -z "$states" ] || grep -qvx running <<<"$states"; then
    docker compose logs --tail 30
    echo "deploy: bot is ${states:-gone}" >&2
    exit 1
  fi
  echo "==> bot is running"
}

main "$@"
