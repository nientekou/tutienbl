import { minigameService } from './src/services/MinigameService';
import { userRepository } from './src/database/repositories/UserRepository';

// Mock DB 
userRepository.create({
  discord_id: 'user1',
  name: 'User 1',
  base_hp: 100, base_mp: 50, base_atk: 10, base_def: 5, base_crit: 0, base_crit_res: 0, base_luck: 0, linh_can: 'Kim'
});
userRepository.create({
  discord_id: 'user2',
  name: 'User 2',
  base_hp: 100, base_mp: 50, base_atk: 10, base_def: 5, base_crit: 0, base_crit_res: 0, base_luck: 0, linh_can: 'Kim'
});

userRepository.update('user1', { coin_ha_pham: 1000 });
userRepository.update('user2', { coin_ha_pham: 1000 });

const res = minigameService.createChallenge('user1', 'user2', 100);
console.log('Create challenge:', res);

const customId = `duelaccept_${res.duel!.id}`;
console.log('customId:', customId);

const parts = customId.split('_');
console.log('parts:', parts);
const duelId = parts[1];

const acceptRes = minigameService.acceptChallenge(duelId, 'user2');
console.log('Accept result:', acceptRes);
