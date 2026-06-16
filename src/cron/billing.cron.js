import cron from "node-cron";
import { logger } from "../utils/logger.js";
import * as billService from "../modules/bills/bill.service.js";

export function startBillingCron() {
  cron.schedule("0 0 1 * *", async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    logger.info(
      `[BillingCron] Running monthly bill generation for ${month}/${year}`
    );

    try {
      const results = await billService.generateMonthlyBills(month, year);

      if (results.length === 0) {
        logger.info("[BillingCron] No MONTHLY rooms found, skipped");
        return;
      }

      for (const r of results) {
        logger.info(
          `[BillingCron] Generated ${r.count} bills for room "${r.roomName}" (${r.roomId})`
        );
      }

      logger.info(
        `[BillingCron] Done — ${results.reduce((s, r) => s + r.count, 0)} bills total`
      );
    } catch (err) {
      logger.error(`[BillingCron] Failed: ${err.message}`);
    }
  });

  logger.info("[BillingCron] Scheduled — runs on 1st of each month at 00:00");
}
