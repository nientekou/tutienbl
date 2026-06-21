import { PartyCombatEngine, PartyMember, PartyBossConfig } from '../src/services/PartyCombatEngine';

async function testPartyCombat() {
  console.log('🧪 BẮT ĐẦU TEST CHIẾN ĐẤU TỔ ĐỘI... 🧪\n');

  const members: PartyMember[] = [
    {
      userId: 'user_1',
      name: 'hoocshii',
      combatant: {
        name: 'hoocshii',
        hp: 1000,
        maxHp: 1000,
        atk: 5000, // Đòn đánh cực mạnh để bớt vòng lặp
        def: 100,
        crit: 0.1,
        critRes: 0.05,
        speed: 150,
        luck: 10
      },
      petAtk: 0,
      petName: null,
      hp: 1000,
      maxHp: 1000,
      isAlive: true
    },
    {
      userId: 'user_2',
      name: 'Châu Anh',
      combatant: {
        name: 'Châu Anh',
        hp: 800,
        maxHp: 800,
        atk: 1000,
        def: 80,
        crit: 0.1,
        critRes: 0.05,
        speed: 120,
        luck: 10
      },
      petAtk: 0,
      petName: null,
      hp: 800,
      maxHp: 800,
      isAlive: true
    }
  ];

  const boss: PartyBossConfig = {
    name: 'Huyết Ma Phân Thân',
    hp: 10000,
    maxHp: 10000,
    atk: 200,
    def: 50,
    crit: 0.1,
    critRes: 0.05,
    speed: 90,
    dodge: 0.05
  };

  const result = PartyCombatEngine.run(members, boss, 5);
  
  console.log('\n--- KẾT QUẢ CHIẾN ĐẤU ---');
  console.log(`Chiến thắng: ${result.victory}`);
  console.log(`Số hiệp đấu: ${result.rounds}`);
  console.log(`HP Boss còn lại: ${result.bossHpRemaining}/${result.bossMaxHp}`);
  
  console.log('\n--- LOG CHIẾN ĐẤU ---');
  result.log.forEach(l => console.log(l));

  if (result.victory) {
    console.log('\n✅ Đạt chuẩn: Sát thương của người chơi đã trừ đúng vào HP Boss và hạ gục Boss!');
  } else {
    console.error('\n❌ Thất bại: Sát thương không được trừ chính xác vào HP Boss!');
  }
}

testPartyCombat().catch(console.error);
