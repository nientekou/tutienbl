import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { inventoryService } from './InventoryService';
import { cultivationService } from './CultivationService';
import { getRealmDetails, getProgressBar } from '../utils/constants';
import { ITEMS } from '../config/itemConstants';

export interface TribulationState {
  userId: string;
  username: string;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  totalLightningBolts: number;
  currentLightningBolt: number;
  damagePerBolt: number;
  hasAntiLoiPillUsed: boolean;
  history: string[];
  element?: string;
  requiredPillId?: string;
  requiredPillName?: string;
  hasElementPillUsed?: boolean;
  currentMutation?: string | null;
}

export class TribulationService {
  /**
   * Lấy Linh Căn mạnh nhất của người chơi
   */
  private getStrongestElement(userId: string): string {
    const user = userRepository.get(userId);
    if (!user || !user.linh_can) return 'Hỏa';
    try {
      const lc = JSON.parse(user.linh_can);
      const entries = Object.entries(lc);
      if (entries.length === 0) return 'Hỏa';
      let strongest = entries[0][0];
      let maxVal = entries[0][1];
      for (const [el, val] of entries) {
        if ((val as number) > (maxVal as number)) {
          strongest = el;
          maxVal = val;
        }
      }
      return strongest;
    } catch (e) {
      return 'Hỏa';
    }
  }

  /**
   * Lấy thông tin thiên kiếp ngũ hành sắp tới dựa trên Linh Căn của tu sĩ
   */
  public getOncomingKiepInfo(userId: string): { name: string; pillId: string; pillName: string } {
    const strongestElement = this.getStrongestElement(userId);
    const elementMapping: Record<string, { name: string; pillId: string; pillName: string }> = {
      'Hỏa': { name: '💧 Thủy Lôi Kiếp', pillId: ITEMS.PILL_PROTECT_THO, pillName: 'Địa Thổ Đan' },
      'Thủy': { name: '🪨 Thổ Lôi Kiếp', pillId: ITEMS.PILL_PROTECT_MOC, pillName: 'Mộc Linh Hoàn' },
      'Mộc': { name: '🗡️ Kim Lôi Kiếp', pillId: ITEMS.PILL_PROTECT_HOA, pillName: 'Hỏa Linh Đan' },
      'Thổ': { name: '🌿 Mộc Lôi Kiếp', pillId: ITEMS.PILL_PROTECT_KIM, pillName: 'Kim Cương Đan' },
      'Kim': { name: '🔥 Hỏa Lôi Kiếp', pillId: ITEMS.PILL_PROTECT_THUY, pillName: 'Thủy Nguyên Đan' },
      'Phong': { name: '⚡ Lôi Lôi Kiếp', pillId: ITEMS.PILL_PROTECT_PHONG, pillName: 'Phong Linh Đan' },
      'Lôi': { name: '🌀 Phong Lôi Kiếp', pillId: ITEMS.PILL_PROTECT_LOI, pillName: 'Lôi Linh Hoàn' },
    };
    return elementMapping[strongestElement] || elementMapping['Hỏa'];
  }

  /**
   * Bắt đầu quá trình Lôi Kiếp
   */
  public start(userId: string, username: string, majorIndex: number): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
    const stats = inventoryService.getActiveStats(userId);
    if (!stats) {
      throw new Error('Không thể lấy chỉ số chiến đấu của tu sĩ.');
    }

    const user = userRepository.get(userId);

    // Tăng số đạo sét: Trúc Cơ (majorIndex = 0) là 5 đạo sét, các bậc sau tăng dần
    const bolts = 5 + majorIndex * 2;
    
    // Tăng sát thương lôi kiếp: Sát thương phụ thuộc vào cảnh giới lớn và HP tối đa của người chơi
    let damage = Math.round(80 + majorIndex * 120 + stats.hp * (0.10 + majorIndex * 0.02));

    if (user) {
      if (user.alignment === 'orthodox') {
        damage = Math.round(damage * 0.90); // Giảm 10% sát thương Lôi Kiếp cho Chính Đạo
      } else if (user.alignment === 'demonic') {
        damage = Math.round(damage * 1.15); // Tăng 15% sát thương Lôi Kiếp cho Ma Đạo
      }
    }

    const elementInfo = this.getOncomingKiepInfo(userId);

    // Lượt đầu tiên: quyết định mutation
    let initialMutation: string | null = null;
    if (bolts === 1) {
      initialMutation = 'Tử Tiêu Thần Lôi';
    } else if (Math.random() < 0.25) {
      initialMutation = ['Cuồng Lôi', 'Hỗn Loạn Lôi', 'Tâm Ma Kiếp'][Math.floor(Math.random() * 3)];
    }

    const state: TribulationState = {
      userId,
      username,
      currentHp: stats.hp,
      maxHp: stats.hp,
      currentMp: stats.mp,
      maxMp: stats.mp,
      totalLightningBolts: bolts,
      currentLightningBolt: 1,
      damagePerBolt: damage,
      hasAntiLoiPillUsed: false,
      history: [`⚡ Mây đen vây kín, ${elementInfo.name} đang ngưng tụ trên chín tầng mây!`],
      element: elementInfo.name,
      requiredPillId: elementInfo.pillId,
      requiredPillName: elementInfo.pillName,
      hasElementPillUsed: false,
      currentMutation: initialMutation
    };

    this.save(state);

    return this.renderState(userId, state);
  }

  /**
   * Lưu trạng thái lôi kiếp hiện tại của tu sĩ vào database
   */
  private save(state: TribulationState): void {
    db.prepare(`
      INSERT INTO active_tribulations (
        user_id, username, current_hp, max_hp, current_mp, max_mp,
        total_bolts, current_bolt, damage_per_bolt,
        has_antiloi_pill, has_element_pill, history,
        element, required_pill_id, required_pill_name, current_mutation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        current_hp = excluded.current_hp,
        max_hp = excluded.max_hp,
        current_mp = excluded.current_mp,
        max_mp = excluded.max_mp,
        total_bolts = excluded.total_bolts,
        current_bolt = excluded.current_bolt,
        damage_per_bolt = excluded.damage_per_bolt,
        has_antiloi_pill = excluded.has_antiloi_pill,
        has_element_pill = excluded.has_element_pill,
        history = excluded.history,
        element = excluded.element,
        required_pill_id = excluded.required_pill_id,
        required_pill_name = excluded.required_pill_name,
        current_mutation = excluded.current_mutation
    `).run(
      state.userId,
      state.username,
      state.currentHp,
      state.maxHp,
      state.currentMp,
      state.maxMp,
      state.totalLightningBolts,
      state.currentLightningBolt,
      state.damagePerBolt,
      state.hasAntiLoiPillUsed ? 1 : 0,
      state.hasElementPillUsed ? 1 : 0,
      JSON.stringify(state.history),
      state.element || '',
      state.requiredPillId || null,
      state.requiredPillName || null,
      state.currentMutation || null
    );
  }

  /**
   * Xóa trạng thái lôi kiếp hiện tại của tu sĩ trong database
   */
  private delete(userId: string): void {
    db.prepare('DELETE FROM active_tribulations WHERE user_id = ?').run(userId);
  }

  /**
   * Lấy trạng thái lôi kiếp hiện tại của tu sĩ từ database
   */
  public get(userId: string): TribulationState | undefined {
    const row = db.prepare('SELECT * FROM active_tribulations WHERE user_id = ?').get(userId) as any;
    if (!row) return undefined;

    return {
      userId: row.user_id,
      username: row.username,
      currentHp: row.current_hp,
      maxHp: row.max_hp,
      currentMp: row.current_mp,
      maxMp: row.max_mp,
      totalLightningBolts: row.total_bolts,
      currentLightningBolt: row.current_bolt,
      damagePerBolt: row.damage_per_bolt,
      hasAntiLoiPillUsed: row.has_antiloi_pill === 1,
      hasElementPillUsed: row.has_element_pill === 1,
      history: JSON.parse(row.history || '[]'),
      element: row.element,
      requiredPillId: row.required_pill_id,
      requiredPillName: row.required_pill_name,
      currentMutation: row.current_mutation
    };
  }

  /**
   * Kết xuất giao diện Lôi Kiếp
   */
  public renderState(userId: string, state?: TribulationState): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
    const currentState = state || this.get(userId);
    if (!currentState) {
      throw new Error('Không tìm thấy lôi kiếp đang hoạt động cho tu sĩ này.');
    }
    
    // Kiểm tra đan dược trong túi
    const inv = inventoryRepository.getUserInventory(userId);
    const hasTiLoi = inv.some(i => i.item_id === ITEMS.TALISMAN_ANTI_LOI && i.quantity > 0);
    const hasAntiLoi = inv.some(i => i.item_id === ITEMS.PILL_ALCHEMY_ANTI_LOI && i.quantity > 0);
    const hasHoiHuyet = inv.some(i => (i.item_id === ITEMS.PILL_HP_2 || i.item_id === ITEMS.PILL_HP_1) && i.quantity > 0);

    // Kiểm tra Ngũ Hành Đan
    const requiredPillId = currentState.requiredPillId || '';
    const hasElementPill = requiredPillId ? inv.some(i => i.item_id === requiredPillId && i.quantity > 0) : false;

    // Thiết lập thông báo Dị Biến
    let mutationWarning = '';
    let embedColor = '#9b59b6';
    if (currentState.currentMutation === 'Cuồng Lôi') {
      mutationWarning = `⚠️ **Dị Biến Thiên Kiếp: [Cuồng Lôi]** giáng thế! Uy lực tăng mạnh (+50% sát thương)!\n`;
      embedColor = '#e74c3c';
    } else if (currentState.currentMutation === 'Hỗn Loạn Lôi') {
      mutationWarning = `⚠️ **Dị Biến Thiên Kiếp: [Hỗn Loạn Lôi]** đang tích tụ! Khí hải chấn động, trực tiếp tiêu hao 40 MP của tu sĩ!\n`;
      embedColor = '#e67e22';
    } else if (currentState.currentMutation === 'Tâm Ma Kiếp') {
      mutationWarning = `⚠️ **Dị Biến Thiên Kiếp: [Tâm Ma Kiếp]** quấy phá! Giảm 50% tỷ lệ Kháng Cự thành công và gây thêm sát thương linh hồn bằng 15% MP tối đa!\n`;
      embedColor = '#c0392b';
    } else if (currentState.currentMutation === 'Tử Tiêu Thần Lôi') {
      mutationWarning = `💀 **CỰC HẠN THIÊN KIẾP: [TỬ TIÊU THẦN LÔI]** giáng thế! Hủy thiên diệt địa, sát thương tăng vọt x2.5 lần!\n`;
      embedColor = '#8e44ad';
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚡ ĐỘ PHÁ THIÊN KIẾP - ĐẠO THỨ ${currentState.currentLightningBolt}/${currentState.totalLightningBolts} ⚡`)
      .setColor(embedColor as any)
      .setDescription(
        `🛡️ **Tu sĩ:** **${currentState.username}**\n\n` +
        `🌀 **Thiên Kiếp:** **${currentState.element}**\n` +
        `💡 *Cần:* **${currentState.requiredPillName}** để khắc chế kiếp lực này.\n\n` +
        mutationWarning +
        (mutationWarning ? '\n' : '') +
        `❤️ **Sinh Lực:** \`${currentState.currentHp}/${currentState.maxHp}\` HP\n` +
        `${getProgressBar(currentState.currentHp, currentState.maxHp, 10)}\n\n` +
        `💙 **Pháp Lực:** \`${currentState.currentMp}/${currentState.maxMp}\` MP\n` +
        `${getProgressBar(currentState.currentMp, currentState.maxMp, 10)}\n\n` +
        `${currentState.hasAntiLoiPillUsed ? '🛡️ *Trạng thái:* **Đã uống Ngự Lôi Đan** (Giảm 30% sát thương lôi kiếp)\n' : ''}` +
        `${currentState.hasElementPillUsed ? `🛡️ *Trạng thái:* **Đã uống ${currentState.requiredPillName}** (Giảm 40% sát thương lôi kiếp)\n` : ''}` +
        `⚡ **Độ mạnh sấm sét:** **${currentState.damagePerBolt}** Sát thương cơ bản.\n\n` +
        `📝 **Lịch kiếp ký sự:**\n${currentState.history.slice(-3).join('\n')}`
      )
      .setFooter({ text: 'Hãy đưa ra quyết sách nhanh trong 60 giây trước khi đạo sét giáng xuống!' })
      .setTimestamp();

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`loi_nguthu_${userId}`)
        .setLabel('🛡️ Ngự Thủ (20 MP)')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentState.currentMp < 20),
      new ButtonBuilder()
        .setCustomId(`loi_khangcu_${userId}`)
        .setLabel('⚡ Kháng Cự')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`loi_dungnguloidan_${userId}`)
        .setLabel('💊 Ngự Lôi Đan (-30%)')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasAntiLoi || currentState.hasAntiLoiPillUsed),
      new ButtonBuilder()
        .setCustomId(`loi_dunghoihuyetdan_${userId}`)
        .setLabel('❤️ Hồi Huyết Đan (+150 HP)')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasHoiHuyet),
      new ButtonBuilder()
        .setCustomId(`loi_dungtiloi_${userId}`)
        .setLabel('📜 Tị Lôi Phù (-80% 1 nhịp)')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasTiLoi)
    );
    rows.push(row1);

    if (currentState.requiredPillId) {
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`loi_dungnguhanhdan_${userId}`)
          .setLabel(`💊 ${currentState.requiredPillName} (-40% toàn trận)`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(!hasElementPill || !!currentState.hasElementPillUsed)
      );
      rows.push(row2);
    }

    return { embed, rows };
  }

  /**
   * Xử lý hành động chống lôi kiếp của tu sĩ
   */
  public handleAction(
    userId: string,
    action: 'nguthu' | 'khangcu' | 'dungnguloidan' | 'dunghoihuyetdan' | 'dungtiloi' | 'dungnguhanhdan'
  ): { finished: boolean; success: boolean; embed: EmbedBuilder; rows?: ActionRowBuilder<ButtonBuilder>[] } {
    const state = this.get(userId);
    if (!state) {
      throw new Error('Không tìm thấy lôi kiếp đang hoạt động cho tu sĩ này.');
    }

    const user = userRepository.get(userId)!;
    const now = Math.floor(Date.now() / 1000);

    let logs = '';
    let dmgReceived = 0;
    
    // Áp dụng MP Drain cho Hỗn Loạn Lôi ngay từ đầu
    if (state.currentMutation === 'Hỗn Loạn Lôi') {
      state.currentMp = Math.max(0, state.currentMp - 40);
    }

    // Tính toán sát thương của đạo sét hiện tại
    let currentBoltDamage = state.damagePerBolt;
    
    // Áp dụng sát thương biến dị
    if (state.currentMutation === 'Cuồng Lôi') {
      currentBoltDamage = Math.round(currentBoltDamage * 1.5);
    } else if (state.currentMutation === 'Tử Tiêu Thần Lôi') {
      currentBoltDamage = Math.round(currentBoltDamage * 2.5);
    }

    // Thiết lập tiền tố log theo biến dị
    let prefix = '';
    if (state.currentMutation === 'Tử Tiêu Thần Lôi') {
      prefix = '🔥 **[TỬ TIÊU THẦN LÔI]** ';
    } else if (state.currentMutation === 'Cuồng Lôi') {
      prefix = '⚡ **[CUỒNG LÔI DỊ BIẾN]** ';
    } else if (state.currentMutation === 'Hỗn Loạn Lôi') {
      prefix = '🌀 **[HỖN LOẠN LÔI DỊ BIẾN]** ';
    } else if (state.currentMutation === 'Tâm Ma Kiếp') {
      prefix = '👁️ **[TÂM MA LÔI DỊ BIẾN]** ';
    }

    // Tính toán sát thương hồn thể (Tâm Ma Kiếp)
    let extraDmg = 0;
    if (state.currentMutation === 'Tâm Ma Kiếp') {
      extraDmg = Math.round(state.maxMp * 0.15);
    }

    if (action === 'nguthu') {
      state.currentMp = Math.max(0, state.currentMp - 20);
      dmgReceived = Math.round(currentBoltDamage * 0.5) + extraDmg;
      logs = `${prefix}🛡️ Đạo hữu ngưng tụ pháp lực hộ thể, chắn đỡ đạo sét thứ ${state.currentLightningBolt}. Gánh chịu **${dmgReceived}** sát thương.`;
    } 
    
    else if (action === 'khangcu') {
      const activeStats = inventoryService.getActiveStats(userId)!;
      
      // Giảm 50% tỉ lệ thành công khi gặp Tâm Ma Kiếp
      let successChance = Math.min(0.80, activeStats.crit + activeStats.luck * 0.01);
      if (state.currentMutation === 'Tâm Ma Kiếp') {
        successChance = successChance * 0.5;
      }
      
      const isSuccess = Math.random() <= successChance;

      if (isSuccess) {
        dmgReceived = 0; // Kháng cự tuyệt đối sát thương sét thường
        
        if (extraDmg > 0) {
          // Vẫn gánh chịu sát thương hồn thể từ Tâm Ma Kiếp
          dmgReceived = extraDmg;
          logs = `${prefix}⚡ Đạo hữu tung đòn chí mạng xé đôi đạo sét thứ ${state.currentLightningBolt}! Nhưng hồn thể bị tâm ma xâm lấn, gánh chịu **${extraDmg}** sát thương!`;
        } else {
          logs = `${prefix}⚡ Đạo hữu tung ra đòn chí mạng xé đôi đạo sét thứ ${state.currentLightningBolt}! Không nhận bất kỳ thương tổn nào!`;
        }
      } else {
        dmgReceived = Math.round(currentBoltDamage * 1.5) + extraDmg;
        logs = `${prefix}💥 Kháng cự thất bại! Đạo sét thứ ${state.currentLightningBolt} đánh trực diện làm cháy xém kinh mạch, gánh chịu **${dmgReceived}** sát thương!`;
      }
    } 
    
    else if (action === 'dungnguloidan') {
      inventoryRepository.removeItem(userId, ITEMS.PILL_ALCHEMY_ANTI_LOI, 1);
      state.hasAntiLoiPillUsed = true;
      dmgReceived = Math.round(currentBoltDamage * 0.7) + extraDmg;
      logs = `${prefix}💊 Đạo hữu nuốt nhanh Ngự Lôi Đan, kích hoạt kết giới chống sét! Đạo sét thứ ${state.currentLightningBolt} giáng xuống chịu giảm sát thương, gánh chịu **${dmgReceived}** sát thương.`;
    } 

    else if (action === 'dungnguhanhdan') {
      const requiredPillId = state.requiredPillId || '';
      inventoryRepository.removeItem(userId, requiredPillId, 1);
      state.hasElementPillUsed = true;
      dmgReceived = Math.round(currentBoltDamage * 0.6) + extraDmg;
      logs = `${prefix}💊 Đạo hữu nuốt nhanh ${state.requiredPillName}, kích hoạt ngũ hành tương khắc! Đạo sét thứ ${state.currentLightningBolt} giáng xuống chịu giảm sát thương, gánh chịu **${dmgReceived}** sát thương.`;
    }
    
    else if (action === 'dunghoihuyetdan') {
      const inv = inventoryRepository.getUserInventory(userId);
      const midPill = inv.find(i => i.item_id === ITEMS.PILL_HP_2 && i.quantity > 0);
      let restore = 50;
      if (midPill) {
        inventoryRepository.removeItem(userId, ITEMS.PILL_HP_2, 1);
        restore = 150;
      } else {
        inventoryRepository.removeItem(userId, ITEMS.PILL_HP_1, 1);
        restore = 50;
      }
      
      state.currentHp = Math.min(state.maxHp, state.currentHp + restore);
      dmgReceived = currentBoltDamage + extraDmg;
      logs = `${prefix}❤️ Đạo hữu nuốt Hồi Huyết Đan, hồi phục **+${restore}** HP, sau đó gánh chịu toàn bộ **${dmgReceived}** sát thương từ đạo sét thứ ${state.currentLightningBolt}.`;
    }

    else if (action === 'dungtiloi') {
      inventoryRepository.removeItem(userId, ITEMS.TALISMAN_ANTI_LOI, 1);
      dmgReceived = Math.round(currentBoltDamage * 0.2) + extraDmg;
      logs = `${prefix}📜 Đạo hữu tế xuất Tị Lôi Phù hóa giải phần lớn uy lực thiên kiếp! Gánh chịu **${dmgReceived}** sát thương từ đạo sét thứ ${state.currentLightningBolt}.`;
    }

    // Áp dụng giảm sát thương toàn cục nếu đã dùng Ngự Lôi Đan (không tính sát thương Tâm Ma)
    if (state.hasAntiLoiPillUsed && action !== 'dungnguloidan' && action !== 'dungnguhanhdan') {
      const baseDmgPart = Math.max(0, dmgReceived - extraDmg);
      const reducedBaseDmg = Math.round(baseDmgPart * 0.7);
      dmgReceived = reducedBaseDmg + extraDmg;
      logs += ` *(Kháng lôi giảm thêm 30% sát thương thường còn **${dmgReceived}**).*`;
    }
    
    // Áp dụng giảm sát thương toàn cục nếu đã dùng Ngũ Hành Đan (không tính sát thương Tâm Ma)
    if (state.hasElementPillUsed && action !== 'dungnguloidan' && action !== 'dungnguhanhdan') {
      const baseDmgPart = Math.max(0, dmgReceived - extraDmg);
      const reducedBaseDmg = Math.round(baseDmgPart * 0.6);
      dmgReceived = reducedBaseDmg + extraDmg;
      logs += ` *(Dược lực ${state.requiredPillName} giảm thêm 40% sát thương thường còn **${dmgReceived}**).*`;
    }

    if (state.currentMutation === 'Hỗn Loạn Lôi') {
      logs += ` *(Hút phệ kinh mạch, đạo hữu tiêu hao 40 MP!)*`;
    }

    if (state.currentMutation === 'Tâm Ma Kiếp' && extraDmg > 0) {
      logs += ` *(Tâm ma công kích thần hồn gây **${extraDmg}** sát thương trực tiếp!)*`;
    }

    state.currentHp = Math.max(0, state.currentHp - dmgReceived);
    state.history.push(logs);

    // 1. Kiểm tra nếu chết (HP về 0) -> Thất bại
    if (state.currentHp <= 0) {
      this.delete(userId);

      // Phạt: Giảm 30% tu vi hiện tại, bị Trọng Thương trong 1 giờ
      const lostTuVi = Math.round(user.tu_vi * 0.30);
      const newTuVi = Math.max(0, user.tu_vi - lostTuVi);
      const injuryEnd = now + 3600; // 1 giờ

      userRepository.update(userId, {
        tu_vi: newTuVi,
        injury_end_time: injuryEnd
      });

      const embed = new EmbedBuilder()
        .setTitle('💀 ĐỘT PHÁ THẤT BẠI - THIÊN KIẾP PHẢN PHỆ 💀')
        .setColor('#c0392b')
        .setDescription(
          `❌ Thiên uy khó lường! Đạo hữu **${state.username}** không trụ vững trước uy lực của lôi kiếp đạo thứ ${state.currentLightningBolt}.\n\n` +
          `💥 Thần trí mơ màng, nguyên thần bị thương nặng, rơi vào trạng thái **Trọng Thương** trong **1 giờ** (không thể làm việc, đi bí cảnh hay luyện đan).\n` +
          `📉 Tổn thất tu vi: **-${lostTuVi}** Tu Vi (Hiện tại: **${newTuVi}/${user.exp_needed}**).`
        )
        .setTimestamp();

      return { finished: true, success: false, embed };
    }

    // 2. Kiểm tra nếu đã chịu hết lôi kiếp và vẫn sống -> Thành công!
    if (state.currentLightningBolt >= state.totalLightningBolts) {
      this.delete(userId);

      // Gọi logic đột phá thành công trong CultivationService
      const successRes = cultivationService.breakthrough(userId, false, true);

      const updatedUser = userRepository.get(userId)!;
      const newRealm = getRealmDetails(updatedUser.level);

      // Trích xuất thông báo thành tựu từ breakthrough message
      let achieveMsg = '';
      if (successRes.message && successRes.message.includes('🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**')) {
        const parts = successRes.message.split('🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**');
        achieveMsg = `\n\n🎁 **THÔNG BÁO THÀNH TỰU ĐẠT ĐƯỢC:**` + parts[1];
      }

      const embed = new EmbedBuilder()
        .setTitle('⚡ ĐỘT PHÁ ĐẠI CẢNH GIỚI THÀNH CÔNG! ⚡')
        .setColor('#2ecc71')
        .setDescription(
          `🎉 **Lôi vân tiêu tán, ngũ sắc hào quang chiếu rọi thiên địa!**\n\n` +
          `Chúc mừng đạo hữu **${state.username}** đã vượt qua sinh tử lôi kiếp thành công, thăng cấp lên cảnh giới mới!\n\n` +
          `📜 Cảnh giới mới: **${newRealm.fullName}**\n` +
          `📈 Yêu cầu tu vi tiếp theo: **${updatedUser.exp_needed}** Tu Vi\n` +
          `💪 Lực chiến (Tiên Lực) tăng mạnh!${achieveMsg}`
        )
        .setTimestamp();

      return { finished: true, success: true, embed };
    }

    // 3. Nếu vẫn còn đạo sét tiếp theo -> Tăng biến đếm và roll mutation mới
    state.currentLightningBolt += 1;
    
    // Đạo sét cuối cùng luôn luôn là Tử Tiêu Thần Lôi
    if (state.currentLightningBolt === state.totalLightningBolts) {
      state.currentMutation = 'Tử Tiêu Thần Lôi';
    } else {
      // 25% cơ hội dị biến ngẫu nhiên
      state.currentMutation = Math.random() < 0.25 
        ? ['Cuồng Lôi', 'Hỗn Loạn Lôi', 'Tâm Ma Kiếp'][Math.floor(Math.random() * 3)] 
        : null;
    }

    this.save(state);
    
    const nextRender = this.renderState(userId, state);

    return {
      finished: false,
      success: true,
      embed: nextRender.embed,
      rows: nextRender.rows
    };
  }
}

export const tribulationService = new TribulationService();
