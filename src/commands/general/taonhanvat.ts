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
          text: 'Thuở thiên địa chưa định, vạn vật còn chìm trong một cõi hỗn mang vô tận. Không nhật nguyệt, không sơn hà, không phân âm dương, chỉ có linh khí cùng hư vô đan xen, trôi nổi qua những năm tháng chẳng ai biết đến tận cùng.\\n\\nĐến khi thiên địa sơ khai, thanh khí thăng lên thành trời, trọc khí lắng xuống hóa thành đất. Nhật nguyệt thay phiên, tinh tú vận hành, sơn hà dần thành thế. Linh khí theo đó lưu chuyển khắp Thương Mang, vạn vật bắt đầu sinh trưởng, chúng sinh lần lượt xuất hiện.\\n\\nTừ phàm nhân đến vạn tộc, từ một ngọn cỏ vô danh đến những tồn tại có thể lay chuyển thiên địa, tất cả đều bắt đầu từ cùng một cõi Thương Mang. Đại đạo cũng từ đó mà mở ra. Kẻ cầu trường sinh, kẻ cầu cực đạo, kẻ cầu tự tại giữa hồng trần — mỗi người đều bắt đầu bước lên con đường của riêng mình.',
          color: 0xf1c40f
        },
        {
          title: 'Chương II: Dấu Mốc',
          text: 'Sau thuở khai thiên, Thương Mang từng trải qua một thời đại mà hậu thế khó lòng hình dung.\n\nKhi ấy, tiên lộ vẫn chưa có người đặt chân đến tận cùng. Tiên duyên chưa từng được chứng kiến, đại đạo chưa có khuôn thước, mà con đường phía trước cũng chẳng một ai biết sẽ dẫn đến đâu.\n\nĐó là một thời đại không có tiền lệ.\n\nCó những người sinh ra giữa phong vân, lấy thân thử đạo, lấy mệnh hỏi trời. Có những cái tên từng khiến thiên địa đổi sắc, rồi lại biến mất giữa dòng năm tháng. Cũng có những trận chiến, những đạo thống, những cổ địa đã sớm chìm vào lịch sử, chỉ còn đôi ba nét mực trong cổ thư để hậu nhân suy đoán.\n\nKhông ai biết chính xác chuyện gì đã xảy ra trong những năm tháng ấy.\n\nChỉ biết rằng, từ sau thời đại đó, tiên lộ bắt đầu có dấu vết để lần theo. Những giới hạn từng không thể gọi tên dần được chạm tới, những con đường chưa từng có người đặt chân dần được mở ra. Một thời đại mới cũng từ đó mà thành hình.\n\nHậu thế gọi đó là khởi nguyên của Tiên duyên.\n\nNhưng có lẽ, Tiên duyên chỉ là kết quả. Còn cái thật sự được để lại chính là con đường.\n\nMột con đường được mở bằng vô số năm tháng không tên, bằng những kẻ đi trước chưa từng biết mình có thể đi được bao xa.\n\nVà cũng từ nơi ấy, cái nôi của Thương Mang Thiên Hạ ngày nay bắt đầu được hình thành.',
          color: 0x9b59b6
        },
        {
          title: 'Chương III: Tiên Duyên & Đại Kiếp',
          text: 'Khi những kẻ đứng trên đỉnh đại đạo lần lượt chạm đến giới hạn, Tiên duyên cuối cùng cũng được xác lập. Từ đó, con đường tu hành của hậu thế có thêm một tầng trời để ngước nhìn, một cảnh giới để truy cầu. Nhưng cũng từ khoảnh khắc ấy, đại thế bắt đầu chuyển mình.\\n\\nNhững tranh đấu kéo dài qua năm tháng cuối cùng hóa thành đại kiếp. Tiên, Ma, Yêu, Nhân cùng vô số thế lực cuốn vào vòng xoáy nhân quả. Cường giả lần lượt xuất thế rồi ngã xuống, đạo thống từng hưng thịnh cũng có ngày hóa thành phế tích. Có những trận chiến làm đổi màu cả một phương thiên địa, có những cái tên từng vang động cửu thiên rồi biến mất khỏi cổ sử.\\n\\nSau đại kiếp, Thương Mang không còn là Thương Mang của năm xưa. Rất nhiều truyền thừa thất lạc, cổ địa bị phong ấn, linh mạch dần suy kiệt. Những người từng đứng trên đỉnh cao cũng lần lượt lui khỏi thế gian. Chỉ còn vô số dấu vết của thời đại cũ nằm lại giữa sơn hà, chờ hậu nhân một ngày tìm thấy.',
          color: 0xe74c3c
        },
        {
          title: 'Chương IV: Thương Mang Tái Khởi',
          text: 'Năm tháng trôi qua, thiên địa tưởng như đã trở lại bình lặng. Nhưng dưới lớp bụi của thời gian, những dòng linh mạch từng khô cạn bắt đầu thức tỉnh. Cổ địa lần lượt hiện thế, bí cảnh mở cửa, những truyền thừa từng biến mất từ thời đại ||Tô Tịnh|| cũng bắt đầu xuất hiện trở lại.\\n\\nTông môn dựng cờ, thế gia tranh thế, tán tu tìm cơ duyên. Một thế hệ mới bắt đầu bước lên tiên lộ, mang theo những khát vọng của riêng mình. Không ai biết những gì đã xảy ra trong thời đại trước sẽ một lần nữa tái diễn, cũng không ai biết những bí mật bị chôn vùi bao năm sẽ dẫn thế gian đi về đâu.\\n\\nThương Mang lại nổi phong vân. Tiên duyên không còn là truyền thuyết xa xôi, nhưng con đường đến đó vẫn là một con đường chưa từng dễ đi. Có người sinh ra đã có thiên tư, có người xuất thân thế gia, cũng có kẻ chỉ mang một thân phàm cốt.\\n\\nNhưng tiên lộ vốn chẳng hỏi xuất thân.\\n\\nMột bước nhập đạo, phía trước là vạn dặm sơn hà. Phía sau là hồng trần cố thổ. Cơ duyên, nhân quả, sinh tử, vinh nhục — tất cả đều sẽ trở thành một phần trên con đường của mỗi người.\\n\\nCòn ngươi, cũng chỉ là một người giữa Thương Mang chúng sinh. Không ai biết ngươi sẽ trở thành ai, cũng chẳng ai biết tên ngươi có được lưu lại trong cổ sử hay không.\\n\\nNhưng từ hôm nay, ngươi đã bước lên con đường mà những người như Tô Tịnh từng bước qua.\\n\\n**Thương Mang đã nổi phong vân. Tiên lộ lại mở. Và chương tiếp theo — do chính ngươi viết lấy.**',
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
                'Lăng Tiêu không nói tiếp.\n' +
                'Có vài chuyện, biết sớm hay muộn vốn chẳng khác nhau.\n' +
                 '*Tiên lộ còn dài. Căn cốt chỉ quyết định nơi ngươi bắt đầu.*';
    } else if (maxVal >= 70) {
      type = 'Địa'; color = 0x3498db; icon = '<:lcdia:1547929786402340935>';
      npcReac = '"Địa linh căn..."';
      npcStory = 'Linh quang dần lắng xuống, để lại một vệt sáng nhàn nhạt giữa lòng bàn tay.\n' +
                 '"Không tệ. Với căn cốt này, Đạo Hữu có thể đi rất xa."\n' +
                 'Lăng Tiêu dừng một thoáng, rồi nói tiếp:\n' +
                 '"Chỉ là đường xa hay gần, trước nay đâu phải do người khác định đoạt."\n' +
                 '*Căn cốt tốt là một chuyện. Giữ được mình trên tiên lộ lại là một chuyện khác.*';
    } else if (maxVal >= 40) {
      type = 'Nhân'; color = 0xbdc3c7; icon = '<:lcnhan:1547929784145813534>';
      npcReac = '"Nhân linh căn à..."';
      npcStory = 'Linh quang chỉ lóe lên trong chốc lát rồi trở về bình thường.\n' +
                 '"Bình bình phàm phàm."\n' +
                 'Không có thất vọng, cũng chẳng có vẻ xem nhẹ.\n' +
                 '"Nhưng Đạo Hữu, tiên lộ vốn chẳng hỏi xuất thân. Có người đi một bước đã ở trước vạn người, cũng có người đi hết nửa đời mới tìm được con đường của mình."\n' +
                 '*Đi được bao xa, cuối cùng vẫn phải tự mình bước.*';
    } else {
      type = 'Tạp'; color = 0x95a5a6; icon = '<:lctap:1547929782191128576>';
      npcReac = '"Tạp linh căn sao?"';
      npcStory = 'Linh quang chập chờn hồi lâu mới chịu tan.\n' +
                 'Lăng Tiêu im lặng rất lâu.\n' +
                 '"Đường này của Đạo Hữu sẽ khó đi hơn người khác."\n' +
                 'Chỉ một câu ấy, không an ủi, cũng chẳng thương hại.\n' +
                 'Một lúc sau, hắn mới nói:\n\n' +
                 '"Nhưng khó đi... không có nghĩa là không thể đi."\n' +
                 '*Cổ sử từng có người bắt đầu từ nơi này.*\n' +
                 '*Chuyện về sau thế nào, Đạo Hữu tự mình viết lấy.*';
    }

    const embed = new EmbedBuilder()
      .setTitle(`Đài Kiểm Tra Linh Căn`)
      .setColor(color)
      .setDescription(`Trưởng lão đặt tay lên trán ngươi. Một luồng sáng ${icon} lóe lên!\n\n**${npcReac}**\n*${npcStory}*`)
      .setFooter({ text: `Ngươi sở hữu ${type} Linh Căn.` });

    await interaction.editReply(toV2Payload([embed]));
    await new Promise(r => setTimeout(r, 10000));
  }

  private async stepChooseBackground(interaction: ChatInputCommandInteraction, name: string): Promise<(typeof BACKGROUNDS)[number] | null> {
    const embed = new EmbedBuilder()
      .setTitle('Bước 1: Xuất Thân Của Ngươi')
      .setColor(EMBED_COLORS.MYSTIC)
      .setDescription(`**${name}** — trước khi bước lên tiên lộ, trước hết phải biết mình từ đâu mà đến.\n` +
      `Thương Mang rộng lớn, chúng sinh vạn loại. Có người sinh giữa thế gia, ` +
      `có người bái nhập sư môn, cũng có kẻ chỉ mang một thân phàm cốt mà bước vào hồng trần.\n` +
      `Xuất thân không quyết định Đạo Hữu sẽ trở thành ai.\n` +
      `Nhưng con đường đã chọn, sẽ theo Đạo Hữu rất lâu.`)
      .addFields(
        ...BACKGROUNDS.map(b => ({
          name: `${b.emoji} ${b.name}`,
          value: 
          `${b.description}\n` +
          `${b.bonuses.hp ? `<:ihp:1547865965998379048> +${b.bonuses.hp} HP` : ''}` +
          `${b.bonuses.atk ? ` <:iiatk:1547935869602631680> +${b.bonuses.atk} ATK` : ''}` +
          `${b.bonuses.def ? ` <:idef:1547935867149099083> +${b.bonuses.def} DEF` : ''}` +
          `${b.bonuses.expRate ? ` <:iexp:1547935874077954078> +${b.bonuses.expRate}% EXP` : ''}` +
          `${b.bonuses.lt ? ` <:lt1:1547866122123218945> +${b.bonuses.lt} LT` : ''}` +
          `${b.bonuses.knb ? ` <:lt2:1547866118817845309> +${b.bonuses.knb} CPLT` : ''}`,,
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
      .setFooter({ text: '— Xem ra Đạo Hữu đã chọn được con đường mình muốn đi về sau rồi...' });
    await interaction.editReply(toV2Payload([storyEmbed], [] ));

    // Brief delay for dramatic effect
    await new Promise(r => setTimeout(r, 6000));
    return background;
  }

  private async stepChooseDestiny(interaction: ChatInputCommandInteraction, name: string, background: (typeof BACKGROUNDS)[number]): Promise<(typeof DESTINIES)[number] | null> {
    const embed = new EmbedBuilder()
      .setTitle('Bước 2: Định Mệnh Của Ngươi')
      .setColor(EMBED_COLORS.ERROR)
      .setDescription(`Xuất thân chỉ nói cho ngươi biết mình từ đâu mà đến.\n` +
  `Còn từ đây, con đường sẽ do chính ngươi chọn lấy.\n\n` +
  `Có những con đường nhìn tưởng bằng phẳng, nhưng phía cuối chưa chắc có lối ra.` +
  ` Có những con đường đầy chông gai, vậy mà lại dẫn đến nơi người khác cả đời cũng chẳng thể đặt chân tới.\n\n` +
  `Đạo Hữu hãy chọn cho mình một Định Mệnh.`)
      .addFields(
        ...DESTINIES.map(d => ({
          name: `${d.emoji} ${d.name}`,
          value:       
            `${d.description}\n` +
            `✨ ${Object.entries(d.bonuses)
              .map(([k, v]) => `+${v}% ${k.replace('Percent', '').replace('Rate', '')}`)
              .join(', ')}\n` +
            `⚠️ ${Object.entries(d.penalties)
              .map(([k, v]) => `-${v}% ${k.replace('Percent', '').replace('Rate', '')}`)
              .join(', ')}`,
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
        .setFooter({ text: '📖 Hãy dùng lệnh /camnang để xem Cẩm Nang Tiên Lộ hướng dẫn tân thủ!' })
        .setTimestamp();

      await interaction.editReply(toV2Payload([embed]));

    } catch (error) {
      console.error('Lỗi tạo nhân vật:', error);
      await interaction.editReply(toV2TextUpdate('❌ Lỗi hệ thống khi khai sinh nhân vật. Xin thử lại!'));
    }
  }
}
