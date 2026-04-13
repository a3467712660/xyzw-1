import http from "http";
import { env } from "./config/env.js";
import { closeDatabase, initDatabase } from "./db/database.js";
import { assertNoBootstrapAdminEnvInProduction } from "./services/bootstrapService.js";
import { backup, scheduleDailyBackup } from "./db/client.js";
import { createApp } from "./app/createApp.js";
import { registerWs } from "./app/registerWs.js";
import { startBackgroundJobs } from "./app/startBackgroundJobs.js";
import {
  assertProductionBuildInfoReady,
  publicBuildInfo,
} from "./lib/buildInfo.js";
import { userRepository } from "./repositories/userRepository.js";

const WS_SHUTDOWN_TIMEOUT_MS = 3000;
const TASK_CONTROL_SCHEDULER_GRACE_MS = 5000;
const SHUTDOWN_HARD_TIMEOUT_MS = 10000;

let runtime = null;
let shutdownPromise = null;

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

const closeHttpServer = async (server) => {
  if (!server || !server.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });
};

const closeWsServer = async (wss) => {
  if (!wss) {
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(undefined);
    };

    const timeout = setTimeout(() => {
      wss.clients.forEach((client) => {
        try {
          client.terminate?.();
        } catch {
          // ignore terminate failure during shutdown
        }
      });
      finish();
    }, WS_SHUTDOWN_TIMEOUT_MS);

    wss.clients.forEach((client) => {
      try {
        client.close?.(1001, "Server shutting down");
      } catch {
        // ignore close failure during shutdown
      }
    });

    wss.close(() => {
      clearTimeout(timeout);
      finish();
    });
  });
};

const logShutdownError = (label, error) => {
  // eslint-disable-next-line no-console
  console.error(`[lifecycle] ${label} shutdown failed:`, error);
};

const initiateShutdown = async ({
  reason,
  exitCode = 0,
  error = null,
} = {}) => {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[lifecycle] shutdown requested: ${reason}`, error);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[lifecycle] shutdown requested: ${reason}`);
    }

    const activeRuntime = runtime;
    runtime = null;

    let finalExitCode = exitCode;

    try {
      await closeHttpServer(activeRuntime?.server);
    } catch (shutdownError) {
      finalExitCode = 1;
      logShutdownError("http-server", shutdownError);
    }

    try {
      await closeWsServer(activeRuntime?.wss);
    } catch (shutdownError) {
      finalExitCode = 1;
      logShutdownError("ws-server", shutdownError);
    }

    try {
      await activeRuntime?.backgroundJobs?.stopAll?.({
        schedulerGraceMs: TASK_CONTROL_SCHEDULER_GRACE_MS,
      });
    } catch (shutdownError) {
      finalExitCode = 1;
      logShutdownError("background-jobs", shutdownError);
    }

    try {
      activeRuntime?.backupHandle?.stop?.();
    } catch (shutdownError) {
      finalExitCode = 1;
      logShutdownError("db-backup", shutdownError);
    }

    try {
      closeDatabase();
    } catch (shutdownError) {
      finalExitCode = 1;
      logShutdownError("database", shutdownError);
    }

    return finalExitCode;
  })();

  const timeoutResult = await Promise.race([
    shutdownPromise,
    new Promise((resolve) => {
      setTimeout(() => {
        // eslint-disable-next-line no-console
        console.error(
          `[lifecycle] shutdown timed out after ${SHUTDOWN_HARD_TIMEOUT_MS}ms`,
        );
        resolve(1);
      }, SHUTDOWN_HARD_TIMEOUT_MS);
    }),
  ]);

  process.exit(Number(timeoutResult) || 0);
};

const installProcessHandlers = () => {
  process.on("SIGINT", () => {
    void initiateShutdown({ reason: "SIGINT", exitCode: 0 });
  });

  process.on("SIGTERM", () => {
    void initiateShutdown({ reason: "SIGTERM", exitCode: 0 });
  });

  process.on("uncaughtException", (error) => {
    void initiateShutdown({
      reason: "uncaughtException",
      exitCode: 1,
      error,
    });
  });

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    void initiateShutdown({
      reason: "unhandledRejection",
      exitCode: 1,
      error,
    });
  });
};

const listen = async (server) => {
  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("error", handleError);
      reject(error);
    };

    const handleListening = () => {
      server.off("error", handleError);
      resolve(undefined);
    };

    server.once("error", handleError);
    server.listen(env.port, () => {
      handleListening();
    });
  });
};

const bootstrap = async () => {
  assertNoBootstrapAdminEnvInProduction();
  assertProductionBuildInfoReady(env.nodeEnv);
  await initDatabase();
  assertProductionAdminMfaReady();

  let backupHandle = null;
  if (env.appDbBackupEnabled) {
    try {
      backup("startup");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[db-backup] startup backup failed:", error.message);
    }
    backupHandle = scheduleDailyBackup();
  } else {
    // eslint-disable-next-line no-console
    console.log(
      "[db-backup] app-level SQLite backup disabled; use infrastructure-level encrypted backups in production.",
    );
  }

  const { app, corsOriginSet } = createApp();
  const server = http.createServer(app);
  const wss = registerWs(server, corsOriginSet);
  const backgroundJobs = startBackgroundJobs();

  runtime = {
    server,
    wss,
    backgroundJobs,
    backupHandle,
  };

  server.on("error", (error) => {
    void initiateShutdown({
      reason: "server-error",
      exitCode: 1,
      error,
    });
  });

  await listen(server);

  // eslint-disable-next-line no-console
  console.log(
    `Backend listening at http://localhost:${env.port} (build=${publicBuildInfo.gitSha} id=${publicBuildInfo.buildId} time=${publicBuildInfo.buildTime})`,
  );
};

installProcessHandlers();

bootstrap().catch((error) => {
  void initiateShutdown({
    reason: "bootstrap-failed",
    exitCode: 1,
    error,
  });
});
