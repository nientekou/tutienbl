import { Event } from '../structures/Event';
import { TuTienClient } from '../client/TuTienClient';
import { initDatabase } from '../database/database';
import { leaderboardService } from '../services/LeaderboardService';
import chalk from 'chalk';
import Table from 'cli-table3';

export default class ReadyEvent extends Event<'ready'> {
  constructor() {
    super('ready', true); // Chạy 1 lần duy nhất khi bot sẵn sàng
  }

  public async execute(client: TuTienClient): Promise<void> {
    const table = new Table({
      head: [chalk.cyan('Service / Module'), chalk.cyan('Trạng Thái')],
      colWidths: [40, 20],
      style: { head: [], border: [] }
    });

    console.log(chalk.green.bold(`\n✅ Bot Tu Tiên đã sẵn sàng! Danh tính: ${chalk.yellow(client.user?.tag)}`));

    // 1. Tự động kết nối và khởi tạo các bảng cơ sở dữ liệu
    try {
      initDatabase();
      leaderboardService.clearCache();
      table.push(['SQLite Database', chalk.green('✔ Thành công')]);
    } catch (error) {
      table.push(['SQLite Database', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Database:'), error);
    }

    // 2. Tự động đăng ký các Slash Command
    try {
      await client.commandHandler.deploy();
      table.push(['Slash Commands', chalk.green('✔ Đã đăng ký')]);
    } catch (error) {
      table.push(['Slash Commands', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Slash Commands:'), error);
    }

    // 3. Khởi động vòng quét hồi sinh và thông báo Boss
    try {
      const { bossSpawnService } = require('../services/BossSpawnService');
      bossSpawnService.startScheduler(client);
      table.push(['World Boss Scheduler', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['World Boss Scheduler', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Boss Scheduler:'), error);
    }

    // 4. Khởi động scheduler sự kiện định kỳ
    try {
      const { eventService } = require('../services/EventService');
      eventService.startScheduler();
      table.push(['Event Scheduler', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Event Scheduler', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Event Scheduler:'), error);
    }

    // 5. Khởi động scheduler Vạn Bảo Lâu (kết thúc đấu giá hết hạn & auto-bid)
    try {
      const { marketService } = require('../services/MarketService');
      marketService.startScheduler();
      table.push(['Vạn Bảo Lâu Scheduler', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Vạn Bảo Lâu Scheduler', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Vạn Bảo Lâu Scheduler:'), error);
    }

    // 6. Khởi động scheduler mùa giải quyết đấu (trao thưởng top 3 hàng tuần)
    try {
      const { minigameService } = require('../services/MinigameService');
      minigameService.startSeasonScheduler();
      table.push(['Duel Season Scheduler', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Duel Season Scheduler', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Duel Season Scheduler:'), error);
    }

    // 7. Khởi động Rich Presence (Activity Rotation)
    try {
      this.startRichPresence(client);
      table.push(['Rich Presence', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Rich Presence', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Rich Presence:'), error);
    }

    // 8. Khởi động Data Cleanup Scheduler
    try {
      const { dataCleanupService } = require('../services/DataCleanupService');
      dataCleanupService.startScheduler();
      table.push(['Data Cleanup Scheduler', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Data Cleanup Scheduler', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Data Cleanup Scheduler:'), error);
    }

    // 9. Khởi động Leyline Service
    try {
      const { leylineService } = require('../services/LeylineService');
      leylineService.init(client);
      table.push(['Leyline Service', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Leyline Service', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Leyline Service:'), error);
    }

    // 10. Khởi động Traveler Service
    try {
      const { travelerService } = require('../services/TravelerService');
      travelerService.init(client);
      table.push(['Traveler Service', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Traveler Service', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Traveler Service:'), error);
    }

    // 10.5. Khởi động Backup Service
    try {
      const { backupService } = require('../services/BackupService');
      backupService.startScheduler();
      table.push(['Backup Service', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Backup Service', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Backup Service:'), error);
    }

    // 11. Khởi động Arena Scheduler
    try {
      const { arenaService } = require('../services/ArenaService');
      arenaService.initScheduler();
      table.push(['Arena Scheduler', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Arena Scheduler', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Arena Scheduler:'), error);
    }

    // 12. Khởi động Voice Recovery Service
    try {
      const { voiceRecoveryService } = require('../services/VoiceRecoveryService');
      voiceRecoveryService.initScheduler(client);
      table.push(['Voice Recovery Service', chalk.green('✔ Running')]);
    } catch (error) {
      table.push(['Voice Recovery Service', chalk.red('❌ LỖI')]);
      console.error(chalk.red('[System] Lỗi Voice Recovery Service:'), error);
    }

    console.log('\n' + table.toString() + '\n');
    console.log(chalk.magenta('Mời đạo hữu sử dụng bot trên Discord! 🚀\n'));
  }

  /**
   * Khởi động vòng xoay Rich Presence cho bot
   * Tự động cập nhật Activity mỗi 30 giây với thông tin thực tế từ DB
   */
  private startRichPresence(client: TuTienClient): void {
    const { ActivityType } = require('discord.js');
    const db = require('../database/database').default;

    // Hàm lấy số liệu thực tế từ DB
    const getStats = () => {
      try {
        const totalPlayers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
        const totalSects = (db.prepare('SELECT COUNT(*) as c FROM sects WHERE status = ?').get('active') as any)?.c || 0;
        const activeBoss = db.prepare("SELECT name FROM world_boss WHERE status = 'active' LIMIT 1").get() as { name: string } | undefined;
        const topPlayer = db.prepare('SELECT name FROM users ORDER BY level DESC LIMIT 1').get() as { name: string } | undefined;
        return { totalPlayers, totalSects, activeBoss, topPlayer };
      } catch {
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
      } catch (e) {
        // Bỏ qua lỗi rotation để không crash
      }
    };

    // Chạy ngay lập tức
    rotate();

    // Sau đó xoay mỗi 30 giây
    setInterval(rotate, 30_000);
  }
}
