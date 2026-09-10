import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import app from "./app";
import { logger } from "./lib/logger";

function loadRepoEnv() {
  let currentDir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    const envPath = path.join(currentDir, ".env");
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  dotenv.config();
}

loadRepoEnv();

const rawPort = process.env["PORT"] ?? "4000";
const preferredPort = Number(rawPort);

if (Number.isNaN(preferredPort) || preferredPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const startServer = (port: number) => {
  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port + 1;
      logger.warn({ port, nextPort }, "Port busy; retrying on next port");
      startServer(nextPort);
      return;
    }

    logger.error({ err: error }, "Error listening on port");
    process.exit(1);
  });
};

startServer(preferredPort);
