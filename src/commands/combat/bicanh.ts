import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { partyService } from '../../services/PartyService';
import { DUNGEONS } from '../../config/dungeons';
import db from '../../database/database';
import { getRealmDetails, ELEMENT_EMOJIS } from '../../utils/constants';

export const COOP_DUNGEONS = [
  {
    id: 'dc_1',
    name: 'Huyết Uyên Cốc',
    description: 'Nơi Huyết Ma Lão Tổ từng bế quan. Âm khí nặng nề, quái vật khát máu.',
    minLevel: 10,
    maxDailyEntries: 3,
    bossName: 'Huyết Ma Phân Thân',
    bossHp: 12500,
    bossAtk: 375,
    bossDef: 188,
    bossCrit: 0.15,
    bossCritRes: 0.05,
    bossSpeed: 120,
    bossDodge: 0.1,
    maxMembers: 4,
  },
  {
    id: 'dc_2',
    name: 'Lôi Âm Tự (Phế Tích)',
    description: 'Ngôi chùa cổ bị sấm sét hủy diệt. Tồn tại Lôi Kiếp Chi Linh cực kỳ nguy hiểm.',
    minLevel: 25,
    maxDailyEntries: 3,
    bossName: 'Lôi Kiếp Chi Linh',
    bossHp: 37500,
    bossAtk: 1000,
    bossDef: 500,
    bossCrit: 0.2,
    bossCritRes: 0.1,
    bossSpeed: 150,
    bossDodge: 0.15,
    maxMembers: 4,
  }
];


/**
 * Tạo Embed hiển thị danh sách các Bí Cảnh
 */
export function getDungeonEmbed(userId: string): EmbedBuilder {
  const user = userRepository.get(userId);
  if (!user) {
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor('#e74c3c')
      .setDescription('Đạo hữu chưa khởi tạo nhân vật! Hãy dùng `/taonhanvat` để bắt đầu.');
  }

  const embed = new EmbedBuilder()
    .setTitle('🔮 Bí Cảnh Phó Bản - Giới Luật Tu Hành')
    .setDescription('Nơi tu sĩ thử thách võ học bản thân, diệt quái thú linh dị đoạt lấy Tu Vi và bảo vật trời đất.')
    .setColor('#9b59b6')
    .setTimestamp();

  // Lấy danh sách CD của người chơi hôm nay
  const cds = db.prepare('SELECT dungeon_id, daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ?').all(userId) as { dungeon_id: string; daily_entries: number; last_entry_at: number }[];
  const cdMap = new Map<string, number>();
  
  const nowDate = new Date().toDateString();
  for (const cd of cds) {
    const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
    if (cdDate === nowDate) {
      cdMap.set(cd.dungeon_id, cd.daily_entries);
    }
  }

  for (const [id, config] of Object.entries(DUNGEONS)) {
    const entriesToday = cdMap.get(id) || 0;
    const entriesText = `${entriesToday}/${config.maxDailyEntries}`;
    const isLocked = user.level < config.minLevel;
    
    const statusText = isLocked 
      ? `🔒 **Cảnh giới quá thấp** (Yêu cầu Cấp ${config.minLevel})`
      : `🟢 **Có thể khiêu chiến** (${entriesText} lượt đi hôm nay)`;

    const lootsText = config.rewards.loots
      .map(l => {
        const item = db.prepare('SELECT name FROM items WHERE id = ?').get(l.itemId) as { name: string } | undefined;
        return item ? `• ${item.name} (${Math.round(l.rate * 100)}%)` : '';
      })
      .filter(Boolean)
      .join('\n');

    const realmReq = getRealmDetails(config.minLevel).realmName;

    const elementEmoji = config.monster.element ? (ELEMENT_EMOJIS[config.monster.element] || '') : '';
    const elementText = config.monster.element ? `Hệ ${config.monster.element} ${elementEmoji}` : 'Không hệ';

    embed.addFields({
      name: `${config.name} [${realmReq}]`,
      value: `*${config.description}*\n` +
             `👾 **Thủ Vệ:** **${config.monster.name}** (${elementText})\n` +
             `   └ 🩸 Sinh Lực: **${config.monster.hp}** | ⚔️ Tấn Công: **${config.monster.atk}** | 🛡️ Phòng Thủ: **${config.monster.def}**\n` +
             `🎁 **Phần Thưởng:** **+${config.rewards.exp}** Tu Vi | **${config.rewards.coinMin}-${config.rewards.coinMax}** Linh Thạch\n` +
             `✨ **Tỷ lệ rơi bảo vật:**\n${lootsText}\n` +
             `📌 Trạng thái: ${statusText}\n\u200b`
    });
  }

  return embed;
}

/**
 * Tạo các nút khiêu chiến Bí Cảnh tương ứng
 */
export function getDungeonComponents(userId: string): ActionRowBuilder<ButtonBuilder> {
  const user = userRepository.get(userId);
  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const [id, config] of Object.entries(DUNGEONS)) {
    const isLocked = user ? user.level < config.minLevel : true;
    
    let btnStyle = ButtonStyle.Success;
    if (id.includes('truc_co')) btnStyle = ButtonStyle.Primary;
    if (id.includes('kim_dan')) btnStyle = ButtonStyle.Danger;

    // Lấy số lượt hôm nay
    const cd = db.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
      .get(userId, id) as { daily_entries: number; last_entry_at: number } | undefined;
    
    let entriesToday = 0;
    if (cd) {
      const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
      if (cdDate === new Date().toDateString()) {
        entriesToday = cd.daily_entries;
      }
    }

    const isOutOfEntries = entriesToday >= config.maxDailyEntries;

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bicanhselect_${id}_${userId}`)
        .setLabel(`Khiêu Chiến ${config.name.split(' (')[0]}`)
        .setStyle(btnStyle)
        .setDisabled(isLocked || isOutOfEntries)
    );
  }

  return row;
}

/**
 * Tạo Embed hiển thị thông tin phòng chờ tổ đội bí cảnh
 */
export function buildCoopPartyEmbed(partyId: string): EmbedBuilder {
  const { partyService } = require('../../services/PartyService');
  const party = partyService.getParty(partyId);
  if (!party) {
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor('#e74c3c')
      .setDescription('Tổ đội này không tồn tại hoặc đã bị giải tán.');
  }

  const dungeon = COOP_DUNGEONS.find(d => d.id === party.dungeonId);
  if (!dungeon) {
    return new EmbedBuilder()
      .setTitle('❌ Lỗi')
      .setColor('#e74c3c')
      .setDescription('Bí cảnh không hợp lệ.');
  }

  const realmReq = getRealmDetails(dungeon.minLevel).realmName;

  const embed = new EmbedBuilder()
    .setTitle(`⛩️ PHÒNG CHỜ BÍ CẢNH: ${dungeon.name}`)
    .setColor('#e74c3c')
    .setDescription(
      `*${dungeon.description}*\n\n` +
      `⚠️ **Cảnh giới tối thiểu:** **${realmReq}** (Cấp ${dungeon.minLevel})\n` +
      `👾 **Thủ Vệ Vương Giả:** **${dungeon.bossName}**\n` +
      `   └ 🩸 Sinh Lực: **${dungeon.bossHp}** | ⚔️ Công: **${dungeon.bossAtk}** | 🛡️ Thủ: **${dungeon.bossDef}**\n` +
      `   └ ⚡ Tốc Độ: **${dungeon.bossSpeed}** | 🎯 Bạo Kích: **${Math.round(dungeon.bossCrit * 100)}%** | 🌀 Thân Pháp: **${Math.round(dungeon.bossDodge * 100)}%**\n\n` +
      `👥 **Thành Viên Đội Ngũ (${party.members.length}/${party.maxMembers}):**`
    )
    .setTimestamp();

  const membersLines = party.members.map((mId: string, index: number) => {
    const u = userRepository.get(mId);
    if (!u) return `${index + 1}. 👤 <@${mId}> (Không rõ tu sĩ)`;
    const realm = getRealmDetails(u.level);
    const prefix = mId === party.hostId ? '👑' : '👤';
    return `${index + 1}. ${prefix} <@${mId}> - **${u.name}**\n   └ Cảnh giới: *${realm.fullName}* | ⚔️ ATK: **${u.base_atk}** | ❤️ HP: **${u.base_hp}**`;
  });

  embed.setDescription(embed.data.description + '\n' + membersLines.join('\n') + `\n\n*Đạo hữu khác hãy nhấn nút "Tham gia" để kề vai sát cánh! Chủ phòng nhấn "Bắt đầu" khi đội ngũ đã tề tựu đông đủ.*`);

  return embed;
}

export default class BiCanhCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('bicanh')
        .setDescription('Hệ thống Bí Cảnh - Phó Bản.')
        .addSubcommand(sub =>
          sub
            .setName('solo')
            .setDescription('Mở giao diện khiêu chiến Bí Cảnh đơn nhân (Solo Dungeon).')
        )
        .addSubcommand(sub =>
          sub
            .setName('taolap')
            .setDescription('Tạo tổ đội khiêu chiến Bí Cảnh đa nhân (Co-op Dungeon).')
            .addStringOption(opt => 
              opt.setName('dungeon')
                .setDescription('Chọn bí cảnh co-op')
                .setRequired(true)
                .addChoices(
                  { name: 'Huyết Uyên Cốc (Cảnh giới 10+)', value: 'dc_1' },
                  { name: 'Lôi Âm Tự (Cảnh giới 25+)', value: 'dc_2' }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('bangxephang')
            .setDescription('Bảng xếp hạng cống hiến bí cảnh co-op')
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.reply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.',
        ephemeral: true
      });
      return;
    }

    const subcmd = interaction.options.getSubcommand(true);

    if (subcmd === 'solo') {
      await interaction.deferReply();
      const embed = getDungeonEmbed(userId);
      const row = getDungeonComponents(userId);

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    }
    else if (subcmd === 'taolap') {
      const dungeonId = interaction.options.getString('dungeon', true);
      const dungeon = COOP_DUNGEONS.find(d => d.id === dungeonId);
      if (!dungeon) return;

      if (user.level < dungeon.minLevel) {
        await interaction.reply({ 
          content: `❌ Cảnh giới của đạo hữu chưa đủ để vào **${dungeon.name}**! (Yêu cầu cấp ${dungeon.minLevel})`, 
          ephemeral: true 
        });
        return;
      }

      // Kiểm tra giới hạn lượt đi hàng ngày cho Co-op Dungeon
      const cd = db.prepare('SELECT daily_entries, last_entry_at FROM dungeon_cooldowns WHERE user_id = ? AND dungeon_id = ?')
        .get(userId, dungeonId) as { daily_entries: number; last_entry_at: number } | undefined;
      
      let entriesToday = 0;
      if (cd) {
        const cdDate = new Date(cd.last_entry_at * 1000).toDateString();
        if (cdDate === new Date().toDateString()) {
          entriesToday = cd.daily_entries;
        }
      }

      if (entriesToday >= dungeon.maxDailyEntries) {
        await interaction.reply({
          content: `❌ Đạo hữu đã cạn kiệt linh lực khiêu chiến Bí Cảnh này hôm nay! (Giới hạn: **${dungeon.maxDailyEntries}/${dungeon.maxDailyEntries}** lượt/ngày)`,
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply();
      // Tạo party
      const party = partyService.createParty(userId, dungeonId, dungeon.maxMembers);
      const embed = buildCoopPartyEmbed(party.id);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`joinparty_${party.id}`).setLabel('🤝 Tham Gia').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`startparty_${party.id}`).setLabel('⚔️ Bắt Đầu').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leaveparty_${party.id}`).setLabel('🚪 Rời Khỏi/Hủy').setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    }
    else if (subcmd === 'bangxephang') {
      await interaction.deferReply();
      const topPlayers = db.prepare(`
        SELECT name, dungeon_clears, level 
        FROM users 
        WHERE dungeon_clears > 0 
        ORDER BY dungeon_clears DESC, tu_vi DESC 
        LIMIT 10
      `).all() as any[];

      if (topPlayers.length === 0) {
        await interaction.editReply({ content: '📭 Hiện chưa có cường giả nào vượt qua được Bí Cảnh.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 BẢNG XẾP HẠNG BÍ CẢNH 🏆')
        .setColor('#f1c40f')
        .setDescription('Danh sách các đại năng đã chinh phục nhiều Bí Cảnh nhất:\n\n' +
          topPlayers.map((p, i) => `**#${i + 1}** ${p.name} (Cấp ${p.level}) - ⚔️ **${p.dungeon_clears}** lần phá đảo`).join('\n')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}
