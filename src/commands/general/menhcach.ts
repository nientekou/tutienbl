import { Command } from '../../structures/Command';
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { destinyRepository } from '../../database/repositories/DestinyRepository';
import { destinyService } from '../../services/DestinyService';
import { userRepository } from '../../database/repositories/UserRepository';
import { getRealmDetails } from '../../utils/constants';
import { DESTINY_TYPES, DESTINY_GACHA_COST, DESTINY_MAX_LEVEL, getDestinyExpNeeded } from '../../config/destinies';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class MenhCachCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('menhcach')
        .setDescription('Hệ thống Mệnh Cách - Bốc Quẻ và Trang Bị Bảng Ngọc')
        .addSubcommand(sub =>
          sub.setName('boi-que')
            .setDescription('Bốc quẻ tìm kiếm Mệnh Cách mới (Tiêu tốn Linh Thạch)')
        )
        .addSubcommand(sub =>
          sub.setName('tu-do')
            .setDescription('Xem túi Mệnh Cách và các khe cắm hiện tại')
        )
    );
  }

  public async execute(client: any, interaction: any): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa khởi tạo nhân vật. Vui lòng dùng `/taonhanvat`!' });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'boi-que') {
      const result = destinyService.rollGacha(userId);
      const embed = new EmbedBuilder()
        .setTitle('🔮 BÓC QUẺ MỆNH CÁCH')
        .setColor(result.success ? '#9b59b6' : '#e74c3c')
        .setDescription(result.message)
        .setTimestamp();
        
      await interaction.editReply(toV2Payload([embed]));
    } else if (sub === 'tu-do') {
      const realmDetails = getRealmDetails(user.level);
      const maxSlots = destinyService.getMaxSlotsByRealm(realmDetails.fullName);
      
      const destinies = destinyRepository.getUserDestinies(userId);
      const equipped = destinies.filter(d => d.is_equipped === 1);
      
      const embed = new EmbedBuilder()
        .setTitle(`☯️ BẢNG MỆNH CÁCH - ${user.name}`)
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(`Số khe cắm Mệnh Cách tối đa: **${equipped.length}/${maxSlots}** (Tăng theo Cảnh Giới)`)
        .setTimestamp();

      if (maxSlots === 0) {
        embed.addFields({ name: 'Chưa Đủ Cảnh Giới', value: 'Đạo hữu cần đạt tối thiểu Trúc Cơ Kỳ để mở Bảng Mệnh Cách.' });
      } else {
        let equippedDesc = '';
        for (let i = 1; i <= maxSlots; i++) {
          const slotItem = equipped.find(d => d.slot === i);
          if (slotItem) {
            const config = DESTINY_TYPES[slotItem.destiny_id];
            const currentBuff = config.baseValue + (slotItem.level - 1) * config.scalePerLevel;
            const expNeeded = getDestinyExpNeeded(slotItem.level, slotItem.rarity);
            equippedDesc += `**Khe [${i}]**: ${config.icon} **${config.name}** [${slotItem.rarity.toUpperCase()}] - Cấp ${slotItem.level}\n└ Tác dụng: +**${Math.round(currentBuff * 100)}%** ${config.name.split(' ')[0]}\n└ EXP: ${slotItem.exp}/${expNeeded}\n\n`;
          } else {
            equippedDesc += `**Khe [${i}]**: 🔲 Trống\n\n`;
          }
        }
        embed.addFields({ name: '🌟 Đang Trang Bị', value: equippedDesc || 'Trống' });
      }

      embed.setFooter({ text: 'Để trang bị hoặc nâng cấp Mệnh Cách, hãy chọn từ Menu bên dưới.' });

      // Build components
      const components = [];
      const unequipped = destinies.filter(d => d.is_equipped === 0);
      
      if (maxSlots > 0 && unequipped.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`destiny_equip_${userId}`)
          .setPlaceholder('Chọn Mệnh Cách để trang bị...');

        unequipped.slice(0, 25).forEach(d => {
          const config = DESTINY_TYPES[d.destiny_id];
          selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${config.name} (Cấp ${d.level}) - ${d.rarity}`)
              .setDescription(`Tác dụng: ${config.description}`)
              .setValue(`equip_${d.id}`)
          );
        });

        components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
      }
      
      if (equipped.length > 0) {
        const unequipMenu = new StringSelectMenuBuilder()
          .setCustomId(`destiny_unequip_${userId}`)
          .setPlaceholder('Tháo Mệnh Cách hiện tại...');
        
        equipped.forEach(d => {
          const config = DESTINY_TYPES[d.destiny_id];
          unequipMenu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`Khe [${d.slot}]: ${config.name}`)
              .setValue(`unequip_${d.slot}`)
          );
        });
        components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(unequipMenu));
      }

      await interaction.editReply(toV2Payload([embed], components));
    }
  }
}
