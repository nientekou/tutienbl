import db from '../src/database/database';
import { tribulationService } from '../src/services/TribulationService';
import { userRepository } from '../src/database/repositories/UserRepository';

async function testAll() {
  const userId = '416080455398588416';
  const user = userRepository.get(userId)!;
  console.log(`Testing all tribulation actions for User: ${user.name}`);

  const actions: Array<'nguthu' | 'khangcu' | 'dungnguloidan' | 'dunghoihuyetdan' | 'dungtiloi' | 'dungnguhanhdan'> = [
    'nguthu', 'khangcu', 'dungnguloidan', 'dunghoihuyetdan', 'dungtiloi', 'dungnguhanhdan'
  ];

  for (const act of actions) {
    console.log(`\n--- TESTING ACTION: ${act} ---`);
    try {
      // Start a fresh tribulation for each action to reset state
      tribulationService.start(userId, user.name, 0);
      const res = tribulationService.handleAction(userId, act);
      console.log(`✅ Success for ${act}! Title: ${res.embed.data.title}`);
    } catch (e: any) {
      console.error(`❌ ERROR for ${act}:`, e.stack || e);
    }
  }
}

testAll();
