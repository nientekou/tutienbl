import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository, UserEntity } from '../../database/repositories/UserRepository';
import { getRealmDetails, getProgressBar, formatLinhCan, formatNumber, formatStatDiff } from '../../utils/constants';
import { EMBED_COLORS, toV2Payload, type EmbedColor } from '../../utils/uiSystem';
import { inventoryRepository, InventoryItem } from '../../database/repositories/InventoryRepository';
import { achievementService } from '../../services/AchievementService';
import { inventoryService, ActiveStats } from '../../services/InventoryService';
import { mountService } from '../../services/MountService';
import { spiritWeaponService } from '../../services/SpiritWeaponService';
import { bloodlineService } from '../../services/BloodlineService';
import { leaderboardService } from '../../services/LeaderboardService';
import db from '../../database/database';

export type HoSoTab = 'chiso' | 'taisan' | 'chientich' | 'trangbi' | 'linhthu' | 'somenh' | 'bangxephang' | 'thongke';

const TAB_LABELS: Record<HoSoTab, { name: string; emoji: string }> = {
  chiso: { name: 'Chỉ Số', emoji: '📊' },
  taisan: { name: 'Tài Sản', emoji: '🪙' },
  chientich: { name: 'Chiến Tích', emoji: '🏆' },
  trangbi: { name: 'Trang Bị', emoji: '⚔️' },
  linhthu: { name: 'Linh Thú', emoji: '🐉' },
  somenh: { name: 'Số Mệnh', emoji: '📜' },
  bangxephang: { name: 'Bảng Phong Thần', emoji: '👑' },
  thongke: { name: 'Thống Kê', emoji: '📈' },
};

const SLOT_EMOJI: Record<string, string> = {
  weapon: '<:bcp:1547865914744115200>', armor: '<:itp:1547883759527792710>', ring: '<:nhannt:1547865903310307338>', necklace: '<:ivc:1547951691242938490>', amulet: '<:buatk:1547865909534654474>', mount: '<:itoaky:1547955958309847061>', treasure: '<:ic:1547865958431985714>',
};

function getDayGreeting(): string {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 3600000);
  const h = vnTime.getUTCHours();
  if (h < 6) return '🌙 Khuya rồi mà vẫn tu luyện sao?';
  if (h < 12) return '🌅 Sớm mai an lành, chúc đạo hữu tu tiên tấn tới!';
  if (h < 18) return '☀️ Trời đẹp, đạo hữu nên đi khám phá dã ngoại!';
  return '🌆 Hoàng hôn buông xuống, linh khí dồi dào, thích hợp thiền định.';
}

const TITLE_BUFFS: Record<string, string> = {
  'Thiên Trụ': '<:ihp:1547865965998379048> HP +5%, <:iiatk:1547935869602631680> ATK +5%, <:idef:1547935867149099083> DEF +5%',
  'Thánh Địa Bá Chủ': '<:iiatk:1547935869602631680> ATK +5%',
  'Chiến Thần Vô Song': '<:iiatk:1547935869602631680> ATK +8%',
  'Truyền Thừa Danh Môn': '<:idef:1547935867149099083> DEF +5%',
};

function getTitleLine(user: UserEntity): string {
  const title = user.title || 'Tán Tu';
  const buff = title !== 'Tán Tu' && TITLE_BUFFS[title] ? ` *(Buff: ${TITLE_BUFFS[title]})*` : '';
  return `🏆 **Danh hiệu:** **${title}**${buff}`;
}

function getChiSoTabEmbed(user: UserEntity, activeStats: ActiveStats | null): EmbedBuilder {
  const realmInfo = getRealmDetails(user.level);
  const progressBar = getProgressBar(user.tu_vi, user.exp_needed);
  const formattedLinhCan = formatLinhCan(user.linh_can);
  const speed = user.base_speed ?? 100;
  const dodge = user.base_dodge ?? 0.05;

  const baseCp = Math.round(
    user.base_hp * 0.2 + user.base_mp * 0.1 + user.base_atk * 3 + user.base_def * 5 +
    user.base_crit * 1000 + user.base_crit_res * 1000 + user.base_luck * 10 +
    speed * 10 + dodge * 1000
  );

  const activeMount = mountService.getActiveMount(user.discord_id);
  const spiritWeapons = spiritWeaponService.getSpiritWeapons(user.discord_id);
  const activePet = db.prepare('SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1').get(user.discord_id) as any;
  const userBloodline = bloodlineService.getUserBloodline(user.discord_id);
  
  const { caveService } = require('../../services/CaveService');
  const cave = caveService.getCave(user.discord_id);
  const springLvl = cave.spring_level || 1;
  const meridianLvl = cave.meridian_level || 0;
  const arrayLvl = cave.array_level || 0;

  let mountLine = '<:itoaky:1547955958309847061> Tọa kỵ: *Chưa cưỡi*';
  if (activeMount) {
    mountLine = `<:itoaky:1547955958309847061> Tọa kỵ: **${activeMount.name}** (Tốc +${Math.round(activeMount.speed_bonus * 100)}% • TK +${Math.round(activeMount.stamina_save * 100)}%)`;
  }

  let spiritLine = '<:ngotinh:1547877042232496138> Khí linh: *Chưa thức tỉnh*';
  if (spiritWeapons.length > 0) {
    const sw = spiritWeapons[0];
    spiritLine = `<:ngotinh:1547877042232496138> Khí linh: **${sw.spirit_name}** (Cấp ${sw.level} • Thân thiết ${sw.affinity})`;
  }

  let petLine = '<:ilt:1547950632562982994> Sủng thú: *Chưa phái ra trận*';
  if (activePet) {
    const rarityEmoji: Record<string, string> = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
    petLine = `<:ilt:1547950632562982994> Sủng thú: ${rarityEmoji[activePet.rarity] || '⚪'} **${activePet.name}** (Cấp ${activePet.level})`;
  }

  let bloodlineLine = '🩸 Huyết mạch: *Chưa giác tỉnh*';
  if (userBloodline) {
    bloodlineLine = `🩸 Huyết mạch: **${userBloodline.name}** (Cấp ${userBloodline.level})`;
  }

  const greeting = getDayGreeting();
  const showCp = activeStats ? Math.round(
    activeStats.hp * 0.2 + activeStats.mp * 0.1 + activeStats.atk * 3 + activeStats.def * 5 +
    activeStats.crit * 1000 + activeStats.critRes * 1000 + activeStats.luck * 10 +
    activeStats.speed * 10 + activeStats.dodge * 1000
  ) : baseCp;

  let alignmentStr = 'Tán Tu ⚪';
  if (user.alignment === 'orthodox') alignmentStr = 'Chính Đạo ⚖️';
  else if (user.alignment === 'demonic') alignmentStr = 'Ma Đạo 👿';

  const embed = new EmbedBuilder()
    .setTitle(`<:inv:1547865980854599693> HỒ SƠ TU SĨ - ${user.name}`)
    .setColor(EMBED_COLORS.PRIMARY)
    .setDescription(
      `*${greeting}*\n\n` +
      `<:inv:1547865980854599693> Đạo Hiệu: **${user.name}**\n` +
      `${getTitleLine(user)}\n` +
      `<:ida:1547865990216417392> Tiên Lực (Lực Chiến): **${formatNumber(showCp)}**` +
      (user.luan_hoi_count > 0 ? `\n🌀 **Luân Hồi:** **Chuyển Thế Đời thứ ${user.luan_hoi_count}**` : '')
    )
    .addFields(
      {
        name: '📈 Tiến Trình Tu Vi',
        value: `${progressBar}\n🎯 **EXP:** **${formatNumber(user.tu_vi)}** / **${formatNumber(user.exp_needed)}**`,
        inline: false,
      },
      {
        name: '### ✨ Trạng Thái',
        value: [
          `\nCảnh giới: **${realmInfo.fullName}**`,
          `Đạo Thống: **${alignmentStr}**`,
          `Ngộ Tính: **${user.ngotinh}**`,
          `Thể Lực: **${user.stamina}/500**`,
          `May Mắn: **${user.base_luck}**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '### <:lc01:1547878586000875550> Căn Cơ Linh Căn',
        value: [ '',
          formattedLinhCan,],
        inline: true,
      },
      ...(activeStats?.elementResonance?.resonance ? [{
        name: `⚡ Cộng Hưởng Linh Căn (${activeStats.elementResonance.element})`,
        value: `📍 **Đã kích hoạt!**\n${activeStats.elementResonance.buffs.map(b => `• ${b}`).join('\n')}`,
        inline: true,
      }] : []),
      {
        name: '### <:idrole:1547865936848101456> Đồng Hành & Động Phủ',
        value: [
          '',
          petLine,
          bloodlineLine,
          mountLine,
          spiritLine,
          `<:dongphu:1547957254341263430> Động Phủ: **Cấp ${cave.level}** (Linh Tuyền Lvl ${springLvl} | Linh Mạch Lvl ${meridianLvl} | Trận Lvl ${arrayLvl})`
        ].join('\n'),
        inline: false,
      }
    );

  if (user.partner_id) {
    const partner = userRepository.get(user.partner_id);
    if (partner) {
      embed.addFields({
        name: '💖 Đạo Lữ',
        value: `**${partner.name}** • Thân mật: **${user.intimacy}** 🌸`,
        inline: false,
      });
    }
  }

  if (activeStats) {
    embed.spliceFields(0, 0, {
      name: '### <:sotay:1547883761776197632> Chỉ Số Chiến Đấu (Cơ Bản → Kèm Đồ)',
      value: [
        `\nSinh Mệnh (HP): ${formatStatDiff(user.base_hp, activeStats.hp)}`,
        `Pháp Lực (MP): ${formatStatDiff(user.base_mp, activeStats.mp)}`,
        `Tấn Công (ATK): ${formatStatDiff(user.base_atk, activeStats.atk)}`,
        `Phòng Ngự (DEF): ${formatStatDiff(user.base_def, activeStats.def)}`,
        `Bạo Kích (CRIT): ${formatStatDiff(Math.round(user.base_crit * 1000) / 10, Math.round(activeStats.crit * 1000) / 10, '%')} | **Kháng Bạo:** ${formatStatDiff(Math.round(user.base_crit_res * 1000) / 10, Math.round(activeStats.critRes * 1000) / 10, '%')}`,
        `Tốc Độ (SPD): ${formatStatDiff(user.base_speed ?? 100, activeStats.speed)} | **Né Tránh:** ${formatStatDiff(Math.round((user.base_dodge ?? 0.05) * 1000) / 10, Math.round(activeStats.dodge * 1000) / 10, '%')}`,
        `May Mắn (LUCK): ${formatStatDiff(user.base_luck, activeStats.luck)}`,
      ].join('\n'),
      inline: false,
    });
  } else {
    embed.spliceFields(0, 0, {
      name: '<:sotay:1547883761776197632> Chỉ Số Chiến Đấu Cơ Bản',
      value: [
        `**Sinh Mệnh (HP):** **${formatNumber(user.base_hp)}** | **Pháp Lực (MP):** **${formatNumber(user.base_mp)}**`,
        `**Tấn Công (ATK):** **${formatNumber(user.base_atk)}** | **Phòng Ngự (DEF):** **${formatNumber(user.base_def)}**`,
        `**Bạo Kích (CRIT):** **${(user.base_crit * 100).toFixed(1)}%** | **Kháng Bạo:** **${(user.base_crit_res * 100).toFixed(1)}%**`,
        `**Tốc Độ (SPD):** **${speed}** | **Né Tránh:** **${(dodge * 100).toFixed(1)}%**`,
        `**May Mắn (LUCK):** **${user.base_luck}**`,
      ].join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: '<:sotay:1547883761776197632> Xem Cẩm Nang Tiên Lộ với /camnang' });
  return embed;
}

function getTaiSanTabEmbed(user: UserEntity): EmbedBuilder {
  const inv = inventoryRepository.getUserInventory(user.discord_id);
  const equippedCount = inv.filter(i => i.is_equipped === 1).length;
  const totalItems = inv.reduce((sum, i) => sum + i.quantity, 0);

  const totalWealth = user.coin_ha_pham +
    user.coin_trung_pham * 100 +
    user.coin_thuong_pham * 10000 +
    user.knb * 10000;

  let sectInfo = '🚫 Chưa gia nhập';
  if (user.sect_id) {
    const sect = db.prepare('SELECT name, level FROM sects WHERE id = ?').get(user.sect_id) as any;
    if (sect) sectInfo = `<:sotay:1547883761776197632> **${sect.name}** (Cấp ${sect.level}) • Cống hiến: **${formatNumber(user.sect_contribution)}**`;
  }

  const materialCount = inv.filter(i => i.type === 'material').reduce((s, i) => s + i.quantity, 0);
  const pillCount = inv.filter(i => i.type === 'pill').reduce((s, i) => s + i.quantity, 0);
  const equipmentCount = inv.filter(i => i.type === 'equipment').length;
  const chestCount = inv.filter(i => i.type === 'chest').reduce((s, i) => s + i.quantity, 0);

  const mountCount = db.prepare('SELECT COUNT(*) as c FROM mounts WHERE user_id = ?').get(user.discord_id) as any;
  const spiritCount = db.prepare('SELECT COUNT(*) as c FROM spirit_weapons WHERE user_id = ?').get(user.discord_id) as any;

  return new EmbedBuilder()
    .setTitle(`<:tvp1:1547866133242056704> TÀI SẢN - ${user.name}`)
    .setColor(EMBED_COLORS.GOLD)
    .setDescription(`*Tổng tài sản quy đổi:* **${formatNumber(totalWealth)}** Hạ Phẩm Linh Thạch <:lt1:1547866122123218945> `)
    .addFields(
      {
        name: '### <:tvp1:1547866133242056704> Linh Thạch & Cực Phẩm Linh Thạch',
        value: [
          `\n🟤 Hạ Phẩm: **${formatNumber(user.coin_ha_pham)}** LT`,
          `⚪ Trung Phẩm: **${formatNumber(user.coin_trung_pham)}** LT`,
          `🟡 Thượng Phẩm: **${formatNumber(user.coin_thuong_pham)}** LT`,
          `<:lt2:1547866118817845309> **Cực Phẩm Linh Thạch:** **${formatNumber(user.knb)}** CPLT`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '### <:tvp1:1547866133242056704> Hành Trang',
        value: [
          `\n<:a1:1547866004573392926> **Tổng số:** **${formatNumber(totalItems)}** món`,
          `<:idef:1547935867149099083> **Trang bị mặc:** **${equippedCount}** món`,
          `<:tt1:1547866327144734730> **Nguyên liệu:** **${formatNumber(materialCount)}** món`,
          `<:dan:1547866099339624458> **Đan dược:** **${formatNumber(pillCount)}** món`,
          `<:a1:1547866004573392926> **Rương đạo cụ:** **${formatNumber(chestCount)}** cái`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '### <:ilt:1547950632562982994> Linh Thú & Tọa Kỵ',
        value: [
          `\nㅤ└<:itoaky:1547955958309847061> **Tọa kỵ:** **${mountCount?.c || 0}** con`,
          `ㅤ└<:ngotinh:1547877042232496138> **Khí linh:** **${spiritCount?.c || 0}** pháp bảo`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '### ☯️ Tông Môn',
        value: sectInfo,
        inline: false,
      }
    )
    .setFooter({ text: 'Dùng /tuido để xem chi tiết | /vanbaolau để giao dịch' })
    .setTimestamp();
}

function getChienTichTabEmbed(user: UserEntity): EmbedBuilder {
  const completedAchievements = achievementService.countCompleted(user.discord_id);
  const totalAchievements = achievementService.getAllAchievements().length;

  const petData = db.prepare(
    'SELECT name, level, rarity, base_atk FROM pets WHERE user_id = ? AND is_deployed = 1'
  ).get(user.discord_id) as any;

  const petCount = db.prepare(
    'SELECT COUNT(*) as c FROM pets WHERE user_id = ?'
  ).get(user.discord_id) as { c: number };

  const pvpWins = user.pvp_wins || 0;
  const pvpLosses = user.pvp_losses || 0;
  const totalGames = pvpWins + pvpLosses;
  const winRate = totalGames > 0 ? Math.round((pvpWins / totalGames) * 100) : 0;

  let winRateBar = '';
  if (winRate > 0) {
    const filled = Math.round(winRate / 10);
    winRateBar = `\`[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]\` **${winRate}%**`;
  }

  let activePetDesc = '🚫 Chưa có';
  if (petData) {
    const rarityEmoji: Record<string, string> = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
    activePetDesc = `${rarityEmoji[petData.rarity] || '⚪'} **${petData.name}** (Cấp ${petData.level}) • Tấn công: **${petData.base_atk}**`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 CHIẾN TÍCH - ${user.name}`)
    .setColor(EMBED_COLORS.ERROR)
    .setDescription(`*Hành trình tu đạo của* **${user.name}** *qua những con số*`)
    .addFields(
      {
        name: '### <:iiatk:1547935869602631680> Chiến Trường PvP',
        value: [
          `\n🎖️ **Điểm Phong Thần:** **${formatNumber(user.pvp_points)}**`,
          `🔥 **Thắng trận:** **${formatNumber(pvpWins)}** | 💀 **Thất bại:** **${formatNumber(pvpLosses)}**`,
          winRateBar ? `<:sotay:1547883761776197632> **Tỷ lệ thắng:** ${winRateBar}` : '',
        ].filter(Boolean).join('\n'),
        inline: true,
      },
      {
        name: '### 🏆 Thành Tựu & Danh Hiệu',
        value: [
          `\n<:sotay:1547883761776197632> **Tiến độ:** **${completedAchievements}/${totalAchievements}** (${totalAchievements > 0 ? Math.round((completedAchievements / totalAchievements) * 100) : 0}%)`,
          `🎖️ **Danh hiệu đã mở:** **${achievementService.getUserTitles(user.discord_id).length}**`,
          `\n*Dùng \`/thanhtuu\` để xem chi tiết*`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '### 🌀 Luân Hồi & Sủng Thú',
        value: [
          `\n🌀 **Luân hồi:** **${user.luan_hoi_count}** lần`,
          `<:ilt:1547950632562982994> **Linh thú sở hữu:** **${petCount?.c || 0}** con`,
          `<:ilt:1547950632562982994> **Đang xuất chiến:** ${activePetDesc}`,
          `<:lc1:1547866362511368212> **Ngộ Tính tích lũy:** **${formatNumber(user.ngotinh)}** điểm`,
          `🌌 **Ý Cảnh đại đạo:** **${(() => { try { const y = JSON.parse(user.y_canh || '{}'); return Object.keys(y).filter(k => ['KiemY', 'BatDietY', 'HuyenQuyY'].includes(k)).length; } catch { return 0; }})()}** loại`,
        ].join('\n'),
        inline: false,
      },
      // W9-03: Extended stats
      {
        name: '### <:sotay:1547883761776197632> Thống Kê Mở Rộng\n',
        value: (() => {
          const stats: string[] = [];
          // Tower
          try {
            const tower = db.prepare('SELECT max_floor FROM roguelike_progress WHERE user_id = ?').get(user.discord_id) as any;
            if (tower) stats.push(`<:thap:1547954692116451358> **Tháp cao nhất:** Tầng **${tower.max_floor}**`);
          } catch {}
          // Beast collection
          try {
            const beastCount = db.prepare('SELECT COUNT(DISTINCT beast_type) as c FROM rare_beasts WHERE user_id = ?').get(user.discord_id) as any;
            if (beastCount) stats.push(`<:ilt:1547950632562982994> **Linh thú hiếm:** **${beastCount.c}** loại`);
          } catch {}
          // Dream Dust
          stats.push(`✨ **Mộng Cát:** **${formatNumber(user.dream_dust || 0)}**`);
          // Bounty tokens
          stats.push(`<:tk1:1547866139856732190> **Phiếu Săn Thưởng:** **${formatNumber(user.bounty_tokens || 0)}**`);
          // Destiny shards
          stats.push(`<:menhcach:1547981230023245834> **Mảnh Mệnh Cách:** **${formatNumber(user.destiny_shards || 0)}**`);
          // Reincarnation tokens
          stats.push(`<:phieuvan:1547865894162661386> **Phiếu Luân Hồi:** **${formatNumber(user.reincarnation_tokens || 0)}**`);
          return stats.join('\n') || 'Chưa có thống kê';
        })(),
        inline: false,
      }
    )
    .setFooter({ text: 'Tiếp tục tu luyện để mở thêm thành tựu!' })
    .setTimestamp();

  return embed;
}

function getTrangBiTabEmbed(user: UserEntity): EmbedBuilder {
  const equippedItems = db.prepare(`
    SELECT i.*, t.name, t.rarity, t.description
    FROM inventories i
    JOIN items t ON i.item_id = t.id
    WHERE i.user_id = ? AND i.is_equipped = 1
  `).all(user.discord_id) as any[];

  const slotOrder = ['weapon', 'armor', 'ring', 'necklace', 'amulet', 'mount', 'treasure'];
  const slotNames: Record<string, string> = {
    weapon: 'Vũ Khí', armor: 'Đạo Bào', ring: 'Nhẫn', necklace: 'Dây Chuyền',
    amulet: 'Bùa Hộ Mệnh', mount: 'Tọa Kỵ', treasure: 'Pháp Bảo',
  };
  const rarityColor: Record<string, string> = {
    common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '🔴',
  };

  const embed = new EmbedBuilder()
    .setTitle(`<:iiatk:1547935869602631680> TRANG BỊ - ${user.name}`)
    .setColor(EMBED_COLORS.DARK_PURPLE)
    .setDescription('*Các trang bị đang mặc trên người:*')
    .setTimestamp();

  for (const slot of slotOrder) {
    const item = equippedItems.find((i: any) => i.equipment_slot === slot);
    if (item) {
      const stats = item.custom_stats ? (() => { try { return JSON.parse(item.custom_stats); } catch { return {}; } })() : {};
      const statParts: string[] = [];
      if (stats.atk) statParts.push(`Công +${stats.atk}`);
      if (stats.def) statParts.push(`Thủ +${stats.def}`);
      if (stats.hp) statParts.push(`HP +${stats.hp}`);
      if (stats.mp) statParts.push(`MP +${stats.mp}`);
      const starStr = item.stars > 0 ? '⭐'.repeat(item.stars) : '';
      const enhanceStr = item.enhance_level > 0 ? ` (+${item.enhance_level})` : '';
      embed.addFields({
        name: `${SLOT_EMOJI[slot] || '<:a1:1547866004573392926>'} ${slotNames[slot] || slot}`,
        value: `\`[Mã: ${item.id}]\` ${rarityColor[item.rarity] || '⚪'} **${item.name}${enhanceStr}** ${starStr}\n*${statParts.join(' | ') || 'Không có chỉ số phụ'}*`,
        inline: true,
      });
    } else {
      embed.addFields({
        name: `${SLOT_EMOJI[slot] || '<:a1:1547866004573392926>'} ${slotNames[slot] || slot}`,
        value: '🍃 *Chưa trang bị*',
        inline: true,
      });
    }
  }

  embed.setFooter({ text: 'Dùng /trangbi để quản lý | /tuido để xem kho đồ' });
  return embed;
}

function getLinhThuTabEmbed(user: UserEntity): EmbedBuilder {
  const activeMount = mountService.getActiveMount(user.discord_id);
  const allMounts = mountService.getMounts(user.discord_id);
  const spiritWeapons = spiritWeaponService.getSpiritWeapons(user.discord_id);
  const activePet = db.prepare(
    'SELECT * FROM pets WHERE user_id = ? AND is_deployed = 1'
  ).get(user.discord_id) as any;
  const allPets = db.prepare(
    'SELECT * FROM pets WHERE user_id = ? ORDER BY level DESC'
  ).all(user.discord_id) as any[];
  const userBloodline = bloodlineService.getUserBloodline(user.discord_id);

  const rarityEmoji: Record<string, string> = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };

  const embed = new EmbedBuilder()
    .setTitle(`<:ilt:1547950632562982994> LINH THÚ & HUYẾT MẠCH - ${user.name}`)
    .setColor(EMBED_COLORS.SUCCESS)
    .setDescription('*Các linh thú, tọa kỵ, khí linh và huyết mạch đang đồng hành cùng đạo hữu*')
    .setTimestamp();

  // Active pet
  if (activePet) {
    let mut = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
    try {
      if (activePet.mutations) {
        mut = JSON.parse(activePet.mutations);
      }
    } catch (e) {}

    const starStr = mut.stars > 0 ? ` [${'★'.repeat(mut.stars)}]` : '';
    const bonusAtk = mut.bonus_atk > 0 ? ` (+${mut.bonus_atk})` : '';
    const bonusDef = mut.bonus_def > 0 ? ` (+${mut.bonus_def})` : '';
    const bonusHp = mut.bonus_hp > 0 ? ` (+${mut.bonus_hp})` : '';

    embed.addFields({
      name: `<:ilt:1547950632562982994> Sủng Thú Đang Xuất Chiến${starStr}`,
      value: [
        `• **Tên thú:** **${activePet.name}** (Cấp ${activePet.level})`,
        `• **Phẩm chất:** ${rarityEmoji[activePet.rarity] || '⚪'} **${activePet.rarity.toUpperCase()}**`,
        `• **Thuộc tính:** <:iiatk:1547935869602631680> Công: **${activePet.base_atk}**${bonusAtk} | <:idef:1547935867149099083> Thủ: **${activePet.base_def}**${bonusDef} | <:ihp:1547865965998379048> HP: **${activePet.base_hp}**${bonusHp}`
      ].join('\n'),
      inline: false,
    });
  } else {
    embed.addFields({
      name: '<:ilt:1547950632562982994> Sủng Thú',
      value: `🚫 *Chưa phái ra trận.*\n*Dùng \`/sanyeuthu\` để săn bắt linh thú! (Trong chuồng: **${allPets.length}** con)*`,
      inline: false,
    });
  }

  // Active mount
  if (activeMount) {
    const bar = '█'.repeat(Math.floor((activeMount.level / 10) * 10)) + '░'.repeat(10 - Math.floor((activeMount.level / 10) * 10));
    embed.addFields({
      name: `<:itoaky:1547955958309847061> Tọa Kỵ Đang Cưỡi`,
      value: [
        `• **Tên thú:** **${activeMount.name}** [${activeMount.rarity.toUpperCase()}]`,
        `• **Cấp độ:** **${activeMount.level}/10** \`[${bar}]\``,
        `• **Thuộc tính:** 🏇 Tốc chạy: +**${Math.round(activeMount.speed_bonus * 100)}%** | ⚡ Thể lực tiết kiệm: +**${Math.round(activeMount.stamina_save * 100)}%**`
      ].join('\n'),
      inline: false,
    });
  }
  if (allMounts.length > 0 && !activeMount) {
    embed.addFields({
      name: '<:itoaky:1547955958309847061> Tọa Kỵ',
      value: `*Đang sở hữu **${allMounts.length}** tọa kỵ. Dùng \`/toaky cuoi\` để cưỡi!*`,
      inline: false,
    });
  }

  // Spirit weapons
  if (spiritWeapons.length > 0) {
    for (const sw of spiritWeapons) {
      const affinityBar = '<:ihp:1547865965998379048>'.repeat(Math.min(Math.floor(sw.affinity / 20), 5)) + '🖤'.repeat(Math.max(0, 5 - Math.floor(sw.affinity / 20)));
      embed.addFields({
        name: `<:ngotinh:1547877042232496138> Khí Linh: ${sw.spirit_name} (ID: ${sw.id})`,
        value: [
          `• **Đẳng cấp:** Cấp **${sw.level}**`,
          `• **Độ thân thiết:** ${affinityBar} (${sw.affinity}/100)`,
          `• **Thần thông kỹ năng:** **${sw.skill_id || 'Chưa thức tỉnh'}**`,
          `*Dùng \`/khilinh tuongtac\` với ID để tăng hảo cảm.*`
        ].join('\n'),
        inline: false,
      });
    }
  } else {
    embed.addFields({
      name: '<:ngotinh:1547877042232496138> Khí Linh',
      value: '🚫 *Chưa thức tỉnh khí linh. Hãy dùng \`/khilinh thuctinh\` trên trang bị Epic+.*',
      inline: false,
    });
  }

  // Huyết mạch
  if (userBloodline) {
    const passives = bloodlineService.getActivePassives(userBloodline);
    const nextLevelExp = userBloodline.level * 200;
    const isMaxLevel = userBloodline.level >= 50;

    let passiveDesc = '';
    if (passives.hp_steal) passiveDesc += `• 🩸 Hút máu: +**${(passives.hp_steal * 100).toFixed(0)}%**\n`;
    if (passives.revive_chance) passiveDesc += `• 🔥 Tỷ lệ hồi sinh: **${(passives.revive_chance * 100).toFixed(0)}%**\n`;
    if (passives.dmg_reduce) passiveDesc += `• <:idef:1547935867149099083> Giảm sát thương: **${(passives.dmg_reduce * 100).toFixed(0)}%**\n`;
    if (passives.crit_rate) passiveDesc += `• 💥 Tỷ lệ bạo kích: +**${(passives.crit_rate * 100).toFixed(0)}%**\n`;
    if (passives.max_hp) passiveDesc += `• <:ihp:1547865965998379048> Tăng HP tối đa: +**${(passives.max_hp * 100).toFixed(0)}%**\n`;
    if (passives.shield_start) passiveDesc += `• 🔰 Khiên khởi đầu: **${(passives.shield_start * 100).toFixed(0)}%** HP\n`;
    if (passives.speed) passiveDesc += `• ⚡ Tăng tốc độ: +**${(passives.speed * 100).toFixed(0)}%**\n`;

    const progressStr = isMaxLevel ? ' (Tối Đa)' : `\n📈 **Tiến độ EXP:** **${userBloodline.exp}** / **${nextLevelExp}**`;

    embed.addFields({
      name: `🩸 Huyết Mạch Giác Tỉnh: ${userBloodline.name}`,
      value: [
        `• **Cảnh giới huyết mạch:** Cấp **${userBloodline.level}**${progressStr}`,
        `• **Thần thông nội tại:**\n${passiveDesc || '*Chưa kích hoạt*'}`.trim(),
        `• **Huyết Mạch Nộ kỹ:** Tăng sức mạnh x**${userBloodline.rage_effect.multiplier || 2}** trong **${userBloodline.rage_effect.duration || 3}** hiệp đấu.`
      ].join('\n'),
      inline: false
    });
  } else {
    embed.addFields({
      name: '🩸 Huyết Mạch',
      value: '🚫 *Chưa giác tỉnh. Đạt Cấp 10 và dùng \`/huyetmach chon\` để giác tỉnh huyết mạch thượng cổ!*',
      inline: false
    });
  }

  embed.setFooter({ text: 'Dùng /toaky, /sanyeuthu, /khilinh, /huyetmach để quản lý' });
  return embed;
}

function getSoMenhTabEmbed(user: UserEntity): EmbedBuilder {
  const prophecy = user.prophecy || 'Số phận mù mịt, chưa rõ đường đi.';
  let heirloomText = 'Không có vật gia truyền.';
  if (user.heirloom) {
    try {
      const h = JSON.parse(user.heirloom);
      heirloomText = `${h.icon} **${h.name}**\n*${h.description}*\nHiệu ứng: **${h.effect}**`;
    } catch (e) {
      heirloomText = user.heirloom;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`<:sotay:1547883761776197632> SỐ MỆNH & KỲ DUYÊN - ${user.name}`)
    .setColor(EMBED_COLORS.DARK)
    .setDescription(`*Định mệnh đã an bài, hay do tự tay ngươi xoay chuyển?*`)
    .addFields(
      {
        name: '<:tin4:1547875508174327828> Lá Số Tử Vi',
        value: `*${prophecy}*`,
        inline: false,
      },
      {
        name: '<:ic:1547865958431985714> Vật Gia Truyền\n',
        value: heirloomText,
        inline: false,
      }
    )
    .setFooter({ text: 'Lá số tử vi là cơ duyên trời ban, không thể thay đổi.' })
    .setTimestamp();

  return embed;
}

export function getTabNavigationRows(userId: string, activeTab: HoSoTab): ActionRowBuilder<ButtonBuilder>[] {
  const tabs: HoSoTab[] = ['chiso', 'taisan', 'chientich', 'trangbi', 'linhthu', 'somenh', 'bangxephang', 'thongke'];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  
  for (let i = 0; i < tabs.length; i += 4) {
    const rowTabs = tabs.slice(i, i + 4);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...rowTabs.map(tab => {
        const info = TAB_LABELS[tab];
        const isActive = tab === activeTab;
        return new ButtonBuilder()
          .setCustomId(`hosotab_${tab}_${userId}`)
          .setLabel(`${info.emoji} ${info.name}`)
          .setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(isActive);
      })
    );
    rows.push(row);
  }
  
  return rows;
}

export function getHoSoActionMenus(userId: string): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const selectMenu1 = new StringSelectMenuBuilder()
    .setCustomId(`hosoaction1_${userId}`)
    .setPlaceholder('⚔️ Tu Luyện, Vượt Ải & Khiêu Chiến')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('🧘 Thiền Định (Tu Luyện)').setValue('tuluyen').setDescription('Hấp thu linh khí thiên địa tu luyện'),
      new StringSelectMenuOptionBuilder().setLabel('⚡ Đột Phá Cảnh Giới').setValue('dotpha').setDescription('Bức phá bình cảnh cảnh giới'),
      new StringSelectMenuOptionBuilder().setLabel('🌀 Tẩy Tủy Linh Căn').setValue('taytuynav').setDescription('Đổi ngũ hành linh căn (Tốn 100 LT)'),
      new StringSelectMenuOptionBuilder().setLabel('🌌 Ngộ Ý Cảnh').setValue('ycanhnaav').setDescription('Lĩnh ngộ đại đạo ý cảnh'),
      new StringSelectMenuOptionBuilder().setLabel('📜 Nhiệm Vụ Thiên Cơ Các').setValue('nhiemvunav').setDescription('Kiểm tra nhiệm vụ hàng ngày'),
      new StringSelectMenuOptionBuilder().setLabel('🗺️ Khám Phá Địa Đồ').setValue('khambhanav').setDescription('Du ngoạn thám hiểm khắp nơi'),
      new StringSelectMenuOptionBuilder().setLabel('🐺 Săn Bắn Yêu Thú').setValue('sanyeuthunaav').setDescription('Tiêu diệt dã thú nhặt chiến lợi phẩm'),
      new StringSelectMenuOptionBuilder().setLabel('🔮 Khiêu Chiến Bí Cảnh').setValue('bicanhnaav').setDescription('Khiêu chiến phó bản bí cảnh viễn cổ'),
      new StringSelectMenuOptionBuilder().setLabel('🏯 Khiêu Chiến Trấn Yêu Tháp').setValue('leothapnav').setDescription('Leo Tháp Vô Hạn trừ ma'),
      new StringSelectMenuOptionBuilder().setLabel('🛡️ Khiêu Chiến World Boss').setValue('worldbossnav').setDescription('Đại chiến Boss toàn server'),
      new StringSelectMenuOptionBuilder().setLabel('⚔️ Quyết Đấu PvP').setValue('quyetau').setDescription('Tỷ thí võ nghệ cướp linh thạch'),
      new StringSelectMenuOptionBuilder().setLabel('⚔️ Đấu Trường PvP (Ranked)').setValue('arenanav').setDescription('Khiêu chiến đối thủ ELO nâng cao'),
      new StringSelectMenuOptionBuilder().setLabel('🌀 Luân Hồi Trọng Sinh').setValue('luanhoinnav').setDescription('Chuyển thế đầu thai nhận thuộc tính vĩnh viễn')
    );

  const selectMenu2 = new StringSelectMenuBuilder()
    .setCustomId(`hosoaction2_${userId}`)
    .setPlaceholder('💼 Tiên Nghề, Sủng Vật & Giao Dịch')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('💼 Mở Túi Đồ (Hành Trang)').setValue('tuido').setDescription('Xem và sử dụng vật phẩm'),
      new StringSelectMenuOptionBuilder().setLabel('🐉 Quản Lý Sủng Thú').setValue('sungthunaav').setDescription('Bố trí, huấn luyện linh thú xuất chiến'),
      new StringSelectMenuOptionBuilder().setLabel('🐎 Quản Lý Tọa Kỵ').setValue('toakynav').setDescription('Chăm sóc và nâng cấp thú cưỡi'),
      new StringSelectMenuOptionBuilder().setLabel('⚡ Thức Tỉnh Khí Linh').setValue('spiritnav').setDescription('Thức tỉnh linh hồn pháp khí'),
      new StringSelectMenuOptionBuilder().setLabel('🛡️ Quản Lý Trang Bị').setValue('trangbinaav').setDescription('Mặc/Tháo và cường hóa trang bị'),
      new StringSelectMenuOptionBuilder().setLabel('⛏️ Làm Việc Kiếm Liệu').setValue('lamviecnav').setDescription('Chặt củi, đào mỏ tích lũy linh tài'),
      new StringSelectMenuOptionBuilder().setLabel('🌿 Luyện Đan Dược').setValue('luyendannav').setDescription('Chế tạo đan dược phụ trợ'),
      new StringSelectMenuOptionBuilder().setLabel('🛠️ Chế Tạo Pháp Khí').setValue('chetaonav').setDescription('Rèn phôi chế tạo trang bị'),
      new StringSelectMenuOptionBuilder().setLabel('⚒️ Rèn Đúc Luyện Khí').setValue('luyenkhinav').setDescription('Rèn đúc trang bị (Luyện Khí Sư)'),
      new StringSelectMenuOptionBuilder().setLabel('🌾 Chăm Sóc Linh Điền').setValue('linhdiennav').setDescription('Gieo hạt trồng trọt thảo mộc'),
      new StringSelectMenuOptionBuilder().setLabel('🏰 Quản Lý Động Phủ').setValue('dongphunav').setDescription('Quản lý Động Phủ Tiên Gia và Linh Mạch'),
      new StringSelectMenuOptionBuilder().setLabel('☯️ Trở Về Tông Môn').setValue('tonmonnav').setDescription('Bái sư bách nghệ gia nhập tông môn'),
      new StringSelectMenuOptionBuilder().setLabel('🏪 Ghé Thăm Cửa Hàng').setValue('shopnav').setDescription('Mua sắm dược phẩm và vé khiêu chiến'),
      new StringSelectMenuOptionBuilder().setLabel('📜 Tiệm Sách Kỹ Năng').setValue('shopkynangnav').setDescription('Mua sách học kỹ năng chiến đấu'),
      new StringSelectMenuOptionBuilder().setLabel('🏛️ Sàn Giao Dịch Vạn Bảo Lâu').setValue('vanbaolaunav').setDescription('Mua bán tự do với tu sĩ khác')
    );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu1),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu2),
  ];
}

export function getHoSoAllComponents(userId: string, activeTab: HoSoTab = 'chiso'): ActionRowBuilder<any>[] {
  const components: ActionRowBuilder<any>[] = [];

  // Tab Bảng Phong Thần: hiển thị nút chọn danh mục & nút quay lại, ẩn các menu tab và menu hành động
  if (activeTab === 'bangxephang') {
    const lbTypes = [
      { id: 'combatPower', label: 'Lực Chiến', emoji: '⚔️' },
      { id: 'realm', label: 'Cảnh Giới', emoji: '🌀' },
      { id: 'wealth', label: 'Tài Sản', emoji: '🪙' },
      { id: 'sectContribution', label: 'Cống Hiến', emoji: '🏛️' },
    ];
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...lbTypes.map(t =>
        new ButtonBuilder()
          .setCustomId(`hosolb_${t.id}_${userId}`)
          .setLabel(`${t.emoji} ${t.label}`)
          .setStyle(ButtonStyle.Secondary)
      ),
      new ButtonBuilder()
        .setCustomId(`hosoback_${userId}`)
        .setLabel('🔙 Trở Lại Hồ Sơ')
        .setStyle(ButtonStyle.Primary)
    );
    components.push(row);
  } else {
    // Các tab bình thường: hiển thị đầy đủ hàng điều hướng tab và menu hành động
    components.push(
      ...getTabNavigationRows(userId, activeTab),
      ...getHoSoActionMenus(userId)
    );
  }

  const user = userRepository.get(userId);
  if (user && user.level >= 39 && (!user.alignment || user.alignment === 'neutral')) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`select_alignment_${userId}`)
        .setLabel('Chọn Đạo Thống (Chính/Ma)')
        .setStyle(ButtonStyle.Success)
    );
    components.push(row);
  }

  return components;
}

const cleanedUsers = new Set<string>();

export function getInventoryEmbed(userId: string, page: number): { embed: EmbedBuilder; totalPages: number; itemsOnPage: InventoryItem[] } {
  const ITEMS_PER_PAGE = 5;

  // Tự động xoá vật phẩm bất thường (chỉ chạy 1 lần mỗi session bot)
  if (!cleanedUsers.has(userId)) {
    cleanedUsers.add(userId);
    try {
      inventoryRepository.cleanupOrphanItems(userId);
    } catch (e) {
      console.error('[getInventoryEmbed] Lỗi cleanup orphan:', e);
    }
  }

  let totalItemsCount = 0;
  try {
    totalItemsCount = inventoryRepository.getUserInventoryCount(userId);
  } catch (e) {
    console.error('[getInventoryEmbed] Lỗi đếm inventory:', e);
    totalItemsCount = 0;
  }

  const totalPages = Math.max(Math.ceil(totalItemsCount / ITEMS_PER_PAGE), 1);
  const cappedPage = Math.min(Math.max(page, 1), totalPages);

  const offset = (cappedPage - 1) * ITEMS_PER_PAGE;
  let itemsOnPage: InventoryItem[] = [];
  try {
    itemsOnPage = inventoryRepository.getUserInventoryPaginated(userId, ITEMS_PER_PAGE, offset);
  } catch (e) {
    console.error('[getInventoryEmbed] Lỗi lấy inventory:', e);
    itemsOnPage = [];
  }

  // Filter out items with null name (orphan items that slipped through)
  itemsOnPage = itemsOnPage.filter(item => item && item.item_id);

  let description = `*Hành trang chứa đựng thiên tài địa bảo, trang bị và linh dược mà đạo hữu đã tích lũy trên đường tu tiên.*\n\n`;

  if (totalItemsCount === 0 || itemsOnPage.length === 0) {
    description += `*Hiện tại trống trơn. Hãy chăm chỉ dùng \`/lamviec\` hoặc chinh phục Bí Cảnh để tích lũy!*`;
  } else {
    itemsOnPage.forEach((item, index) => {
      const idx = offset + index + 1;
      const rarityEmoji: Record<string, string> = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡', mythic: '🔴' };
      const rarityTag = item.rarity ? `${rarityEmoji[item.rarity] || ''}[${item.rarity.toUpperCase()}] ` : '';
      const equippedText = item.is_equipped === 1 ? ` **🔸[ĐANG MẶC]**` : '';
      const starText = item.stars > 0 ? ` ⭐${item.stars}` : '';
      const enhanceText = item.enhance_level > 0 ? ` (+${item.enhance_level})` : '';

      let itemStats = '';
      if (item.base_stats && item.base_stats !== '{}') {
        try {
          const stats = JSON.parse(item.base_stats);
          const bonus = [];
          if (stats.atk) bonus.push(`Công +${stats.atk}`);
          if (stats.def) bonus.push(`Thủ +${stats.def}`);
          if (stats.hp) bonus.push(`HP +${stats.hp}`);
          if (stats.mp) bonus.push(`MP +${stats.mp}`);
          if (stats.add_tu_vi) bonus.push(`Tu Vi +${stats.add_tu_vi}`);
          if (bonus.length > 0) itemStats = ` *(${bonus.join(', ')})*`;
        } catch (e) {}
      }

      const itemName = item.name || item.item_id || 'Vật phẩm lạ';
      description += `**${idx}.** ${rarityTag}**${itemName}${enhanceText}** x${item.quantity}${starText}${equippedText}${itemStats}\n*└ Mã: \`${item.id}\`*\n\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`<:tvp1:1547866133242056704> HÀNH TRANG (Trang ${cappedPage}/${totalPages})`)
    .setColor(EMBED_COLORS.GOLD)
    .setDescription(description)
    .setFooter({ text: 'Dùng Mã (ID số) cho tất cả lệnh: /dung, /thanhly, /trade, /cuonghoa, /trangbi, /suachua, /khilinh, /loren, /vanbaolau, /dungkynang' })
    .setTimestamp();

  return { embed, totalPages, itemsOnPage };
}

export function getInventoryComponents(userId: string, page: number, totalPages: number, itemsOnPage: InventoryItem[]): ActionRowBuilder<any>[] {
  const rows: ActionRowBuilder<any>[] = [];

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`invprev_${page - 1}_${userId}`)
      .setLabel('◀ Trang Trước')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`invnext_${page + 1}_${userId}`)
      .setLabel('Trang Sau ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder()
      .setCustomId(`hosoback_${userId}`)
      .setLabel('🔙 Hồ Sơ')
      .setStyle(ButtonStyle.Secondary)
  );

  rows.push(buttonRow);

  const interactiveItems = itemsOnPage.filter(item => item.usable === 1 || item.equipable === 1);
  if (interactiveItems.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`invselect_${page}_${userId}`)
      .setPlaceholder('⚡ Nhấp chọn vật phẩm: Sử Dụng / Trang Bị / Tháo');

    let optionCount = 0;
    const seenValues = new Set<string>();
    for (const item of interactiveItems.slice(0, 25)) {
      let actionLabel = '';
      let value = '';

      if (item.is_equipped === 1) {
        actionLabel = `Tháo: ${item.name || 'Vật phẩm'}`;
        value = `unequip_${item.id}`;
      } else if (item.equipable === 1) {
        actionLabel = `Mặc: ${item.name || 'Vật phẩm'}`;
        value = `equip_${item.id}`;
      } else if (item.usable === 1) {
        actionLabel = `Dùng: ${item.name || 'Vật phẩm'} (SL: ${item.quantity})`;
        value = `use_${item.id}`;
      }

      if (!actionLabel || !value || seenValues.has(value)) continue;
      seenValues.add(value);

      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(actionLabel.substring(0, 100))
          .setDescription((item.description || 'Không có mô tả').substring(0, 100))
          .setValue(value)
      );
      optionCount++;
    }

    if (optionCount > 0) {
      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      rows.push(selectRow);
    }
  }

  return rows;
}

import { cultivationService } from '../../services/CultivationService';

export default class HoSoCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('hoso')
        .setDescription('Xem hồ sơ nhân vật tu hành của đạo hữu.')
        .addUserOption(opt =>
          opt
            .setName('dao_huu')
            .setDescription('Xem hồ sơ của đạo hữu khác (để trống = xem của mình)')
            .setRequired(false)
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    // Hỗ trợ xem hồ sơ người khác: /hoso @user
    const targetUser = interaction.options.getUser('dao_huu');
    const discordId = targetUser ? targetUser.id : interaction.user.id;
    const isViewingOther = targetUser && targetUser.id !== interaction.user.id;

    // Kiểm tra nhanh xem người chơi có tồn tại không trước khi defer
    const userExists = userRepository.get(discordId);
    if (!userExists) {
      const targetName = isViewingOther ? targetUser!.displayName : 'Đạo hữu';
      await interaction.editReply({
        content: `❌ ${targetName} chưa khởi tạo nhân vật!`,
      });
      return;
    }

    // Chỉ claim idle cultivation khi xem profile mình
    let idleGained = 0;
    if (!isViewingOther) {
      const idleRes = cultivationService.claimIdleCultivation(discordId);
      if (idleRes && idleRes.gained > 0) idleGained = idleRes.gained;
    }

    const user = userRepository.get(discordId);
    const activeStats = inventoryService.getActiveStats(discordId);
    const embed = getChiSoTabEmbed(user || userExists, activeStats);

    if (idleGained > 0) {
      embed.setDescription(`✨ **Thu Hoạch Nhàn Rỗi:** Đạo hữu tự động hấp thu thêm **+${idleGained}** Tu Vi!\n\n` + (embed.data.description || ''));
    }

    if (isViewingOther) {
      embed.setFooter({ text: `Đang xem hồ sơ của ${targetUser!.displayName}` });
    }

    const rows = getHoSoAllComponents(discordId, 'chiso');
    await interaction.editReply(toV2Payload([embed], rows));
  }
}

function getThongKeTabEmbed(user: UserEntity): EmbedBuilder {
  const joinDate = new Date((user.created_at || 0) * 1000);
  const now = new Date();
  const daysPlayed = Math.max(1, Math.floor((now.getTime() - joinDate.getTime()) / 86400000));

  let arenaProfile: any = null;
  try { arenaProfile = db.prepare('SELECT * FROM arena_profiles WHERE user_id = ?').get(user.discord_id); } catch {}
  const wins = arenaProfile?.wins || 0;
  const losses = arenaProfile?.losses || 0;
  const totalFights = wins + losses;
  const winRate = totalFights > 0 ? Math.round((wins / totalFights) * 100) : 0;

  let companionInfo = 'Chưa có';
  try {
    const comp = db.prepare('SELECT companion_type, level FROM companion WHERE user_id = ? AND equipped = 1').get(user.discord_id) as any;
    if (comp) companionInfo = `${comp.companion_type} (Lv.${comp.level})`;
  } catch {}

  let awakenedDest = 0;
  try { const row = db.prepare('SELECT COUNT(*) as c FROM user_destinies WHERE user_id = ? AND awakened = 1').get(user.discord_id) as { c: number }; awakenedDest = row?.c || 0; } catch {}

  let bestFloor = 0;
  try { const row = db.prepare('SELECT MAX(floor) as best FROM nine_heavens_progress WHERE user_id = ?').get(user.discord_id) as { best: number }; bestFloor = row?.best || 0; } catch {}

  let bestiaryCount = 0;
  try { const row = db.prepare('SELECT COUNT(*) as c FROM bestiary WHERE user_id = ? AND times_defeated > 0').get(user.discord_id) as { c: number }; bestiaryCount = row?.c || 0; } catch {}

  let tribBest = 'N/A';
  try {
    const row = db.prepare('SELECT best_tier, best_floor FROM infinite_tribulation_progress WHERE user_id = ?').get(user.discord_id) as any;
    if (row && row.best_tier > 0) tribBest = `Tier ${row.best_tier} / Floor ${row.best_floor}`;
  } catch {}

  return new EmbedBuilder()
    .setTitle(`📈 Thống Kê — ${user.name || user.discord_id}`)
    .setColor(EMBED_COLORS.INFO)
    .setDescription(
      `📅 **Ngày tạo:** <t:${Math.floor(joinDate.getTime() / 1000)}:D> (${daysPlayed} ngày)\n` +
      `<:iiatk:1547935869602631680> **Chiến đấu:** ${wins} thắng / ${losses} thua (${winRate}% win rate)\n` +
      `🌀 **Tháp sâu nhất:** ${bestFloor > 0 ? `Tầng ${bestFloor}` : 'Chưa rõ'}\n` +
      `⚡ **Thiên Kiếp:** ${tribBest}\n` +
      `<:ilt:1547950632562982994> **Companion:** ${companionInfo}\n` +
      `✨ **Destiny giác tĩnh:** ${awakenedDest}/3\n` +
      `<:sotay:1547883761776197632> **Bestiary:** ${bestiaryCount} enemy đã hạ\n` +
      `🏆 **Danh hiệu:** ${user.title || 'Tán Tu'}`
    )
    .setFooter({ text: `Đại cảnh giới: ${getRealmDetails(user.level).realmName}` })
    .setTimestamp();
}

export function getHoSoTabEmbed(userId: string, tab: HoSoTab): EmbedBuilder {
  const user = userRepository.get(userId)!;
  const activeStats = inventoryService.getActiveStats(userId);

  switch (tab) {
    case 'chiso':
      return getChiSoTabEmbed(user, activeStats);
    case 'taisan':
      return getTaiSanTabEmbed(user);
    case 'chientich':
      return getChienTichTabEmbed(user);
    case 'trangbi':
      return getTrangBiTabEmbed(user);
    case 'linhthu':
      return getLinhThuTabEmbed(user);
    case 'somenh':
      return getSoMenhTabEmbed(user);
    case 'bangxephang': {
      const embed = new EmbedBuilder()
        .setTitle('<:thienthu:1547875509919289465> Bảng Phong Thần')
        .setColor(EMBED_COLORS.GOLD) // ponytail: gold hex, keep numeric for BXH
        .setDescription('*Chọn một danh mục bên dưới để xem bảng xếp hạng.*\n\nDữ liệu được cập nhật mỗi **5 phút**.\n\n📋 **Các danh mục:**\n<:iiatk:1547935869602631680> Lực Chiến\n🌀 Cảnh Giới\n<:tvp1:1547866133242056704> Tài Sản\n<:tientrang:1547866014857826354> Cống Hiến Tông Môn')
        .setFooter({ text: 'Sử dụng các nút bên dưới để chuyển danh mục.' })
        .setTimestamp();
      return embed;
    }
    case 'thongke':
      return getThongKeTabEmbed(user);
  }
}
