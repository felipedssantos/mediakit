import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const cargoBin = path.join(os.homedir(), ".cargo", "bin");
const pathKey = process.env.Path ? "Path" : "PATH";
const current = process.env[pathKey] ?? process.env.PATH ?? "";
if (
  !current.toLowerCase().includes(".cargo\\bin") &&
  !current.includes(".cargo/bin")
) {
  process.env.PATH = `${cargoBin}${path.delimiter}${current}`;
  process.env.Path = process.env.PATH;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Uso: node scripts/with-cargo.mjs <comando> [...args]");
  process.exit(1);
}

const child = spawn([command, ...args].join(" "), {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
