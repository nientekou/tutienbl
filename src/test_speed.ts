import { initDatabase } from './database/database';
import { buildLeaderboardMessage } from './commands/general/bangphongthan';

async function main() {
  console.log('Initializing database...');
  initDatabase();

  const userId = '1234567890';
  const categories = ['combatPower', 'realm', 'wealth', 'sectContribution', 'arena', 'alchemy', 'forging'];

  for (const cat of categories) {
    const start = Date.now();
    try {
      buildLeaderboardMessage(userId, cat, 1);
      const duration = Date.now() - start;
      console.log(`Category: ${cat} -> ${duration}ms`);
    } catch (e) {
      console.error(`Error in ${cat}:`, e);
    }
  }
}

main().catch(console.error);
