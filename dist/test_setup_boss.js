"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const UserRepository_1 = require("./database/repositories/UserRepository");
const InventoryService_1 = require("./services/InventoryService");
const database_2 = __importDefault(require("./database/database"));
console.log('=== CHẠY KIỂM THỬ TỰ ĐỘNG THIẾT LẬP KÊNH & BOSS LIVE RAID ===');
try {
    // 1. Khởi tạo DB
    (0, database_1.initDatabase)();
    const guildId = 'test_guild_123456';
    const userId = '888888888888888881';
    // Dọn dẹp dữ liệu cũ
    database_2.default.prepare('DELETE FROM guild_configs WHERE guild_id = ?').run(guildId);
    database_2.default.prepare('DELETE FROM boss_announcements WHERE guild_id = ?').run(guildId);
    database_2.default.prepare('DELETE FROM users WHERE discord_id = ?').run(userId);
    database_2.default.prepare('DELETE FROM world_boss_contributions WHERE boss_id = ?').run('world_boss_current');
    // 2. Khởi tạo nhân vật test
    UserRepository_1.userRepository.create({
        discord_id: userId,
        name: 'Lâm Phàm',
        base_hp: 200,
        base_mp: 100,
        base_atk: 30,
        base_def: 15,
        base_crit: 0.05,
        base_crit_res: 0.0,
        base_luck: 15,
        linh_can: JSON.stringify({ 'Hỏa': 100 })
    });
    console.log('✅ Đã tạo nhân vật test Lâm Phàm.');
    // ============================================
    // 3. KIỂM THỬ THIẾT LẬP KÊNH (/setup)
    // ============================================
    console.log('\n--- 3. Kiểm Thử Thiết Lập Kênh (/setup) ---');
    database_2.default.prepare(`
    INSERT INTO guild_configs (
      guild_id, category_id, tuluyen_channel_id, linhdien_channel_id, tongmon_channel_id, bicanh_channel_id, boss_channel_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, 'cat_999', 'ch_tuluyen', 'ch_linhdien', 'ch_tongmon', 'ch_bicanh', 'ch_boss_channel');
    const config = database_2.default.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
    console.log(`- Đã lưu cấu hình Guild: ID = ${config.guild_id}`);
    console.log(`- Kênh Tu Luyện: ${config.tuluyen_channel_id}`);
    console.log(`- Kênh Boss Thế Giới: ${config.boss_channel_id}`);
    if (config.boss_channel_id === 'ch_boss_channel' && config.tuluyen_channel_id === 'ch_tuluyen') {
        console.log('✅ Đạt chuẩn: Cấu hình kênh được lưu trữ chính xác!');
    }
    else {
        throw new Error('Lỗi lưu trữ cấu hình Guild/Kênh!');
    }
    // ============================================
    // 4. KIỂM THỬ WORLD BOSS LIVE SPANNER
    // ============================================
    console.log('\n--- 4. Kiểm Thử World Boss Live Spawner ---');
    // Thiết lập boss hồi sinh
    const now = Math.floor(Date.now() / 1000);
    database_2.default.prepare(`
    UPDATE world_boss
    SET hp = 5000, max_hp = 5000, atk = 100, def = 30, level = 1, status = 'active', last_spawned_at = ?
    WHERE id = 'world_boss_current'
  `).run(now);
    const boss = database_2.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
    console.log(`- Trạng thái Boss hiện tại: ${boss.name} | Level: ${boss.level} | HP: ${boss.hp}/${boss.max_hp}`);
    // Lưu tin nhắn thông báo ảo
    database_2.default.prepare('INSERT OR REPLACE INTO boss_announcements (guild_id, channel_id, message_id) VALUES (?, ?, ?)')
        .run(guildId, 'ch_boss_channel', 'msg_888888');
    const ann = database_2.default.prepare('SELECT * FROM boss_announcements WHERE guild_id = ?').get(guildId);
    console.log(`- Thông báo ảo được ghi nhận: Message ID = ${ann.message_id} tại Kênh = ${ann.channel_id}`);
    if (boss.hp === 5000 && ann.message_id === 'msg_888888') {
        console.log('✅ Đạt chuẩn: Khởi tạo Boss và ghi nhận tin nhắn thông báo thành công!');
    }
    else {
        throw new Error('Lỗi đồng bộ Boss hoặc Thông báo!');
    }
    // ============================================
    // 5. KIỂM THỬ RAID ATTACK BUTTON (worldbossattack)
    // ============================================
    console.log('\n--- 5. Kiểm Thử Nút Tấn Công Live Raid ---');
    const activeStats = InventoryService_1.inventoryService.getActiveStats(userId);
    console.log(`- Chỉ số chiến đấu của Lâm Phàm: ATK: ${activeStats.atk} | LUCK: ${activeStats.luck}`);
    // Tính sát thương
    const isCrit = Math.random() < (activeStats.crit + activeStats.luck * 0.001);
    let rawDmg = Math.max(1, activeStats.atk - boss.def);
    rawDmg = Math.round(rawDmg * (0.9 + Math.random() * 0.2));
    if (isCrit)
        rawDmg = Math.round(rawDmg * 1.5);
    const petDmg = 0; // Không mang pet
    const totalDmg = rawDmg + petDmg;
    console.log(`- Sát thương tính toán gây ra: ${totalDmg} HP${isCrit ? ' (Bạo Kích 💥)' : ''}`);
    const newHp = Math.max(0, boss.hp - totalDmg);
    // Cập nhật máu boss và đóng góp
    database_2.default.prepare("UPDATE world_boss SET hp = ? WHERE id = 'world_boss_current'").run(newHp);
    database_2.default.prepare(`
    INSERT INTO world_boss_contributions (user_id, boss_id, damage, attacks, last_attack_at)
    VALUES (?, 'world_boss_current', ?, 1, ?)
  `).run(userId, totalDmg, now);
    const updatedBoss = database_2.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
    const contrib = database_2.default.prepare("SELECT * FROM world_boss_contributions WHERE user_id = ?").get(userId);
    console.log(`- Máu Boss còn lại sau khi bị đánh: ${updatedBoss.hp}/${updatedBoss.max_hp}`);
    console.log(`- Điểm đóng góp của Lâm Phàm: Sát thương: ${contrib.damage} | Lượt đánh: ${contrib.attacks}`);
    if (updatedBoss.hp === 5000 - totalDmg && contrib.damage === totalDmg) {
        console.log('✅ Đạt chuẩn: Tấn công Boss Live Raid và ghi nhận điểm cống hiến thành công!');
    }
    else {
        throw new Error('Lỗi xử lý sát thương hoặc ghi nhận đóng góp!');
    }
    // ============================================
    // 6. KIỂM THỬ KẾT LIỄU & PHÁT THƯỞNG
    // ============================================
    console.log('\n--- 6. Kiểm Thử Trảm Sát & Phát Thưởng ---');
    // Đưa máu Boss về 0
    database_2.default.prepare("UPDATE world_boss SET hp = 0, status = 'defeated', defeated_at = ?, defeated_by = ? WHERE id = 'world_boss_current'")
        .run(now, userId);
    const finalBoss = database_2.default.prepare("SELECT * FROM world_boss WHERE id = 'world_boss_current'").get();
    console.log(`- Trạng thái Boss sau trảm sát: HP: ${finalBoss.hp} | Trạng thái: ${finalBoss.status} | Kết liễu bởi: Lâm Phàm`);
    // Phân phát phần thưởng boss level 1
    const { combatService } = require('./services/CombatService');
    const rewardsLogs = combatService.distributeWorldBossRewards(finalBoss.level, userId);
    console.log(`- Bản ghi phát thưởng Boss Thế Giới:`);
    rewardsLogs.forEach((log) => console.log(`  └ ${log}`));
    if (finalBoss.status === 'defeated' && rewardsLogs.length > 0) {
        console.log('✅ Đạt chuẩn: Trảm sát boss thế giới và phát thưởng thành công!');
    }
    else {
        throw new Error('Lỗi kết liễu hoặc phát thưởng Boss!');
    }
    // Dọn dẹp dữ liệu test
    database_2.default.prepare('DELETE FROM guild_configs WHERE guild_id = ?').run(guildId);
    database_2.default.prepare('DELETE FROM boss_announcements WHERE guild_id = ?').run(guildId);
    database_2.default.prepare('DELETE FROM users WHERE discord_id = ?').run(userId);
    database_2.default.prepare('DELETE FROM world_boss_contributions WHERE boss_id = ?').run('world_boss_current');
    console.log('\n🎉 === TẤT CẢ KIỂM THỬ THIẾT LẬP KÊNH & BOSS LIVE RAID THÀNH CÔNG RỰC RỠ! ===');
}
catch (error) {
    console.error('❌ Có lỗi xảy ra trong quá trình chạy kiểm thử:', error);
    process.exit(1);
}
finally {
    database_2.default.close();
}
