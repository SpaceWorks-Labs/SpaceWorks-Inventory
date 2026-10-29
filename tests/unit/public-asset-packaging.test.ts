import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("passes only fixture coordinates through an environment-clearing sudo", () => {
  const source = readFileSync("scripts/test-vps-install.sh", "utf8").replace(/\r\n/g, "\n");
  const helper = source.match(/as_root\(\) \{[\s\S]*?\n\}/)?.[0];
  expect(helper).toBeTruthy();
  const windowsBash = "C:/Program Files/Git/bin/bash.exe";
  const bash = process.platform === "win32" && existsSync(windowsBash) ? windowsBash : "bash";
  const result = spawnSync(bash, ["-c", `${helper}
id() { printf '1000\\n'; }
sudo() {
  if [[ "$1" = -E ]]; then shift; fi
  env -i PATH="$PATH" SYSTEMROOT="\${SYSTEMROOT:-}" "$@"
}
export CI=true SWI_CONFIG_DIR='/tmp/private fixture/config' SWI_PROJECT_NAME=swi-smoke-disposable
export UNRELATED_TEST_SECRET=not-forwarded
as_root "$BASH" -c 'printf "%s\\n" "$CI" "$SWI_CONFIG_DIR" "$SWI_PROJECT_NAME" "\${UNRELATED_TEST_SECRET-unset}"'
`], { encoding: "utf8", timeout: 20_000, env: { ...process.env, NODE_ENV: "test" } });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim().split("\n")).toEqual(["true", "/tmp/private fixture/config", "swi-smoke-disposable", "unset"]);
}, 25_000);

it("cleans only its restrictive public fixture when an actual installer build fails", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "inventory packaging "));
  const scripts = path.join(fixture, "scripts"), publicDir = path.join(fixture, "public");
  const windowsBash = "C:/Program Files/Git/bin/bash.exe";
  const bash = process.platform === "win32" && existsSync(windowsBash) ? windowsBash : "bash";
  try {
    mkdirSync(scripts); mkdirSync(publicDir); mkdirSync(path.join(fixture, "tmp"));
    cpSync(path.join(process.cwd(), "scripts/test-vps-install.sh"), path.join(scripts, "test-vps-install.sh"));
    const existing = path.join(publicDir, "existing.txt");
    writeFileSync(existing, "existing checkout asset", { mode: 0o640 });
    const mode = statSync(existing).mode;
    const result = spawnSync(bash, ["-c", `
docker() {
  if [[ "$1" = build ]]; then
    probe=$(find "$PWD/public" -mindepth 1 -maxdepth 1 -type d -name 'audit-permissions.*')
    [[ -n "$probe" ]] || return 91
    cat "$probe/nested/readable.txt" > "$PROBE_CONTENT_LOG"
    stat -c '%a' "$probe" "$probe/nested" "$probe/nested/readable.txt" > "$PROBE_MODE_LOG"
    return 23
  fi
}
id() { printf '0\\n'; }
export -f docker id
if [[ -n "\${SWI_WINDOWS_FIXTURE:-}" ]]; then
  # Windows has no POSIX chmod contract; Linux checks the real modes below.
  mkdir() { if [[ "$1" = -m ]]; then shift 2; fi; command mkdir "$@"; }
  export -f mkdir
fi
exec "$BASH" scripts/test-vps-install.sh
`], {
      cwd: fixture, encoding: "utf8", timeout: 20_000,
      env: {
        ...process.env, NODE_ENV: "test", CI: "true",
        TMPDIR: path.join(fixture, "tmp").replaceAll("\\", "/"),
        PROBE_CONTENT_LOG: path.join(fixture, "content.log").replaceAll("\\", "/"),
        PROBE_MODE_LOG: path.join(fixture, "modes.log").replaceAll("\\", "/"),
        SWI_WINDOWS_FIXTURE: process.platform === "win32" ? "1" : "",
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(23);
    expect(readFileSync(path.join(fixture, "content.log"), "utf8")).toBe("inventory-public-permission-fixture\n");
    if (process.platform !== "win32") expect(readFileSync(path.join(fixture, "modes.log"), "utf8").trim().split("\n")).toEqual(["700", "700", "600"]);
    expect(readdirSync(publicDir)).toEqual(["existing.txt"]);
    expect(readFileSync(existing, "utf8")).toBe("existing checkout asset");
    expect(statSync(existing).mode).toBe(mode);
    expect(readdirSync(path.join(fixture, "tmp"))).toEqual([]);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
}, 25_000);
