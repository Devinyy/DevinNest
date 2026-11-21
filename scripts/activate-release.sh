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

HEALTH_CHECK_ATTEMPTS="${HEALTH_CHECK_ATTEMPTS:-10}"
HEALTH_CHECK_DELAY_SECONDS="${HEALTH_CHECK_DELAY_SECONDS:-3}"
case "$HEALTH_CHECK_ATTEMPTS" in
  ''|*[!0-9]*) fail "HEALTH_CHECK_ATTEMPTS must be a non-negative integer" ;;
esac
case "$HEALTH_CHECK_DELAY_SECONDS" in
  ''|*[!0-9]*) fail "HEALTH_CHECK_DELAY_SECONDS must be a non-negative integer" ;;
esac
[ "$HEALTH_CHECK_ATTEMPTS" -gt 0 ] || fail "HEALTH_CHECK_ATTEMPTS must be greater than zero"

verify_service() {
  local attempt=1

  while [ "$attempt" -le "$HEALTH_CHECK_ATTEMPTS" ]; do
    if docker inspect --format '{{.State.Running}}' homepage | grep -qx true; then
      if [ "$HTTP_CHECKER" = curl ]; then
        if curl --fail --silent --show-error --location --insecure \
          --resolve devinnest.top:443:127.0.0.1 \
          --max-time 15 https://devinnest.top/ >/dev/null; then
          return 0
        fi
      elif wget -q --no-check-certificate --timeout=15 --tries=1 \
        --header='Host: devinnest.top' -O /dev/null https://127.0.0.1/; then
        return 0
      fi
    fi

    if [ "$attempt" -lt "$HEALTH_CHECK_ATTEMPTS" ]; then
      echo "Health check attempt $attempt/$HEALTH_CHECK_ATTEMPTS failed; retrying in ${HEALTH_CHECK_DELAY_SECONDS}s." >&2
      sleep "$HEALTH_CHECK_DELAY_SECONDS"
    fi
    attempt=$((attempt + 1))
  done

  return 1
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
VALIDATED_IMAGE_TAG=""

validate_fixed_release() {
  local release="$1"
  local image_prefix="${2:-}"
  local image_tag

  [ -f "$release/docker-compose.yml" ] || fail "release is missing docker-compose.yml: $release"
  [ -f "$release/rollback-compose.override.yml" ] || fail "release has no fixed-image rollback metadata: $release"
  image_tag="$(sed -n 's/^    image: //p' "$release/rollback-compose.override.yml")"
  [ -n "$image_tag" ] || fail "release rollback image tag is missing: $release"
  if [ -n "$image_prefix" ]; then
    case "$image_tag" in
      "$image_prefix"*) ;;
      *) fail "release rollback image tag has an unexpected prefix: $release" ;;
    esac
  fi
  docker image inspect "$image_tag" >/dev/null 2>&1 || fail "release rollback image is missing: $image_tag"
  VALIDATED_IMAGE_TAG="$image_tag"
}

container_uses_image_tag() {
  local image_tag="$1"
  local running_image
  local tagged_image

  running_image="$(docker inspect --format '{{.Image}}' homepage 2>/dev/null || true)"
  tagged_image="$(docker image inspect --format '{{.Id}}' "$image_tag" 2>/dev/null || true)"
  [ -n "$running_image" ] && [ -n "$tagged_image" ] && [ "$running_image" = "$tagged_image" ]
}

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
  validate_fixed_release "$CURRENT_RELEASE"
  CURRENT_IMAGE_TAG="$VALIDATED_IMAGE_TAG"
  case "$CURRENT_IMAGE_TAG" in
    devinnest-release:*|devinnest-legacy:*) ;;
    *) fail "current rollback image tag has an unexpected prefix" ;;
  esac
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

# A first migration can be interrupted after its legacy baseline is created
# but before the current symlink is installed. Reuse exactly one complete
# legacy baseline, and only if the running homepage container still uses its
# pinned image. Other releases may be incomplete attempts and are preserved;
# they are never treated as rollback candidates.
if [ -z "$CURRENT_RELEASE" ] && [ -d "$RELEASES_DIR" ]; then
  legacy_candidates=()
  while IFS= read -r -d '' legacy_candidate; do
    legacy_candidates+=("$legacy_candidate")
  done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -name 'legacy-*' -print0)

  if [ "${#legacy_candidates[@]}" -gt 1 ]; then
    fail "multiple legacy migration baselines exist; refusing to guess"
  fi
  if [ "${#legacy_candidates[@]}" -eq 1 ]; then
    LEGACY_RELEASE="${legacy_candidates[0]}"
    [ -f "$LEGACY_RELEASE/container.inspect.json" ] || fail "legacy migration baseline is incomplete"
    validate_fixed_release "$LEGACY_RELEASE" "devinnest-legacy:"
    LEGACY_IMAGE_TAG="$VALIDATED_IMAGE_TAG"

    if docker container inspect homepage >/dev/null 2>&1; then
      case "$compose_workdir" in
        "$PROJECT_DIR"|"$LEGACY_RELEASE") ;;
        *) fail "existing homepage container is not running from the legacy migration baseline" ;;
      esac
      container_uses_image_tag "$LEGACY_IMAGE_TAG" || fail "existing homepage container is not using the legacy rollback image"
      verify_service || fail "existing legacy homepage container failed its health check"
    fi

    CURRENT_RELEASE="$LEGACY_RELEASE"
    echo "Resuming the interrupted migration from the verified legacy baseline: $CURRENT_RELEASE"
  fi
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
