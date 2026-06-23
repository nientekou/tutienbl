import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { soulWeaponRepository } from '../../database/repositories/SoulWeaponRepository';
import { soulWeaponService } from '../../services/SoulWeaponService';
import { getRealmDetails, getProgressBar } from '../../utils/constants';
import db from '../../database/database';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

export default class PhapBaoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('phapbao')
        .setDescription('Hệ thống Pháp Bảo Bản Mệnh')
        .addSubcommand(sub =>
          sub.setName('thongtin')
            .setDescription('Xem trạng thái Pháp Bảo hiện tại')
        )
        .addSubcommand(sub =>
          sub.setName('banmenh')
            .setDescription('Quản lý Bản Mệnh Pháp Bảo (Huyết Tế liên kết nguyên thần)')
        )
        .addSubcommand(sub =>
          sub.setName('ngung-tu')
            .setDescription('Ngưng tụ Pháp Bảo (Yêu cầu Kim Đan Kỳ)')
            .addStringOption(opt => opt.setName('ten').setDescription('Tên Pháp Bảo').setRequired(true))
            .addStringOption(opt => opt.setName('loai').setDescription('Loại Pháp Bảo').setRequired(true)
              .addChoices(
                { name: '🗡️ Kiếm (Tăng Công, Bạo kích)', value: 'kiem' },
                { name: '🛡️ Đỉnh (Tăng Thủ, Máu, Kháng Bạo)', value: 'dinh' },
                { name: '💠 Ấn (Tăng Máu, Né, Tốc độ)', value: 'an' }
              ))
        )
        .addSubcommand(sub =>
          sub.setName('te-luyen')
            .setDescription('Nuốt trang bị rác trong túi đồ để tăng EXP')
            .addStringOption(opt => opt.setName('ids').setDescription('Danh sách ID vật phẩm cách nhau bởi dấu phẩy (VD: 12,34,56)').setRequired(true))
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);
    if (!user) { await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!'}); return; }

    const sub = interaction.options.getSubcommand();

    if (sub === 'banmenh') {
      const embed = getBanMenhEmbed(userId);
      const components = getBanMenhComponents(userId);
      await interaction.editReply(toV2Payload([embed], components));
      return;
    }

    if (sub === 'thongtin') {
      const sw = soulWeaponRepository.getByUserId(userId);
      if (!sw) {
        await interaction.editReply({ content: '❌ Đạo hữu chưa ngưng tụ Pháp Bảo Bản Mệnh! Dùng lệnh `/phapbao ngung-tu` (Yêu cầu Kim Đan Kỳ).'});
        return;
      }

      const expNeeded = soulWeaponService.getExpRequired(sw.level);
      const types: Record<string, string> = { kiem: '🗡️ Kiếm', dinh: '🛡️ Đỉnh', an: '💠 Ấn' };

      // Mô tả buff
      let buffDesc = '';
      if (sw.type === 'kiem') buffDesc = `+${sw.level * 10} Công, +${(sw.level * 0.1).toFixed(1)}% Bạo Kích`;
      if (sw.type === 'dinh') buffDesc = `+${sw.level * 100} Máu, +${sw.level * 10} Thủ, +${(sw.level * 0.1).toFixed(1)}% Kháng Bạo`;
      if (sw.type === 'an') buffDesc = `+${sw.level * 150} Máu, +${sw.level * 2} Tốc, +${(sw.level * 0.1).toFixed(1)}% Né`;

      const expBar = getProgressBar(sw.exp, sw.level >= 100 ? 1 : expNeeded);

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ PHÁP BẢO BẢN MỆNH: ${sw.name}`)
        .setColor(EMBED_COLORS.DARK_PURPLE)
        .setDescription(
          `🔮 **Phân Loại:** **${types[sw.type]}**\n` +
          `⭐ **Cấp Độ:** Cấp **${sw.level}**\n` +
          `📊 **Tiến Trình EXP:** ${expBar} *(${sw.exp}/${sw.level >= 100 ? 'TỐI ĐA' : expNeeded} EXP)*\n\n` +
          `✨ **Thuộc Tính Cộng Thêm:**\n└ **${buffDesc}**`
        )
        .setFooter({ text: 'Dùng lệnh /phapbao te-luyen <id,id...> để Pháp Bảo nuốt trang bị rác!' })
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));

    } else if (sub === 'ngung-tu') {
      const sw = soulWeaponRepository.getByUserId(userId);
      if (sw) {
        await interaction.editReply({ content: `❌ Đạo hữu đã có Pháp Bảo Bản Mệnh là **${sw.name}** rồi! Không thể ngưng tụ thêm.`});
        return;
      }

      const realm = getRealmDetails(user.level);
      if (user.level < 40) {
        await interaction.editReply({ content: `❌ Cảnh giới hiện tại là **${realm.fullName}**, chưa đủ điều kiện! Yêu cầu cấp **40** trở lên để ngưng tụ Pháp Bảo Bản Mệnh.`});
        return;
      }

      const name = interaction.options.getString('ten', true);
      const type = interaction.options.getString('loai', true) as 'kiem' | 'dinh' | 'an';

      if (user.coin_ha_pham < 50000) {
        await interaction.editReply({ content: '❌ Cần **50,000 Hạ Phẩm Linh Thạch** làm vật dẫn để ngưng tụ Pháp Bảo!'});
        return;
      }

      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 50000 });
      soulWeaponRepository.create(userId, name, type);

      const types: Record<string, string> = { kiem: '🗡️ Kiếm (Công, Bạo Kích)', dinh: '🛡️ Đỉnh (Máu, Thủ, Kháng Bạo)', an: '💠 Ấn (Máu, Tốc, Né)' };
      const embed = new EmbedBuilder()
        .setTitle('🎉 NGƯNG TỤ PHÁP BẢO THÀNH CÔNG!')
        .setColor(EMBED_COLORS.DARK_PURPLE)
        .setDescription(
          `*Tinh huyết dung hợp, đất trời biến sắc, một luồng dị quang phóng thẳng lên chín tầng mây!*\n\n` +
          `Đạo hữu **${user.name}** đã ngưng tụ thành công Pháp Bảo Bản Mệnh:\n` +
          `✨ 👉 **${name}** 👈 ✨\n\n` +
          `ℹ️ **Loại Pháp Bảo:** **${types[type]}**\n` +
          `⭐ **Cấp Độ Ban Đầu:** Cấp **1**\n\n` +
          `*Hãy dùng lệnh \`/phapbao te-luyen\` để hiến tế trang bị thừa giúp Pháp Bảo thăng cấp sức mạnh!*`
        )
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));

    } else if (sub === 'te-luyen') {
      const idsStr = interaction.options.getString('ids', true);
      const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

      if (ids.length === 0) {
        await interaction.editReply({ content: '❌ Định dạng ID không hợp lệ. Ví dụ đúng: 12, 34, 56'});
        return;
      }

      const result = soulWeaponService.feedItems(userId, ids);
      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}`});
        return;
      }

      const sw = soulWeaponRepository.getByUserId(userId)!;
      const expNeeded = soulWeaponService.getExpRequired(sw.level);
      const expBar = getProgressBar(sw.exp, sw.level >= 100 ? 1 : expNeeded);

      const embed = new EmbedBuilder()
        .setTitle('🔥 TẾ LUYỆN PHÁP BẢO THÀNH CÔNG')
        .setColor(EMBED_COLORS.ORANGE)
        .setDescription(
          `Đạo hữu ném các vật phẩm thừa vào chân hỏa lò luyện, chắt lọc tinh túy dung hợp vào Pháp Bảo Bản Mệnh...\n\n` +
          `🛡️ **Pháp Bảo:** **${sw.name}**\n` +
          `✨ **EXP Nhận Được:** **+${result.expGained}** EXP\n` +
          `📈 **Cấp Độ:** Cấp **${sw.level}**${result.levelUp > 0 ? ` ⬆️ **[TĂNG ${result.levelUp} CẤP!]**` : ''}\n` +
          `   └ Tiến trình EXP: ${expBar} *(${sw.exp}/${sw.level >= 100 ? 'TỐI ĐA' : expNeeded} EXP)*\n`
        )
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));
    }
  }
}

export function getBanMenhEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId)!;
  const boundItem = db.prepare('SELECT * FROM inventories WHERE user_id = ? AND is_life_bound = 1').get(userId) as any;

  const embed = new EmbedBuilder()
    .setTitle('🩸 BẢN MỆNH PHÁP BẢO - NGUYÊN THẦN LIÊN KẾT')
    .setColor(EMBED_COLORS.ALERT)
    .setTimestamp();

  if (!boundItem) {
    embed.setDescription(
      `Đạo hữu hiện tại **chưa liên kết** Bản Mệnh Pháp Bảo nào với Nguyên Thần.\n\n` +
      `💡 **Bản Mệnh Pháp Bảo là gì?**\n` +
      `• Là trang bị hoặc pháp bảo được Huyết Tế vĩnh viễn gắn liền với sinh mệnh tu sĩ.\n` +
      `• **Hấp thu chiến ý:** Tự động nhận thêm EXP khi đạo hữu chiến đấu thắng lợi dã ngoại, tháp vô hạn, cửu trùng tháp, quyết đấu arena.\n` +
      `• **Thăng tiến thuộc tính:** Khi tăng cấp, Pháp Bảo tự nhận thêm các thuộc tính ngẫu nhiên gia cường sức chiến đấu.\n` +
      `• **Thức tỉnh Kiếp lực:** Khi đạo hữu đột phá đại cảnh giới thành công, Pháp Bảo sẽ mở khóa thêm 1 dòng thuộc tính cực kỳ quý hiếm vĩnh viễn.\n\n` +
      `*Bấm nút bên dưới để chọn trang bị trong túi đồ tiến hành Huyết Tế Bản Mệnh!*`
    );
  } else {
    const currentLvl = boundItem.bound_level || 1;
    const currentExp = boundItem.bound_exp || 0;
    const nextExpNeed = currentLvl * 200;
    const expBar = getProgressBar(currentExp, nextExpNeed, 10);

    let customStats: any = {};
    try { customStats = JSON.parse(boundItem.custom_stats || '{}'); } catch (e) {}

    const statLines: string[] = [];
    if (customStats.atk) statLines.push(`⚔️ Công kích: **+${customStats.atk}**`);
    if (customStats.def) statLines.push(`🛡️ Phòng thủ: **+${customStats.def}**`);
    if (customStats.hp) statLines.push(`💚 Sinh lực: **+${customStats.hp}**`);
    if (customStats.crit) statLines.push(`💥 Bạo kích: **+${(customStats.crit * 100).toFixed(1)}%**`);
    if (customStats.luck) statLines.push(`🍀 May mắn: **+${customStats.luck}**`);
    if (customStats.dodge) statLines.push(`🌀 Né tránh: **+${(customStats.dodge * 100).toFixed(1)}%**`);
    if (customStats.crit_res) statLines.push(`🛡️ Kháng bạo: **+${(customStats.crit_res * 100).toFixed(1)}%**`);
    if (customStats.speed) statLines.push(`⚡ Tốc độ: **+${customStats.speed}**`);

    const statsText = statLines.length > 0 ? statLines.join('\n') : '*Chưa thức tỉnh thuộc tính phụ nào.*';

    embed.setDescription(
      `🔮 **Bản Mệnh Pháp Bảo:** **${boundItem.name}**\n` +
      `⭐ **Cấp Độ:** Cấp **${currentLvl}**\n` +
      `📊 **Tiến Trình EXP:** ${expBar} *(${currentExp}/${nextExpNeed} EXP)*\n\n` +
      `✨ **Linh Trận Thức Tỉnh (Thuộc tính Bản Mệnh cộng thêm):**\n${statsText}\n\n` +
      `*Lưu ý: Chỉ số Bản Mệnh này cộng dồn trực tiếp vào thuộc tính của đạo hữu bất kể bạn có trang bị vật phẩm này hay không!*`
    );
  }

  return embed;
}

export function getBanMenhComponents(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();
  const boundItem = db.prepare('SELECT id FROM inventories WHERE user_id = ? AND is_life_bound = 1').get(userId) as any;

  if (!boundItem) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`pb_bind_nav_${userId}`)
        .setLabel('🩸 Huyết Tế Bản Mệnh')
        .setStyle(ButtonStyle.Danger)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`pb_swap_nav_${userId}`)
        .setLabel('🔄 Hoán Đổi Bản Mệnh')
        .setStyle(ButtonStyle.Primary)
    );
  }

  return [row];
}
