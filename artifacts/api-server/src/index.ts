import app from "./app";
import { logger } from "./lib/logger";
import { startHousekeepingScheduler } from "./lib/housekeeping-job";
import { startImportRecoveryWorker } from "./routes/imports";
import { ensureDemoAccounts } from "./lib/demo-accounts";
import { startReviewInvitationScheduler } from "./lib/agent-reviews";

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
  await ensureDemoAccounts();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startHousekeepingScheduler();
    startImportRecoveryWorker();
    startReviewInvitationScheduler();
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Unable to prepare server startup");
  process.exit(1);
});
