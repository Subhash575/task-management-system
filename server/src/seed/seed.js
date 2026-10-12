// Fills a LOCAL development database with sample users, tasks and status history.
//   npm run seed          (run from server/)
// Safe to run again and again: items that already exist are skipped, nothing is deleted or overwritten.
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { checkSeedAllowed } from './guard.js';
import { seedDatabase } from './seedDatabase.js';

async function main() {
  // Check first and connect afterwards, so a refused run never opens a connection.
  const verdict = checkSeedAllowed({ nodeEnv: env.NODE_ENV, mongoUri: env.MONGODB_URI });
  if (!verdict.ok) {
    console.error(`Seeding refused: ${verdict.reason}`);
    process.exitCode = 1;
    return;
  }

  await connectDatabase();
  try {
    const { usersCreated, tasksCreated, historyCreated } = await seedDatabase();
    console.log(
      `Seed finished. New: ${usersCreated} users, ${tasksCreated} tasks, ${historyCreated} status changes ` +
        '(items that already existed were skipped).',
    );
    console.log('Sample logins are listed in README.md under "Sample data".');
  } finally {
    await disconnectDatabase();
  }
}

main().catch(async (error) => {
  // Print only the message: stack traces and driver errors can include connection details.
  console.error(`Seeding failed: ${error.message}`);
  process.exitCode = 1;
  await mongoose.disconnect();
});
