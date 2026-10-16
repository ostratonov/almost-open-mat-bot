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
  local state
  state="$(docker compose ps bot --format '{{.State}}')"
  [ "$state" = running ] || { docker compose logs --tail 30 bot; echo "deploy: bot is $state" >&2; exit 1; }
  echo "==> bot is running"
}

main "$@"
