"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Event_1 = require("../structures/Event");
const database_1 = require("../database/database");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
class ReadyEvent extends Event_1.Event {
    constructor() {
        super('ready', true); // Chạy 1 lần duy nhất khi bot sẵn sàng
    }
    async execute(client) {
        const table = new cli_table3_1.default({
            head: [chalk_1.default.cyan('Service / Module'), chalk_1.default.cyan('Trạng Thái')],
            colWidths: [40, 20],
            style: { head: [], border: [] }
        });
        console.log(chalk_1.default.green.bold(`\n✅ Bot Tu Tiên đã sẵn sàng! Danh tính: ${chalk_1.default.yellow(client.user?.tag)}`));
        // 1. Tự động kết nối và khởi tạo các bảng cơ sở dữ liệu
        try {
            (0, database_1.initDatabase)();
            table.push(['SQLite Database', chalk_1.default.green('✔ Thành công')]);
        }
        catch (error) {
            table.push(['SQLite Database', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Database:'), error);
        }
        // 2. Tự động đăng ký các Slash Command
        try {
            await client.commandHandler.deploy();
            table.push(['Slash Commands', chalk_1.default.green('✔ Đã đăng ký')]);
        }
        catch (error) {
            table.push(['Slash Commands', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Slash Commands:'), error);
        }
        // 3. Khởi động vòng quét hồi sinh và thông báo Boss
        try {
            const { bossSpawnService } = require('../services/BossSpawnService');
            bossSpawnService.startScheduler(client);
            table.push(['World Boss Scheduler', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['World Boss Scheduler', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Boss Scheduler:'), error);
        }
        // 4. Khởi động scheduler sự kiện định kỳ
        try {
            const { eventService } = require('../services/EventService');
            eventService.startScheduler();
            table.push(['Event Scheduler', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Event Scheduler', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Event Scheduler:'), error);
        }
        // 5. Khởi động scheduler Vạn Bảo Lâu (kết thúc đấu giá hết hạn & auto-bid)
        try {
            const { marketService } = require('../services/MarketService');
            marketService.startScheduler();
            table.push(['Vạn Bảo Lâu Scheduler', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Vạn Bảo Lâu Scheduler', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Vạn Bảo Lâu Scheduler:'), error);
        }
        // 6. Khởi động scheduler mùa giải quyết đấu (trao thưởng top 3 hàng tuần)
        try {
            const { minigameService } = require('../services/MinigameService');
            minigameService.startSeasonScheduler();
            table.push(['Duel Season Scheduler', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Duel Season Scheduler', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Duel Season Scheduler:'), error);
        }
        // 7. Khởi động Rich Presence (Activity Rotation)
        try {
            this.startRichPresence(client);
            table.push(['Rich Presence', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Rich Presence', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Rich Presence:'), error);
        }
        // 8. Khởi động Data Cleanup Scheduler
        try {
            const { dataCleanupService } = require('../services/DataCleanupService');
            dataCleanupService.startScheduler();
            table.push(['Data Cleanup Scheduler', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Data Cleanup Scheduler', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Data Cleanup Scheduler:'), error);
        }
        // 9. Khởi động Leyline Service
        try {
            const { leylineService } = require('../services/LeylineService');
            leylineService.init(client);
            table.push(['Leyline Service', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Leyline Service', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Leyline Service:'), error);
        }
        // 10. Khởi động Traveler Service
        try {
            const { travelerService } = require('../services/TravelerService');
            travelerService.init(client);
            table.push(['Traveler Service', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Traveler Service', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Traveler Service:'), error);
        }
        // 10.5. Khởi động Backup Service
        try {
            const { backupService } = require('../services/BackupService');
            backupService.startScheduler();
            table.push(['Backup Service', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Backup Service', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Backup Service:'), error);
        }
        // 11. Khởi động Arena Scheduler
        try {
            const { arenaService } = require('../services/ArenaService');
            arenaService.initScheduler();
            table.push(['Arena Scheduler', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Arena Scheduler', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Arena Scheduler:'), error);
        }
        // 12. Khởi động Voice Recovery Service
        try {
            const { voiceRecoveryService } = require('../services/VoiceRecoveryService');
            voiceRecoveryService.initScheduler(client);
            table.push(['Voice Recovery Service', chalk_1.default.green('✔ Running')]);
        }
        catch (error) {
            table.push(['Voice Recovery Service', chalk_1.default.red('❌ LỖI')]);
            console.error(chalk_1.default.red('[System] Lỗi Voice Recovery Service:'), error);
        }
        console.log('\n' + table.toString() + '\n');
        console.log(chalk_1.default.magenta('Mời đạo hữu sử dụng bot trên Discord! 🚀\n'));
    }
    /**
     * Khởi động vòng xoay Rich Presence cho bot
     * Tự động cập nhật Activity mỗi 30 giây với thông tin thực tế từ DB
     */
    startRichPresence(client) {
        const { ActivityType } = require('discord.js');
        const db = require('../database/database').default;
        // Hàm lấy số liệu thực tế từ DB
        const getStats = () => {
            try {
                const totalPlayers = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0;
                const totalSects = db.prepare('SELECT COUNT(*) as c FROM sects WHERE status = ?').get('active')?.c || 0;
                const activeBoss = db.prepare("SELECT name FROM world_boss WHERE status = 'active' LIMIT 1").get();
                const topPlayer = db.prepare('SELECT name FROM users ORDER BY level DESC LIMIT 1').get();
                return { totalPlayers, totalSects, activeBoss, topPlayer };
            }
            catch {
                return { totalPlayers: 0, totalSects: 0, activeBoss: undefined, topPlayer: undefined };
            }
        };
        // Pool các activity xoay vòng
        const getActivities = () => {
            const { totalPlayers, totalSects, activeBoss, topPlayer } = getStats();
            return [
                {
                    name: `${totalPlayers} tu sĩ đang tu luyện`,
                    type: ActivityType.Watching,
                    state: '⚡ Hệ Thống Tu Chân — Niên Hiệu Linh Hư 358'
                },
                {
                    name: '/taonhanvat — Khai sinh nhân vật',
                    type: ActivityType.Playing,
                    state: '🌟 Tu Đạo Vấn Trường Sinh!'
                },
                {
                    name: activeBoss ? `Boss ${activeBoss.name} đang xuất hiện!` : 'Tu tiên, luyện khí, đột phá!',
                    type: activeBoss ? ActivityType.Competing : ActivityType.Playing,
                    state: activeBoss ? '👹 Boss Thế Giới đang hoành hành!' : '⚔️ Chiến Đấu & Tu Luyện'
                },
                {
                    name: `${totalSects} Tông Môn tranh bá`,
                    type: ActivityType.Watching,
                    state: '🏯 Cuộc Chiến Tông Môn Bắt Đầu!'
                },
                {
                    name: 'Tam Hồi Linh Chiến — /quyetau',
                    type: ActivityType.Competing,
                    state: '⚔️ Quyết Đấu PvP Linh Thạch!'
                },
                {
                    name: topPlayer ? `Cao Thủ: ${topPlayer.name}` : 'Ai là đệ nhất tu sĩ?',
                    type: ActivityType.Watching,
                    state: '🏆 Bảng Xếp Hạng Tu Sĩ'
                },
                {
                    name: '/lamviec — Khai thác, hái lượm, tuần tra',
                    type: ActivityType.Playing,
                    state: '⛏️ Kiếm Linh Thạch Mỗi Ngày'
                },
                {
                    name: 'Trấn Yêu Tháp — 100 Tầng Thử Thách',
                    type: ActivityType.Competing,
                    state: '🏯 Ai Đủ Sức Vượt Đỉnh Tháp?'
                },
            ];
        };
        let activityIndex = 0;
        const rotate = () => {
            try {
                const activities = getActivities();
                const current = activities[activityIndex % activities.length];
                client.user?.setPresence({
                    status: 'online',
                    activities: [{
                            name: current.name,
                            type: current.type,
                            state: current.state,
                        }]
                });
                activityIndex++;
            }
            catch (e) {
                // Bỏ qua lỗi rotation để không crash
            }
        };
        // Chạy ngay lập tức
        rotate();
        // Sau đó xoay mỗi 30 giây
        setInterval(rotate, 30_000);
    }
}
exports.default = ReadyEvent;
