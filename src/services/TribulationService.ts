import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { inventoryService } from './InventoryService';
import { cultivationService } from './CultivationService';
import { getRealmDetails, getProgressBar } from '../utils/constants';

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
  hasAntiLoiPillUsed: boolean; // Ngự Lôi Đan kích hoạt giảm 30% sát thương lôi kiếp suốt trận
  history: string[];
  element?: string;
  requiredPillId?: string;
  requiredPillName?: string;
  hasElementPillUsed?: boolean;
}

export class TribulationService {
  private activeTribulations = new Map<string, TribulationState>();

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
  /**
   * Lấy thông tin thiên kiếp ngũ hành sắp tới dựa trên Linh Căn của tu sĩ
   */
  public getOncomingKiepInfo(userId: string): { name: string; pillId: string; pillName: string } {
    const strongestElement = this.getStrongestElement(userId);
    const elementMapping: Record<string, { name: string; pillId: string; pillName: string }> = {
      'Hỏa': { name: '💧 Thủy Lôi Kiếp', pillId: 'pill_protect_tho', pillName: 'Địa Thổ Đan' },
      'Thủy': { name: '🪨 Thổ Lôi Kiếp', pillId: 'pill_protect_moc', pillName: 'Mộc Linh Hoàn' },
      'Mộc': { name: '🗡️ Kim Lôi Kiếp', pillId: 'pill_protect_hoa', pillName: 'Hỏa Linh Đan' },
      'Thổ': { name: '🌿 Mộc Lôi Kiếp', pillId: 'pill_protect_kim', pillName: 'Kim Cương Đan' },
      'Kim': { name: '🔥 Hỏa Lôi Kiếp', pillId: 'pill_protect_thuy', pillName: 'Thủy Nguyên Đan' },
      'Phong': { name: '⚡ Lôi Lôi Kiếp', pillId: 'pill_protect_phong', pillName: 'Phong Linh Đan' },
      'Lôi': { name: '🌀 Phong Lôi Kiếp', pillId: 'pill_protect_loi', pillName: 'Lôi Linh Hoàn' },
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

    // Số đạo sét dựa vào cảnh giới: Trúc Cơ (majorIndex = 0) là 3 đạo sét, các bậc sau tăng dần
    const bolts = 3 + majorIndex * 2;
    const damage = Math.round(20 + majorIndex * 15);

    const elementInfo = this.getOncomingKiepInfo(userId);

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
      hasElementPillUsed: false
    };

    this.activeTribulations.set(userId, state);

    return this.renderState(userId);
  }

  /**
   * Lấy trạng thái lôi kiếp hiện tại của tu sĩ
   */
  public get(userId: string): TribulationState | undefined {
    return this.activeTribulations.get(userId);
  }

  /**
   * Kết xuất giao diện Lôi Kiếp
   */
  public renderState(userId: string): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
    const state = this.activeTribulations.get(userId)!;
    
    // Kiểm tra đan dược trong túi
    const inv = inventoryRepository.getUserInventory(userId);
    const hasTiLoi = inv.some(i => i.item_id === 'talisman_anti_loi' && i.quantity > 0);
    const hasAntiLoi = inv.some(i => i.item_id === 'pill_alchemy_anti_loi' && i.quantity > 0);
    const hasHoiHuyet = inv.some(i => (i.item_id === 'pill_hp_2' || i.item_id === 'pill_hp_1') && i.quantity > 0);

    // Kiểm tra Ngũ Hành Đan
    const requiredPillId = state.requiredPillId || '';
    const hasElementPill = requiredPillId ? inv.some(i => i.item_id === requiredPillId && i.quantity > 0) : false;

    const embed = new EmbedBuilder()
      .setTitle(`⚡ ĐỘ PHÁ THIÊN KIẾP - ĐẠO THỨ ${state.currentLightningBolt}/${state.totalLightningBolts} ⚡`)
      .setColor('#9b59b6')
      .setDescription(
        `🛡️ **Tu sĩ:** **${state.username}**\n\n` +
        `🌀 **Thiên Kiếp:** **${state.element}**\n` +
        `💡 *Cần:* **${state.requiredPillName}** để khắc chế kiếp lực này.\n\n` +
        `❤️ **Sinh Lực:** \`${state.currentHp}/${state.maxHp}\` HP\n` +
        `${getProgressBar(state.currentHp, state.maxHp, 10)}\n\n` +
        `💙 **Pháp Lực:** \`${state.currentMp}/${state.maxMp}\` MP\n` +
        `${getProgressBar(state.currentMp, state.maxMp, 10)}\n\n` +
        `${state.hasAntiLoiPillUsed ? '🛡️ *Trạng thái:* **Đã uống Ngự Lôi Đan** (Giảm 30% sát thương lôi kiếp)\n' : ''}` +
        `${state.hasElementPillUsed ? `🛡️ *Trạng thái:* **Đã uống ${state.requiredPillName}** (Giảm 40% sát thương lôi kiếp)\n` : ''}` +
        `⚡ **Độ mạnh sấm sét:** **${state.damagePerBolt}** Sát thương cơ bản.\n\n` +
        `📝 **Lịch kiếp ký sự:**\n${state.history.slice(-3).join('\n')}`
      )
      .setFooter({ text: 'Hãy đưa ra quyết sách nhanh trong 60 giây trước khi đạo sét giáng xuống!' })
      .setTimestamp();

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`loi_nguthu_${userId}`)
        .setLabel('🛡️ Ngự Thủ (20 MP)')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state.currentMp < 20),
      new ButtonBuilder()
        .setCustomId(`loi_khangcu_${userId}`)
        .setLabel('⚡ Kháng Cự')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`loi_dungnguloidan_${userId}`)
        .setLabel('💊 Ngự Lôi Đan (-30%)')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasAntiLoi || state.hasAntiLoiPillUsed),
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

    if (state.requiredPillId) {
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`loi_dungnguhanhdan_${userId}`)
          .setLabel(`💊 ${state.requiredPillName} (-40% toàn trận)`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(!hasElementPill || !!state.hasElementPillUsed)
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
    const state = this.activeTribulations.get(userId);
    if (!state) {
      throw new Error('Không tìm thấy lôi kiếp đang hoạt động cho tu sĩ này.');
    }

    const user = userRepository.get(userId)!;
    const now = Math.floor(Date.now() / 1000);

    let logs = '';
    let dmgReceived = 0;
    
    // Xử lý Tử Tiêu Thần Lôi (20% x2.5 sát thương ở đạo cuối)
    let currentBoltDamage = state.damagePerBolt;
    let isTuTieu = false;
    if (state.currentLightningBolt === state.totalLightningBolts && Math.random() < 0.20) {
      currentBoltDamage = Math.round(state.damagePerBolt * 2.5);
      isTuTieu = true;
    }

    const prefix = isTuTieu ? '🔥 **[TỬ TIÊU THẦN LÔI]** ' : '';

    if (action === 'nguthu') {
      state.currentMp = Math.max(0, state.currentMp - 20);
      dmgReceived = Math.round(currentBoltDamage * 0.5);
      logs = `${prefix}🛡️ Đạo hữu ngưng tụ pháp lực hộ thể, chắn đỡ được đạo sét thứ ${state.currentLightningBolt}. Gánh chịu **${dmgReceived}** sát thương.`;
    } 
    
    else if (action === 'khangcu') {
      // Tỷ lệ kháng cự thành công dựa vào Chí mạng (Crit) + May Mắn
      const activeStats = inventoryService.getActiveStats(userId)!;
      const successChance = Math.min(0.80, activeStats.crit + activeStats.luck * 0.01);
      const isSuccess = Math.random() <= successChance;

      if (isSuccess) {
        dmgReceived = 0;
        logs = `${prefix}⚡ Đạo hữu tung ra đòn chí mạng xé đôi đạo sét thứ ${state.currentLightningBolt}! Không nhận bất kỳ thương tổn nào!`;
      } else {
        dmgReceived = Math.round(currentBoltDamage * 1.5);
        logs = `${prefix}💥 Kháng cự thất bại! Đạo sét thứ ${state.currentLightningBolt} đánh trực diện làm cháy xém kinh mạch, gánh chịu **${dmgReceived}** sát thương!`;
      }
    } 
    
    else if (action === 'dungnguloidan') {
      inventoryRepository.removeItem(userId, 'pill_alchemy_anti_loi', 1);
      state.hasAntiLoiPillUsed = true;
      dmgReceived = Math.round(currentBoltDamage * 0.7);
      logs = `${prefix}💊 Đạo hữu nuốt nhanh Ngự Lôi Đan, kích hoạt kết giới chống sét! Đạo sét thứ ${state.currentLightningBolt} giáng xuống chịu giảm sát thương, gánh chịu **${dmgReceived}** sát thương.`;
    } 

    else if (action === 'dungnguhanhdan') {
      const requiredPillId = state.requiredPillId || '';
      inventoryRepository.removeItem(userId, requiredPillId, 1);
      state.hasElementPillUsed = true;
      dmgReceived = Math.round(currentBoltDamage * 0.6);
      logs = `${prefix}💊 Đạo hữu nuốt nhanh ${state.requiredPillName}, kích hoạt ngũ hành tương khắc! Đạo sét thứ ${state.currentLightningBolt} giáng xuống chịu giảm sát thương, gánh chịu **${dmgReceived}** sát thương.`;
    }
    
    else if (action === 'dunghoihuyetdan') {
      const inv = inventoryRepository.getUserInventory(userId);
      const midPill = inv.find(i => i.item_id === 'pill_hp_2' && i.quantity > 0);
      let restore = 50;
      if (midPill) {
        inventoryRepository.removeItem(userId, 'pill_hp_2', 1);
        restore = 150;
      } else {
        inventoryRepository.removeItem(userId, 'pill_hp_1', 1);
        restore = 50;
      }
      
      state.currentHp = Math.min(state.maxHp, state.currentHp + restore);
      dmgReceived = currentBoltDamage;
      logs = `${prefix}❤️ Đạo hữu nuốt Hồi Huyết Đan, hồi phục **+${restore}** HP, sau đó gánh chịu toàn bộ **${dmgReceived}** sát thương từ đạo sét thứ ${state.currentLightningBolt}.`;
    }

    else if (action === 'dungtiloi') {
      inventoryRepository.removeItem(userId, 'talisman_anti_loi', 1);
      dmgReceived = Math.round(currentBoltDamage * 0.2);
      logs = `${prefix}📜 Đạo hữu tế xuất Tị Lôi Phù hóa giải phần lớn uy lực thiên kiếp! Gánh chịu **${dmgReceived}** sát thương từ đạo sét thứ ${state.currentLightningBolt}.`;
    }

    // Áp dụng giảm sát thương toàn cục nếu đã dùng Ngự Lôi Đan
    if (state.hasAntiLoiPillUsed && action !== 'dungnguloidan' && action !== 'dungnguhanhdan' && dmgReceived > 0) {
      dmgReceived = Math.round(dmgReceived * 0.7);
      logs += ` *(Kháng lôi giảm thêm 30% sát thương còn **${dmgReceived}**).*`;
    }
    // Áp dụng giảm sát thương toàn cục nếu đã dùng Ngũ Hành Đan
    if (state.hasElementPillUsed && action !== 'dungnguloidan' && action !== 'dungnguhanhdan' && dmgReceived > 0) {
      dmgReceived = Math.round(dmgReceived * 0.6);
      logs += ` *(Dược lực ${state.requiredPillName} giảm thêm 40% sát thương còn **${dmgReceived}**).*`;
    }

    state.currentHp = Math.max(0, state.currentHp - dmgReceived);
    state.history.push(logs);

    // 1. Kiểm tra nếu chết (HP về 0) -> Thất bại
    if (state.currentHp <= 0) {
      this.activeTribulations.delete(userId);

      // Phạt phạt phạt: Giảm 30% tu vi hiện tại, bị Trọng Thương trong 1 giờ
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
      this.activeTribulations.delete(userId);

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

    // 3. Nếu vẫn còn đạo sét tiếp theo -> Tăng biến đếm và tiếp tục
    state.currentLightningBolt += 1;
    const nextRender = this.renderState(userId);

    return {
      finished: false,
      success: true,
      embed: nextRender.embed,
      rows: nextRender.rows
    };
  }
}

export const tribulationService = new TribulationService();
