"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const UserRepository_1 = require("./database/repositories/UserRepository");
const CombatService_1 = require("./services/CombatService");
const database_2 = __importDefault(require("./database/database"));
console.log('=== CHẠY THỬ NGHIỆM CHIẾN ĐẤU & PVE (GIAI ĐOẠN 5) ===');
try {
    // 1. Khởi tạo DB
    (0, database_1.initDatabase)();
    const userIdA = '999999999999999991';
    const userIdB = '999999999999999992';
    // Dọn dẹp dữ liệu test cũ
    database_2.default.prepare('DELETE FROM users WHERE discord_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM dungeon_cooldowns WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM world_boss_contributions WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    // 2. Tạo nhân vật A (Luyện Khí Tầng 1, Linh Căn Thủy-Mộc)
    console.log('\n--- 1. Khởi Tạo Nhân Vật Test ---');
    UserRepository_1.userRepository.create({
        discord_id: userIdA,
        name: 'Diệp Phàm',
        base_hp: 120,
        base_mp: 60,
        base_atk: 25,
        base_def: 12,
        base_crit: 0.05,
        base_crit_res: 0.0,
        base_luck: 10,
        linh_can: JSON.stringify({ 'Mộc': 50, 'Thủy': 50 })
    });
    console.log('✅ Đã tạo nhân vật A: Diệp Phàm (Cấp 1 - Luyện Khí)');
    // Tạo nhân vật B (Cấp 40 - Trúc Cơ Kỳ, Linh Căn Lôi-Hỏa)
    UserRepository_1.userRepository.create({
        discord_id: userIdB,
        name: 'Lâm Động',
        base_hp: 1600,
        base_mp: 600,
        base_atk: 250,
        base_def: 140,
        base_crit: 0.10,
        base_crit_res: 0.02,
        base_luck: 12,
        linh_can: JSON.stringify({ 'Lôi': 60, 'Hỏa': 40 })
    });
    // Nâng cấp nhân vật B lên Cấp 40 thực tế
    UserRepository_1.userRepository.update(userIdB, { level: 40, coin_ha_pham: 500 });
    console.log('✅ Đã tạo nhân vật B: Lâm Động (Cấp 40 - Trúc Cơ)');
    // 3. Kiểm thử phó bản U Minh Cốc (Yêu cầu cấp 1)
    console.log('\n--- 2. Khiêu Chiến Bí Cảnh U Minh Cốc (Diệp Phàm - Cấp 1) ---');
    const res1 = CombatService_1.combatService.challengeDungeon(userIdA, 'dungeon_luyen_khi_1');
    console.log(`- Kết quả khiêu chiến: **${res1.message}**`);
    console.log(`- Số lượt còn lại hôm nay: ${res1.dailyEntriesLeft}`);
    if (res1.combatResult) {
        console.log(`- Số hiệp đấu: ${res1.combatResult.rounds}`);
        console.log(`- HP người chơi cuối trận: ${res1.combatResult.playerEndingHp}`);
        console.log(`- HP quái cuối trận: ${res1.combatResult.enemyEndingHp}`);
        if (res1.rewards) {
            console.log(`- Phần thưởng: +${res1.rewards.exp} EXP, +${res1.rewards.coins} Linh Thạch`);
            console.log(`- Vật phẩm rơi ra:`, res1.rewards.loots.map(l => `${l.name} x${l.quantity}`).join(', ') || 'Không');
        }
    }
    // 4. Kiểm thử khóa phó bản cấp cao
    console.log('\n--- 3. Thử Vào Phó Bản Cấp Cao Hơn Cảnh Giới ---');
    const res2 = CombatService_1.combatService.challengeDungeon(userIdA, 'dungeon_truc_co_1');
    console.log(`- Diệp Phàm (Cấp 1) vào Huyết Ma Động (Yêu cầu Cấp 39):`);
    console.log(`  👉 Kết quả: ${res2.success ? 'Thành công' : 'Bị chặn'} - Tin nhắn: "${res2.message}"`);
    // 5. Kiểm thử giới hạn lượt khiêu chiến hàng ngày
    console.log('\n--- 4. Kiểm Thử Giới Hạn Lượt Vào Bí Cảnh Hàng Ngày ---');
    console.log('Diệp Phàm đi tiếp lượt thứ 2...');
    const resL2 = CombatService_1.combatService.challengeDungeon(userIdA, 'dungeon_luyen_khi_1');
    console.log(`- Lượt 2: ${resL2.message} (Còn ${resL2.dailyEntriesLeft} lượt)`);
    console.log('Diệp Phàm đi tiếp lượt thứ 3...');
    const resL3 = CombatService_1.combatService.challengeDungeon(userIdA, 'dungeon_luyen_khi_1');
    console.log(`- Lượt 3: ${resL3.message} (Còn ${resL3.dailyEntriesLeft} lượt)`);
    console.log('Diệp Phàm đi tiếp lượt thứ 4 (Quá giới hạn)...');
    const resL4 = CombatService_1.combatService.challengeDungeon(userIdA, 'dungeon_luyen_khi_1');
    console.log(`- Lượt 4: success = ${resL4.success}, tin nhắn = "${resL4.message}"`);
    // 6. Kiểm thử sủng thú xuất chiến
    console.log('\n--- 5. Kiểm Thử Trợ Chiến Từ Sủng Thú ---');
    // Thêm một sủng thú vào DB và cho xuất chiến
    database_2.default.prepare(`
    INSERT INTO pets (user_id, name, template_id, rarity, level, base_hp, base_atk, base_def, is_deployed, created_at)
    VALUES (?, 'Tiểu Hỏa kê', 'pet_chicken_1', 'uncommon', 5, 200, 45, 10, 1, ?)
  `).run(userIdB, Math.floor(Date.now() / 1000));
    console.log('Đã tạo sủng thú "Tiểu Hỏa kê" (ATK: 45) xuất chiến cho Lâm Động.');
    console.log('\nLâm Động (Cấp 40) khiêu chiến Huyết Ma Động...');
    const resB1 = CombatService_1.combatService.challengeDungeon(userIdB, 'dungeon_truc_co_1');
    console.log(`- Kết quả: ${resB1.message}`);
    if (resB1.combatResult) {
        console.log(`- Số hiệp: ${resB1.combatResult.rounds}`);
        // Tìm các dòng log sủng thú trợ chiến
        const petLogs = resB1.combatResult.log.filter(line => line.includes('Sủng thú') || line.includes('🐾'));
        console.log(`- Nhật ký trợ chiến của Pet (Dòng mẫu):`);
        petLogs.slice(0, 3).forEach(line => console.log(`  👉 ${line}`));
    }
    // 7. Kiểm thử World Boss
    console.log('\n--- 6. Kiểm Thử World Boss (Boss Thế Giới) ---');
    // Khởi tạo World Boss về cấp độ 1 với HP đầy
    database_2.default.prepare(`
    UPDATE world_boss
    SET hp = 5000, max_hp = 5000, level = 1, status = 'active', defeated_at = NULL, defeated_by = NULL
    WHERE id = 'world_boss_current'
  `).run();
    const bossStatusBefore = CombatService_1.combatService.getCurrentBoss();
    console.log(`- Trạng thái Boss ban đầu: ${bossStatusBefore.name} (Cấp ${bossStatusBefore.level}) - HP: ${bossStatusBefore.hp}/${bossStatusBefore.maxHp}`);
    console.log('\nLâm Động khiêu chiến World Boss lần 1 (Tấn công)...');
    const wbRes1 = CombatService_1.combatService.challengeWorldBoss(userIdB, false);
    console.log(`- Kết quả: ${wbRes1.message}`);
    console.log(`- Sát thương gây ra: ${wbRes1.damageDealt}`);
    const bossStatusAfter1 = CombatService_1.combatService.getCurrentBoss();
    console.log(`- HP Boss sau lần đánh 1: ${bossStatusAfter1.hp}/${bossStatusAfter1.maxHp}`);
    console.log('\nThử đánh tiếp lần 2 ngay lập tức (Không xóa CD)...');
    const wbRes2 = CombatService_1.combatService.challengeWorldBoss(userIdB, false);
    console.log(`- Kết quả: success = ${wbRes2.success}, tin nhắn = "${wbRes2.message}"`);
    console.log('\nĐánh tiếp lần 2 dùng Linh Thạch để xóa CD (Chi phí 50 Linh thạch)...');
    const uBefore = UserRepository_1.userRepository.get(userIdB);
    console.log(`- Số dư Linh thạch trước xóa CD: ${uBefore.coin_ha_pham}`);
    const wbRes3 = CombatService_1.combatService.challengeWorldBoss(userIdB, true);
    console.log(`- Kết quả: ${wbRes3.message}`);
    console.log(`- Sát thương gây ra: ${wbRes3.damageDealt}`);
    const uAfter = UserRepository_1.userRepository.get(userIdB);
    console.log(`- Số dư Linh thạch sau xóa CD: ${uAfter.coin_ha_pham}`);
    // 8. Mô phỏng Boss bị tiêu diệt và hồi sinh lên cấp
    console.log('\n--- 7. Mô Phỏng Boss Bị Tiêu Diệt & Phát Thưởng ---');
    // Ép HP Boss xuống cực thấp (100 HP)
    database_2.default.prepare("UPDATE world_boss SET hp = 100 WHERE id = 'world_boss_current'").run();
    console.log(`- Ép HP World Boss xuống còn 100 HP để giả lập đòn trảm sát...`);
    // Cho Lâm Động đánh phát cuối
    // Để chắc chắn không dính CD test, ta xóa CD trực tiếp trong DB
    database_2.default.prepare("UPDATE world_boss_contributions SET last_attack_at = 0 WHERE user_id = ?").run(userIdB);
    const wbKill = CombatService_1.combatService.challengeWorldBoss(userIdB, false);
    console.log(`- Kết quả khiêu chiến trảm sát: **${wbKill.message}**`);
    console.log(`- World Boss bị tiêu diệt? ${wbKill.isDefeated}`);
    if (wbKill.rewardsLogs) {
        console.log(`- Nhật ký phân phát phần thưởng:`);
        wbKill.rewardsLogs.forEach(line => console.log(`  👉 ${line}`));
    }
    const bossStatusAfterDefeat = CombatService_1.combatService.getCurrentBoss();
    console.log(`- Trạng thái Boss ngay sau khi bị diệt: status = ${bossStatusAfterDefeat.status}, Hồi sinh sau: ${bossStatusAfterDefeat.respawnTimeRemaining} giây`);
    // Dọn dẹp dữ liệu test
    database_2.default.prepare('DELETE FROM users WHERE discord_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM dungeon_cooldowns WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM world_boss_contributions WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    database_2.default.prepare('DELETE FROM pets WHERE user_id IN (?, ?)').run(userIdA, userIdB);
    console.log('\n🎉 === TẤT CẢ KIỂM THỬ GIAI ĐOẠN 5 ĐÃ HOÀN THÀNH XUẤT SẮC! ===');
}
catch (error) {
    console.error('❌ Có lỗi xảy ra trong quá trình chạy kiểm thử:', error);
}
finally {
    database_2.default.close();
}
