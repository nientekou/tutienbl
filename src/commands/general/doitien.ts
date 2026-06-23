import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { formatNumber } from '../../utils/constants';
import db from '../../database/database';
import { getShopEmbed, getShopComponents } from './shop';


export default class DoiTienCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('doitien')
        .setDescription('Đổi linh thạch hoặc KNB giữa các phẩm cấp.')
        .addStringOption(opt =>
          opt
            .setName('loai_doi')
            .setDescription('Loại tiền tệ muốn đổi')
            .setRequired(false)
            .addChoices(
              { name: '🟤 Hạ Phẩm ➡️ ⚪ Trung Phẩm (100:1)', value: 'ha_sang_trung' },
              { name: '⚪ Trung Phẩm ➡️ 🟤 Hạ Phẩm (1:100)', value: 'trung_sang_ha' },
              { name: '⚪ Trung Phẩm ➡️ 🟡 Thượng Phẩm (100:1)', value: 'trung_sang_thuong' },
              { name: '🟡 Thượng Phẩm ➡️ ⚪ Trung Phẩm (1:100)', value: 'thuong_sang_trung' },
              { name: '🟤 Hạ Phẩm ➡️ 🟡 Thượng Phẩm (10k:1)', value: 'ha_sang_thuong' },
              { name: '🟡 Thượng Phẩm ➡️ 🟤 Hạ Phẩm (1:10k)', value: 'thuong_sang_ha' },
              { name: '💎 KNB ➡️ 🟡 Thượng Phẩm (1:5)', value: 'knb_sang_thuong' },
              { name: '🟡 Thượng Phẩm ➡️ 💎 KNB (5:1)', value: 'thuong_sang_knb' },
              { name: '💎 KNB ➡️ 🟤 Hạ Phẩm (1:50k)', value: 'knb_sang_ha' },
              { name: '🟤 Hạ Phẩm ➡️ 💎 KNB (50k:1)', value: 'ha_sang_knb' }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('soluong')
            .setDescription('Số lượng lần thực hiện đổi (mặc định là 1)')
            .setRequired(false)
        )
    );
  }

  public static performConversion(
    userId: string,
    type: string,
    qty: number
  ): { success: boolean; message: string; sourceName?: string; targetName?: string; sourceCost?: number; targetGain?: number } {
    const user = userRepository.get(userId);

    if (!user) {
      return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.' };
    }

    if (qty <= 0) {
      return { success: false, message: '❌ Số lượng lần đổi phải lớn hơn 0!' };
    }

    let sourceName = '';
    let targetName = '';
    let sourceCost = 0;
    let targetGain = 0;

    switch (type) {
      case 'ha_sang_trung':
        sourceName = 'Hạ Phẩm Linh Thạch';
        targetName = 'Trung Phẩm Linh Thạch';
        sourceCost = 100 * qty;
        targetGain = 1 * qty;
        break;
      case 'trung_sang_ha':
        sourceName = 'Trung Phẩm Linh Thạch';
        targetName = 'Hạ Phẩm Linh Thạch';
        sourceCost = 1 * qty;
        targetGain = 100 * qty;
        break;
      case 'trung_sang_thuong':
        sourceName = 'Trung Phẩm Linh Thạch';
        targetName = 'Thượng Phẩm Linh Thạch';
        sourceCost = 100 * qty;
        targetGain = 1 * qty;
        break;
      case 'thuong_sang_trung':
        sourceName = 'Thượng Phẩm Linh Thạch';
        targetName = 'Trung Phẩm Linh Thạch';
        sourceCost = 1 * qty;
        targetGain = 100 * qty;
        break;
      case 'ha_sang_thuong':
        sourceName = 'Hạ Phẩm Linh Thạch';
        targetName = 'Thượng Phẩm Linh Thạch';
        sourceCost = 10000 * qty;
        targetGain = 1 * qty;
        break;
      case 'thuong_sang_ha':
        sourceName = 'Thượng Phẩm Linh Thạch';
        targetName = 'Hạ Phẩm Linh Thạch';
        sourceCost = 1 * qty;
        targetGain = 10000 * qty;
        break;
      case 'knb_sang_thuong':
        sourceName = 'Kim Nguyên Bảo (KNB)';
        targetName = 'Thượng Phẩm Linh Thạch';
        sourceCost = 1 * qty;
        targetGain = 5 * qty;
        break;
      case 'thuong_sang_knb':
        sourceName = 'Thượng Phẩm Linh Thạch';
        targetName = 'Kim Nguyên Bảo (KNB)';
        sourceCost = 5 * qty;
        targetGain = 1 * qty;
        break;
      case 'knb_sang_ha':
        sourceName = 'Kim Nguyên Bảo (KNB)';
        targetName = 'Hạ Phẩm Linh Thạch';
        sourceCost = 1 * qty;
        targetGain = 50000 * qty;
        break;
      case 'ha_sang_knb':
        sourceName = 'Hạ Phẩm Linh Thạch';
        targetName = 'Kim Nguyên Bảo (KNB)';
        sourceCost = 50000 * qty;
        targetGain = 1 * qty;
        break;
      default:
        return { success: false, message: '❌ Loại quy đổi không hợp lệ!' };
    }

    // Check balance
    let hasEnough = false;
    let currentSourceBalance = 0;

    if (type.startsWith('ha_')) {
      currentSourceBalance = user.coin_ha_pham;
      hasEnough = user.coin_ha_pham >= sourceCost;
    } else if (type.startsWith('trung_')) {
      currentSourceBalance = user.coin_trung_pham;
      hasEnough = user.coin_trung_pham >= sourceCost;
    } else if (type.startsWith('thuong_')) {
      currentSourceBalance = user.coin_thuong_pham;
      hasEnough = user.coin_thuong_pham >= sourceCost;
    } else if (type.startsWith('knb_')) {
      currentSourceBalance = user.knb;
      hasEnough = user.knb >= sourceCost;
    }

    if (!hasEnough) {
      return {
        success: false,
        message: `❌ Đạo hữu không đủ **${sourceName}**! (Yêu cầu: **${formatNumber(sourceCost)}**, Hiện có: **${formatNumber(currentSourceBalance)}**).`
      };
    }

    // Execute conversion in transaction
    const tx = db.transaction(() => {
      // Deduct source
      if (type.startsWith('ha_')) {
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - sourceCost });
      } else if (type.startsWith('trung_')) {
        userRepository.update(userId, { coin_trung_pham: user.coin_trung_pham - sourceCost });
      } else if (type.startsWith('thuong_')) {
        userRepository.update(userId, { coin_thuong_pham: user.coin_thuong_pham - sourceCost });
      } else if (type.startsWith('knb_')) {
        userRepository.update(userId, { knb: user.knb - sourceCost });
      }

      // Add target (fetch fresh user stats inside transaction)
      const freshUser = userRepository.get(userId)!;
      if (type.endsWith('_trung')) {
        userRepository.update(userId, { coin_trung_pham: freshUser.coin_trung_pham + targetGain });
      } else if (type.endsWith('_ha')) {
        userRepository.update(userId, { coin_ha_pham: freshUser.coin_ha_pham + targetGain });
      } else if (type.endsWith('_thuong')) {
        userRepository.update(userId, { coin_thuong_pham: freshUser.coin_thuong_pham + targetGain });
      } else if (type.endsWith('_knb')) {
        userRepository.update(userId, { knb: freshUser.knb + targetGain });
      }
    });
    tx();

    return {
      success: true,
      message: `Đạo hữu đã thực hiện chuyển đổi thành công **${formatNumber(sourceCost)}** ${sourceName} sang **${formatNumber(targetGain)}** ${targetName}!`,
      sourceName,
      targetName,
      sourceCost,
      targetGain
    };
  }

  public static buildResultEmbed(res: any, userId: string): EmbedBuilder {
    const updatedUser = userRepository.get(userId)!;
    return new EmbedBuilder()
      .setTitle('⚖️ ĐỔI TIỀN TỆ THÀNH CÔNG ⚖️')
      .setColor('#f1c40f')
      .setDescription(`Đạo hữu đã thực hiện chuyển đổi tiền tệ tại Phường Thị!`)
      .addFields(
        { name: '📉 Tiêu hao', value: `**-${formatNumber(res.sourceCost)}** ${res.sourceName}`, inline: true },
        { name: '📈 Nhận được', value: `**+${formatNumber(res.targetGain)}** ${res.targetName}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: false },
        {
          name: '💼 Tài sản sau khi đổi',
          value: [
            `🟤 Hạ Phẩm: **${formatNumber(updatedUser.coin_ha_pham)}** LT`,
            `⚪ Trung Phẩm: **${formatNumber(updatedUser.coin_trung_pham)}** LT`,
            `🟡 Thượng Phẩm: **${formatNumber(updatedUser.coin_thuong_pham)}** LT`,
            `💎 Kim Nguyên Bảo: **${formatNumber(updatedUser.knb)}** KNB`
          ].join('\n')
        }
      )
      .setTimestamp();
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.'});
      return;
    }

    const type = interaction.options.getString('loai_doi');
    const qty = interaction.options.getInteger('soluong') || 1;

    if (type) {
      if (qty <= 0) {
        await interaction.editReply({ content: '❌ Số lượng lần đổi phải lớn hơn 0!'});
        return;
      }

      const res = DoiTienCommand.performConversion(userId, type, qty);
      if (!res.success) {
        await interaction.editReply({ content: res.message});
        return;
      }

      const embed = DoiTienCommand.buildResultEmbed(res, userId);
      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = getDoiTienEmbed(userId);
      const components = getDoiTienComponents(userId);
      await interaction.editReply({ embeds: [embed], components });
    }
  }
}

export function getDoiTienEmbed(userId: string): EmbedBuilder {
  return getShopEmbed(userId, 'doitien');
}

export function getDoiTienComponents(userId: string): any[] {
  return getShopComponents(userId, 'doitien');
}
