import http from "http";
import { env } from "./config/env.js";
import { initDatabase } from "./db/database.js";
import { assertNoBootstrapAdminEnvInProduction } from "./services/bootstrapService.js";
import { backup, scheduleDailyBackup } from "./db/client.js";
import { createApp } from "./app/createApp.js";
import { registerWs } from "./app/registerWs.js";
import { startBackgroundJobs } from "./app/startBackgroundJobs.js";
import { assertProductionBuildInfoReady, publicBuildInfo } from "./lib/buildInfo.js";
import { userRepository } from "./repositories/userRepository.js";

const assertProductionAdminMfaReady = () => {
  if (env.nodeEnv !== "production") return;
  const adminsWithoutMfa = userRepository.listAdminUsersWithoutMfa();
  if (!adminsWithoutMfa.length) return;
  const identities = adminsWithoutMfa
    .map((user) => String(user.username || user.email || user.id || "").trim())
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `Production startup blocked: admin MFA is required. Admins without MFA: ${identities}`,
  );
};

const bootstrap = async () => {
  assertNoBootstrapAdminEnvInProduction();
  assertProductionBuildInfoReady(env.nodeEnv);
  await initDatabase();
  assertProductionAdminMfaReady();
  if (env.appDbBackupEnabled) {
    try {
      backup("startup");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[db-backup] startup backup failed:", error.message);
    }
    scheduleDailyBackup();
  } else {
    // eslint-disable-next-line no-console
    console.log("[db-backup] app-level SQLite backup disabled; use infrastructure-level encrypted backups in production.");
  }

  const { app, corsOriginSet } = createApp();

  const server = http.createServer(app);
  registerWs(server, corsOriginSet);
  startBackgroundJobs();

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `Backend listening at http://localhost:${env.port} (build=${publicBuildInfo.gitSha} id=${publicBuildInfo.buildId} time=${publicBuildInfo.buildTime})`,
    );
  });
};

bootstrap();
