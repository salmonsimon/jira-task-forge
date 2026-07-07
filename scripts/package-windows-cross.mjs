import { mkdirSync, readdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolRoot = "/tmp/codex-windows-packaging-tools";
const debDir = join(toolRoot, "debs");
const extractRoot = join(toolRoot, "root");
const binDir = join(toolRoot, "bin");
const xwinCacheDir = join(toolRoot, "xwin");

const packages = [
  "nsis",
  "nsis-common",
  "lld-21",
  "llvm-21",
  "llvm-21-tools",
  "llvm-21-linker-tools",
  "clang-21",
  "libclang-cpp21",
  "libclang1-21",
  "libclang-common-21-dev",
  "libllvm21",
  "libstdc++-15-dev",
  "libgcc-15-dev",
  "libobjc-15-dev",
];

function run(command, args, options = {}) {
  console.log(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    env: options.env ?? process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function canRun(command, args = ["--version"], env = process.env) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "ignore", env });
  return result.status === 0;
}

function ensureDirs() {
  for (const dir of [toolRoot, debDir, extractRoot, binDir, xwinCacheDir]) {
    mkdirSync(dir, { recursive: true });
  }
}

function ensureDebs() {
  const existing = readdirSync(debDir);
  const missing = packages.filter((pkg) => !existing.some((file) => file.startsWith(`${pkg}_`)));

  if (missing.length > 0) {
    run("apt-get", ["download", ...missing], { cwd: debDir });
  }

  for (const deb of readdirSync(debDir).filter((file) => file.endsWith(".deb"))) {
    run("dpkg-deb", ["-x", join(debDir, deb), extractRoot]);
  }
}

function ensureRustTarget() {
  const result = spawnSync("rustup", ["target", "list", "--installed"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }

  if (!result.stdout.includes("x86_64-pc-windows-msvc")) {
    run("rustup", ["target", "add", "x86_64-pc-windows-msvc"]);
  }
}

function ensureCargoXwin(env) {
  if (!canRun("cargo-xwin", ["--version"], env)) {
    run("cargo", ["install", "--locked", "cargo-xwin"], { env });
  }
}

function writeMakensisWrapper() {
  const wrapperPath = join(binDir, "makensis");
  writeFileSync(
    wrapperPath,
    `#!/usr/bin/env bash
set -euo pipefail

ROOT=${extractRoot}

exec bwrap \\
  --ro-bind / / \\
  --bind ${repoRoot} ${repoRoot} \\
  --bind /tmp /tmp \\
  --tmpfs /usr/share \\
  --ro-bind "$ROOT/usr/share/nsis" /usr/share/nsis \\
  "$ROOT/usr/bin/makensis" "$@"
`,
  );
  chmodSync(wrapperPath, 0o755);
}

ensureDirs();
ensureDebs();

const env = {
  ...process.env,
  PATH: [
    binDir,
    join(extractRoot, "usr/bin"),
    join(extractRoot, "usr/lib/llvm-21/bin"),
    join(process.env.HOME ?? "", ".cargo/bin"),
    process.env.PATH ?? "",
  ].join(":"),
  LD_LIBRARY_PATH: [
    join(extractRoot, "usr/lib/x86_64-linux-gnu"),
    join(extractRoot, "usr/lib/llvm-21/lib"),
    process.env.LD_LIBRARY_PATH ?? "",
  ].join(":"),
  NSISDIR: join(extractRoot, "usr/share/nsis"),
  XWIN_CACHE_DIR: xwinCacheDir,
};

if (!canRun("bwrap", ["--version"], env)) {
  console.error("bubblewrap (bwrap) is required to expose portable NSIS stubs to makensis.");
  process.exit(1);
}

ensureRustTarget();
ensureCargoXwin(env);
writeMakensisWrapper();

run(
  "npm",
  [
    "run",
    "tauri",
    "build",
    "--",
    "--runner",
    "cargo-xwin",
    "--target",
    "x86_64-pc-windows-msvc",
    "--bundles",
    "nsis",
  ],
  { env },
);
