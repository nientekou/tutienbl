import db from '../src/database/database';
import { userRepository } from '../src/database/repositories/UserRepository';
import { inventoryRepository } from '../src/database/repositories/InventoryRepository';
import { inventoryService } from '../src/services/InventoryService';

async function testPill() {
  const itemId = 'pill_alchemy_tuvi';
  
  // 1. Get static item info
  const staticItem = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
  console.log('Static Item info:', staticItem);

  const testUser = 'test_user_tuvi_pill';
  db.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
  db.prepare('DELETE FROM inventories WHERE user_id = ?').run(testUser);

  userRepository.create({
    discord_id: testUser,
    name: 'Test Tu Vi',
    base_hp: 200,
    base_mp: 100,
    base_atk: 30,
    base_def: 15,
    base_crit: 0.05,
    base_crit_res: 0.01,
    base_luck: 10,
    linh_can: JSON.stringify({ 'Hỏa': 100 })
  });

  const beforeUser = userRepository.get(testUser)!;
  console.log(`Before using: tu_vi = ${beforeUser.tu_vi}/${beforeUser.exp_needed}`);

  // Give item
  inventoryRepository.addItem(testUser, itemId, 1);
  const inv = inventoryRepository.getUserInventory(testUser);
  const userItem = inv.find(i => i.item_id === itemId)!;
  console.log('User inventory item details:', userItem);

  // Use item
  const res = inventoryService.useItem(testUser, userItem.id);
  console.log('Use result:', res);

  const afterUser = userRepository.get(testUser)!;
  console.log(`After using: tu_vi = ${afterUser.tu_vi}/${afterUser.exp_needed}`);
  
  const dbUser = db.prepare('SELECT tu_vi FROM users WHERE discord_id = ?').get(testUser) as any;
  console.log(`Direct DB Tu Vi: ${dbUser.tu_vi}`);
}

testPill().catch(console.error);
