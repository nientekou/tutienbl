import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { nineHeavensService } from '../../services/NineHeavensService';
import db from '../../database/database';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class CuuTrungCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('cuutrung')
        .setDescription('Cửu Trùng Tháp - Vượt qua 9 tầng tháp nhận thuộc tính vĩnh viễn.')
        .addSubcommand(sub =>
          sub.setName('khieu-chien')
            .setDescription('Khiêu chiến tầng tháp hiện tại')
        )
        .addSubcommand(sub =>
          sub.setName('trangthai')
            .setDescription('Xem trạng thái leo tháp và chỉ số vĩnh viễn đã nhận')
        )
        .addSubcommand(sub =>
          sub.setName('bangxephang')
            .setDescription('Xem bảng xếp hạng leo tháp trên toàn máy chủ')
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

    // ───────────────── KHIÊU CHIẾN CỬU TRÙNG THÁP ─────────────────
    if (sub === 'khieu-chien') {
      const progress = nineHeavensService.getProgress(userId);
      const nextFloor = progress.highest_floor + 1;

      if (nextFloor > 9) {
        await interaction.editReply({ content: '🎉 Chúc mừng đạo hữu! Đạo hữu đã chinh phục thành công cả **9 tầng Cửu Trùng Tháp** và đạt tới đỉnh cao võ học!'});
        return;
      }

      const floorConfig = nineHeavensService.FLOORS[nextFloor];

      // Gửi thử thách ban đầu để kiểm tra xem có cần mua lượt hay không
      const res = nineHeavensService.enterFloorChallenge(userId, false);

      if (!res.success && res.requireBuy) {
        // Hết lượt miễn phí -> Cần xác nhận mua lượt
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('buy_and_fight_cuutrung').setLabel('Mua lượt (1,000 Linh Thạch)').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('cancel_cuutrung').setLabel('Hủy bỏ').setStyle(ButtonStyle.Secondary)
        );

        const msg = await interaction.editReply({
          content: `⚠️ **Hết lượt khiêu chiến miễn phí tuần này!**\n` +
            `Đạo hữu có muốn tiêu hao **1,000 Linh Thạch** để tiếp tục khiêu chiến **Tầng ${nextFloor}** [Luật: *${floorConfig.ruleDesc}*] không?`,
          components: [row]
        });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
        collector.on('collect', async i => {
          try {
            if (i.user.id !== userId) {
              await i.reply({ content: '❌ Đạo hữu không phải là người gọi lệnh!', ephemeral: true });
              return;
            }

            if (i.customId === 'buy_and_fight_cuutrung') {
              const buyRes = nineHeavensService.enterFloorChallenge(userId, true);
              if (buyRes.success && buyRes.combatResult) {
                const attachment = new AttachmentBuilder(Buffer.from(buyRes.combatResult.log.join('\n'), 'utf-8'), { name: `cuutrung_tang_${nextFloor}.txt` });
                const embed = new EmbedBuilder()
                  .setTitle(`⚔️ CHIẾN BÁO CỬU TRÙNG THÁP - TẦNG ${nextFloor}`)
                  .setTimestamp();

                if (buyRes.combatResult.winner === 'player') {
                  embed.setColor(EMBED_COLORS.SUCCESS)
                    .setDescription(
                      (nextFloor === 5
                        ? `💔 **TUYỆT CẢNH SINH TỬ!** Đạo hữu đã vượt qua thử thách với chỉ **1 HP** và đánh bại **${floorConfig.name}**! Một chiến tích hiếm có!\n\n`
                        : nextFloor === 9
                          ? `👑 **CỬU TRÙNG ĐỈNH!** Đạo hữu đã chinh phục đỉnh cao Cửu Trùng Tháp, đánh bại **${floorConfig.name}**! Danh hiệu **Thiên Trụ** đã thuộc về ngươi!\n\n`
                          : `🎉 **Chiến thắng vẻ vang!** Đạo hữu đã đả bại **${floorConfig.name}** ở tầng ${nextFloor}!\n\n`) +
                      `${buyRes.rewardsLog}`);
                } else {
                  embed.setColor(EMBED_COLORS.ERROR)
                    .setDescription(
                      nextFloor === 5
                        ? `💔 **TUYỆT CẢNH SINH TỬ!** Chỉ với **1 HP**, đạo hữu đã không thể xoay chuyển tình thế trước **${floorConfig.name}** ở tầng ${nextFloor}.\n*Hãy tăng cường trang bị, tâm pháp và sủng vật để khiêu chiến lại!*`
                        : nextFloor === 9
                          ? `👑 **CỬU TRÙNG ĐỈNH!** Đạo hữu suýt chạm tới đỉnh cao nhưng đã gục ngã trước **${floorConfig.name}** ở tầng ${nextFloor}. Hãy tu luyện thêm và thử lại!`
                          : `💀 **Bại trận!** Thần thức của đạo hữu đã bị trục xuất khỏi Cửu Trùng Tháp sau **${buyRes.combatResult.rounds}** hiệp đấu.\n*Hãy tăng cường trang bị, tâm pháp và sủng vật để khiêu chiến lại!*`);
                }

                // Use message.edit to avoid discord.js injecting content:undefined with V2 flag
                await i.message.edit({ ...toV2Payload([embed]), files: [attachment] });
              } else {
                await i.message.edit({ content: `❌ Có lỗi xảy ra: ${buyRes.message}`, components: [] });
              }
            } else {
              await i.message.edit({ content: '👍 Đạo hữu đã thu hồi quyết định khiêu chiến.', components: [] });
            }
          } catch (e: any) {
            console.error('[cuutrung] Lỗi xử lý button:', e?.message || e);
            // Fallback: try to respond if message edit failed
            try {
              if (!i.replied && !i.deferred) {
                await i.deferUpdate();
              }
            } catch {}
          }
        });
        return;
      }

      if (!res.success) {
        await interaction.editReply({ content: `❌ Lỗi khiêu chiến: ${res.message}`});
        return;
      }

      // Trận đấu diễn ra thành công (dưới dạng miễn phí)
      if (res.combatResult) {
        const attachment = new AttachmentBuilder(Buffer.from(res.combatResult.log.join('\n'), 'utf-8'), { name: `cuutrung_tang_${nextFloor}.txt` });
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ CHIẾN BÁO CỬU TRÙNG THÁP - TẦNG ${nextFloor} ⚔️`)
          .setTimestamp();

        if (res.combatResult.winner === 'player') {
          embed.setColor(EMBED_COLORS.SUCCESS)
            .setDescription(
              (nextFloor === 5
                ? `💔 **TUYỆT CẢNH SINH TỬ!** Đạo hữu đã vượt qua thử thách với chỉ **1 HP** và đánh bại **${floorConfig.name}**! Một chiến tích hiếm có!\n\n`
                : nextFloor === 9
                  ? `👑 **CỬU TRÙNG ĐỈNH!** Đạo hữu đã chinh phục đỉnh cao Cửu Trùng Tháp, đánh bại **${floorConfig.name}**! Danh hiệu **Thiên Trụ** đã thuộc về ngươi!\n\n`
                  : `🎉 **Chiến thắng vẻ vang!** Đạo hữu đã đả bại **${floorConfig.name}** ở tầng ${nextFloor}!\n\n`) +
              `${res.rewardsLog}`);
        } else {
          embed.setColor(EMBED_COLORS.ERROR)
            .setDescription(
              nextFloor === 5
                ? `💔 **TUYỆT CẢNH SINH TỬ!** Chỉ với **1 HP**, đạo hữu đã không thể xoay chuyển tình thế trước **${floorConfig.name}** ở tầng ${nextFloor}.\n*Hãy tăng cường trang bị, tâm pháp và sủng vật để khiêu chiến lại!*`
                : nextFloor === 9
                  ? `👑 **CỬU TRÙNG ĐỈNH!** Đạo hữu suýt chạm tới đỉnh cao nhưng đã gục ngã trước **${floorConfig.name}** ở tầng ${nextFloor}. Hãy tu luyện thêm và thử lại!`
                  : `💀 **Bại trận!** Thần thức của đạo hữu đã bị trục xuất khỏi Cửu Trùng Tháp sau **${res.combatResult.rounds}** hiệp đấu.\n*Hãy tăng cường trang bị, tâm pháp và sủng vật để khiêu chiến lại!*`);
        }

        await interaction.editReply({
          content: `📖 Chi tiết trận chiến đã được gửi kèm trong tệp tin dưới đây:`,
          embeds: [embed],
          files: [attachment]
        });
      }
    }

    // ───────────────── TRẠNG THÁI LEO THÁP ─────────────────
    else if (sub === 'trangthai') {
      const progress = nineHeavensService.getProgress(userId);
      const embed = new EmbedBuilder()
        .setTitle('🏰 TRẠNG THÁI CỬU TRÙNG THÁP')
        .setColor(EMBED_COLORS.ORANGE)
        .setTimestamp()
        .setDescription(`Hồ sơ khiêu chiến tháp thần của đạo hữu:\n\n` +
          `• Tầng cao nhất đã vượt: **Tầng ${progress.highest_floor}/9**\n` +
          `• Số lượt đã khiêu chiến tuần này: **${progress.attempts_this_week}/3** lượt miễn phí\n` +
          `*(Sau 3 lượt, tiêu hao 1,000 Linh Thạch mỗi lần khiêu chiến tiếp theo. Reset mỗi thứ Hai)*`);

      let statsStr = '';
      const floor = progress.highest_floor;
      if (floor > 0) {
        let bonusHp = 0;
        let bonusAtk = 0;
        let bonusDef = 0;
        let bonusCrit = 0;
        let bonusDodge = 0;
        let bonusSpeed = 0;
        let bonusCritRes = 0;

        if (floor >= 1) bonusAtk += 10;
        if (floor >= 2) bonusHp += 100;
        if (floor >= 3) bonusDef += 5;
        if (floor >= 4) bonusCrit += 1;
        if (floor >= 5) bonusDodge += 1;
        if (floor >= 6) bonusSpeed += 10;
        if (floor >= 7) bonusAtk += 15;
        if (floor >= 8) bonusCritRes += 2;
        if (floor >= 9) {
          bonusHp += 250;
          bonusAtk += 20;
          bonusDef += 10;
        }

        statsStr += `• Sinh lực (HP): **+${bonusHp}**\n` +
          `• Công kích (ATK): **+${bonusAtk}**\n` +
          `• Phòng thủ (DEF): **+${bonusDef}**\n` +
          `• Tỷ lệ Bạo kích: **+${bonusCrit}%**\n` +
          `• Tỷ lệ Né tránh: **+${bonusDodge}%**\n` +
          `• Tốc độ đánh: **+${bonusSpeed}**\n` +
          `• Kháng bạo kích: **+${bonusCritRes}%**\n`;
      } else {
        statsStr = '*Chưa vượt qua tầng nào để nhận thuộc tính vĩnh viễn.*';
      }

      embed.addFields({ name: '🌟 Chỉ Số Tẩy Tủy Nhận Được (Vĩnh viễn)', value: statsStr });
      await interaction.editReply(toV2Payload([embed]));
    }

    // ───────────────── BẢNG XẾP HẠNG LEO THÁP ─────────────────
    else if (sub === 'bangxephang') {
      const topPlayers = db.prepare(`
        SELECT u.name, n.highest_floor 
        FROM nine_heavens_progress n
        JOIN users u ON n.user_id = u.discord_id
        ORDER BY n.highest_floor DESC, n.user_id ASC
        LIMIT 10
      `).all() as { name: string; highest_floor: number }[];

      const embed = new EmbedBuilder()
        .setTitle('🏆 CỬU TRÙNG THÁP BẢNG')
        .setColor(EMBED_COLORS.GOLD)
        .setTimestamp();

      let desc = '';
      if (topPlayers.length > 0) {
        topPlayers.forEach((p, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
          desc += `${medal} **${p.name}** ─ Vượt Tầng: **${p.highest_floor}/9**\n`;
        });
      } else {
        desc = '*Chưa có đạo hữu nào ghi tên lên bia đá.*';
      }

      embed.setDescription(desc);
      await interaction.editReply(toV2Payload([embed]));
    }
  }
}
