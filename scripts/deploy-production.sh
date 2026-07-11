#!/usr/bin/env bash
set -Eeuo pipefail

: "${ECS_PATH:?ECS_PATH is required}"
: "${APP_IMAGE:?APP_IMAGE is required}"
: "${GHCR_USERNAME:?GHCR_USERNAME is required}"
: "${GHCR_TOKEN_FILE:?GHCR_TOKEN_FILE is required}"

current_compose="$ECS_PATH/compose.yaml"
candidate_compose="$ECS_PATH/compose.candidate.yaml"
current_image_file="$ECS_PATH/CURRENT_IMAGE"
backup_path=""
previous_image=""
deployment_started=false
docker_config="$(mktemp -d)"

cleanup() {
  rm -rf "$docker_config"
  rm -f "$GHCR_TOKEN_FILE"
}

rollback() {
  local status=$?
  trap - ERR

  if [[ "$deployment_started" == true && -n "$previous_image" ]]; then
    APP_IMAGE="$APP_IMAGE" docker compose -f "$candidate_compose" down --remove-orphans || true

    if [[ -n "$backup_path" && -f "$backup_path" ]]; then
      rm -f "$ECS_PATH/data/app.db" "$ECS_PATH/data/app.db-wal" "$ECS_PATH/data/app.db-shm"
      cp "$backup_path" "$ECS_PATH/data/app.db"
    fi

    APP_IMAGE="$previous_image" docker compose -f "$candidate_compose" up -d --wait --wait-timeout 60 --remove-orphans || true
  fi

  exit "$status"
}

trap cleanup EXIT
trap rollback ERR

test -f "$candidate_compose" && test ! -L "$candidate_compose"
test -s "$GHCR_TOKEN_FILE" && test ! -L "$GHCR_TOKEN_FILE"
APP_IMAGE="$APP_IMAGE" docker compose -f "$candidate_compose" config --quiet

container_id="$(docker ps -q --filter label=com.docker.compose.project=team-account-manager --filter label=com.docker.compose.service=app)"
test -n "$container_id"

if [[ -f "$current_image_file" ]]; then
  previous_image="$(<"$current_image_file")"
else
  previous_image="$(docker inspect -f '{{.Config.Image}}' "$container_id")"
fi
test -n "$previous_image"

rollback_tag="team-account-manager-rollback:$(date -u +%Y%m%d%H%M%S)"
docker tag "$previous_image" "$rollback_tag"
previous_image="$rollback_tag"

backup_dir="$ECS_PATH/data/backups"
backup_name="app-$(date -u +%Y%m%d%H%M%S).db"
mkdir -p "$backup_dir"
docker exec "$container_id" node -e '
  const Database = require("better-sqlite3");
  const db = new Database("/app/data/app.db", { readonly: true });
  db.backup(process.argv[1])
    .then(() => db.close())
    .catch((error) => { console.error(error); process.exit(1); });
' "/app/data/backups/$backup_name"
backup_path="$backup_dir/$backup_name"
test -s "$backup_path"

DOCKER_CONFIG="$docker_config" docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin < "$GHCR_TOKEN_FILE"
for attempt in 1 2 3; do
  if DOCKER_CONFIG="$docker_config" docker pull "$APP_IMAGE"; then
    break
  fi
  test "$attempt" -lt 3
  sleep "$((attempt * 10))"
done
docker image inspect "$APP_IMAGE" >/dev/null

deployment_started=true
APP_IMAGE="$APP_IMAGE" docker compose -f "$candidate_compose" up -d --wait --wait-timeout 60 --remove-orphans
new_container_id="$(APP_IMAGE="$APP_IMAGE" docker compose -f "$candidate_compose" ps -q app)"
test -n "$new_container_id"
test "$(docker inspect -f '{{.State.Health.Status}}' "$new_container_id")" = healthy
docker exec "$new_container_id" node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

mv "$candidate_compose" "$current_compose"
printf '%s\n' "$APP_IMAGE" > "$current_image_file"
find "$backup_dir" -type f -name 'app-*.db' -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2- | xargs -r rm -f
