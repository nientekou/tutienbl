import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, User } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { tradeService } from '../../services/TradeService';
import { userRepository } from '../../database/repositories/UserRepository';

export default class TradeCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Giao dịch trực tiếp với người chơi khác.')
        .addSubcommand(sub =>
          sub.setName('mo')
            .setDescription('Mở yêu cầu giao dịch với một tu sĩ.')
            .addUserOption(opt => opt.setName('user').setDescription('Người bạn muốn giao dịch.').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('linhthach')
            .setDescription('Thêm linh thạch vào giao dịch hiện tại.')
            .addIntegerOption(opt => opt.setName('so_luong').setDescription('Số linh thạch muốn giao dịch').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('them')
            .setDescription('Thêm vật phẩm vào giao dịch.')
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('Mã hành trang của vật phẩm (xem trong /tuido)').setRequired(true))
            .addIntegerOption(opt => opt.setName('so_luong').setDescription('Số lượng muốn thêm (mặc định 1)').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('xoa')
            .setDescription('Bỏ vật phẩm ra khỏi giao dịch.')
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('Mã hành trang của vật phẩm đã thêm').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('hienthi')
            .setDescription('Hiển thị lại bảng giao dịch hiện tại.')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    const user = userRepository.get(userId);
    if (!user) {
      await interaction.reply({ content: '❌ Bạn chưa có nhân vật!', ephemeral: true });
      return;
    }

    if (user.level < 39) { // 39 là bắt đầu Trúc Cơ Kỳ
      await interaction.reply({ 
        content: '❌ **Giới Hạn Cảnh Giới:** Để tránh kẻ gian thao túng thị trường (clone), tu sĩ phải đạt tối thiểu **Trúc Cơ Kỳ** mới có quyền mở giao dịch!', 
        ephemeral: true 
      });
      return;
    }

    if (sub === 'mo') {
      const targetUser = interaction.options.getUser('user', true);
      if (targetUser.bot) {
        await interaction.reply({ content: '❌ Không thể giao dịch với Bot!', ephemeral: true });
        return;
      }
      const res = tradeService.initiateTrade(userId, targetUser.id);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      
      const ui = tradeService.renderTradeUI(res.tradeId!);
      if (ui) {
        await interaction.reply({ content: `<@${targetUser.id}>, đạo hữu <@${userId}> muốn giao dịch với bạn!`, embeds: ui.embeds, components: ui.components });
      } else {
        await interaction.reply({ content: `✅ Đã gửi yêu cầu giao dịch đến ${targetUser.username}.`, ephemeral: true });
      }
      return;
    }

    // Find active trade for user
    const tradeId = this.findActiveTrade(userId);
    if (!tradeId) {
      await interaction.reply({ content: '❌ Đạo hữu hiện không có giao dịch nào đang mở.', ephemeral: true });
      return;
    }

    if (sub === 'linhthach') {
      const amount = interaction.options.getInteger('so_luong', true);
      if (amount < 0) {
        await interaction.reply({ content: '❌ Số lượng không hợp lệ.', ephemeral: true });
        return;
      }
      const res = tradeService.addCoins(tradeId, userId, amount);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      await this.updateTradeUI(interaction, tradeId);
      await interaction.followUp({ content: `✅ Đã đặt ${amount} Linh Thạch.`, ephemeral: true });
      return;
    }

    if (sub === 'them') {
      const inventoryId = interaction.options.getInteger('inventory_id', true);
      const qty = interaction.options.getInteger('so_luong') || 1;
      const res = tradeService.addItem(tradeId, userId, inventoryId, qty);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      await this.updateTradeUI(interaction, tradeId);
      await interaction.followUp({ content: `✅ Đã thêm vật phẩm vào giao dịch.`, ephemeral: true });
      return;
    }

    if (sub === 'xoa') {
      const inventoryId = interaction.options.getInteger('inventory_id', true);
      const res = tradeService.removeItem(tradeId, userId, inventoryId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }
      await this.updateTradeUI(interaction, tradeId);
      await interaction.followUp({ content: `✅ Đã xóa vật phẩm khỏi giao dịch.`, ephemeral: true });
      return;
    }

    if (sub === 'hienthi') {
      const ui = tradeService.renderTradeUI(tradeId);
      if (ui) {
        await interaction.reply({ embeds: ui.embeds, components: ui.components });
      } else {
        await interaction.reply({ content: '❌ Giao dịch đã kết thúc hoặc bị hủy.', ephemeral: true });
      }
    }
  }

  private findActiveTrade(userId: string): string | null {
    const tradeServiceInstance = (tradeService as any); // Access private map just for searching
    const activeTrades = tradeServiceInstance.activeTrades as Map<string, any>;
    for (const [id, trade] of activeTrades.entries()) {
      if (trade.status !== 'completed' && trade.status !== 'cancelled') {
        if (trade.initiator.discordId === userId || trade.target.discordId === userId) {
          return id;
        }
      }
    }
    return null;
  }

  private async updateTradeUI(interaction: ChatInputCommandInteraction, tradeId: string) {
    const ui = tradeService.renderTradeUI(tradeId);
    if (ui) {
      await interaction.reply({ embeds: ui.embeds, components: ui.components });
    } else {
      await interaction.reply({ content: 'Giao dịch đã kết thúc.', ephemeral: true });
    }
  }
}
