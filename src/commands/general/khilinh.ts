import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { spiritWeaponService } from '../../services/SpiritWeaponService';
import db from '../../database/database';
import { getProgressBar } from '../../utils/constants';

export default class KhiLinhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('khilinh')
        .setDescription('Quản lý Khí Linh (Spirit Weapon).')
        .addSubcommand(sub =>
          sub
            .setName('thuctinh')
            .setDescription('Thức tỉnh khí linh cho pháp bảo (Yêu cầu vũ khí Epic trở lên)')
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('Mã hành trang của vật phẩm trong túi đồ (xem trong /tuido)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('nuoiduong')
            .setDescription('Cho khí linh ăn trang bị hoặc nguyên liệu tăng EXP')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID Khí Linh (Xem trong /khilinh danhsach hoặc /hoso)').setRequired(true))
            .addIntegerOption(opt => opt.setName('inventory_id').setDescription('Mã hành trang của vật phẩm trong túi đồ (xem trong /tuido)').setRequired(true))
            .addIntegerOption(opt => opt.setName('soluong').setDescription('Số lượng hiến tế').setRequired(false))
        )
        .addSubcommand(sub =>
          sub
            .setName('tuongtac')
            .setDescription('Trò chuyện với khí linh để tăng độ thân thiết')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID Khí Linh (Xem trong /khilinh danhsach hoặc /hoso)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('kynang')
            .setDescription('Xem thông tin và kỹ năng của Khí Linh')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID Khí Linh (Xem trong /khilinh danhsach hoặc /hoso)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('tienhoa')
            .setDescription('Tiến hóa khí linh đạt cấp 20')
            .addIntegerOption(opt => opt.setName('spirit_id').setDescription('ID Khí Linh (Xem trong /khilinh danhsach hoặc /hoso)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách tất cả Khí Linh đang sở hữu')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.reply({ content: '❌ Đạo hữu chưa tạo nhân vật!', ephemeral: true });
      return;
    }

    const subcmd = interaction.options.getSubcommand(true);

    if (subcmd === 'thuctinh') {
      const inventoryId = interaction.options.getInteger('inventory_id', true);
      const res = spiritWeaponService.awaken(userId, inventoryId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }

      const spirit = res.spirit!;
      const itemInfo = db.prepare('SELECT * FROM items WHERE id = ?').get(spirit.item_id) as any;
      const skill = spirit.skill_id ? spiritWeaponService.getSkill(spirit.skill_id) : null;
      const expBar = getProgressBar(spirit.exp, spirit.level * 50);
      const affinityBar = getProgressBar(spirit.affinity, 100);

      const embed = new EmbedBuilder()
        .setTitle('✨ THỨC TỈNH KHÍ LINH THÀNH CÔNG! ✨')
        .setColor('#8e44ad')
        .setDescription(
          `*Từ trong thần phong sắc bén của pháp bảo, một tia linh trí bỗng chốc thức tỉnh...*\n\n` +
          `🔮 **Khí Linh:** **${spirit.spirit_name}**\n` +
          `⚔️ **Ký Chủ Pháp Bảo:** **${itemInfo?.name || spirit.item_id}** [${itemInfo?.rarity.toUpperCase()}]\n` +
          `⚡ **Cấp Độ:** Cấp **${spirit.level}**\n` +
          `   └ Tiến trình EXP: ${expBar} *(${spirit.exp}/${spirit.level * 50} EXP)*\n` +
          `❤️ **Độ Thân Thiết:** ${affinityBar} *(${spirit.affinity}/100)*\n`
        )
        .addFields({
          name: '🔮 Kỹ Năng Bản Mệnh Ngộ Ra',
          value: skill 
            ? `**${skill.name}**\n└ *${skill.description}*` 
            : '*Chưa ngộ ra kỹ năng nào.*'
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
    else if (subcmd === 'nuoiduong') {
      const spiritId = interaction.options.getInteger('spirit_id', true);
      const inventoryId = interaction.options.getInteger('inventory_id', true);
      const qty = interaction.options.getInteger('soluong') || 1;
      
      const res = spiritWeaponService.feedSpirit(userId, spiritId, inventoryId, qty);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }

      const expBar = getProgressBar(res.remainingExp || 0, res.expNeeded || 50);

      const embed = new EmbedBuilder()
        .setTitle('🍽️ NUÔI DƯỠNG KHÍ LINH 🍽️')
        .setColor('#e67e22')
        .setDescription(
          `**${res.spiritName}** hấp thụ nguyên liệu **${res.materialName}**, nhận thêm **+${res.expGain}** EXP!\n\n` +
          `⚡ **Cấp Độ:** Cấp **${res.newLevel}** ${res.leveledUp ? ' ⬆️ **[THĂNG CẤP!]**' : ''}\n` +
          `   └ Tiến trình EXP: ${expBar} *(${res.remainingExp}/${res.expNeeded} EXP)*\n`
        )
        .setTimestamp();

      if (res.newSkillName) {
        embed.addFields({
          name: '✨ Kỹ Năng Mới Lĩnh Ngộ!',
          value: `🔮 Khí linh bừng tỉnh thần thông, ngộ được kỹ năng: **${res.newSkillName}**`
        });
      }

      await interaction.reply({ embeds: [embed] });
    }
    else if (subcmd === 'tuongtac') {
      const spiritId = interaction.options.getInteger('spirit_id', true);
      const res = spiritWeaponService.interact(userId, spiritId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }

      const affinityBar = getProgressBar(res.newAffinity || 0, 100);
      const dialogues = [
        `"Đạo hữu, ta cảm nhận được mối liên kết thần thức giữa chúng ta ngày càng bền chặt..."`,
        `"Linh lực của đạo hữu làm ấm áp khí cốt của ta. Cảm ơn đạo hữu!"`,
        `"Mỗi lần trò chuyện cùng ngươi, ta lại nhớ về linh khí hồng hoang thủa xưa..."`,
        `"Chỉ cần đạo hữu cần, ta nguyện làm mũi kiếm đi tiên phong!"`
      ];
      const quote = dialogues[Math.floor(Math.random() * dialogues.length)];

      const embed = new EmbedBuilder()
        .setTitle('💬 TƯƠNG TÁC KHÍ LINH 💬')
        .setColor('#e91e63')
        .setDescription(
          `*Đạo hữu mở ra linh thức, ôn nhu đàm đạo cùng khí linh của pháp bảo...*\n\n` +
          `💬 **${res.spiritName}:**\n*${quote}*\n\n` +
          `❤️ **Độ Thân Thiết:** ${affinityBar} *(+${res.affinityGain} | ${res.newAffinity}/100)*`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
    else if (subcmd === 'tienhoa') {
      const spiritId = interaction.options.getInteger('spirit_id', true);
      const res = spiritWeaponService.evolve(userId, spiritId);
      if (!res.success) {
        await interaction.reply({ content: `❌ ${res.message}`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🐉 KHÍ LINH TIẾN HÓA THÀNH CÔNG! 🐉')
        .setColor('#9b59b6')
        .setDescription(
          `*Thiên địa bỗng hiện ngũ sắc tường vân, linh khí bàng bạc hội tụ giáng xuống pháp bảo...*\n\n` +
          `🔥 Khí linh **${res.oldName}** đã lột xác niết bàn, tiến hóa thăng hoa thành:\n` +
          `✨ 👉 **${res.newName}** 👈 ✨\n\n` +
          `*Phong ấn sức mạnh tối cổ đã được giải trừ, khí lực bừng bừng bộc phát!*`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
    else if (subcmd === 'kynang') {
      const spiritId = interaction.options.getInteger('spirit_id', true);
      const spirit = db.prepare('SELECT * FROM spirit_weapons WHERE id = ? AND user_id = ?').get(spiritId, userId) as any;
      
      if (!spirit) {
        await interaction.reply({ content: '❌ Khí linh không tồn tại!', ephemeral: true });
        return;
      }

      const itemInfo = db.prepare('SELECT * FROM items WHERE id = ?').get(spirit.item_id) as any;
      const skill = spirit.skill_id ? spiritWeaponService.getSkill(spirit.skill_id) : null;
      const expBar = getProgressBar(spirit.exp, spirit.level * 50);
      const affinityBar = getProgressBar(spirit.affinity, 100);

      const embed = new EmbedBuilder()
        .setTitle(`✨ Thông Tin Khí Linh: ${spirit.spirit_name}`)
        .setColor('#8e44ad')
        .setDescription(
          `⚔️ **Pháp Bảo Ký Chủ:** **${itemInfo?.name || spirit.item_id}** [${itemInfo?.rarity.toUpperCase()}]\n\n` +
          `⚡ **Cấp Độ:** Cấp **${spirit.level}**\n` +
          `   └ Tiến trình EXP: ${expBar} *(${spirit.exp}/${spirit.level * 50} EXP)*\n\n` +
          `❤️ **Độ Thân Thiết:** ${affinityBar} *(${spirit.affinity}/100)*\n`
        )
        .addFields(
          { 
            name: '🔮 Kỹ Năng Kế Thừa Bản Mệnh', 
            value: skill 
              ? `**${skill.name}**\n└ *${skill.description}*` 
              : '*Khí linh này hiện chưa ngộ ra kỹ năng nào.*'
          },
          {
            name: '🍖 Thức Ăn Thức Tỉnh & Nuôi Dưỡng',
            value: '• **Common (Thường):** +10 EXP\n' +
                   '• **Uncommon (Nhã):** +20 EXP\n' +
                   '• **Rare (Tốt):** +35 EXP\n' +
                   '• **Epic (Kỷ Vật):** +60 EXP\n' +
                   '• **Legendary (Truyền Thuyết):** +100 EXP\n' +
                   '*Khí linh có thể nuốt các loại khoáng sản, linh thạch, tinh thạch, linh thảo hoặc trang bị không dùng.*'
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
    else if (subcmd === 'danhsach') {
      const spiritWeapons = spiritWeaponService.getSpiritWeapons(userId);
      if (spiritWeapons.length === 0) {
        await interaction.reply({
          content: '🍃 Đạo hữu hiện chưa thức tỉnh Khí Linh nào. Hãy dùng `/khilinh thuctinh [mã_trang_bi]` trên trang bị phẩm chất Epic trở lên!',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚡ Danh Sách Khí Linh Sở Hữu ⚡')
        .setColor('#8e44ad')
        .setTimestamp();

      spiritWeapons.forEach(sw => {
        const itemInfo = db.prepare('SELECT name, rarity FROM items WHERE id = ?').get(sw.item_id) as any;
        const expBar = getProgressBar(sw.exp, sw.level * 50);
        const affinityBar = '❤️'.repeat(Math.min(Math.floor(sw.affinity / 20), 5)) + '🖤'.repeat(Math.max(0, 5 - Math.floor(sw.affinity / 20)));
        
        embed.addFields({
          name: `🔮 ${sw.spirit_name} (ID: **${sw.id}**)`,
          value: `• **Pháp Bảo ký chủ:** **${itemInfo?.name || sw.item_id}** [${itemInfo?.rarity.toUpperCase() || 'UNKNOWN'}]\n` +
                 `• **Cấp độ:** Cấp **${sw.level}** (EXP: ${expBar} - ${sw.exp}/${sw.level * 50})\n` +
                 `• **Thân mật:** ${affinityBar} (${sw.affinity}/100)\n` +
                 `• **Kỹ năng:** **${sw.skill_id || 'Chưa thức tỉnh'}**`
        });
      });

      await interaction.reply({ embeds: [embed] });
    }
  }
}
