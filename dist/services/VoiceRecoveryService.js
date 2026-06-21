"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceRecoveryService = exports.VoiceRecoveryService = exports.VOICE_RECOVERY_CONFIG = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const CronManager_1 = require("../utils/CronManager");
const discord_js_1 = require("discord.js");
exports.VOICE_RECOVERY_CONFIG = {
    TARGET_GUILD_ID: '1436366637899976767',
    ACTIVATION_THRESHOLD: 100,
    RECOVERY_INTERVAL_MS: 20_000,
    DAILY_BONUS_CAP: 120,
    MIN_SESSION_SECONDS: 300, // 5 minutes
    SESSION_COOLDOWN_SECONDS: 600, // 10 minutes
};
class VoiceRecoveryService {
    /**
     * Khởi chạy scheduler quét hồi phục thể lực
     */
    initScheduler(client) {
        // Quét mỗi 20 giây
        CronManager_1.CronManager.registerTask('voice_recovery_tick', exports.VOICE_RECOVERY_CONFIG.RECOVERY_INTERVAL_MS, () => {
            this.tickAll(client);
        });
    }
    /**
     * Lấy thông tin voice recovery của người dùng
     */
    getOrCreate(userId) {
        let vr = database_1.default.prepare('SELECT * FROM voice_recovery WHERE user_id = ?').get(userId);
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
        if (!vr) {
            database_1.default.prepare(`
        INSERT INTO voice_recovery (user_id, session_start, total_bonus_today, last_bonus_date, last_session_end, stamina_at_join, session_bonus_added)
        VALUES (?, 0, 0, ?, 0, 0, 0)
      `).run(userId, today);
            vr = {
                user_id: userId,
                session_start: 0,
                total_bonus_today: 0,
                last_bonus_date: today,
                last_session_end: 0,
                stamina_at_join: 0,
                session_bonus_added: 0
            };
        }
        else if (vr.last_bonus_date !== today) {
            database_1.default.prepare(`
        UPDATE voice_recovery 
        SET total_bonus_today = 0, last_bonus_date = ?, session_bonus_added = 0 
        WHERE user_id = ?
      `).run(today, userId);
            vr.total_bonus_today = 0;
            vr.last_bonus_date = today;
            vr.session_bonus_added = 0;
        }
        return vr;
    }
    /**
     * Lấy kênh thông báo (tông môn tu luyện) của máy chủ
     */
    async getAnnounceChannel(client, guildId) {
        try {
            const config = database_1.default.prepare('SELECT tuluyen_channel_id, event_channel_id FROM guild_configs WHERE guild_id = ?').get(guildId);
            if (!config)
                return null;
            const targetId = config.tuluyen_channel_id || config.event_channel_id;
            if (!targetId || !/^\d{17,20}$/.test(targetId))
                return null;
            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
            if (!guild)
                return null;
            const channel = guild.channels.cache.get(targetId) || await guild.channels.fetch(targetId);
            if (channel && channel.isTextBased()) {
                return channel;
            }
        }
        catch (e) {
            console.error('[VoiceRecoveryService] Lỗi lấy kênh thông báo:', e);
        }
        return null;
    }
    /**
     * Khi người dùng tham gia voice channel
     */
    async onVoiceJoin(client, userId, guildId, channelId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return;
        // Chỉ kích hoạt khi Stamina dưới mức quy định
        if (user.stamina >= exports.VOICE_RECOVERY_CONFIG.ACTIVATION_THRESHOLD)
            return;
        const vr = this.getOrCreate(userId);
        // Nếu đã ở trong session rồi thì bỏ qua
        if (vr.session_start > 0)
            return;
        const now = Math.floor(Date.now() / 1000);
        // Kiểm tra cooldown
        const elapsedCooldown = now - vr.last_session_end;
        if (elapsedCooldown < exports.VOICE_RECOVERY_CONFIG.SESSION_COOLDOWN_SECONDS) {
            const remaining = exports.VOICE_RECOVERY_CONFIG.SESSION_COOLDOWN_SECONDS - elapsedCooldown;
            const channel = await this.getAnnounceChannel(client, guildId);
            if (channel) {
                channel.send(`⚠️ Đạo hữu **${user.name}** vừa vào voice nhưng vẫn còn trong thời gian giãn cách tụ linh (${remaining} giây).`).catch(() => null);
            }
            return;
        }
        // Khởi động session mới
        database_1.default.prepare(`
      UPDATE voice_recovery 
      SET session_start = ?, stamina_at_join = ?, session_bonus_added = 0
      WHERE user_id = ?
    `).run(now, user.stamina, userId);
        // Gửi thông báo
        const channel = await this.getAnnounceChannel(client, guildId);
        if (channel) {
            try {
                const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
                const vc = guild?.channels.cache.get(channelId) || await guild?.channels.fetch(channelId);
                const vcName = vc ? vc.name : 'Voice Channel';
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🎵 TỤ LINH HỒI PHỤC')
                    .setColor('#3498db')
                    .setDescription(`🧘 **${user.name}** đã vào phòng voice **${vcName}**.\n` +
                    `Bắt đầu hấp thu linh khí hồi phục thể lực!\n\n` +
                    `📊 Thể lực hiện tại: **${user.stamina}/500**\n` +
                    `⏱️ Tốc độ hồi: **1 stamina / 20 giây** (gấp 6x)\n` +
                    `🎯 Bonus tối đa hôm nay: **${exports.VOICE_RECOVERY_CONFIG.DAILY_BONUS_CAP} stamina**\n` +
                    `📈 Đã dùng hôm nay: **${vr.total_bonus_today}/${exports.VOICE_RECOVERY_CONFIG.DAILY_BONUS_CAP}**\n\n` +
                    `*Càng ở lâu càng hồi nhanh. Tối thiểu 5 phút để nhận bonus.*`)
                    .setTimestamp();
                channel.send({ embeds: [embed] }).catch(() => null);
            }
            catch (e) {
                console.error(e);
            }
        }
    }
    /**
     * Khi người dùng rời voice channel
     */
    async onVoiceLeave(client, userId) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return;
        const vr = this.getOrCreate(userId);
        if (vr.session_start === 0)
            return;
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - vr.session_start;
        // Reset session trước trong DB để tránh loop trùng lặp
        database_1.default.prepare(`
      UPDATE voice_recovery 
      SET session_start = 0, last_session_end = ?
      WHERE user_id = ?
    `).run(now, userId);
        const channel = await this.getAnnounceChannel(client, exports.VOICE_RECOVERY_CONFIG.TARGET_GUILD_ID);
        // Kiểm tra thời gian tối thiểu
        if (elapsed < exports.VOICE_RECOVERY_CONFIG.MIN_SESSION_SECONDS) {
            if (channel) {
                channel.send(`⚠️ Đạo hữu **${user.name}** rời voice quá sớm (mới được ${elapsed} giây, chưa đủ 5 phút). Tụ linh thất bại, linh khí tiêu tán hết!`).catch(() => null);
            }
            return;
        }
        // Gửi thông báo kết thúc thành công
        if (channel) {
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🎵 KẾT THÚC TỤ LINH')
                .setColor('#2ecc71')
                .setDescription(`🧘 **${user.name}** đã rời khỏi voice.\n\n` +
                `⏱️ Thời gian tụ linh: **${minutes} phút ${seconds} giây**\n` +
                `⚡ Thể lực hồi phục: **+${vr.session_bonus_added}** (Tổng: **${vr.total_bonus_today}/${exports.VOICE_RECOVERY_CONFIG.DAILY_BONUS_CAP}** hôm nay)\n` +
                `📊 Thể lực hiện tại: **${user.stamina}/500**\n` +
                `⏳ Cooldown: **10 phút** trước lần tụ tiếp.\n\n` +
                `*Hãy quay lại khi thể lực cạn nhé!*`)
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => null);
        }
    }
    /**
     * Định kỳ cộng thêm stamina và check trạng thái
     */
    async tickAll(client) {
        try {
            const activeSessions = database_1.default.prepare('SELECT * FROM voice_recovery WHERE session_start > 0').all();
            const guild = client.guilds.cache.get(exports.VOICE_RECOVERY_CONFIG.TARGET_GUILD_ID) ||
                await client.guilds.fetch(exports.VOICE_RECOVERY_CONFIG.TARGET_GUILD_ID);
            if (!guild)
                return;
            const now = Math.floor(Date.now() / 1000);
            for (const vr of activeSessions) {
                const userId = vr.user_id;
                // 1. Kiểm tra xem người dùng còn ở trong voice của guild đó không
                let inVoice = false;
                try {
                    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
                    if (member && member.voice.channelId) {
                        inVoice = true;
                    }
                }
                catch (e) { }
                if (!inVoice) {
                    // Người dùng đã rời voice mà bot không bắt được event -> gọi onVoiceLeave
                    await this.onVoiceLeave(client, userId);
                    continue;
                }
                // 2. Kiểm tra giới hạn hàng ngày & thể lực tối đa
                const user = UserRepository_1.userRepository.get(userId);
                if (!user)
                    continue;
                if (vr.total_bonus_today >= exports.VOICE_RECOVERY_CONFIG.DAILY_BONUS_CAP || user.stamina >= 500) {
                    // Không thể nhận thêm nữa, bỏ qua tick này
                    continue;
                }
                // 3. Tính toán xem có được cộng stamina hay không
                const elapsed = now - vr.session_start;
                if (elapsed < exports.VOICE_RECOVERY_CONFIG.MIN_SESSION_SECONDS) {
                    // Chưa đủ 5 phút tối thiểu -> chưa cộng gì cả
                    continue;
                }
                // Đã đủ 5 phút trở lên.
                // Tỷ lệ hồi phục: 1 stamina / 20 giây.
                // Tổng số stamina đáng lẽ phải được cộng ở mốc thời gian này:
                const expectedBonus = Math.floor(elapsed / 20);
                // Số stamina thực tế cần bù thêm vào (chênh lệch giữa expected và lượng đã cộng trước đó trong session này)
                const addedInSession = vr.session_bonus_added;
                let diff = expectedBonus - addedInSession;
                if (diff > 0) {
                    // Enforce cap
                    const remainingCap = exports.VOICE_RECOVERY_CONFIG.DAILY_BONUS_CAP - vr.total_bonus_today;
                    const remainingStaminaLimit = 500 - user.stamina;
                    const maxToApply = Math.min(remainingCap, remainingStaminaLimit);
                    const actualAdd = Math.min(diff, maxToApply);
                    if (actualAdd > 0) {
                        const newStamina = user.stamina + actualAdd;
                        const newTotalBonus = vr.total_bonus_today + actualAdd;
                        const newSessionBonus = vr.session_bonus_added + actualAdd;
                        // Cập nhật DB
                        UserRepository_1.userRepository.update(userId, { stamina: newStamina });
                        database_1.default.prepare(`
              UPDATE voice_recovery 
              SET total_bonus_today = ?, session_bonus_added = ? 
              WHERE user_id = ?
            `).run(newTotalBonus, newSessionBonus, userId);
                        // Ghi nhận vào cache
                        user.stamina = newStamina;
                    }
                }
            }
        }
        catch (error) {
            console.error('[VoiceRecoveryService] Lỗi trong tickAll:', error);
        }
    }
    /**
     * Reset daily counter
     */
    resetDaily() {
        const today = new Date().toLocaleDateString('en-CA');
        database_1.default.prepare('UPDATE voice_recovery SET total_bonus_today = 0, last_bonus_date = ?').run(today);
        console.log('[VoiceRecoveryService] Reset daily stamina recovery counts.');
    }
}
exports.VoiceRecoveryService = VoiceRecoveryService;
exports.voiceRecoveryService = new VoiceRecoveryService();
