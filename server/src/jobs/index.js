import cron from 'node-cron';
import { autoClosePlans } from './autoClosePlans.js';

/**
 * Daily cron job to auto-close plans whose end date has passed.
 * Runs every day at midnight (00:00).
 */
export const autoCloseJob = cron.schedule('0 0 * * *', async () => {
  try {
    await autoClosePlans(new Date());
  } catch (error) {
    console.error('Error running autoClosePlans cron job:', error);
  }
});

export function stopJobs() {
  if (autoCloseJob && typeof autoCloseJob.stop === 'function') {
    autoCloseJob.stop();
  }
}

export function startJobs() {
  if (autoCloseJob && typeof autoCloseJob.start === 'function') {
    autoCloseJob.start();
  }
}

export { autoClosePlans };

export default {
  autoCloseJob,
  startJobs,
  stopJobs,
};
