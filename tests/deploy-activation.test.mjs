import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, readlink, realpath, symlink, writeFile, chmod, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const activationScript = new URL("../scripts/activate-release.sh", import.meta.url);

test("production workflow is restricted to master and verifies the SSH host fingerprint", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
  assert.match(workflow, /branches:\s*\n\s+- master/);
  assert.doesNotMatch(workflow, /- main\b/);
  assert.match(workflow, /pnpm\/action-setup@v4[\s\S]*version: 11\.1\.2/);
  assert.match(workflow, /cache: pnpm/);
  assert.match(workflow, /cache-dependency-path: pnpm-lock\.yaml/);
  assert.match(workflow, /run: pnpm install --frozen-lockfile/);
  assert.doesNotMatch(workflow, /cache: npm|run: npm (?:ci|install)/);
  assert.match(workspace, /esbuild:\s*true/);
  assert.match(workspace, /sharp:\s*true/);
  assert.match(workspace, /ttf2woff2:\s*true/);
  assert.match(workflow, /scp-action@v1\.0\.0[\s\S]*fingerprint: \$\{\{ secrets\.SERVER_HOST_FINGERPRINT \}\}/);
  assert.match(workflow, /ssh-action@v1\.2\.3[\s\S]*fingerprint: \$\{\{ secrets\.SERVER_HOST_FINGERPRINT \}\}/);
  assert.match(workflow, /RELEASE_ID: \$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.doesNotMatch(workflow, /--remove-orphans/);
});

const dockerMock = `#!/bin/sh
set -eu
printf 'docker %s\\n' "$*" >> "$MOCK_LOG"
if [ "$1" = info ]; then exit 0; fi
if [ "$1" = compose ] && [ "\${2:-}" = version ]; then exit 0; fi
if [ "$1" = compose ]; then
  case " $* " in
    *" config --images "*) echo "\${LEGACY_COMPOSE_IMAGE:-homepage-homepage}"; exit 0 ;;
  esac
  if [ "\${COMPOSE_FAIL:-0}" = 1 ]; then exit 1; fi
  if [ "\${FAIL_FIRST:-0}" = 1 ] && [ ! -e "$MOCK_STATE/compose-failed" ]; then
    touch "$MOCK_STATE/compose-failed"
    exit 1
  fi
  exit 0
fi
if [ "$1" = container ] && [ "\${2:-}" = inspect ]; then
  [ "\${CONTAINER_EXISTS:-0}" = 1 ]
  exit $?
fi
if [ "$1" = image ] && [ "\${2:-}" = inspect ]; then
  if [ "\${3:-}" = --format ]; then
    case "\${4:-}" in
      *'.Id'*) echo "\${IMAGE_ID:-sha256:legacy}" ;;
    esac
  fi
  exit 0
fi
if [ "$1" = tag ]; then exit 0; fi
if [ "$1" = inspect ]; then
  if [ "\${2:-}" != --format ]; then echo '{}'; exit 0; fi
  format="\${3:-}"
  case "$format" in
    *'.Image'*) echo "\${IMAGE_ID:-sha256:legacy}" ;;
    *Config.Image*) echo "\${LEGACY_COMPOSE_IMAGE:-homepage-homepage}" ;;
    *State.Running*) echo true ;;
    *com.docker.compose.project.working_dir*) echo "\${COMPOSE_WORKDIR:-}" ;;
    *com.docker.compose.project*) echo "\${COMPOSE_PROJECT:-homepage}" ;;
    *com.docker.compose.service*) echo homepage ;;
    *) echo "" ;;
  esac
  exit 0
fi
exit 1
`;

const curlMock = `#!/bin/sh
set -eu
printf 'curl %s\\n' "$*" >> "$MOCK_LOG"
attempt_file="$MOCK_STATE/curl-attempts"
attempt=0
if [ -f "$attempt_file" ]; then attempt="$(cat "$attempt_file")"; fi
attempt=$((attempt + 1))
printf '%s\\n' "$attempt" > "$attempt_file"
[ "\${HEALTH_FAIL:-0}" != 1 ] || exit 1
if [ "$attempt" -le "\${HEALTH_TRANSIENT_FAILURES:-0}" ]; then exit 1; fi
`;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fixture({ containerExists = false } = {}) {
  const base = await mkdtemp(join(tmpdir(), "devinnest-deploy-"));
  const project = join(base, "project");
  const archiveRoot = join(base, "archive");
  const fakeBin = join(base, "bin");
  const state = join(base, "state");
  const log = join(base, "commands.log");
  await Promise.all([mkdir(project), mkdir(archiveRoot), mkdir(fakeBin), mkdir(state)]);
  await mkdir(join(archiveRoot, "dist"));
  await mkdir(join(archiveRoot, "scripts"));
  await writeFile(join(archiveRoot, "dist/index.html"), "<html></html>");
  await writeFile(join(archiveRoot, "Dockerfile"), "FROM scratch\n");
  await writeFile(join(archiveRoot, "docker-compose.yml"), "services:\n  homepage:\n    image: scratch\n");
  await writeFile(join(archiveRoot, "nginx.conf"), "events {}\n");
  await writeFile(join(archiveRoot, "scripts/activate-release.sh"), await readFile(activationScript));
  await writeFile(join(fakeBin, "docker"), dockerMock);
  await writeFile(join(fakeBin, "curl"), curlMock);
  await Promise.all([
    chmod(join(fakeBin, "docker"), 0o755),
    chmod(join(fakeBin, "curl"), 0o755),
  ]);
  const archive = join(base, "release.tar.gz");
  await execFileAsync("tar", ["-czf", archive, "-C", archiveRoot, "dist", "Dockerfile", "docker-compose.yml", "nginx.conf", "scripts/activate-release.sh"]);
  return {
    base,
    project,
    projectReal: await realpath(project),
    archive,
    fakeBin,
    state,
    log,
    env: {
      RELEASE_ID: "run-1",
      PROJECT_DIR: project,
      ARCHIVE: archive,
      MOCK_LOG: log,
      MOCK_STATE: state,
      CONTAINER_EXISTS: containerExists ? "1" : "0",
      IMAGE_ID: "sha256:legacy",
      LEGACY_COMPOSE_IMAGE: "homepage-homepage",
      HEALTH_CHECK_DELAY_SECONDS: "0",
      PATH: `${fakeBin}:${process.env.PATH}`,
    },
  };
}

async function runActivation(fixtureState, overrides = {}) {
  try {
    const result = await execFileAsync("bash", [activationScript.pathname], {
      env: { ...process.env, ...fixtureState.env, ...overrides },
    });
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, stdout: error.stdout || "", stderr: error.stderr || "", code: error.code };
  }
}

async function createInterruptedLegacyBaseline(fixtureState, id = "legacy-run-0") {
  const legacy = join(fixtureState.projectReal, "releases", id);
  await mkdir(join(legacy, "dist"), { recursive: true });
  await writeFile(join(legacy, "dist/index.html"), "legacy\n");
  await writeFile(join(legacy, "Dockerfile"), "legacy\n");
  await writeFile(join(legacy, "docker-compose.yml"), "services:\n  homepage:\n    image: homepage-homepage\n");
  await writeFile(join(legacy, "nginx.conf"), "legacy\n");
  await writeFile(join(legacy, "container.inspect.json"), "{}\n");
  await writeFile(
    join(legacy, "rollback-compose.override.yml"),
    "services:\n  homepage:\n    image: devinnest-legacy:" + id + "\n",
  );
  return legacy;
}

test("first release adopts a verified homepage container as a rollback baseline", async () => {
  const f = await fixture({ containerExists: true });
  for (const file of ["Dockerfile", "docker-compose.yml", "nginx.conf"]) {
    await writeFile(join(f.project, file), "legacy\n");
  }
  await mkdir(join(f.project, "dist"));
  await writeFile(join(f.project, "dist/index.html"), "legacy\n");

  const result = await runActivation(f, { COMPOSE_WORKDIR: f.projectReal });
  assert.equal(result.ok, true, result.stderr);
  assert.equal(await readlink(join(f.project, "current")), join(f.projectReal, "releases/run-1"));
  assert.equal(await exists(join(f.project, "releases/legacy-run-1/dist/index.html")), true);
  assert.match(await readFile(join(f.project, "releases/run-1/rollback-compose.override.yml"), "utf8"), /devinnest-release:run-1/);
  assert.match(await readFile(f.log, "utf8"), /docker compose -p homepage up -d --build/);
});

test("a failed first release rolls back to the pinned legacy image without rebuilding it", async () => {
  const f = await fixture({ containerExists: true });
  for (const file of ["Dockerfile", "docker-compose.yml", "nginx.conf"]) {
    await writeFile(join(f.project, file), "legacy\n");
  }
  await mkdir(join(f.project, "dist"));
  await writeFile(join(f.project, "dist/index.html"), "legacy\n");

  const result = await runActivation(f, {
    COMPOSE_WORKDIR: f.projectReal,
    FAIL_FIRST: "1",
  });
  assert.equal(result.ok, false, "a failed first release must fail the workflow");
  assert.match(result.stderr, /Rollback completed/);
  assert.equal(await readlink(join(f.project, "current")), join(f.projectReal, "releases/legacy-run-1"));
  assert.match(await readFile(join(f.project, "releases/legacy-run-1/rollback-compose.override.yml"), "utf8"), /devinnest-legacy:run-1/);
  assert.match(await readFile(f.log, "utf8"), /up -d --no-build/);
});

test("health checks retry transient TLS startup failures", async () => {
  const f = await fixture({ containerExists: true });
  for (const file of ["Dockerfile", "docker-compose.yml", "nginx.conf"]) {
    await writeFile(join(f.project, file), "legacy\n");
  }
  await mkdir(join(f.project, "dist"));
  await writeFile(join(f.project, "dist/index.html"), "legacy\n");

  const result = await runActivation(f, {
    COMPOSE_WORKDIR: f.projectReal,
    HEALTH_TRANSIENT_FAILURES: "2",
  });
  assert.equal(result.ok, true, result.stderr);
  const curlAttempts = Number.parseInt(await readFile(join(f.state, "curl-attempts"), "utf8"), 10);
  assert.ok(curlAttempts >= 3, `expected retries, got ${curlAttempts} curl attempts`);
});

test("an interrupted first migration resumes one verified legacy baseline", async () => {
  const f = await fixture({ containerExists: true });
  const legacy = await createInterruptedLegacyBaseline(f);

  const result = await runActivation(f, {
    COMPOSE_WORKDIR: legacy,
    RELEASE_ID: "run-resume",
    IMAGE_ID: "sha256:legacy",
    HEALTH_TRANSIENT_FAILURES: "2",
  });
  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /Resuming the interrupted migration/);
  assert.equal(await readlink(join(f.project, "current")), join(f.projectReal, "releases/run-resume"));
  assert.equal(await exists(join(f.project, "releases/legacy-run-0/container.inspect.json")), true);
});

test("a recovered legacy baseline can remain current for the next release", async () => {
  const f = await fixture({ containerExists: true });
  const legacy = await createInterruptedLegacyBaseline(f);
  await symlink(legacy, join(f.project, "current"));

  const result = await runActivation(f, {
    COMPOSE_WORKDIR: legacy,
    RELEASE_ID: "run-after-recovery",
    IMAGE_ID: "sha256:legacy",
  });
  assert.equal(result.ok, true, result.stderr);
  assert.equal(await readlink(join(f.project, "current")), join(f.projectReal, "releases/run-after-recovery"));
});

test("a failed update rolls back to the managed current release", async () => {
  const f = await fixture({ containerExists: false });
  const current = join(f.projectReal, "releases/current-release");
  await mkdir(current, { recursive: true });
  await writeFile(join(current, "docker-compose.yml"), "services:\n  homepage:\n    image: scratch\n");
  await writeFile(join(current, "rollback-compose.override.yml"), "services:\n  homepage:\n    image: devinnest-release:current\n");
  await symlink(current, join(f.project, "current"));

  const result = await runActivation(f, {
    CONTAINER_EXISTS: "1",
    COMPOSE_WORKDIR: current,
    RELEASE_ID: "run-2",
    FAIL_FIRST: "1",
  });
  assert.equal(result.ok, false, "a failed release must fail the workflow");
  assert.match(result.stderr, /Rollback completed/);
  assert.equal(await readlink(join(f.project, "current")), current);
  const log = await readFile(f.log, "utf8");
  assert.equal((log.match(/docker compose -p homepage up -d --build/g) || []).length, 1);
  assert.match(log, /up -d --no-build/);
});

test("an existing homepage container with the wrong compose identity is rejected", async () => {
  const f = await fixture({ containerExists: false });
  const current = join(f.projectReal, "releases/current-release");
  await mkdir(current, { recursive: true });
  await writeFile(join(current, "docker-compose.yml"), "services:\n  homepage:\n    image: scratch\n");
  await writeFile(join(current, "rollback-compose.override.yml"), "services:\n  homepage:\n    image: devinnest-release:current\n");
  await symlink(current, join(f.project, "current"));

  const result = await runActivation(f, {
    CONTAINER_EXISTS: "1",
    COMPOSE_PROJECT: "someone-else",
    COMPOSE_WORKDIR: current,
  });
  assert.equal(result.ok, false);
  assert.match(result.stderr, /not managed by Compose project homepage/);
  assert.doesNotMatch(await readFile(f.log, "utf8"), /docker compose -p homepage up/);
});

test("a first release reports that no rollback exists when the server is empty", async () => {
  const f = await fixture();
  const result = await runActivation(f, { COMPOSE_FAIL: "1" });
  assert.equal(result.ok, false);
  assert.match(result.stderr, /No previous release exists; manual recovery is required/);
});
