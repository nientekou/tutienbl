import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import { CombatEngine } from '../../services/CombatEngine';
import { dailyQuestService } from '../../services/DailyQuestService';
import { getProgressBar } from '../../utils/constants';
import { ITEMS } from '../../config/itemConstants';
import db from '../../database/database';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

interface RoguelikeProgress {
  user_id: string;
  current_floor: number;
  max_floor: number;
  hp_percent: number;
  mp_percent: number;
  buffs: string;
  lives: number;
  last_reset_at: number;
}

// === Helper functions for button handlers ===

export function getTowerEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  const progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress | undefined;

  const floor = progress ? progress.current_floor : 1;
  const maxFloor = progress ? progress.max_floor : 1;
  const lives = progress ? progress.lives : 3;
  const hpPercent = progress ? progress.hp_percent : 1.0;

  // Tính chỉ số quái vật ở tầng hiện tại
  const monsterHp = Math.round(150 * Math.pow(1.15, floor - 1));
  const monsterAtk = Math.round(15 * Math.pow(1.12, floor - 1));
  const monsterDef = Math.round(6 * Math.pow(1.12, floor - 1));

  const livesText = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
  const hpBar = getProgressBar(Math.round(hpPercent * 100), 100, 10);

  return new EmbedBuilder()
    .setTitle(`🏰 THÁP VÔ HẠN ROGUELIKE - ${user?.name || 'Không xác định'}`)
    .setColor(EMBED_COLORS.ERROR)
    .setDescription(
      `Nơi tu sĩ leo tháp cọ xát võ học bản thân. Càng lên cao, yêu tinh thần thú càng bá đạo.\n\n` +
      `🏆 **Tầng Cao Nhất Đạt Được:** Tầng **${maxFloor}**\n` +
      `⚡ **Tầng Hiện Tại:** Tầng **${floor}**\n` +
      `❤️ **Sinh Mạng Còn Lại:** ${livesText} **(${lives}/3)**\n` +
      `🩸 **Trạng Thái Sinh Lực:**\n${hpBar} **(${Math.round(hpPercent * 100)}%)**\n\n` +
      `👻 **Thông tin quái vật tầng ${floor}:**\n` +
      `• Sinh Lực: **${monsterHp}** HP\n` +
      `• Tấn Công: **${monsterAtk}** ATK\n` +
      `• Phòng Thủ: **${monsterDef}** DEF\n\n` +
      `*Gợi ý: Dùng \`/leothap khieu-chien\` để leo tầng tiếp theo (Tốn 20 Thể Lực), hoặc \`/leothap khoi-dau\` để reset bắt đầu lại từ đầu.*`
    )
    .setTimestamp();
}

export function getTowerComponents(userId: string): any[] {
  return [];
}

export default class LeoThapCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('leothap')
        .setDescription('Khiêu chiến Tháp Vô Hạn (Roguelike) kiểm thử thực lực tu sĩ.')
        .addSubcommand(sub =>
          sub
            .setName('trangthai')
            .setDescription('Xem trạng thái leo tháp và tầng cao nhất đã đạt.')
        )
        .addSubcommand(sub =>
          sub
            .setName('khieu-chien')
            .setDescription('Tiến vào khiêu chiến tầng tiếp theo (Tiêu hao 20 Thể Lực).')
        )
        .addSubcommand(sub =>
          sub
            .setName('khoi-dau')
            .setDescription('Reset quá trình về Tầng 1 với 3 mạng mới (Tiêu hao 20 Thể Lực).')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'});
      return;
    }

    const sub = interaction.options.getSubcommand();

    // Lấy progress hiện tại
    let progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress | undefined;

    if (sub === 'trangthai') {
      const embed = getTowerEmbed(userId);
      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    // Các hành động chiến đấu/reset tiêu tốn 20 Stamina
    if (user.stamina < 20) {
      await interaction.editReply({
        content: `❌ Đạo hữu không đủ Thể Lực! (Cần ít nhất **20** điểm, hiện có **${user.stamina}**). Hãy nghỉ ngơi tĩnh dưỡng.`
      });
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    if (sub === 'khoi-dau') {
      db.transaction(() => {
        // Reset progress
        db.prepare(`
          INSERT INTO roguelike_progress (user_id, current_floor, max_floor, hp_percent, mp_percent, buffs, lives, last_reset_at)
          VALUES (?, 1, ?, 1.0, 1.0, '[]', 3, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            current_floor = 1,
            hp_percent = 1.0,
            mp_percent = 1.0,
            buffs = '[]',
            lives = 3,
            last_reset_at = excluded.last_reset_at
        `).run(userId, progress ? progress.max_floor : 1, now);

        // Trừ thể lực
        userRepository.update(userId, { stamina: user.stamina - 20 });
      })();

      await interaction.editReply({
        content: `🔄 Đạo hữu đã tốn **20 Thể Lực** để thiết lập lại trận địa Tháp Vô Hạn! Đạo hữu đang ở **Tầng 1** với đầy đủ **3 sinh mạng**. Sử dụng \`/leothap khieu-chien\` để xung trận!`
      });
      return;
    }

    if (sub === 'khieu-chien') {
      if (!progress) {
        // Tạo mới run nếu chưa có
        db.prepare(`
          INSERT INTO roguelike_progress (user_id, current_floor, max_floor, hp_percent, mp_percent, buffs, lives, last_reset_at)
          VALUES (?, 1, 1, 1.0, 1.0, '[]', 3, ?)
        `).run(userId, now);
        progress = db.prepare('SELECT * FROM roguelike_progress WHERE user_id = ?').get(userId) as RoguelikeProgress;
      }

      if (progress.lives <= 0) {
        await interaction.editReply({
          content: '❌ Đạo hữu đã cạn kiệt sinh mạng trong run tháp này! Vui lòng dùng lệnh \`/leothap khoi-dau\` để reset bắt đầu đợt leo tháp mới.'
        });
        return;
      }

      // Lấy chỉ số chiến đấu thực tế
      const activeStats = inventoryService.getActiveStats(userId);
      if (!activeStats) {
        await interaction.editReply({ content: '❌ Lỗi hệ thống: Không thể tính toán thuộc tính chiến đấu.'});
        return;
      }

      // Tính toán HP dựa trên lượng HP mang theo từ tầng trước
      const startHp = Math.max(1, Math.round(activeStats.hp * progress.hp_percent));

      // Lấy sủng thú trợ chiến
      const activePet = db.prepare('SELECT name, base_atk FROM pets WHERE user_id = ? AND is_deployed = 1')
        .get(userId) as { name: string; base_atk: number } | undefined;

      // Quái vật tầng hiện tại (tăng tiến cấp số nhân sức mạnh)
      const floor = progress.current_floor;
      const monsterHp = Math.round(150 * Math.pow(1.15, floor - 1));
      const monsterAtk = Math.round(15 * Math.pow(1.12, floor - 1));
      const monsterDef = Math.round(6 * Math.pow(1.12, floor - 1));

      const playerCombatant = {
        name: user.name,
        hp: startHp,
        maxHp: activeStats.hp,
        atk: activeStats.atk,
        def: activeStats.def,
        crit: activeStats.crit,
        critRes: activeStats.critRes,
        luck: activeStats.luck,
        linhCan: user.linh_can
      };

      const enemyCombatant = {
        name: `Oán Linh Tháp Chủ - Tầng ${floor} 👻`,
        hp: monsterHp,
        maxHp: monsterHp,
        atk: monsterAtk,
        def: monsterDef,
        crit: 0.05 + floor * 0.002,
        critRes: 0.01 + floor * 0.001,
        luck: 10
      };

      // Chạy combat
      const combatResult = CombatEngine.run(
        playerCombatant,
        enemyCombatant,
        activePet ? { name: activePet.name, atk: activePet.base_atk } : null,
        30
      );

      const isWin = combatResult.winner === 'player';
      const embed = new EmbedBuilder().setTimestamp();

      if (isWin) {
        // Tỷ lệ sinh lực còn lại sau trận đấu
        const endingHpPercent = Math.min(1.0, combatResult.playerEndingHp / activeStats.hp);

        let sectBonusMultiplier = 1.0;
        if (user.sect_id) {
          const sect = db.prepare('SELECT buildings FROM sects WHERE id = ?').get(user.sect_id) as any;
          if (sect) {
            try {
              const b = JSON.parse(sect.buildings || '{}');
              if (b.tangkinhcac) sectBonusMultiplier += b.tangkinhcac * 0.02; // +2% mỗi cấp
            } catch(e){}
          }
        }
        const expGained = Math.round(50 * floor * sectBonusMultiplier);
        const coinGained = 10 * floor;

        const cappedNewTuVi = Math.min(user.tu_vi + expGained, user.exp_needed);
        const actualGainedExp = cappedNewTuVi - user.tu_vi;

        const newMaxFloor = Math.max(progress.max_floor, floor);

        db.transaction(() => {
          // Trực tiếp cập nhật progress tháp tiến lên tầng sau
          db.prepare(`
            UPDATE roguelike_progress
            SET current_floor = current_floor + 1,
                max_floor = ?,
                hp_percent = ?
            WHERE user_id = ?
          `).run(newMaxFloor, endingHpPercent, userId);

          // Trừ stamina và phát thưởng
          userRepository.update(userId, {
            stamina: user.stamina - 20,
            tu_vi: cappedNewTuVi,
            coin_ha_pham: user.coin_ha_pham + coinGained
          });

          // Cơ hội 20% rơi mảnh trang bị
          if (Math.random() < 0.20) {
            inventoryRepository.addItem(userId, ITEMS.ITEM_FRAGMENT, 1);
          }
        })();

        // Cập nhật tiến trình nhiệm vụ hàng ngày
        dailyQuestService.updateProgress(userId, 'daily_leothap', 1);

        let artifactMsg = '';
        const artifactExp = Math.round(expGained * 0.1);
        const artifactRes = inventoryService.addArtifactExp(userId, artifactExp);
        if (artifactRes && artifactRes.message) {
          artifactMsg = `\n• ${artifactRes.message}`;
        }

        embed.setTitle(`🏆 CHIẾN THẮNG TẦNG ${floor}`)
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(
            `Đạo hữu đã đả bại thành công **${enemyCombatant.name}**!\n\n` +
            `📊 **Thông số sau hiệp đấu:**\n` +
            `• Sinh lực mang đi tiếp: **${Math.round(endingHpPercent * 100)}%** HP ❤️\n` +
            `• Tu vi nhận thức: **+${actualGainedExp}** Tu Vi 🌿\n` +
            `• Linh thạch nhặt được: **+${coinGained}** Linh Thạch 🟤\n` +
            `• Thể lực hao tổn: **-20** Thể Lực ⚡ (Còn lại: **${user.stamina - 20}/500**)${artifactMsg}\n\n` +
            `👉 Đạo hữu đã sẵn sàng bước tiếp lên **Tầng ${floor + 1}**!`
          );

      } else {
        // Thất bại trong tháp -> Hao tổn 1 mạng
        const newLives = progress.lives - 1;
        const finalHpPercent = newLives > 0 ? 1.0 : 0.0; // Hồi sinh lại 100% nếu còn mạng

        db.transaction(() => {
          db.prepare(`
            UPDATE roguelike_progress
            SET lives = ?,
                hp_percent = ?
            WHERE user_id = ?
          `).run(newLives, finalHpPercent, userId);

          userRepository.update(userId, { stamina: user.stamina - 20 });
        })();

        embed.setTitle(`💀 THẤT BẠI TẦNG ${floor}`)
          .setColor(EMBED_COLORS.ERROR);

        if (newLives > 0) {
          embed.setDescription(
            `Đạo hữu tử trận tại tầng **${floor}**!\n\n` +
            `• Sát thương oán khí bạo liệt, đạo hữu hao tổn **-1 sinh mạng** (Còn lại **${newLives}/3** mạng).\n` +
            `• Trừ **-20 Thể Lực** ⚡ (Còn lại: **${user.stamina - 20}/500**).\n\n` +
            `✨ *Linh thể tự động được tháp quy tắc tái tạo đầy 100% HP. Đạo hữu có thể khiêu chiến lại tầng này!*`
          );
        } else {
          embed.setDescription(
            `Đạo hữu đã cạn kiệt sinh mạng tại tầng **${floor}**!\n\n` +
            `• Trừ **-20 Thể Lực** ⚡.\n` +
            `💀 *Đạo hữu bị đẩy văng ra khỏi chân tháp. Hãy dùng lệnh \`/leothap khoi-dau\` để thiết lập run mới từ Tầng 1.*`
          );
        }
      }

      await interaction.editReply(toV2Payload([embed]));
    }
  }
}
