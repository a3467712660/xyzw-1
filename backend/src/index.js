import http from "http";
import { env } from "./config/env.js";
import { initDatabase } from "./db/database.js";
import { ensureBootstrapAdminFromEnv } from "./services/bootstrapService.js";
import { startTemporaryInviteAutoJob } from "./services/temporaryInviteService.js";
import { backup, scheduleDailyBackup } from "./db/client.js";
import { createApp } from "./app/createApp.js";
import { registerWs } from "./app/registerWs.js";
import { startBackgroundJobs } from "./app/startBackgroundJobs.js";

const bootstrap = async () => {
  await initDatabase();
  try {
    backup("startup");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[db-backup] startup backup failed:", error.message);
  }
  scheduleDailyBackup();
  ensureBootstrapAdminFromEnv();
  startTemporaryInviteAutoJob();

  const { app, corsOriginSet } = createApp();

  const server = http.createServer(app);
  registerWs(server, corsOriginSet);
  startBackgroundJobs();

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening at http://localhost:${env.port}`);
  });
};

bootstrap();
