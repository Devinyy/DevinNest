#!/usr/bin/env bash

set -euo pipefail

: "${RELEASE_ID:?RELEASE_ID is required}"
: "${PROJECT_DIR:?PROJECT_DIR is required}"
: "${ARCHIVE:=/tmp/devinnest-release.tar.gz}"

fail() {
  echo "Deployment preflight failed: $*" >&2
  exit 1
}

case "$RELEASE_ID" in
  ""|*[!A-Za-z0-9._-]*) fail "invalid release id" ;;
esac

case "$PROJECT_DIR" in
  /*) ;;
  *) fail "PROJECT_DIR must be an absolute path" ;;
esac

case "$ARCHIVE" in
  /*) ;;
  *) fail "ARCHIVE must be an absolute path" ;;
esac

[ -f "$ARCHIVE" ] || fail "release archive does not exist: $ARCHIVE"
command -v docker >/dev/null 2>&1 || fail "Docker is not installed"
docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable"

COMPOSE_BIN=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE_BIN=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_BIN=(docker-compose)
else
  fail "Docker Compose is not installed"
fi

if command -v curl >/dev/null 2>&1; then
  HTTP_CHECKER=curl
elif command -v wget >/dev/null 2>&1; then
  HTTP_CHECKER=wget
else
  fail "curl or wget is required for the post-deploy health check"
fi

verify_service() {
  docker inspect --format '{{.State.Running}}' homepage | grep -qx true || return 1
  if [ "$HTTP_CHECKER" = curl ]; then
    curl --fail --silent --show-error --location --insecure \
      --resolve devinnest.top:443:127.0.0.1 \
      --max-time 15 https://devinnest.top/ >/dev/null
  else
    wget -q --no-check-certificate --timeout=15 --tries=1 \
      --header='Host: devinnest.top' -O /dev/null https://127.0.0.1/
  fi
}

compose_up() {
  local release="$1"
  (
    cd "$release"
    ASTRO_SITE="" "${COMPOSE_BIN[@]}" -p homepage up -d --build
  )
}

compose_up_fixed() {
  local release="$1"
  (
    cd "$release"
    ASTRO_SITE="" "${COMPOSE_BIN[@]}" -p homepage \
      -f "$release/docker-compose.yml" \
      -f "$release/rollback-compose.override.yml" \
      up -d --no-build
  )
}

pin_release_image() {
  local release="$1"
  local image_id
  local image_tag

  image_id="$(docker inspect --format '{{.Image}}' homepage 2>/dev/null || true)"
  [ -n "$image_id" ] || return 1
  docker image inspect "$image_id" >/dev/null 2>&1 || return 1
  image_tag="devinnest-release:$RELEASE_ID"
  docker tag "$image_id" "$image_tag" || return 1
  docker inspect homepage > "$release/container.inspect.json" || return 1
  printf '%s\n' 'services:' '  homepage:' "    image: $image_tag" \
    > "$release/rollback-compose.override.yml"
}

if [ -L "$PROJECT_DIR" ]; then
  fail "project directory must not be a symlink: $PROJECT_DIR"
fi
if [ -e "$PROJECT_DIR" ] && [ ! -d "$PROJECT_DIR" ]; then
  fail "project path is not a directory: $PROJECT_DIR"
fi
mkdir -p "$PROJECT_DIR"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd -P)"

RELEASES_DIR="$PROJECT_DIR/releases"
CURRENT_LINK="$PROJECT_DIR/current"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
CURRENT_RELEASE=""
LEGACY_RELEASE=""
LEGACY_IMAGE_TAG=""
CURRENT_ROLLBACK_OVERRIDE=""

if [ -L "$RELEASES_DIR" ] || { [ -e "$RELEASES_DIR" ] && [ ! -d "$RELEASES_DIR" ]; }; then
  fail "releases path is not a normal directory"
fi
if [ -e "$CURRENT_LINK" ] && [ ! -L "$CURRENT_LINK" ]; then
  fail "current must be a symlink managed by this workflow"
fi

if [ -L "$CURRENT_LINK" ]; then
  CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
  [ -n "$CURRENT_RELEASE" ] || fail "current is a broken symlink"
  case "$CURRENT_RELEASE" in
    "$PROJECT_DIR/releases/"*) ;;
    *) fail "current points outside the managed releases directory" ;;
  esac
  [ -f "$CURRENT_RELEASE/docker-compose.yml" ] || fail "current release is incomplete"
  [ -d "$RELEASES_DIR" ] || fail "releases directory is missing"
  CURRENT_ROLLBACK_OVERRIDE="$CURRENT_RELEASE/rollback-compose.override.yml"
  [ -f "$CURRENT_ROLLBACK_OVERRIDE" ] || fail "current release has no fixed-image rollback metadata"
  CURRENT_IMAGE_TAG="$(sed -n 's/^    image: //p' "$CURRENT_ROLLBACK_OVERRIDE")"
  [ -n "$CURRENT_IMAGE_TAG" ] || fail "current rollback image tag is missing"
  docker image inspect "$CURRENT_IMAGE_TAG" >/dev/null 2>&1 || fail "current rollback image is missing"
fi

compose_project=""
compose_service=""
compose_workdir=""

archive_entries="$(tar -tzf "$ARCHIVE")" || fail "release archive cannot be read"
printf '%s\n' "$archive_entries" | grep -Eq '(^/|(^|/)\.\.(/|$))' && fail "release archive contains an unsafe path"
for required_entry in dist/index.html Dockerfile docker-compose.yml nginx.conf scripts/activate-release.sh; do
  printf '%s\n' "$archive_entries" | grep -Fxq "$required_entry" || fail "release archive is missing $required_entry"
done

if docker container inspect homepage >/dev/null 2>&1; then
  compose_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' homepage 2>/dev/null || true)"
  compose_service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' homepage 2>/dev/null || true)"
  compose_workdir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' homepage 2>/dev/null || true)"

  [ "$compose_project" = homepage ] || fail "existing homepage container is not managed by Compose project homepage"
  [ "$compose_service" = homepage ] || fail "existing homepage container is not the homepage service"
fi

# The first automated release may adopt the currently running, verified
# homepage container as a rollback baseline. It must still be the expected
# Compose project, run from PROJECT_DIR, and pass the same health check. The
# backend containers are never inspected, stopped, or recreated here.
if [ -z "$CURRENT_RELEASE" ] && [ -n "$compose_project" ]; then
  [ "$compose_workdir" = "$PROJECT_DIR" ] || fail "existing homepage container is not running from PROJECT_DIR"
  verify_service || fail "existing homepage container failed its health check"

  [ ! -e "$RELEASES_DIR" ] || fail "releases exists without current; refusing an ambiguous migration state"
  for source in Dockerfile docker-compose.yml nginx.conf dist; do
    source_path="$PROJECT_DIR/$source"
    [ -e "$source_path" ] || fail "legacy baseline is missing $source"
    [ ! -L "$source_path" ] || fail "legacy baseline contains a symlink at $source"
  done

  LEGACY_IMAGE_ID="$(docker inspect --format '{{.Image}}' homepage 2>/dev/null || true)"
  LEGACY_COMPOSE_IMAGE="$(docker inspect --format '{{.Config.Image}}' homepage 2>/dev/null || true)"
  [ -n "$LEGACY_IMAGE_ID" ] || fail "existing homepage image id is unavailable"
  [ -n "$LEGACY_COMPOSE_IMAGE" ] || fail "existing homepage image name is unavailable"
  docker image inspect "$LEGACY_IMAGE_ID" >/dev/null 2>&1 || fail "existing homepage image cannot be inspected"
  docker image inspect "$LEGACY_COMPOSE_IMAGE" >/dev/null 2>&1 || fail "existing homepage image tag cannot be inspected"
  legacy_compose_images="$(
    cd "$PROJECT_DIR"
    "${COMPOSE_BIN[@]}" -p homepage -f docker-compose.yml config --images 2>/dev/null || true
  )"
  legacy_image_match=0
  while IFS= read -r compose_image; do
    [ -n "$compose_image" ] || continue
    if [ "$compose_image" = "$LEGACY_COMPOSE_IMAGE" ]; then
      legacy_image_match=1
      break
    fi
    resolved_image_id="$(docker image inspect --format '{{.Id}}' "$compose_image" 2>/dev/null || true)"
    if [ "$resolved_image_id" = "$LEGACY_IMAGE_ID" ]; then
      legacy_image_match=1
      break
    fi
  done <<< "$legacy_compose_images"
  [ "$legacy_image_match" = 1 ] || fail "existing homepage image does not match the Compose configuration"

  mkdir "$RELEASES_DIR"
  LEGACY_RELEASE="$RELEASES_DIR/legacy-$RELEASE_ID"
  mkdir "$LEGACY_RELEASE"
  LEGACY_IMAGE_TAG="devinnest-legacy:$RELEASE_ID"
  docker tag "$LEGACY_IMAGE_ID" "$LEGACY_IMAGE_TAG"
  docker inspect homepage > "$LEGACY_RELEASE/container.inspect.json"
  printf '%s\n' 'services:' '  homepage:' "    image: $LEGACY_IMAGE_TAG" \
    > "$LEGACY_RELEASE/rollback-compose.override.yml"
  for source in Dockerfile docker-compose.yml nginx.conf dist; do
    cp -a "$PROJECT_DIR/$source" "$LEGACY_RELEASE/"
  done
  if [ -f "$PROJECT_DIR/.env" ]; then
    cp -a "$PROJECT_DIR/.env" "$LEGACY_RELEASE/"
  fi
  CURRENT_RELEASE="$LEGACY_RELEASE"
  echo "Adopting the verified existing homepage container as rollback baseline: $CURRENT_RELEASE"
fi

# Refuse to take over an unknown checkout or an existing homepage container.
# An empty directory is the only valid state for a brand-new installation.
if [ -z "$CURRENT_RELEASE" ]; then
  if [ -n "$compose_project" ]; then
    fail "existing homepage container has no verified rollback baseline"
  fi
  if find "$PROJECT_DIR" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
    fail "project directory is non-empty but has no managed current release; migrate it manually first"
  fi
else
  if [ -z "$LEGACY_RELEASE" ]; then
    while IFS= read -r entry; do
      case "$(basename "$entry")" in
        current|releases) ;;
        *) : ;; # Legacy source files are preserved and never overwritten.
      esac
    done < <(find "$PROJECT_DIR" -mindepth 1 -maxdepth 1 -print)
  fi
fi

if docker container inspect homepage >/dev/null 2>&1 && [ -z "$LEGACY_RELEASE" ]; then
  [ "$compose_workdir" = "$CURRENT_RELEASE" ] || fail "existing homepage container is not running from current"
fi

[ ! -e "$RELEASE_DIR" ] || fail "release directory already exists; refusing to overwrite it"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"

if ! compose_up "$RELEASE_DIR" || ! verify_service || ! pin_release_image "$RELEASE_DIR"; then
  echo "Release $RELEASE_ID failed its health check." >&2
  if [ -n "$CURRENT_RELEASE" ]; then
    echo "Attempting rollback to $CURRENT_RELEASE." >&2
    if compose_up_fixed "$CURRENT_RELEASE" && verify_service; then
      if [ -n "$LEGACY_RELEASE" ]; then
        ln -sfn "$CURRENT_RELEASE" "$CURRENT_LINK"
      fi
      echo "Rollback completed." >&2
    else
      echo "Rollback failed; manual recovery is required." >&2
    fi
  else
    echo "No previous release exists; manual recovery is required." >&2
  fi
  exit 1
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
rm -f "$ARCHIVE"
echo "Activated release $RELEASE_ID"
