import { spawn } from "node:child_process";
import { mkdir, appendFile } from "node:fs/promises";

const RESTART_DELAY_MS = Number(process.env.SYNC_RESTART_DELAY_MS || 30000);
const INACTIVITY_TIMEOUT_MS = Number(process.env.SYNC_INACTIVITY_TIMEOUT_MS || 15 * 60 * 1000);
const CHECK_INTERVAL_MS = 15000;
const LOG_DIR = ".sync";
const LOG_PATH = `${LOG_DIR}/parts-sync-watchdog.log`;

function now() {
  return new Date().toISOString();
}

async function log(message) {
  const line = `[${now()}] ${message}`;
  console.log(line);
  try {
    await appendFile(LOG_PATH, `${line}\n`, "utf8");
  } catch {
    // ignore log file write errors
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce() {
  await log("Starting sync worker...");

  return await new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/sync-rebrickable-parts.mjs"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let lastActivityAt = Date.now();
    let killedByWatchdog = false;

    child.stdout.on("data", async (chunk) => {
      lastActivityAt = Date.now();
      await log(String(chunk).trimEnd());
    });

    child.stderr.on("data", async (chunk) => {
      lastActivityAt = Date.now();
      await log(`ERR ${String(chunk).trimEnd()}`);
    });

    const timer = setInterval(async () => {
      if (Date.now() - lastActivityAt < INACTIVITY_TIMEOUT_MS) {
        return;
      }

      killedByWatchdog = true;
      await log(`No activity for ${INACTIVITY_TIMEOUT_MS}ms. Restarting worker...`);
      child.kill("SIGTERM");

      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 10000);
    }, CHECK_INTERVAL_MS);

    child.on("exit", (code, signal) => {
      clearInterval(timer);
      resolve({ code: Number(code ?? 1), signal: signal ?? null, killedByWatchdog });
    });
  });
}

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  await log("Watchdog started.");

  let restartCount = 0;

  while (true) {
    const result = await runOnce();

    if (result.code === 0 && !result.killedByWatchdog) {
      await log("Sync finished successfully. Watchdog exiting.");
      break;
    }

    restartCount += 1;
    await log(
      `Worker stopped (code=${result.code}, signal=${result.signal}, watchdog=${result.killedByWatchdog}). Restart #${restartCount} in ${RESTART_DELAY_MS}ms...`,
    );
    await sleep(RESTART_DELAY_MS);
  }
}

main().catch(async (error) => {
  await log(`Fatal watchdog error: ${String(error?.stack || error)}`);
  process.exit(1);
});
