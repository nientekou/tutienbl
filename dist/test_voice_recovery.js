"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const UserRepository_1 = require("./database/repositories/UserRepository");
const VoiceRecoveryService_1 = require("./services/VoiceRecoveryService");
const database_2 = __importDefault(require("./database/database"));
console.log('--- BẮT ĐẦU KIỂM THỬ HỒI PHỤC STAMINA VOICE CHANNEL ---');
// Mock a fake Discord Client for testing announcements
class MockClient {
    guilds = {
        cache: {
            get: () => ({
                channels: {
                    cache: {
                        get: () => ({
                            name: 'Thiền Định Phòng',
                            isTextBased: () => true,
                            send: async (msg) => {
                                console.log(`[Mock Channel Send]:`, msg.embeds ? msg.embeds[0].data.description : msg);
                                return {};
                            }
                        })
                    },
                    fetch: async () => ({
                        name: 'Thiền Định Phòng',
                        isTextBased: () => true,
                        send: async (msg) => {
                            console.log(`[Mock Channel Send]:`, msg.embeds ? msg.embeds[0].data.description : msg);
                            return {};
                        }
                    })
                },
                members: {
                    cache: {
                        get: (id) => ({
                            voice: { channelId: '1436366637899976769' }
                        })
                    },
                    fetch: async (id) => ({
                        voice: { channelId: '1436366637899976769' }
                    })
                }
            })
        },
        fetch: async () => ({
            channels: {
                cache: {
                    get: () => ({
                        name: 'Thiền Định Phòng',
                        isTextBased: () => true,
                        send: async (msg) => {
                            console.log(`[Mock Channel Send]:`, msg.embeds ? msg.embeds[0].data.description : msg);
                            return {};
                        }
                    })
                },
                fetch: async () => ({
                    name: 'Thiền Định Phòng',
                    isTextBased: () => true,
                    send: async (msg) => {
                        console.log(`[Mock Channel Send]:`, msg.embeds ? msg.embeds[0].data.description : msg);
                        return {};
                    }
                })
            },
            members: {
                cache: {
                    get: (id) => ({
                        voice: { channelId: '1436366637899976769' }
                    })
                },
                fetch: async (id) => ({
                    voice: { channelId: '1436366637899976769' }
                })
            }
        })
    };
}
async function main() {
    try {
        (0, database_1.initDatabase)();
        const testUserId = '888888888888888888';
        const targetGuildId = VoiceRecoveryService_1.VOICE_RECOVERY_CONFIG.TARGET_GUILD_ID;
        const channelId = '1436366637899976769';
        // Dọn dẹp dữ liệu test cũ
        database_2.default.prepare('DELETE FROM users WHERE discord_id = ?').run(testUserId);
        database_2.default.prepare('DELETE FROM voice_recovery WHERE user_id = ?').run(testUserId);
        database_2.default.prepare('DELETE FROM guild_configs WHERE guild_id = ?').run(targetGuildId);
        // Tạo cấu hình kênh giả lập trong DB
        database_2.default.prepare(`
      INSERT INTO guild_configs (guild_id, category_id, tuluyen_channel_id)
      VALUES (?, 'cat_123', 'chan_999')
    `).run(targetGuildId);
        // Tạo nhân vật test mới
        const testLinhCan = JSON.stringify({ 'Mộc': 100 });
        const tempStats = { hp: 100, mp: 50, atk: 10, def: 10, crit: 0.05, critRes: 0, luck: 10 };
        UserRepository_1.userRepository.create({
            discord_id: testUserId,
            name: 'Tụ Linh Khách',
            base_hp: tempStats.hp,
            base_mp: tempStats.mp,
            base_atk: tempStats.atk,
            base_def: tempStats.def,
            base_crit: tempStats.crit,
            base_crit_res: tempStats.critRes,
            base_luck: tempStats.luck,
            linh_can: testLinhCan
        });
        const client = new MockClient();
        // ==========================================
        // KIỂM THỬ 1: Vào voice khi Thể Lực thấp (< 100)
        // ==========================================
        console.log('\n--- KIỂM THỬ 1: Tham gia voice với Stamina thấp ---');
        UserRepository_1.userRepository.update(testUserId, { stamina: 50 }); // Stamina = 50
        await VoiceRecoveryService_1.voiceRecoveryService.onVoiceJoin(client, testUserId, targetGuildId, channelId);
        let vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        console.log('Record after join:', vr);
        if (vr && vr.session_start > 0 && vr.stamina_at_join === 50) {
            console.log('✅ Session tụ linh bắt đầu thành công!');
        }
        else {
            throw new Error('❌ Thất bại: Không kích hoạt session tụ linh!');
        }
        // ==========================================
        // KIỂM THỬ 2: Vào voice khi Thể Lực cao (>= 100)
        // ==========================================
        console.log('\n--- KIỂM THỬ 2: Tham gia voice với Stamina cao (>= 100) ---');
        // Dọn session cũ
        database_2.default.prepare('UPDATE voice_recovery SET session_start = 0 WHERE user_id = ?').run(testUserId);
        UserRepository_1.userRepository.update(testUserId, { stamina: 150 }); // Stamina = 150
        await VoiceRecoveryService_1.voiceRecoveryService.onVoiceJoin(client, testUserId, targetGuildId, channelId);
        vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        if (vr && vr.session_start === 0) {
            console.log('✅ Chặn tham gia tụ linh khi stamina >= 100 thành công!');
        }
        else {
            throw new Error('❌ Thất bại: Vẫn kích hoạt session tụ linh khi stamina cao!');
        }
        // ==========================================
        // KIỂM THỬ 3: Thoát voice quá sớm (< 5 phút)
        // ==========================================
        console.log('\n--- KIỂM THỬ 3: Thoát voice quá sớm (< 5 phút) ---');
        UserRepository_1.userRepository.update(testUserId, { stamina: 50 });
        // Khởi động session giả lập
        const now = Math.floor(Date.now() / 1000);
        database_2.default.prepare('UPDATE voice_recovery SET session_start = ?, stamina_at_join = 50, session_bonus_added = 0 WHERE user_id = ?').run(now - 120, testUserId); // Ở 2 phút
        await VoiceRecoveryService_1.voiceRecoveryService.onVoiceLeave(client, testUserId);
        vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        const userStats = UserRepository_1.userRepository.get(testUserId);
        console.log('Stamina after leaving early:', userStats.stamina);
        UserRepository_1.userRepository.update(testUserId, { stamina: 50 });
        database_2.default.prepare('UPDATE voice_recovery SET session_start = ?, stamina_at_join = 50, session_bonus_added = 0 WHERE user_id = ?').run(now - 120, testUserId); // Ở 2 phút
        await VoiceRecoveryService_1.voiceRecoveryService.onVoiceLeave(client, testUserId);
        const userStats2 = UserRepository_1.userRepository.get(testUserId);
        console.log('Stamina after leaving early (fixed):', userStats2.stamina);
        if (userStats2.stamina === 50) {
            console.log('✅ Rời voice sớm không cộng stamina thành công!');
        }
        else {
            throw new Error('❌ Thất bại: Cộng stamina khi rời voice sớm!');
        }
        // ==========================================
        // KIỂM THỬ 4: Đủ 5 phút hồi phục và cộng dồn stamina qua tick
        // ==========================================
        console.log('\n--- KIỂM THỬ 4: Đủ 5 phút hồi phục và cộng dồn qua ticks ---');
        UserRepository_1.userRepository.update(testUserId, { stamina: 50 });
        // Giả lập ở voice 5 phút (300 giây)
        const startTime = now - 305;
        database_2.default.prepare('UPDATE voice_recovery SET session_start = ?, stamina_at_join = 50, session_bonus_added = 0 WHERE user_id = ?').run(startTime, testUserId);
        // Gọi tickAll:
        await VoiceRecoveryService_1.voiceRecoveryService.tickAll(client);
        let updatedUser = UserRepository_1.userRepository.get(testUserId);
        vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        console.log('Stamina after 5 minutes tick:', updatedUser.stamina);
        console.log('Session bonus added:', vr.session_bonus_added);
        if (updatedUser.stamina === 65 && vr.session_bonus_added === 15) { // 50 + 15 = 65
            console.log('✅ Cộng 15 stamina cho 5 phút đầu thành công!');
        }
        else {
            throw new Error(`❌ Thất bại: Thể lực sai lệch (${updatedUser.stamina} / mong muốn 65)!`);
        }
        // Tăng thêm 20 giây nữa (325 giây)
        database_2.default.prepare('UPDATE voice_recovery SET session_start = ? WHERE user_id = ?').run(now - 325, testUserId);
        await VoiceRecoveryService_1.voiceRecoveryService.tickAll(client);
        updatedUser = UserRepository_1.userRepository.get(testUserId);
        vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        console.log('Stamina after 325s tick:', updatedUser.stamina);
        console.log('Session bonus added:', vr.session_bonus_added);
        if (updatedUser.stamina === 66 && vr.session_bonus_added === 16) {
            console.log('✅ Cộng thêm 1 stamina sau mỗi 20s tiếp theo thành công!');
        }
        else {
            throw new Error(`❌ Thất bại: Thể lực không tăng chính xác (${updatedUser.stamina}/66)!`);
        }
        // Rời voice
        await VoiceRecoveryService_1.voiceRecoveryService.onVoiceLeave(client, testUserId);
        vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        console.log('Record after normal leave:', vr);
        if (vr && vr.session_start === 0 && vr.last_session_end > 0) {
            console.log('✅ Dọn dẹp session sau khi rời voice bình thường thành công!');
        }
        else {
            throw new Error('❌ Thất bại: Không dọn dẹp session!');
        }
        // ==========================================
        // KIỂM THỬ 5: Giới hạn hàng ngày (Daily Cap 120)
        // ==========================================
        console.log('\n--- KIỂM THỬ 5: Đạt giới hạn hàng ngày (120 Stamina) ---');
        // Đưa total_bonus_today lên 118, stamina lên 50
        UserRepository_1.userRepository.update(testUserId, { stamina: 50 });
        database_2.default.prepare(`
      UPDATE voice_recovery 
      SET session_start = ?, stamina_at_join = 50, total_bonus_today = 118, session_bonus_added = 0 
      WHERE user_id = ?
    `).run(now - 305, testUserId); // Giả lập đã ở 5 phút, đã nhận 118 bonus hôm nay
        // Chạy tickAll
        await VoiceRecoveryService_1.voiceRecoveryService.tickAll(client);
        updatedUser = UserRepository_1.userRepository.get(testUserId);
        vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        console.log('Stamina after hitting cap:', updatedUser.stamina);
        console.log('Total bonus today:', vr.total_bonus_today);
        console.log('Session bonus added:', vr.session_bonus_added);
        if (updatedUser.stamina === 52 && vr.total_bonus_today === 120 && vr.session_bonus_added === 2) {
            console.log('✅ Giới hạn cap 120 stamina hàng ngày hoạt động chính xác! (Chỉ cộng thêm 2 thay vì 15)');
        }
        else {
            throw new Error(`❌ Thất bại: Giới hạn cap không hoạt động chính xác! (${updatedUser.stamina} / ${vr.total_bonus_today})`);
        }
        // ==========================================
        // KIỂM THỬ 6: Giãn cách thời gian (Cooldown 10 phút)
        // ==========================================
        console.log('\n--- KIỂM THỬ 6: Giãn cách 10 phút (Cooldown) ---');
        UserRepository_1.userRepository.update(testUserId, { stamina: 50 });
        // Thiết lập last_session_end là 2 phút trước
        database_2.default.prepare(`
      UPDATE voice_recovery 
      SET session_start = 0, last_session_end = ?
      WHERE user_id = ?
    `).run(now - 120, testUserId);
        await VoiceRecoveryService_1.voiceRecoveryService.onVoiceJoin(client, testUserId, targetGuildId, channelId);
        vr = database_2.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(testUserId);
        if (vr && vr.session_start === 0) {
            console.log('✅ Cooldown 10 phút chặn tham gia tụ linh thành công!');
        }
        else {
            throw new Error('❌ Thất bại: Không chặn được khi vẫn đang trong cooldown!');
        }
        console.log('\n🎉 --- TẤT CẢ KIỂM THỬ VOICE RECOVERY ĐÃ THÀNH CÔNG RỰC RỠ! ---');
    }
    catch (error) {
        console.error('❌ Lỗi trong quá trình kiểm thử:', error);
        process.exit(1);
    }
    finally {
        database_2.default.close();
    }
}
main();
