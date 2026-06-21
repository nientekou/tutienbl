import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { cultivationService } from '../../services/CultivationService';
import { formatLinhCan } from '../../utils/constants';
import { BACKGROUNDS, DESTINIES, COMBO_BONUSES, getLinhCanFlavorText, getOpeningScene, getDestinyLine, generateProphecy, generateHeirloom } from '../../data/creationLore';
import db from '../../database/database';
import { InteractionLock } from '../../services/InteractionLock';

export default class TaoNhanVatCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('taonhanvat')
        .setDescription('Khởi tạo nhân vật Tu Tiên với cốt truyện nhập vai.')
        .addStringOption(option =>
          option
            .setName('ten')
            .setDescription('Tên nhân vật tu tiên (2-20 ký tự).')
            .setRequired(true)
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const name = interaction.options.getString('ten', true).trim();

    // Validate name
    const nameRegex = /^[a-zA-Z0-9À-ỹ\s]{2,20}$/;
    if (!nameRegex.test(name)) {
      await interaction.reply({ content: '❌ Tên không hợp lệ! Chỉ chứa chữ cái, số, khoảng trắng, dài 2-20 ký tự.', ephemeral: true });
      return;
    }

    // Check existing character
    const existingUser = userRepository.get(discordId);
    if (existingUser) {
      await interaction.reply({
        content: `❌ Bạn đã có nhân vật: **${existingUser.name}**. Dùng /hoso để xem.`,
        ephemeral: true,
      });
      return;
    }

    // Defer reply because cinematic takes time
    await interaction.deferReply({ ephemeral: true });

    // Step 1: Epic Prologue
    await this.stepEpicPrologue(interaction);

    // Release lock early since this command takes time and we already deferred
    InteractionLock.release(interaction.user.id);

    // Generate Linh Can early for Step 2
    const linhCanJson = cultivationService.generateLinhCan();
    const linhCan = JSON.parse(linhCanJson);

    // Step 2: Spirit Root Ceremony
    await this.stepSpiritRootCeremony(interaction, linhCan);

    // Step 3: Choose Background
    const background = await this.stepChooseBackground(interaction, name);
    if (!background) return;

    // Step 4: Choose Destiny
    const destiny = await this.stepChooseDestiny(interaction, name, background);
    if (!destiny) return;

    // Step 5: Finalize Character Creation
    await this.stepCreateCharacter(interaction, name, background, destiny, linhCan, linhCanJson);
  }

  private async stepEpicPrologue(interaction: ChatInputCommandInteraction): Promise<void> {
    const prologueData = [
      {
        title: '📜 Chương 1: Hồng Hoang',
        text: 'Thuở khai thiên lập địa, chín vị Tiên Tổ từ hư vô bước ra, phân chia trời đất thành Cửu Trùng Thiên. Nhân loại khi ấy chỉ là hạt bụi giữa dòng xoáy hỗn mang.',
        color: 0xf1c40f
      },
      {
        title: '⚔️ Chương 2: Đại Chiến',
        text: '3000 năm trước, Ma Giới xé toang bức tường không gian. 12 vị Chân Tiên ngã xuống. Long tộc suy vong. Nhưng nhân loại... nhân loại đã đứng lên.',
        color: 0xe74c3c
      },
      {
        title: '🌪️ Chương 3: Thời Đại Mới',
        text: 'Ngày nay, linh mạch khô cạn, bí cảnh cổ xưa dần hé lộ. Các tông môn tranh giành địa bàn. Một thời đại hỗn loạn và cũng đầy cơ hội.',
        color: 0x3498db
      },
      {
        title: '✨ Chương 4: Định Mệnh',
        text: 'Và ngươi... giữa dòng xoáy của số phận, giữa những mảnh ghép của quá khứ và tương lai... ngươi chính là mảnh ghép còn thiếu. Hãy bắt đầu hành trình của mình.',
        color: 0x2ecc71
      }
    ];

    const embeds = prologueData.map(p => new EmbedBuilder()
      .setTitle(p.title)
      .setDescription(p.text)
      .setColor(p.color)
    );

    for (let i = 0; i < embeds.length; i++) {
      await interaction.editReply({ embeds: [embeds[i]] });
      await new Promise(r => setTimeout(r, 3000));
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }

  private async stepSpiritRootCeremony(interaction: ChatInputCommandInteraction, linhCan: Record<string, number>): Promise<void> {
    const maxVal = Math.max(...Object.values(linhCan));
    
    let type = '';
    let color = 0xffffff;
    let icon = '';
    let npcReac = '';
    let npcStory = '';
    
    if (maxVal >= 90) {
      type = 'Thiên'; color = 0xf1c40f; icon = '✨';
      npcReac = '"Trời ơi! Linh căm thuần khiết! Ngươi là hy vọng của nhân loại!"';
      npcStory = 'Xưa nay chỉ có 3 người có Thiên linh căn... tất cả đều phi thăng.';
    } else if (maxVal >= 70) {
      type = 'Địa'; color = 0x3498db; icon = '🌟';
      npcReac = '"Linh căn thượng đẳng. Rất tốt, theo ta."';
      npcStory = 'Địa linh căn xuất hiện 1 thế hệ 1 lần. Ngươi sẽ làm nên chuyện.';
    } else if (maxVal >= 40) {
      type = 'Nhân'; color = 0xbdc3c7; icon = '💫';
      npcReac = '"Cũng được. Chịu khó tu luyện là thành tài."';
      npcStory = 'Nhân linh căn là phổ biến nhất, nhưng đừng coi thường. Người mạnh nhất từng có Nhân linh căn.';
    } else {
      type = 'Tạp'; color = 0x95a5a6; icon = '⭐';
      npcReac = '"... (im lặng) Ừm, cố gắng lên. Nỗ lực có thể bù đắp."';
      npcStory = 'Tạp linh căn khó tu luyện, nhưng đường dài mới biết ngựa hay. Có người từ Tạp linh căn mà phi thăng.';
    }

    const embed = new EmbedBuilder()
      .setTitle(`Đài Kiểm Tra Linh Căn`)
      .setColor(color)
      .setDescription(`Trưởng lão đặt tay lên trán ngươi. Một luồng sáng ${icon} lóe lên!\n\n**${npcReac}**\n*${npcStory}*`)
      .setFooter({ text: `Ngươi sở hữu ${type} Linh Căn.` });

    await interaction.editReply({ embeds: [embed] });
    await new Promise(r => setTimeout(r, 4000));
  }

  private async stepChooseBackground(interaction: ChatInputCommandInteraction, name: string): Promise<(typeof BACKGROUNDS)[number] | null> {
    const embed = new EmbedBuilder()
      .setTitle('📜 Bước 1: Xuất Thân Của Ngươi')
      .setColor(0x9b59b6)
      .setDescription(`**${name}** — trước khi bước vào con đường tu tiên, hãy chọn xuất thân của ngươi.\n\nMỗi xuất thân mang cho ngươi câu chuyện riêng và ưu thế khởi đầu khác nhau.`)
      .addFields(
        ...BACKGROUNDS.map(b => ({
          name: `${b.emoji} ${b.name}`,
          value: `${b.description}\n${b.bonuses.hp ? `🩸 +${b.bonuses.hp} HP` : ''}${b.bonuses.atk ? ` ⚔️ +${b.bonuses.atk} ATK` : ''}${b.bonuses.def ? ` 🛡️ +${b.bonuses.def} DEF` : ''}${b.bonuses.expRate ? ` ✨ +${b.bonuses.expRate}% EXP` : ''}${b.bonuses.lt ? ` 🪙 +${b.bonuses.lt} LT` : ''}${b.bonuses.knb ? ` 💎 +${b.bonuses.knb} KNB` : ''}`,
        }))
      )
      .setFooter({ text: 'Hãy chọn một xuất thân — nó sẽ ảnh hưởng đến toàn bộ hành trình của ngươi.' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...BACKGROUNDS.map((b, i) =>
        new ButtonBuilder()
          .setCustomId(`bg_${i}`)
          .setLabel(`${b.emoji} ${b.name}`)
          .setStyle(ButtonStyle.Primary)
      )
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    const replyMsg = await interaction.fetchReply();

    const filter = (i: any) => i.user.id === interaction.user.id && i.customId.startsWith('bg_');
    const collected = await replyMsg.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 30000 }).catch(() => null);
    if (!collected) {
      await interaction.editReply({ content: '⏰ Hết thời gian chọn. Hãy dùng lại lệnh /taonhanvat.', components: [] });
      return null;
    }

    const idx = parseInt(collected.customId.split('_')[1], 10);
    const background = BACKGROUNDS[idx];
    try {
      await collected.update({ components: [] });
    } catch {
      // Token button có thể hết hạn, dùng editReply để xóa components
      await interaction.editReply({ components: [] }).catch(() => {});
    }

    // Show intro story
    const storyEmbed = new EmbedBuilder()
      .setTitle(`${background.emoji} ${background.name}`)
      .setColor(0xe67e22)
      .setDescription(background.intro)
      .setFooter({ text: '— Ngươi đã chọn xuất thân. Hãy bước tiếp...' });
    await interaction.editReply({ embeds: [storyEmbed], components: [] });

    // Brief delay for dramatic effect
    await new Promise(r => setTimeout(r, 2000));
    return background;
  }

  private async stepChooseDestiny(interaction: ChatInputCommandInteraction, name: string, background: (typeof BACKGROUNDS)[number]): Promise<(typeof DESTINIES)[number] | null> {
    const embed = new EmbedBuilder()
      .setTitle('🔮 Bước 2: Định Mệnh Của Ngươi')
      .setColor(0xe74c3c)
      .setDescription(`Dù xuất thân là **${background.name}**, con đường phía trước còn tùy thuộc vào định mệnh ngươi chọn.\n\nMỗi định mệnh ban tặng ưu thế — nhưng cũng kèm theo thách thức.`)
      .addFields(
        ...DESTINIES.map(d => ({
          name: `${d.emoji} ${d.name}`,
          value: `${d.description}\n✨ ${Object.entries(d.bonuses).map(([k, v]) => `+${v}% ${k.replace('Percent', '').replace('Rate', '')}`).join(', ')}\n⚠️ ${Object.entries(d.penalties).map(([k, v]) => `-${v}% ${k.replace('Percent', '').replace('Rate', '')}`).join(', ')}`,
        }))
      )
      .setFooter({ text: 'Hãy chọn định mệnh — không thể thay đổi sau khởi tạo.' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...DESTINIES.map((d, i) =>
        new ButtonBuilder()
          .setCustomId(`dest_${i}`)
          .setLabel(`${d.emoji} ${d.name}`)
          .setStyle(i === 0 ? ButtonStyle.Danger : i === 1 ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    const replyMsg2 = await interaction.fetchReply();

    const filter2 = (i: any) => i.user.id === interaction.user.id && i.customId.startsWith('dest_');
    const collected = await replyMsg2.awaitMessageComponent({ filter: filter2, componentType: ComponentType.Button, time: 30000 }).catch(() => null);
    if (!collected) {
      await interaction.editReply({ content: '⏰ Hết thời gian chọn. Hãy dùng lại lệnh /taonhanvat.', components: [] });
      return null;
    }

    const idx = parseInt(collected.customId.split('_')[1], 10);
    const destiny = DESTINIES[idx];
    try {
      await collected.update({ components: [] });
    } catch {
      await interaction.editReply({ components: [] }).catch(() => {});
    }

    // Show destiny line
    const lineEmbed = new EmbedBuilder()
      .setTitle(`${destiny.emoji} ${destiny.name}`)
      .setColor(0x2ecc71)
      .setDescription(`*"${destiny.line}"*`);
    await interaction.editReply({ embeds: [lineEmbed], components: [] });

    await new Promise(r => setTimeout(r, 1500));
    return destiny;
  }

  private async stepCreateCharacter(
    interaction: ChatInputCommandInteraction,
    name: string,
    background: (typeof BACKGROUNDS)[number],
    destiny: (typeof DESTINIES)[number],
    linhCan: Record<string, number>,
    linhCanJson: string
  ): Promise<void> {
    const discordId = interaction.user.id;
    const elements = Object.keys(linhCan);
    const primaryElement = elements.reduce((a, b) => linhCan[a] > linhCan[b] ? a : b, elements[0]);

    // Calculate stats with background + destiny bonuses
    const baseStats = cultivationService.calculateStatsForLevel(1, linhCanJson);
    const totalHp = Math.floor((baseStats.hp + (background.bonuses.hp || 0)) * (1 + ((destiny.bonuses.hpPercent || 0) - (destiny.penalties.hpPercent || 0)) / 100));
    const totalAtk = Math.floor((baseStats.atk + (background.bonuses.atk || 0)) * (1 + ((destiny.bonuses.atkPercent || 0) - (destiny.penalties.atkPercent || 0)) / 100));
    const totalDef = Math.floor((baseStats.def + (background.bonuses.def || 0)) * (1 + ((destiny.bonuses.defPercent || 0) - (destiny.penalties.defPercent || 0)) / 100));
    const totalCrit = Math.min(0.95, baseStats.crit + (background.bonuses.crit || 0) / 100 + (destiny.bonuses.crit || 0) / 100);
    const totalMp = baseStats.mp + (background.bonuses.mp || 0);

    // Check for combo bonus
    const combo = COMBO_BONUSES.find(c => c.backgroundId === background.id && c.element === primaryElement);
    const startingSkills: string[] = [];
    if (combo) {
      startingSkills.push(combo.skillEffect);
    }
    const startingSkillsJson = JSON.stringify(startingSkills);

    // Calculate starting LT with bonus 1000
    let startingLt = 100 + (background.bonuses.lt || 0) + 1000;
    let startingKnb = (background.bonuses.knb || 0) + 0;

    // Generate Prophecy and Heirloom
    const prophecy = generateProphecy(background.id, destiny.id, primaryElement);
    const heirloom = generateHeirloom();
    const heirloomJson = JSON.stringify(heirloom);

    // Create character in DB
    try {
      userRepository.create({
        discord_id: discordId,
        name,
        background: background.id,
        destiny: destiny.id,
        starting_skills: startingSkillsJson,
        prophecy,
        heirloom: heirloomJson,
        claimed_starting_bonus: 1,
        base_hp: totalHp,
        base_mp: totalMp,
        base_atk: totalAtk,
        base_def: totalDef,
        base_crit: totalCrit,
        base_crit_res: baseStats.critRes,
        base_luck: baseStats.luck + (background.bonuses.dropRate || 0),
        linh_can: linhCanJson,
        coin_ha_pham: startingLt,
        knb: startingKnb,
      });

      // Build the final story embed
      const formattedLinhCan = formatLinhCan(linhCanJson);
      const linhCanFlavor = elements.map(e => `**${e}** (${linhCan[e]}%) — ${getLinhCanFlavorText(e, linhCan[e])}`).join('\n');
      const openingScene = getOpeningScene(name, background.id);
      const destinyLine = getDestinyLine(destiny.id);

      const embed = new EmbedBuilder()
        .setTitle('🔮 Nhân Vật Đã Được Khai Sinh!')
        .setColor(0xf1c40f)
        .setDescription(`__****Thế Giới Tu Chân — Niên Hiệu Linh Hư 358****__\n\n*${openingScene}*\n\n__**${destiny.emoji} Định Mệnh**__\n*"${destinyLine}"*\n\n__**📜 Lá Số Tử Vi**__\n*${prophecy}*`)
        .addFields(
          { name: '👤 Đạo Hiệu', value: `**${name}** (${background.emoji} ${background.name})`, inline: true },
          { name: '✨ Cảnh Giới', value: 'Luyện Khí Kỳ — Tầng 1/38', inline: true },
          { name: '☯️ Định Mệnh', value: `${destiny.emoji} ${destiny.name}`, inline: true },
          { name: '📜 Căn Cơ Linh Căn', value: `${formattedLinhCan}\n${linhCanFlavor}` },
          { name: '📊 Chỉ Số', value: `🩸 HP: **${totalHp}** | 🌀 MP: **${totalMp}**\n⚔️ Công Kích: **${totalAtk}** | 🛡️ Phòng Thủ: **${totalDef}**\n💥 Bạo Kích: **${(totalCrit * 100).toFixed(1)}%** | 🍀 May Mắn: **${baseStats.luck + (background.bonuses.dropRate || 0)}**` },
          {
            name: '🎒 Hành Trang Khởi Đầu',
            value: [
              `🪙 ${startingLt.toLocaleString()} Hạ Phẩm Linh Thạch`,
              background.startingItem ? `📦 **${background.startingItem.name}** — ${background.startingItem.description}` : '',
              `🏺 **${heirloom.name}** — ${heirloom.description} (${heirloom.effect})`,
              combo ? `📜 **Combo:** ${combo.skillName} — ${combo.skillDescription}` : '',
              startingKnb ? `💎 ${startingKnb} Kim Nguyên Bảo` : '',
              `\n🎁 *Quà khởi nghiệp: +1000 LT đã được cộng vào hành trang!*`
            ].filter(Boolean).join('\n'),
          },
        )
        .setFooter({ text: 'Hành trình tu tiên của ngươi bắt đầu từ đây. Dùng /hoso để theo dõi tu vi! Dùng /camnang để xem điển tịch.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Lỗi tạo nhân vật:', error);
      await interaction.editReply({ content: '❌ Lỗi hệ thống khi khai sinh nhân vật. Xin thử lại!', embeds: [], components: [] });
    }
  }
}
