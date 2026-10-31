import app from './app.js';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { startBillingScheduler } from './jobs/billingScheduler.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Brightloop Subscription Server running on port ${PORT}`);
});

if (process.env.BILLING_CRON) {
  const billingPrisma = new PrismaClient();
  try {
    startBillingScheduler({ prisma: billingPrisma });
    console.log(`Scheduled billing enabled with cron: ${process.env.BILLING_CRON}`);
  } catch (error) {
    console.error('Scheduled billing could not be started:', error.message);
    billingPrisma.$disconnect().catch(() => {});
  }
}
