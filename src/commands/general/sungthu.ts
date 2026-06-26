import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { dailyQuestService } from '../../services/DailyQuestService';
import { achievementService } from '../../services/AchievementService';
import { checkPetAchievements } from './sanyeuthu';
import { getProgressBar, formatNumber } from '../../utils/constants';
import db from '../../database/database';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

interface PetEntity {
  id: number;
  user_id: string;
  name: string;
  template_id: string;
  rarity: string;
  level: number;
  exp: number;
  base_hp: number;
  base_atk: number;
  base_def: number;
  is_deployed: number;
  skills: string;        // JSON array kỹ năng
  parent_1: number | null;
  parent_2: number | null;
  gender: number;
  mutations: string;
}

// Định nghĩa kỹ năng linh thú
export const PET_SKILLS: Record<string, { name: string; emoji: string; description: string; minLevel: number }> = {
  crit_bite:   { name: 'Cắn Chí Mạng', emoji: '🖥️', description: 'Tăng 3% tỷ lệ bạo kích khi trợ chiến.', minLevel: 5 },
  speed_boost: { name: 'Phóng Xuất Bạo Phát', emoji: '⚡', description: 'Tăng 10% tốc độ chủ nhân khi xuất chiến.', minLevel: 8 },
  def_aura:    { name: 'Hộ Thể Linh Quang', emoji: '🛡️', description: 'Giảm 5% sát thương nhận vào khi linh thú đang xuất chiến.', minLevel: 10 },
  healing:     { name: 'Liều Lực Thánh Thư', emoji: '💦', description: 'Sau mỗi lượt chiến, hồi phục 2% HP tối đa cho chủ nhân.', minLevel: 12 },
  lucky:       { name: 'Thiên Xích May Mắn', emoji: '🍀', description: 'Tăng +5 May Mắn khi liên tục được phái cùng đánh boss.', minLevel: 15 },
  gold_blessing: { name: 'Kim Nguyên Hộ Trì', emoji: '💰', description: 'Tăng +10% Linh Thạch nhận được sau mỗi trận đấu dã ngoại.', minLevel: 1 },
  reborn_flame:  { name: 'Nirvana Chi Hỏa', emoji: '🔥', description: 'Hồi phục khẩn cấp +25% HP tối đa cho chủ nhân khi lượng HP xuống dưới 20% (mỗi trận 1 lần).', minLevel: 1 },
  qilin_fortune: { name: 'Kỳ Lân Tường Thụy', emoji: '🦄', description: 'Tăng cát tường cát khí: +15 May Mắn và +5% Né Tránh cho chủ nhân khi xuất chiến.', minLevel: 1 },
  qilin_heal:    { name: 'Bạch Ngọc Hồi Xuân', emoji: '💚', description: 'Tăng 15% hiệu quả hồi máu cho chủ nhân, tịnh hóa 1 debuff mỗi hiệp.', minLevel: 1 },
  kunpen_hp:     { name: 'Côn Bằng Pháp Thân', emoji: '💜', description: 'Buff +20% HP tối đa cho chủ nhân, kèm AoE hút MP kẻ địch mỗi hiệp.', minLevel: 1 },
  taotie_def:    { name: 'Thao Thiết Hộ Thể', emoji: '🛡️', description: 'Giảm 10% sát thương nhận vào, phong tỏa Tâm Pháp đối thủ 2 hiệp.', minLevel: 1 },
  dragon_berserk: { name: 'Long Huyết Cuồng Bạo', emoji: '🐉', description: '+20% ATK khi HP chủ nhân dưới 30%, kích hoạt Long Hút hồi phục 5% HP mỗi hiệp.', minLevel: 1 },
  phoenix_rebirth: { name: 'Phượng Hoàng Tái Sinh', emoji: '🔥', description: 'Miễn dịch Ngộ Độc, Tái Sinh 1 lần/trận với 30% HP khi tử vong.', minLevel: 1 },
  sky_agile:    { name: 'Cửu Thiên Phong Tốc', emoji: '💨', description: '+8% tốc độ đánh và +8% né tránh cho chủ nhân khi xuất chiến.', minLevel: 1 },
  nine_charm:   { name: 'Hồn Mê Chỉ Pháp', emoji: '🌸', description: '+10% né tránh, gây mê 1 hiệp lên kẻ địch khi bị tấn công.', minLevel: 1 },
};

// === Helper functions for button handlers ===

const PETS_PER_PAGE = 5;

export function getSungThuEmbed(userId: string, page: number = 1): EmbedBuilder {
  const user = userRepository.get(userId);
  const allPets = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId) as PetEntity[];

  const embed = new EmbedBuilder()
    .setTitle(`🐾 LINH THÚ CÁC - ${user?.name || 'Không xác định'}`)
    .setColor(EMBED_COLORS.CAVE)
    .setDescription('Sủng thú trợ chiến giúp tăng sát thương khi công kích Boss Thế Giới và vượt phó bản Bí Cảnh.\n\n👯‍♂️ **Thiết Lập:** Dùng `/sungthu xuatchien` để phái xuất chiến | `/sungthu thuctinhkynang` để thức tỉnh kỹ năng | `/sungthu laitao` lai tạo dị biến.')
    .setTimestamp();

  if (allPets.length === 0) {
    embed.setDescription('*Đạo hữu hiện chưa thu phục được linh thú nào. Hãy sử dụng lệnh `/sanyeuthu` dã ngoại để tìm bắt linh thú!*');
    return embed;
  }

  const totalPages = Math.max(1, Math.ceil(allPets.length / PETS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PETS_PER_PAGE;
  const pets = allPets.slice(startIdx, startIdx + PETS_PER_PAGE);

  for (const pet of pets) {
      const status = pet.is_deployed === 1 ? '⚔️ **[ĐANG XUẤT CHIẾN]**' : '💤 Trong lồng thú';
      const rarityEmoji: Record<string, string> = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
      const emoji = rarityEmoji[pet.rarity] || '👾';

      let skillsText = '*Chưa thức tỉnh kỹ năng nào.*';
      try {
        const skills: string[] = JSON.parse(pet.skills || '[]');
        if (skills.length > 0) {
          skillsText = skills.map(s => {
            const sk = PET_SKILLS[s];
            return sk ? `${sk.emoji} **${sk.name}**: ${sk.description}` : s;
          }).join('\n');
        }
      } catch {}

      let currentSkills: string[] = [];
      try {
        currentSkills = JSON.parse(pet.skills || '[]');
      } catch {
        currentSkills = [];
      }
      const allSkillEntries = Object.entries(PET_SKILLS).sort(([, a], [, b]) => a.minLevel - b.minLevel);
      const lockedSkills = allSkillEntries.filter(([id]) => !currentSkills.includes(id));
      let evolutionHint: string;
      
      if (lockedSkills.length === 0) {
        evolutionHint = '\n⭐ *Linh thú đã thức tỉnh toàn bộ kỹ năng tiềm năng!*';
      } else {
        const nextSkillLevel = lockedSkills[0][1].minLevel;
        const hasAvailable = lockedSkills.some(([, sk]) => pet.level >= sk.minLevel);
        if (hasAvailable) {
          evolutionHint = `\n💡 *Có thể thức tỉnh kỹ năng mới! Dùng /sungthu thuctinhkynang.*`;
        } else {
          evolutionHint = `\n🔒 *Kỹ năng tiếp theo mở khoá ở cấp ${nextSkillLevel} (Hiện cấp ${pet.level}).*`;
        }
      }
      
      let mut = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
      try {
        if (pet.mutations) {
          mut = JSON.parse(pet.mutations);
        }
      } catch (e) {}

      const starStr = mut.stars > 0 ? ` [${'★'.repeat(mut.stars)}]` : '';
      const displayAtk = pet.base_atk + (mut.bonus_atk || 0);
      const displayDef = pet.base_def + (mut.bonus_def || 0);
      const displayHp = pet.base_hp + (mut.bonus_hp || 0);
      const bonusAtk = mut.bonus_atk > 0 ? ` (+${mut.bonus_atk})` : '';
      const bonusDef = mut.bonus_def > 0 ? ` (+${mut.bonus_def})` : '';
      const bonusHp = mut.bonus_hp > 0 ? ` (+${mut.bonus_hp})` : '';

      const genderText = pet.gender === 0 ? 'Đực ♂️' : 'Cái ♀️';

      const expNeeded = pet.level * 100;
      const expBar = getProgressBar(pet.exp, expNeeded, 10);

      embed.addFields({
        name: `${emoji} ID: \`${pet.id}\` | ${pet.name}${starStr} (Cấp ${pet.level}) [${pet.rarity.toUpperCase()}]`,
        value: [
          `• Trạng thái: ${status}`,
          `• Giới tính: **${genderText}**`,
          `• EXP: ${expBar} (${formatNumber(pet.exp)}/${formatNumber(expNeeded)})`,
          `• Chỉ số: ⚔️ ATK **${displayAtk}**${bonusAtk} | 🛡️ DEF **${displayDef}**${bonusDef} | ❤️ HP **${displayHp}**${bonusHp}`,
          `• Kỹ Năng:\n${skillsText}${evolutionHint}`
        ].join('\n')
      });
    }

    if (totalPages > 1) {
      embed.setFooter({ text: `📄 Trang ${currentPage}/${totalPages} • Tổng số: ${allPets.length} linh thú` });
    }

  return embed;
}

export function getSungThuComponents(userId: string, page: number = 1): any[] {
  const allPets = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId) as PetEntity[];
  const totalPages = Math.max(1, Math.ceil(allPets.length / PETS_PER_PAGE));
  if (totalPages <= 1) return [];

  const currentPage = Math.min(page, totalPages);
  const navRow = new ActionRowBuilder<ButtonBuilder>();

  if (currentPage > 1) {
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`sungthu_${currentPage - 1}_${userId}`)
        .setLabel('⬅ Trang Trước')
        .setStyle(ButtonStyle.Primary)
    );
  }
  if (currentPage < totalPages) {
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`sungthu_${currentPage + 1}_${userId}`)
        .setLabel('Trang Sau ➡')
        .setStyle(ButtonStyle.Primary)
    );
  }
  return [navRow];
}

export default class SungThuCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('sungthu')
        .setDescription('Quản lý linh thú sủng vật hộ vệ đạo lộ.')
        .addSubcommand(sub =>
          sub
            .setName('danhsach')
            .setDescription('Xem danh sách tất cả linh thú đang nuôi dưỡng.')
        )
        .addSubcommand(sub =>
          sub
            .setName('xuatchien')
            .setDescription('Phái linh thú ra trận trợ lực chiến đấu.')
            .addIntegerOption(opt =>
              opt
                .setName('pet_id')
                .setDescription('ID linh thú (xem trong /sungthu).')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('thuhoi')
            .setDescription('Thu hồi linh thú đang xuất chiến.')
        )
        .addSubcommand(sub =>
          sub
            .setName('ban')
            .setDescription('Bán một linh thú đổi lấy Linh Thạch.')
            .addIntegerOption(opt =>
              opt
                .setName('pet_id')
                .setDescription('ID linh thú cần bán.')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('banall')
            .setDescription('Bán TẤT CẢ linh thú hiện có (Trừ Linh Khuyển Chó Đỏ - chodo).')
        )
        .addSubcommand(sub =>
          sub
            .setName('thuctinhkynang')
            .setDescription('Thức Tỉnh kỹ năng tiềm năng cho linh thú (Đạt cấp yêu cầu).')
            .addIntegerOption(opt =>
              opt.setName('pet_id').setDescription('ID linh thú cần Thức Tỉnh kỹ năng.').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('laitao')
            .setDescription('Lai tạo 2 linh thú cùng phẩm chất tạo ra dị biến mới (Tiêu hủy cả 2 linh thú cha mẹ).')
            .addIntegerOption(opt =>
              opt.setName('pet1_id').setDescription('ID linh thú đầu tiên (cha).').setRequired(true)
            )
            .addIntegerOption(opt =>
              opt.setName('pet2_id').setDescription('ID linh thú thứ hai (mẹ).').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('thonphe')
            .setDescription('Thôn phệ sủng thú khác để tăng Tinh Túc (Mutations/Stars) cho chủ thú.')
            .addIntegerOption(opt => opt.setName('main_id').setDescription('ID linh thú chính').setRequired(true))
            .addIntegerOption(opt => opt.setName('food_id').setDescription('ID linh thú hiến tế').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('doiten')
            .setDescription('Đổi tên linh thú (Phí 1,000 Linh Thạch).')
            .addIntegerOption(opt => opt.setName('pet_id').setDescription('ID linh thú cần đổi tên.').setRequired(true))
            .addStringOption(opt => opt.setName('name').setDescription('Tên mới cho linh thú (1-30 ký tự).').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('hocky')
            .setDescription('Học kỹ năng mới cho linh thú cấp 70+ (Phí 5,000 Linh Thạch).')
            .addIntegerOption(opt => opt.setName('pet_id').setDescription('ID linh thú cần học kỹ năng.').setRequired(true))
        )
    );
  }

  public async execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = userRepository.get(userId);

    if (!user) {
      await interaction.editReply({ content: '❌ Đạo hữu chưa tạo nhân vật!' });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'danhsach') {
      const embed = getSungThuEmbed(userId);
      const components = getSungThuComponents(userId);
      await interaction.editReply(toV2Payload([embed], components));
      return;
    }

    if (sub === 'xuatchien') {
      const petId = interaction.options.getInteger('pet_id', true);

      const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetEntity | undefined;
      if (!pet) {
        await interaction.editReply({ content: '❌ Không tìm thấy sủng thú này trong Linh Thú Các của đạo hữu!' });
        return;
      }

      db.transaction(() => {
        // Thu hồi toàn bộ
        db.prepare('UPDATE pets SET is_deployed = 0 WHERE user_id = ?').run(userId);
        // Xuất chiến pet này
        db.prepare('UPDATE pets SET is_deployed = 1 WHERE id = ?').run(pet.id);
      })();

      // Cập nhật tiến trình nhiệm vụ hàng ngày
      dailyQuestService.updateProgress(userId, 'daily_sungthu', 1);

      // Kiểm tra thành tựu cấp độ sủng thú
      checkPetAchievements(userId);

      await interaction.editReply({
        content: `⚔️ Đạo hữu phái linh thú **${pet.name}** xuất chiến! Linh thú gầm rú uy chấn tứ phương, chuẩn bị phụ trợ chiến đấu.`
      });
      return;
    }

    if (sub === 'thuhoi') {
      const result = db.prepare('UPDATE pets SET is_deployed = 0 WHERE user_id = ? AND is_deployed = 1').run(userId);
      
      if (result.changes > 0) {
        await interaction.editReply({ content: '💤 Đã thu hồi toàn bộ linh thú về túi nuôi sủng.' });
      } else {
        await interaction.editReply({ content: '❌ Hiện tại đạo hữu không phái sủng thú nào chiến đấu.' });
      }
      return;
    }

    if (sub === 'ban') {
      const petId = interaction.options.getInteger('pet_id', true);
      const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetEntity | undefined;

      if (!pet) {
        await interaction.editReply({ content: '❌ Linh thú không tồn tại!' });
        return;
      }

      if (pet.is_deployed === 1) {
        await interaction.editReply({ content: '❌ Linh thú đang xuất chiến trợ chiến, hãy thu hồi về lồng thú trước khi đem bán!' });
        return;
      }

      const gold = this.getPetValue(pet.rarity);
      db.transaction(() => {
        db.prepare('DELETE FROM pets WHERE id = ?').run(pet.id);
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + gold });
      })();

      await interaction.editReply({
        content: `💰 Đạo hữu bán sủng thú **${pet.name}** [${pet.rarity.toUpperCase()}] cho phường thị, nhận lại **+${gold}** Hạ Phẩm Linh Thạch.`
      });
      return;
    }

    if (sub === 'banall') {
      const pets = db.prepare("SELECT * FROM pets WHERE user_id = ? AND template_id != 'chodo' AND is_deployed = 0").all(userId) as PetEntity[];

      if (pets.length === 0) {
        await interaction.editReply({
          content: '❌ Đạo hữu không có sủng thú rảnh rỗi nào để bán (hoặc các thú cưng hiện tại đang xuất chiến/là Linh Khuyển Chó Đỏ được bảo hộ vĩnh viễn)!'
        });
        return;
      }

      let totalGold = 0;
      const idsToDelete: number[] = [];

      for (const pet of pets) {
        totalGold += this.getPetValue(pet.rarity);
        idsToDelete.push(pet.id);
      }

      db.transaction(() => {
        for (const id of idsToDelete) {
          db.prepare('DELETE FROM pets WHERE id = ?').run(id);
        }
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + totalGold });
      })();

      await interaction.editReply({
        content: `💰 Đạo hữu thanh lý **${pets.length}** linh thú thường, thu hoạch được **+${totalGold}** Linh Thạch! *(Đang linh thú trung thành Chó Đỏ và thú đang lâm trận tự động được lọc giữ lại).*`
      });
      return;
    }

    // --- SUBCOMMAND: THỨC TỈNH KỸ NĂNG ---
    if (sub === 'thuctinhkynang') {
      const petId = interaction.options.getInteger('pet_id', true);
      const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetEntity | undefined;

      if (!pet) {
        await interaction.editReply({ content: '❌ Linh thú không tồn tại!' });
        return;
      }

      const currentSkills: string[] = JSON.parse(pet.skills || '[]');

      if (currentSkills.length >= 2) {
        await interaction.editReply({ content: `❌ **${pet.name}** đã có đủ **2 kỹ năng** rồi, không thể thức tỉnh thêm! Dùng \`/sungthu hocky\` nếu muốn thay đổi kỹ năng.` });
        return;
      }

      // Tìm kỹ năng chưa được mở khoá nhưng đủ cấp
      const availableSkill = Object.entries(PET_SKILLS).find(([id, sk]) => {
        return pet.level >= sk.minLevel && !currentSkills.includes(id);
      });

      if (!availableSkill) {
        const nextSkill = Object.entries(PET_SKILLS)
          .filter(([id]) => !currentSkills.includes(id))
          .sort(([, a], [, b]) => a.minLevel - b.minLevel)[0];
        const hint = nextSkill
          ? `\n*Linh thú cần đạt cấp **${nextSkill[1].minLevel}** mới mở khoá kỹ năng tiếp theo: **${nextSkill[1].name}**.*`
          : '\n*Linh thú đã mở hết toàn bộ kỹ năng tiềm năng!*';
        await interaction.editReply({
          content: `❌ **${pet.name}** chưa đủ cấp để thức tỉnh kỹ năng nào mới (Hiện cấp **${pet.level}**).${hint}`
        });
        return;
      }

      const [skillId, skillDef] = availableSkill;
      currentSkills.push(skillId);
      db.prepare('UPDATE pets SET skills = ? WHERE id = ?').run(JSON.stringify(currentSkills), pet.id);

      // Kiểm tra thành tựu thức tỉnh kỹ năng (st_10: 5 lần)
      const totalSkillAwakens = db.prepare(
        "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'pet_skill_awaken'"
      ).get(userId) as { c: number };
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'pet_skill_awaken', ?, ?)"
      ).run(userId, JSON.stringify({ petId: pet.id, skillId, petName: pet.name }), now);
      achievementService.setProgress(userId, 'st_10', totalSkillAwakens.c + 1);

      await interaction.editReply({
        content: `✨ **THỨC TỈNH THÀNH CÔNG!**\n\n🐉 Linh thú **${pet.name}** đã đạt đến cấp **${pet.level}**, mở ra kỹ năng tiềm năng!\n\n${skillDef.emoji} **${skillDef.name}** được thức tỉnh!\n*${skillDef.description}*`
      });
      return;
    }

    // --- SUBCOMMAND: LAI TẠO Dị BIẾN ---
    if (sub === 'laitao') {
      const pet1Id = interaction.options.getInteger('pet1_id', true);
      const pet2Id = interaction.options.getInteger('pet2_id', true);

      const pet1 = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(pet1Id, userId) as PetEntity | undefined;
      const pet2 = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(pet2Id, userId) as PetEntity | undefined;

      if (!pet1 || !pet2) {
        await interaction.editReply({ content: '❌ Một trong hai linh thú không tồn tại trong sủng thú của đạo hữu!' });
        return;
      }

      if (pet1.id === pet2.id) {
        await interaction.editReply({ content: '❌ Không thể lai tạo một linh thú với chính nó!' });
        return;
      }

      if (pet1.is_deployed === 1 || pet2.is_deployed === 1) {
        await interaction.editReply({ content: '❌ Không thể lai tạo linh thú đang xuất chiến! Hãy thu hồi về trước.' });
        return;
      }

      if (pet1.gender === pet2.gender) {
        await interaction.editReply({ content: '❌ Hai linh thú phải khác giới tính (một Đực, một Cái) mới có thể lai tạo!' });
        return;
      }

      if (user.coin_ha_pham < 100000) {
        await interaction.editReply({ content: '❌ Đạo hữu không đủ 100,000 Hạ Phẩm Linh Thạch để tiến hành lai tạo!' });
        return;
      }

      const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const r1 = rarityOrder.indexOf(pet1.rarity);
      const r2 = rarityOrder.indexOf(pet2.rarity);

      if (r1 !== r2) {
        await interaction.editReply({ content: `❌ Hai linh thú phải cùng phẩm chất (Cấp độ hiện tại: **${pet1.rarity.toUpperCase()}** vs **${pet2.rarity.toUpperCase()}**)!` });
        return;
      }

      // Phẩm chất con = phẩm chất cha mẹ + có 15% cơ hội dị biến lên phẩm cao hơn
      const isMutation = Math.random() < 0.15;
      const childRarityIndex = isMutation ? Math.min(r1 + 1, rarityOrder.length - 1) : r1;
      const childRarity = rarityOrder[childRarityIndex];

      // Thuộc tính con = trung bình cha mẹ + bonus 10%
      const childAtk = Math.round((pet1.base_atk + pet2.base_atk) / 2 * 1.10);
      const childDef = Math.round((pet1.base_def + pet2.base_def) / 2 * 1.10);
      const childHp  = Math.round((pet1.base_hp  + pet2.base_hp)  / 2 * 1.10);

      // Kế thừa 1 kỹ năng ngẫu nhiên từ mỗi bên (nếu có)
      const skills1: string[] = JSON.parse(pet1.skills || '[]');
      const skills2: string[] = JSON.parse(pet2.skills || '[]');
      const inheritedSkills = new Set<string>();
      if (skills1.length > 0) inheritedSkills.add(skills1[Math.floor(Math.random() * skills1.length)]);
      if (skills2.length > 0) inheritedSkills.add(skills2[Math.floor(Math.random() * skills2.length)]);

      const parentTemplate = Math.random() < 0.5 ? pet1.template_id : pet2.template_id;
      const childName = `${pet1.name.split(' ')[0]}${pet2.name.split(' ')[0] || ''} Hậu`;

      const now = Math.floor(Date.now() / 1000);
      const childGender = Math.random() < 0.5 ? 0 : 1;
      const initialMutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };

      db.transaction(() => {
        // Trừ tiền
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 100000 });
        // Xóa 2 linh thú cha mẹ
        db.prepare('DELETE FROM pets WHERE id IN (?, ?)').run(pet1.id, pet2.id);
        // Tạo linh thú con
        db.prepare(`
          INSERT INTO pets (user_id, name, template_id, rarity, level, exp, base_hp, base_atk, base_def, is_deployed, skills, parent_1, parent_2, gender, mutations, created_at)
          VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        `).run(userId, childName, parentTemplate, childRarity, childHp, childAtk, childDef, JSON.stringify([...inheritedSkills]), pet1.id, pet2.id, childGender, JSON.stringify(initialMutations), now);
      })();

      // Kiểm tra thành tựu lai tạo
      achievementService.updateProgress(userId, 'st_8', 1); // Đã lai tạo 1 lần
      if (isMutation) {
        achievementService.updateProgress(userId, 'st_9', 1); // Dị biến thành công
      }

      const mutationText = isMutation
        ? `
🌟 **Dị Biến Xảy Ra!** Phẩm chất vượt trội: **${childRarity.toUpperCase()}** (tăng từ ${pet1.rarity.toUpperCase()})!`
        : '';

      await interaction.editReply({
        content: [
          `🐉 **LAI TẠO THÀNH CÔNG!** (-100,000 LT)`,
          ``,
          `♾️ **Cha:** ${pet1.name} [${pet1.rarity.toUpperCase()}] + **Mẹ:** ${pet2.name} [${pet2.rarity.toUpperCase()}]`,
          ``,
          `✨ **Linh thú con: ${childName}** [${childRarity.toUpperCase()}] đã ra đời! Giới tính: ${childGender === 0 ? 'Đực ♂️' : 'Cái ♀️'}${mutationText}`,
          `⚔️ Công **${childAtk}** | 🛡️ Thủ **${childDef}** | ❤️ HP **${childHp}**`,
          `🌀 **Kỹ năng kế thừa:** ${[...inheritedSkills].map(s => PET_SKILLS[s]?.name || s).join(', ') || '*Không có*'}`,
          ``,
          `*Cả hai linh thú cha mẹ đã hợp nhất linh thể vào truyền nhân mới!*`
        ].join('\n')
      });
      return;
    }

    // --- SUBCOMMAND: THÔN PHỆ TĂNG SAO ---
    if (sub === 'thonphe') {
      const mainId = interaction.options.getInteger('main_id', true);
      const foodId = interaction.options.getInteger('food_id', true);

      const mainPet: any = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(mainId, userId);
      const foodPet: any = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(foodId, userId);

      if (!mainPet || !foodPet) {
        await interaction.editReply({ content: '❌ Không tìm thấy sủng thú tương ứng!' });
        return;
      }

      if (mainPet.id === foodPet.id) {
        await interaction.editReply({ content: '❌ Không thể thôn phệ chính mình!' });
        return;
      }

      if (foodPet.is_deployed === 1) {
        await interaction.editReply({ content: '❌ Linh thú bị thôn phệ đang xuất chiến, hãy thu hồi về trước.' });
        return;
      }

      // Update mutations
      let mutations = { stars: 0, bonus_atk: 0, bonus_def: 0, bonus_hp: 0 };
      try { mutations = JSON.parse(mainPet.mutations || '{"stars":0,"bonus_atk":0,"bonus_def":0,"bonus_hp":0}'); } catch (e) {}

      if (mutations.stars >= 5) {
        await interaction.editReply({ content: '❌ Linh thú này đã đạt tối đa Tinh Túc (5 Sao)! Không thể thôn phệ thêm.' });
        return;
      }

      const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const rMain = rarityOrder.indexOf(mainPet.rarity);
      const rFood = rarityOrder.indexOf(foodPet.rarity);

      if (rFood < rMain) {
        await interaction.editReply({ content: '❌ Thức ăn thôn phệ phải có phẩm chất BẰNG HOẶC CAO HƠN chủ thú!' });
        return;
      }

      const addedAtk = Math.round(foodPet.base_atk * 0.2);
      const addedDef = Math.round(foodPet.base_def * 0.2);
      const addedHp = Math.round(foodPet.base_hp * 0.2);

      mutations.stars += 1;
      mutations.bonus_atk += addedAtk;
      mutations.bonus_def += addedDef;
      mutations.bonus_hp += addedHp;

      db.transaction(() => {
        db.prepare('DELETE FROM pets WHERE id = ?').run(foodPet.id);
        db.prepare('UPDATE pets SET mutations = ? WHERE id = ?').run(JSON.stringify(mutations), mainPet.id);
      })();

      await interaction.editReply({
        content: `🌀 **THÔN PHỆ THÀNH CÔNG!**\n\nLinh thú **${mainPet.name}** đã cắn nuốt **${foodPet.name}** và ngưng tụ thêm 1 Tinh Túc!\n\n⭐ **Cảnh Giới Tinh Túc:** ${mutations.stars} Sao\n⚔️ **Chỉ Số Đột Phá:** +${addedAtk} ATK | +${addedDef} DEF | +${addedHp} HP`
      });
      return;
    }

    // --- SUBCOMMAND: ĐỔI TÊN ---
    if (sub === 'doiten') {
      const petId = interaction.options.getInteger('pet_id', true);
      const newName = interaction.options.getString('name', true).trim();

      if (newName.length < 1 || newName.length > 30) {
        await interaction.editReply({ content: '❌ Tên linh thú phải từ 1-30 ký tự!' });
        return;
      }

      const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetEntity | undefined;

      if (!pet) {
        await interaction.editReply({ content: '❌ Linh thú không tồn tại!' });
        return;
      }

      if (user.coin_ha_pham < 1000) {
        await interaction.editReply({ content: '❌ Đạo hữu không đủ 1,000 Linh Thạch để đổi tên!' });
        return;
      }

      const oldName = pet.name;
      db.transaction(() => {
        db.prepare('UPDATE pets SET name = ? WHERE id = ?').run(newName, pet.id);
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 1000 });
      })();

      await interaction.editReply({
        content: `✏️ Đạo hữu đã đổi tên linh thú từ **${oldName}** thành **${newName}**! (-1,000 LT)`
      });
      return;
    }

    // --- SUBCOMMAND: HỌC KỸ NĂNG MỚI (Cấp 70+) ---
    if (sub === 'hocky') {
      const petId = interaction.options.getInteger('pet_id', true);
      const pet = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetEntity | undefined;

      if (!pet) {
        await interaction.editReply({ content: '❌ Linh thú không tồn tại!' });
        return;
      }

      if (pet.level < 70) {
        await interaction.editReply({ content: `❌ **${pet.name}** chưa đạt cấp 70 để học kỹ năng mới! (Hiện cấp **${pet.level}**)` });
        return;
      }

      const currentSkills: string[] = JSON.parse(pet.skills || '[]');

      if (currentSkills.length >= 2) {
        await interaction.editReply({ content: `❌ **${pet.name}** đã có 2 kỹ năng, không thể học thêm!` });
        return;
      }

      if (user.coin_ha_pham < 5000) {
        await interaction.editReply({ content: '❌ Đạo hữu không đủ 5,000 Linh Thạch để học kỹ năng!' });
        return;
      }

      const availableSkills = Object.keys(PET_SKILLS).filter(s => !currentSkills.includes(s));
      if (availableSkills.length === 0) {
        await interaction.editReply({ content: '❌ Linh thú đã học hết các kỹ năng hiện có!' });
        return;
      }

      const randomSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
      const skillDef = PET_SKILLS[randomSkill];

      currentSkills.push(randomSkill);
      db.transaction(() => {
        db.prepare('UPDATE pets SET skills = ? WHERE id = ?').run(JSON.stringify(currentSkills), pet.id);
        userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 5000 });
      })();

      await interaction.editReply({
        content: `📚 **HỌC KỸ NĂNG THÀNH CÔNG!** (-5,000 LT)\n\n🐉 Linh thú **${pet.name}** đã lĩnh hội kỹ năng mới!\n\n${skillDef.emoji} **${skillDef.name}**: ${skillDef.description}`
      });
      return;
    }
  }

  private getPetValue(rarity: string): number {
    switch (rarity.toLowerCase()) {
      case 'common': return 50;
      case 'uncommon': return 100;
      case 'rare': return 250;
      case 'epic': return 800;
      case 'legendary': return 2500;
      default: return 50;
    }
  }
}
