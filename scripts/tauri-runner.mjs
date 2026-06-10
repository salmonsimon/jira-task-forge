#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

function isWsl() {
  if (process.platform !== "linux") return false;
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;

  try {
    return readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

const env = { ...process.env };

if (isWsl()) {
  env.WEBKIT_DISABLE_DMABUF_RENDERER ??= "1";
  env.LIBGL_ALWAYS_SOFTWARE ??= "1";
  env.GDK_BACKEND ??= "x11";
}

const binName = process.platform === "win32" ? "tauri.cmd" : "tauri";
const localBin = join(process.cwd(), "node_modules", ".bin", binName);
const command = existsSync(localBin) ? localBin : binName;

const child = spawn(command, process.argv.slice(2), {
  env,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
