import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { cultivationService } from '../../services/CultivationService';
import { formatLinhCan } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload, toV2TextUpdate } from '../../utils/uiSystem';
import { BACKGROUNDS, DESTINIES, COMBO_BONUSES, getLinhCanFlavorText, getOpeningScene, getDestinyLine, generateProphecy, generateHeirloom } from '../../data/creationLore';
import db from '../../database/database';
import { InteractionLock } from '../../services/InteractionLock';

export default class TaoNhanVatCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('taonhanvat')
        .setDescription('Khởi tạo nhân vật Tu Tiên tiến vào Thương Mang Thiên Hạ.')
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
      await interaction.editReply({ content: '❌ Tên không hợp lệ! Chỉ chứa chữ cái, số, khoảng trắng, dài 2-20 ký tự.' });
      return;
    }

    // Check existing character
    const existingUser = userRepository.get(discordId);
    if (existingUser) {
      await interaction.editReply({
        content: `❌ Đạo hữu đã có nhân vật: **${existingUser.name}**. Dùng /hoso để xem.`,
        });
      return;
    }

    // Defer reply because cinematic takes time
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
      title: 'Chương I: Khai Thiên',
      text: 'Thuở thiên địa chưa định, vạn vật còn chìm trong cõi hỗn mang vô tận.\n\nĐến khi thanh khí hóa trời, trọc khí thành đất, nhật nguyệt vận hành, Thương Mang Thiên Hạ mới chính thức hình thành.\n\nLinh khí lưu chuyển khắp sơn hà, vạn vật sinh sôi, đại đạo cũng từ đó mở ra.\n\nTừ phàm nhân đến vạn tộc, tất cả đều bước lên cùng một tiên lộ — tìm kiếm con đường của riêng mình.',
      color: 0xf1c40f
    },
    {
      title: 'Chương II: Dấu Mốc',
      text: 'Sau thuở khai thiên, Thương Mang từng có một thời đại mà hậu thế chỉ còn biết qua những mảnh cổ sử rời rạc.\n\nĐó là thời đại chưa có tiền lệ, khi đại đạo chưa ai đi đến tận cùng và tiên lộ vẫn còn là một vùng sương mù.\n\nCó những người lấy thân hỏi trời, mở ra con đường chưa từng tồn tại trước đó.\n\nKhi thời đại ấy khép lại, một cánh cửa mới của tiên lộ cũng được mở ra, đặt nền móng cho Thương Mang ngày nay.',
      color: 0x9b59b6
    },
    {
      title: 'Chương III: Đại Kiếp',
      text: 'Rồi đại kiếp giáng xuống, cuốn Tiên, Ma, Yêu và Nhân vào vòng xoáy nhân quả.\n\nTông môn hưng rồi diệt, cường giả xuất thế rồi biến mất, vô số truyền thừa bị chôn vùi theo năm tháng.\n\nLinh mạch suy kiệt, cổ địa phong ấn, Thương Mang bước vào một thời kỳ dài tĩnh lặng.\n\nNhững gì còn sót lại chỉ là dấu vết của một thời đại đã mất.',
      color: 0xe74c3c
    },
    {
      title: 'Chương IV: Thương Mang Tái Khởi',
      text: 'Nay linh mạch dần thức tỉnh, bí cảnh và cổ địa lần lượt hiện thế.\n\nTông môn, thế gia và tán tu đều tranh đoạt cơ duyên giữa một thời đại phong vân mới.\n\nTiên lộ một lần nữa mở ra, nhưng không ai biết điều gì đang chờ phía cuối con đường.\n\nCòn Đạo Hữu, từ hôm nay cũng chính thức bước vào Thương Mang Thiên Hạ. Chương tiếp theo sẽ do Đạo Hữu tự mình viết nên.',
      color: 0x3498db
    }
    ];

    const embeds = prologueData.map(p => new EmbedBuilder()
      .setTitle(p.title)
      .setDescription(p.text)
      .setColor(p.color)
    );

    for (let i = 0; i < embeds.length; i++) {
      await interaction.editReply(toV2Payload([embeds[i]]));
      await new Promise(r => setTimeout(r, 8000));
    }
    
    await new Promise(r => setTimeout(r, 3000));
  }

  private async stepSpiritRootCeremony(interaction: ChatInputCommandInteraction, linhCan: Record<string, number>): Promise<void> {
    const maxVal = Math.max(...Object.values(linhCan));
    
    let type = '';
    let color = 0xffffff;
    let icon = '';
    let npcReac = '';
    let npcStory = '';
    
    if (maxVal >= 90) {
      type = 'Thiên'; color = 0xf1c40f; icon = '<:lcthien:1547929788147040336>';
      npcReac = '"Thiên linh căn..."';
      npcStory ='Linh quang trước mặt hồi lâu chưa tan.\n' +
                '"Đã rất lâu rồi, Thương Mang mới lại có một người như Đạo Hữu."\n' +
                '**Lăng Tiêu không nói tiếp.**\n' +
                'Có vài chuyện, biết sớm hay muộn vốn chẳng khác nhau.\n' +
                 '*Tiên lộ còn dài. Căn cốt chỉ quyết định nơi ngươi bắt đầu.*';
    } else if (maxVal >= 70) {
      type = 'Địa'; color = 0x3498db; icon = '<:lcdia:1547929786402340935>';
      npcReac = '"Địa linh căn..."';
      npcStory = 'Linh quang dần lắng xuống, để lại một vệt sáng nhàn nhạt giữa lòng bàn tay.\n' +
                 '"Không tệ. Với căn cốt này, Đạo Hữu có thể đi rất xa."\n' +
                 '**Lăng Tiêu dừng một thoáng, rồi nói tiếp:**\n' +
                 '"Chỉ là đường xa hay gần, trước nay đâu phải do người khác định đoạt."\n' +
                 '*Căn cốt tốt là một chuyện. Giữ được mình trên tiên lộ lại là một chuyện khác.*';
    } else if (maxVal >= 40) {
      type = 'Nhân'; color = 0xbdc3c7; icon = '<:lcnhan:1547929784145813534>';
      npcReac = '"Nhân linh căn à..."';
      npcStory = 'Linh quang chỉ lóe lên trong chốc lát rồi trở về bình thường.\n' +
                 '"Bình bình phàm phàm."\n' +
                 '**Lăng Tiêu không có thất vọng, cũng chẳng có vẻ xem nhẹ.**\n' +
                 '"Nhưng Đạo Hữu, tiên lộ vốn chẳng hỏi xuất thân. Có người đi một bước đã ở trước vạn người, cũng có người đi hết nửa đời mới tìm được con đường của mình."\n' +
                 '*Đi được bao xa, cuối cùng vẫn phải tự mình bước.*';
    } else {
      type = 'Tạp'; color = 0x95a5a6; icon = '<:lctap:1547929782191128576>';
      npcReac = '"Tạp linh căn sao?"';
      npcStory = 'Linh quang chập chờn hồi lâu mới chịu tan.\n' +
                 'Lăng Tiêu im lặng rất lâu.\n' +
                 '"Đường này của Đạo Hữu sẽ khó đi hơn người khác."\n' +
                 '**Lăng Tiêu hỉ nói một câu ấy, không an ủi, cũng chẳng thương hại.**\n' +
                 'Một lúc sau, hắn mới nói:\n\n' +
                 '"Nhưng khó đi... không có nghĩa là không thể đi."\n' +
                 '*Cổ sử từng có người bắt đầu từ nơi này.*\n' +
                 '*Chuyện về sau thế nào, Đạo Hữu tự mình viết lấy.*';
    }

    const embed = new EmbedBuilder()
      .setTitle(`Đài Kiểm Tra Linh Căn`)
      .setColor(color)
      .setDescription(`Trưởng lão đặt tay lên trán Đạo Hữu. Một luồng sáng ${icon} lóe lên!\n\n**${npcReac}**\n*${npcStory}*`)
      .setFooter({ text: `Đạo Hữu sở hữu ${type} Linh Căn.` });

    await interaction.editReply(toV2Payload([embed]));
    await new Promise(r => setTimeout(r, 10000));
  }

  private async stepChooseBackground(interaction: ChatInputCommandInteraction, name: string): Promise<(typeof BACKGROUNDS)[number] | null> {
    const embed = new EmbedBuilder()
      .setTitle('Bước 1: Xuất Thân Của Đạo Hữu')
      .setColor(EMBED_COLORS.MYSTIC)
      .setDescription(`**${name}** — trước khi bước lên tiên lộ, trước hết phải biết mình từ đâu mà đến.\n` +
      `Thương Mang rộng lớn, chúng sinh vạn loại. Có người sinh giữa thế gia, ` +
      `có người bái nhập sư môn, cũng có kẻ chỉ mang một thân phàm cốt mà bước vào hồng trần.\n` +
      `Xuất thân không quyết định Đạo Hữu sẽ trở thành ai.\n` +
      `Nhưng con đường đã chọn, sẽ theo Đạo Hữu rất lâu.`)
      .addFields(
        ...BACKGROUNDS.map(b => ({
          name: `${b.emoji} ${b.name}`,
          value: `${b.description}\n${b.bonuses.hp ? `<:ihp:1547865965998379048> +${b.bonuses.hp} HP` : ''}${b.bonuses.atk ? ` <:iiatk:1547935869602631680> +${b.bonuses.atk} ATK` : ''}${b.bonuses.def ? ` <:idef:1547935867149099083> +${b.bonuses.def} DEF` : ''}${b.bonuses.expRate ? ` <:iexp:1547935874077954078> +${b.bonuses.expRate}% EXP` : ''}${b.bonuses.lt ? ` <:lt1:1547866122123218945> +${b.bonuses.lt} LT` : ''}${b.bonuses.knb ? ` <:lt2:1547866118817845309> +${b.bonuses.knb} CPLT` : ''}`,
        }))
      )
      .setFooter({ text: 'Đạo Hữu hãy chọn đi. Tiên lộ phía trước, tự mình bước lấy.' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...BACKGROUNDS.map((b, i) =>
        new ButtonBuilder()
          .setCustomId(`bg_${i}`)
          .setLabel(`${b.emoji} ${b.name}`)
          .setStyle(ButtonStyle.Primary)
      )
    );

    await interaction.editReply(toV2Payload([embed], [row] ));
    const replyMsg = await interaction.fetchReply();

    const filter = (i: any) => i.user.id === interaction.user.id && i.customId.startsWith('bg_');
    const collected = await replyMsg.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 30000 }).catch(() => null);
    if (!collected) {
      await interaction.editReply(toV2TextUpdate('⏰ Hết thời gian chọn. Hãy dùng lại lệnh /taonhanvat.'));
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
      .setColor(EMBED_COLORS.ORANGE)
      .setDescription(background.intro)
      .setFooter({ text: '"Xem ra Đạo Hữu đã chọn được con đường mình muốn đi về sau rồi..."' });
    await interaction.editReply(toV2Payload([storyEmbed], [] ));

    // Brief delay for dramatic effect
    await new Promise(r => setTimeout(r, 6000));
    return background;
  }

  private async stepChooseDestiny(interaction: ChatInputCommandInteraction, name: string, background: (typeof BACKGROUNDS)[number]): Promise<(typeof DESTINIES)[number] | null> {
    const embed = new EmbedBuilder()
      .setTitle('Bước 2: Định Mệnh Của Đạo Hữu')
      .setColor(EMBED_COLORS.ERROR)
      .setDescription(`**${background.name}**. Xuất thân chỉ nói cho Đạo Hữu biết mình từ đâu mà đến.\nCòn từ đây, con đường sẽ do chính Đạo Hữu chọn lấy.\nCó những con đường nhìn tưởng bằng phẳng, nhưng phía cuối chưa chắc có lối ra.\nCó những con đường đầy chông gai, vậy mà lại dẫn đến nơi người khác cả đời cũng chẳng thể đặt chân tới.\n Vậy tiếp theo, là tới Định Mệnh của Đạo Hữu.`)
      .addFields(
        ...DESTINIES.map(d => ({
          name: `${d.emoji} ${d.name}`,
          value: `${d.description}\n<:iexp:1547935874077954078> ${Object.entries(d.bonuses).map(([k, v]) => `+${v}% ${k.replace('Percent', '').replace('Rate', '')}`).join(', ')}\n⚠️ ${Object.entries(d.penalties).map(([k, v]) => `-${v}% ${k.replace('Percent', '').replace('Rate', '')}`).join(', ')}`,
        }))
      )
      .setFooter({ text: 'Định Mệnh một khi đã an bài sẽ vô pháp thay đổi.' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...DESTINIES.map((d, i) =>
        new ButtonBuilder()
          .setCustomId(`dest_${i}`)
          .setLabel(`${d.emoji} ${d.name}`)
          .setStyle(i === 0 ? ButtonStyle.Danger : i === 1 ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    );

    await interaction.editReply(toV2Payload([embed], [row] ));
    const replyMsg2 = await interaction.fetchReply();

    const filter2 = (i: any) => i.user.id === interaction.user.id && i.customId.startsWith('dest_');
    const collected = await replyMsg2.awaitMessageComponent({ filter: filter2, componentType: ComponentType.Button, time: 30000 }).catch(() => null);
    if (!collected) {
      await interaction.editReply(toV2TextUpdate('⏰ Hết thời gian chọn. Hãy dùng lại lệnh /taonhanvat.'));
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
      .setColor(EMBED_COLORS.SUCCESS)
      .setDescription(`*"${destiny.line}"*`);
    await interaction.editReply(toV2Payload([lineEmbed], [] ));

    await new Promise(r => setTimeout(r, 5000));
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
        base_speed: baseStats.speed,
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
        .setTitle('Nhân Vật Đã Được Khai Sinh!')
      .setColor(EMBED_COLORS.GOLD)
      .setDescription(`## Thương Mang Thiên Hạ\n\n*${openingScene}*\n\n__**${destiny.emoji} Định Mệnh**__\n*"${destinyLine}"*\n\n__**<:tin4:1547875508174327828> Lá Số Tử Vi**__\n*${prophecy}*`)
        .addFields(
          { name: '<:inv:1547865980854599693> Đạo Hiệu', value: `**${name}** (${background.emoji} ${background.name})`, inline: true },
          { name: '<:iexp:1547935874077954078> Cảnh Giới', value: 'Luyện Khí Kỳ — Tầng 1/38', inline: true },
          { name: '<:idrole:1547865936848101456> Định Mệnh', value: `${destiny.emoji} ${destiny.name}`, inline: true },
          { name: '<:idp:1547865939574390784> Căn Cơ Linh Căn', value: `${formattedLinhCan}\n${linhCanFlavor}` },
          { name: '<:tin4:1547875508174327828> Chỉ Số', value: `<:ihp:1547865965998379048> HP: **${totalHp}** | <:lc1:1547866362511368212> MP: **${totalMp}**\n<:iiatk:1547935869602631680> Công Kích: **${totalAtk}** | <:idef:1547935867149099083> Phòng Thủ: **${totalDef}**\n💥 Bạo Kích: **${(totalCrit * 100).toFixed(1)}%** | <:tlt:1547865912538046494> May Mắn: **${baseStats.luck + (background.bonuses.dropRate || 0)}**` },
          {
            name: '<:tvp1:1547866133242056704> Hành Trang Khởi Đầu',
            value: [
              `<:lt1:1547866122123218945> ${startingLt.toLocaleString()} Hạ Phẩm Linh Thạch`,
              background.startingItem ? `<:a3:1547865998001053726> **${background.startingItem.name}** — ${background.startingItem.description}` : '',
              `<:ic:1547865958431985714> **${heirloom.name}** — ${heirloom.description} (${heirloom.effect})`,
              combo ? `<:tin4:1547875508174327828> **Combo:** ${combo.skillName} — ${combo.skillDescription}` : '',
              startingKnb ? `<:lt2:1547866118817845309> ${startingKnb} Cực Phẩm Linh Thạch` : '',
              `\n<:qua4:1547881540372009021> *Quà khởi nghiệp: +1000 LT <:lt1:1547866122123218945> đã được cộng vào hành trang!*`
            ].filter(Boolean).join('\n'),
          },
          {
            name: '🎯 Các Bước Đầu Tiên',
            value: [
              `1️⃣ **Tăng Cấp:** \`/luyenkhi\` — Tu luyện để nhận EXP`,
              `2️⃣ **Nhiệm Vụ:** \`/nhiemvu\` — Nhận nhiệm vụ hàng ngày`,
              `3️⃣ **Trang Bị:** \`/trangbi\` — Xem và sử dụng vật phẩm`,
              `4️⃣ **Thẩm:** \`/camnang\` — Đọc cẩm nang hướng dẫn`,
            ].join('\n'),
          },
        )
        .setFooter({ text: '<:sotay:1547883761776197632> Hãy dùng lệnh /camnang để xem Cẩm Nang Tiên Lộ hướng dẫn tân thủ!' })
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));

    } catch (error) {
      console.error('Lỗi tạo nhân vật:', error);
      await interaction.editReply(toV2TextUpdate('❌ Lỗi hệ thống khi khai sinh nhân vật. Xin thử lại!'));
    }
  }
}
