import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { combatService } from '../../services/CombatService';
import { bossSeasonService } from '../../services/BossSeasonService';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { getProgressBar } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';
import { ITEMS } from '../../config/itemConstants';
import db from '../../database/database';

/**
 * Tạo Embed hiển thị thông tin World Boss hiện tại
 */
export function getWorldBossEmbed(userId: string): EmbedBuilder {
  const boss = combatService.getCurrentBoss();
  const user = userRepository.get(userId);

  const embed = new EmbedBuilder()
    .setTitle(`👹 World Boss: ${boss.name} (Cấp ${boss.level})`)
    .setColor(boss.status === 'active' ? EMBED_COLORS.ERROR : EMBED_COLORS.NEUTRAL)
    .setTimestamp();

  if (boss.status === 'active') {
    const hpBar = getProgressBar(boss.hp, boss.maxHp, 15);
    embed.setDescription(
      `Thiên địa linh khí chấn động, yêu ma viễn cổ phá phong ấn bước ra tàn phá chúng sinh! Chư vị đạo hữu hãy đồng lòng trảm ma cứu thế!\n\n` +
      `❤️ **Sinh Lực Boss:** ${hpBar} (${boss.hp}/${boss.maxHp})\n` +
      `⚔️ **Công Kích:** ${boss.atk} | 🛡️ **Phòng Thủ:** ${boss.def}\n\n` +
      `*Tham gia đánh Boss nhận Tu Vi, Linh Thạch, Boss Point (BP) và có cơ hội nhận Rương hiếm!*`
    );
  } else {
    embed.setDescription(
      `💀 **World Boss đã bị tiêu diệt!**\n\n` +
      `• Người ra đón kết liễu: <@${boss.defeatedBy}>\n` +
      `• Thời gian hồi sinh boss tiếp theo: **${boss.respawnTimeRemaining || 0} giây**.\n\n` +
      `*Linh hồn Boss tiếp theo sẽ ngưng tụ ở Cấp Độ cao hơn và mạnh hơn vượt trội!*`
    );
  }

  // BXH season
  const season = bossSeasonService.getCurrentSeason();
  if (season) {
    embed.addFields({
      name: `🏆 Mùa ${season.season_number} — Còn ${season.days_left} ngày`,
      value: `Đã tiêu diệt **${season.total_kills}** boss${season.top_player ? `\nTop sát thương: <@${season.top_player}> (${season.top_damage} dmg)` : ''}`
    });
  }

  // Boss Points của người chơi
  if (user) {
    const bp = user.boss_points || 0;
    embed.addFields({
      name: '⭐ Boss Point (BP)',
      value: `Đạo hữu hiện có: **${bp}** BP — Dùng đổi Rương Boss, Vé Bí Cảnh, Nguyên liệu hiếm tại shop!`
    });
  }

  // Lấy danh sách Top cống hiến sát thương
  const contribs = combatService.getBossContributions();
  if (contribs.length > 0) {
    const leaderboardText = contribs
      .map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';
        return `${medal} **Hạng ${i + 1}**: ${c.name} — **${c.damage}** sát thương (${c.attacks} lần)`;
      })
      .join('\n');
    embed.addFields({ name: '📊 BXH Sát Thương Vòng Này', value: leaderboardText });
  } else {
    embed.addFields({ name: '📊 BXH Sát Thương Vòng Này', value: '*Chưa có tu sĩ nào gây sát thương lên boss.*' });
  }

  // Mốc đóng góp (hiển thị cho người chơi)
  if (user && boss.status === 'active') {
    embed.addFields({
      name: '🎯 Mốc Thưởng',
      value: `Tham gia → **5 BP** | 1% dmg → **+3 BP** | 3% → **+5 BP** | 5% → **+10 BP** | 10% → **+15 BP** | 15% → **+20 BP** | 20% → **+30 BP**`
    });
  }

  // Trạng thái cooldown của người chơi
  if (user && boss.status === 'active') {
    const now = Math.floor(Date.now() / 1000);
    const contrib = db.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
      .get(userId) as { last_attack_at: number } | undefined;

    let cdSec = 0;
    if (contrib) {
      const elapsed = now - contrib.last_attack_at;
      if (elapsed < 200) {
        cdSec = 200 - elapsed;
      }
    }

    if (cdSec > 0) {
      embed.addFields({ 
        name: '⏳ Trạng Thái Trấn Nạp Linh Khí', 
        value: `Đạo hữu đang kiệt sức điều khí. Cần **${cdSec} giây** để hồi phục.` 
      });
    } else {
      embed.addFields({ 
        name: '⏳ Trạng Thái', 
        value: `🟢 **Sẵn sàng xuất chiêu!**` 
      });
    }
  }

  return embed;
}

/**
 * Tạo các nút hành động cho World Boss
 */
export function getWorldBossComponents(userId: string): ActionRowBuilder<ButtonBuilder> {
  const boss = combatService.getCurrentBoss();
  const row = new ActionRowBuilder<ButtonBuilder>();

  const isBossDead = boss.status === 'defeated';
  const now = Math.floor(Date.now() / 1000);
  
  const contrib = db.prepare("SELECT last_attack_at FROM world_boss_contributions WHERE user_id = ? AND boss_id = 'world_boss_current'")
    .get(userId) as { last_attack_at: number } | undefined;

  let cdSec = 0;
  if (contrib) {
    const elapsed = now - contrib.last_attack_at;
    if (elapsed < 200) {
      cdSec = 200 - elapsed;
    }
  }

  const isCd = cdSec > 0;

  // Nút Tấn công Miễn phí
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`worldbossattack_${userId}_free`)
      .setLabel(isCd ? `⚔️ CD Tấn Công (${cdSec}s)` : '⚔️ Khiêu Chiến Boss')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isBossDead || isCd),

    // Nút Làm mới / Refresh
    new ButtonBuilder()
      .setCustomId(`worldbossrefresh_${userId}`)
      .setLabel('🔄 Làm Mới')
      .setStyle(ButtonStyle.Secondary)
  );

  // Nút shop
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`bossshop_${userId}`)
      .setLabel('🏪 Boss Shop')
      .setStyle(ButtonStyle.Primary)
  );

  return row;
}

// ── Boss Point Shop ──

interface BossShopItem {
  key: string;
  itemId: string;
  name: string;
  cost: number;
  qty: number;
  desc: string;
}

// ponytail: giá cân bằng theo BP thực tế (top ~50 BP/kill, casual ~8 BP/kill)
// Boss respawn liên tục, BP tích luỹ dần — giá cao để BP có giá trị lâu dài
const BOSS_SHOP_ITEMS: BossShopItem[] = [
  { key: 'chest',  itemId: ITEMS.SERVER_RAID_CHEST, name: 'Rương Boss Thế Giới', cost: 3000, qty: 1, desc: 'Mở ra nhận trang bị S~EX' },
  { key: 'lucky',  itemId: ITEMS.LUCKY_CHEST,       name: 'Rương Cơ Duyên',      cost: 1000, qty: 1, desc: 'Mở ra nhận phôi F~SSS' },
  { key: 'lenh',   itemId: ITEMS.LENH_BAI,           name: 'Lệnh Bài Bí Cảnh',   cost: 2000, qty: 1, desc: 'Vào bí cảnh săn boss' },
  { key: 'stamina',itemId: ITEMS.PILL_ALCHEMY_STAMINA,name: 'Bổ Thiên Đan x5',    cost: 500,  qty: 5, desc: 'Hồi 20 thể lực/viên' },
  { key: 'coin',   itemId: '',                       name: 'Linh Thạch 10000',   cost: 500,  qty: 0, desc: 'Quy đổi ra linh thạch' },
  { key: 'shard',  itemId: ITEMS.TINH_THACH_SHARD,   name: 'Mảnh Tinh Thạch x5',  cost: 400,  qty: 5, desc: 'Nguyên liệu cường hóa' },
  { key: 'nhan',   itemId: ITEMS.MATERIAL_NHAN_SAM_1,name: 'Huyết Nhân Sâm x10',  cost: 400,  qty: 10, desc: 'Nguyên liệu luyện đan' },
];

export function getBossShopEmbed(userId: string, message?: string): EmbedBuilder {
  const user = userRepository.get(userId);
  const bp = user?.boss_points || 0;
  const lines = BOSS_SHOP_ITEMS.map(item =>
    `• **${item.name}** — **${item.cost}** BP\n${item.desc}`
  );
  const embed = new EmbedBuilder()
    .setTitle('🏪 Boss Point Shop')
    .setColor(EMBED_COLORS.GOLD)
    .setDescription(
      `⭐ **BP hiện có:** **${bp}**\n\n` +
      lines.join('\n\n')
    )
    .setFooter({ text: 'Chọn vật phẩm bên dưới để đổi.' });
  if (message) embed.setDescription(`${message}\n\n${embed.data.description}`);
  return embed;
}

export function getBossShopComponents(userId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const user = userRepository.get(userId);
  const bp = user?.boss_points || 0;
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`bossshop_buy_${userId}`)
    .setPlaceholder('Chọn vật phẩm muốn đổi...');

  for (const item of BOSS_SHOP_ITEMS) {
    const canAfford = bp >= item.cost;
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${item.name} — ${item.cost} BP`)
        .setDescription(`${canAfford ? '✅ ' : '❌ '}${item.desc}${canAfford ? '' : ' (Không đủ BP)'}`)
        .setValue(item.key)
    );
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function handleBossShopPurchase(userId: string, itemKey: string): { success: boolean; message: string } {
  const item = BOSS_SHOP_ITEMS.find(i => i.key === itemKey);
  if (!item) return { success: false, message: 'Vật phẩm không tồn tại.' };

  const user = userRepository.get(userId);
  if (!user) return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };

  const bp = user.boss_points || 0;
  if (bp < item.cost) return { success: false, message: `Không đủ BP! Cần **${item.cost}** BP, hiện có **${bp}** BP.` };

  userRepository.update(userId, { boss_points: bp - item.cost });

  if (item.key === 'coin') {
    userRepository.update(userId, { coin_ha_pham: (user.coin_ha_pham || 0) + 10000 });
  } else {
    inventoryRepository.addItem(userId, item.itemId, item.qty);
  }

  return { success: true, message: `✅ Đã đổi **${item.name}** thành công! (-**${item.cost}** BP)` };
}

export default class WorldBossCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('worldboss')
        .setDescription('Xem trạng thái và khiêu chiến Boss Thế Giới.')
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    const user = userRepository.get(userId);
    if (!user) {
      await interaction.editReply({
        content: '❌ Đạo hữu chưa khởi tạo nhân vật! Hãy sử dụng lệnh `/taonhanvat` để bước vào con đường tu đạo.'
      });
      return;
    }

    const embed = getWorldBossEmbed(userId);
    const row = getWorldBossComponents(userId);

    await interaction.editReply(toV2Payload([embed], [row]));
  }
}
