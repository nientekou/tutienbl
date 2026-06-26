import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../structures/Command';
import { TuTienClient } from '../../client/TuTienClient';
import { userRepository } from '../../database/repositories/UserRepository';
import { prestigeService } from '../../services/PrestigeService';
import db from '../../database/database';
import { EMBED_COLORS, toV2Payload } from '../../utils/uiSystem';

interface UserSkill {
  skill_id: string;
  level: number;
  is_equipped: number;
  equipped_slot: number;
}

const SKILL_DETAILS: Record<string, { name: string; element: string; desc: string }> = {
  skill_fire: { name: 'Liệt Diễm Quyết 🔥', element: 'Hỏa', desc: 'Thiêu đốt đối thủ gây 20% công kích sát thương phép mỗi lượt và áp dụng trạng thái hỏa phế trong 2 hiệp.' },
  skill_water: { name: 'Thủy Linh Quyết 💧', element: 'Thủy', desc: 'Thủy triều gột rửa cơ thể, hồi phục 12% sinh lực tối đa.' },
  skill_wood: { name: 'Hấp Huyết Quyết 🌿', element: 'Mộc', desc: 'Lực lượng dây leo quấn quanh, chuyển hóa 25% sát thương hiệp đó thành HP hồi phục.' },
  skill_earth: { name: 'Thổ Giáp Quyết 🪨', element: 'Thổ', desc: 'Ngưng tụ thạch giáp bảo hộ cơ thể, nhận khiên bằng 15% HP tối đa.' },
  skill_wind: { name: 'Phong Hành Quyết 🌀', element: 'Phong', desc: 'Gia tốc thần hành bộ pháp, chắc chắn né đòn tấn công kế tiếp từ đối thủ.' },
  skill_lightning: { name: 'Lôi Phạt Quyết ⚡', element: 'Lôi', desc: 'Đao phạt sấm sét giáng thế, tăng 50% sát thương đòn đánh và gây tê liệt địch thủ trong 1 hiệp.' }
};

export default class KyNangCommand extends Command {
  constructor() {
    super(
      new SlashCommandBuilder()
        .setName('kynang')
        .setDescription('Quản lý thần thông kỹ năng của đạo hữu.')
        .addSubcommand(sub =>
          sub
            .setName('xem')
            .setDescription('Xem danh sách kỹ năng đã học và đang trang bị.')
        )
        .addSubcommand(sub =>
          sub
            .setName('trangbi')
            .setDescription('Trang bị kỹ năng vào ô chiến đấu.')
            .addStringOption(opt =>
              opt
                .setName('skill_id')
                .setDescription('Mã kỹ năng cần trang bị (skill_fire, skill_water,...)')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt
                .setName('slot')
                .setDescription('Ô trang bị (1-3 cơ bản, 4-5 cần Luân Hồi).')
                .setRequired(true)
                .addChoices(
                  { name: 'Slot 1', value: 1 },
                  { name: 'Slot 2', value: 2 },
                  { name: 'Slot 3', value: 3 },
                  { name: 'Slot 4 (Luân Hồi 2+)', value: 4 },
                  { name: 'Slot 5 (Luân Hồi 2+)', value: 5 }
                )
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('thao')
            .setDescription('Tháo kỹ năng khỏi ô chiến đấu.')
            .addIntegerOption(opt =>
              opt
                .setName('slot')
                .setDescription('Ô cần tháo kỹ năng (1 đến 3).')
                .setRequired(true)
                .addChoices(
                  { name: 'Slot 1', value: 1 },
                  { name: 'Slot 2', value: 2 },
                  { name: 'Slot 3', value: 3 }
                )
            )
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

    if (sub === 'xem') {
      const skills = db.prepare('SELECT * FROM user_skills WHERE user_id = ?').all(userId) as UserSkill[];

      const embed = new EmbedBuilder()
        .setTitle(`📖 TÀNG BÍ THƯ KỸ NĂNG - ${user.name}`)
        .setColor(EMBED_COLORS.DARK_PURPLE)
        .setDescription('Kỹ năng tu chân thức tỉnh linh căn nguyên thủy giúp đạo hữu xoay chuyển càn khôn trong combat.')
        .setTimestamp();

      // B1: Determine max skill slots based on prestige unlock
      const maxSlots = prestigeService.hasPrestigeUnlock(userId, 'skill_slot_5') ? 5
        : prestigeService.hasPrestigeUnlock(userId, 'skill_slot_4') ? 4 : 3;
      const slots: Record<number, string> = {};
      for (let i = 1; i <= maxSlots; i++) slots[i] = 'Trống 🚫';
      const learnedList: string[] = [];

      for (const skill of skills) {
        const details = SKILL_DETAILS[skill.skill_id];
        const skillName = details ? `${details.name} (Hệ ${details.element})` : skill.skill_id;

        if (skill.is_equipped === 1 && skill.equipped_slot >= 1 && skill.equipped_slot <= maxSlots) {
          slots[skill.equipped_slot] = `**${skillName}** (Cấp ${skill.level})`;
        }

        learnedList.push(`• **${skillName}** - Cấp ${skill.level}\n*└ ${details ? details.desc : 'Kỹ năng tu hành.'}*`);
      }

      const slotLines = Object.entries(slots).map(([k, v]) => `• Ô số ${k}: ${v}`).join('\n');

      embed.addFields(
        {
          name: `⚔️ Ô Chiêu Thức Trang Bị (${maxSlots} slots)`,
          value: slotLines,
          inline: false
        },
        {
          name: '📚 Kỹ Năng Đã Lĩnh Ngộ',
          value: learnedList.length > 0 ? learnedList.join('\n') : '*Đạo hữu chưa học pháp thuật nào. Hãy mua bí tịch tại `/shopkynang`!*',
          inline: false
        }
      );

      await interaction.editReply(toV2Payload([embed]));
      return;
    }

    if (sub === 'trangbi') {
      const skillId = interaction.options.getString('skill_id', true);
      const slot = interaction.options.getInteger('slot', true);

      // B1: Validate slot against max slots
      const maxSlots = prestigeService.hasPrestigeUnlock(userId, 'skill_slot_5') ? 5
        : prestigeService.hasPrestigeUnlock(userId, 'skill_slot_4') ? 4 : 3;
      if (slot < 1 || slot > maxSlots) {
        await interaction.editReply({
          content: `❌ Slot không hợp lệ! Đạo hữu có **${maxSlots}** ô kỹ năng.`
        });
        return;
      }

      // Kiểm tra xem đã học kỹ năng đó chưa
      const skill = db.prepare('SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?')
        .get(userId, skillId) as UserSkill | undefined;

      if (!skill) {
        await interaction.editReply({
          content: '❌ Đạo hữu chưa lĩnh ngộ kỹ năng này! Hãy mua bí tịch tương ứng để học.'
        });
        return;
      }

      const details = SKILL_DETAILS[skillId];
      const skillName = details ? details.name : skillId;

      db.transaction(() => {
        // Hủy trang bị kỹ năng khác ở cùng slot
        db.prepare('UPDATE user_skills SET is_equipped = 0, equipped_slot = 0 WHERE user_id = ? AND equipped_slot = ?')
          .run(userId, slot);

        // Đặt kỹ năng này vào slot
        db.prepare('UPDATE user_skills SET is_equipped = 1, equipped_slot = ? WHERE user_id = ? AND skill_id = ?')
          .run(slot, userId, skillId);
      })();

      await interaction.editReply({
        content: `✅ Đã trang bị kỹ năng **${skillName}** vào **Ô số ${slot}**!`
      });
      return;
    }

    if (sub === 'thao') {
      const slot = interaction.options.getInteger('slot', true);

      // Tháo kỹ năng ở slot
      const changes = db.prepare('UPDATE user_skills SET is_equipped = 0, equipped_slot = 0 WHERE user_id = ? AND equipped_slot = ?')
        .run(userId, slot);

      if (changes.changes > 0) {
        await interaction.editReply({
          content: `✅ Đã tháo kỹ năng khỏi **Ô số ${slot}** thành công.`
        });
      } else {
        await interaction.editReply({
          content: `❌ Không có kỹ năng nào đang trang bị ở **Ô số ${slot}** để tháo.`
        });
      }
    }
  }
}
