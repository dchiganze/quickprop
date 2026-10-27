import app from "./app";
import { logger } from "./lib/logger";
import { startHousekeepingScheduler } from "./lib/housekeeping-job";
import { startImportRecoveryWorker } from "./routes/imports";
import { ensureDemoAccounts } from "./lib/demo-accounts";
import { startReviewInvitationScheduler } from "./lib/agent-reviews";
import { startRentalReferenceScheduler } from "./lib/rental-references";
import { startPropertyAlertScheduler } from "./lib/property-alerts";
import { ensurePropertySaleColumns } from "./lib/property-schema";
import { ensurePasskeyTable } from "./routes/passkeys";
import { ensureAgentPastSalesTable } from "./lib/agent-sales";
import { ensureViewingReminderSchema, startViewingReminderScheduler } from "./lib/viewing-reminders";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {
  await ensurePropertySaleColumns();
  await ensureAgentPastSalesTable();
  await ensureViewingReminderSchema();
  await ensurePasskeyTable();
  await ensureDemoAccounts();

  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
    startHousekeepingScheduler();
    startViewingReminderScheduler();
    startImportRecoveryWorker();
    startReviewInvitationScheduler();
    startRentalReferenceScheduler();
    startPropertyAlertScheduler();
  });

  server.on("error", (err) => {
    logger.error({ err, port }, "Error listening on port");
    process.exitCode = 1;
  });

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "API server shutdown requested");
    const forceExit = setTimeout(() => {
      logger.error({ signal }, "API server shutdown timed out");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close((err) => {
      clearTimeout(forceExit);
      if (err) {
        logger.error({ err, signal }, "API server shutdown failed");
        process.exit(1);
      }
      logger.info({ signal }, "API server stopped");
      process.exit(0);
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.error({ err }, "Unable to prepare server startup");
  process.exit(1);
});
