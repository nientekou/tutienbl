import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';
import { achievementService } from './AchievementService';
import { leylineService } from './LeylineService';
import { ITEMS } from '../config/itemConstants';

export interface FarmingPlot {
  id: number;
  user_id: string;
  plot_index: number;
  seed_item_id: string | null;
  planted_at: number | null;
  growth_time: number;
  speedup_applied: number;
  status: 'empty' | 'growing';
  moisture: number;
  nutrition: number;
  pests: number;
  
  // Custom helper attributes
  seedName?: string;
  productName?: string;
  timeRemaining?: number; // in seconds
}

export class FarmingService {
  /**
   * Lấy danh sách ô đất của người chơi, tự động cập nhật tiến trình sinh trưởng sinh học
   */
  public getPlots(userId: string): FarmingPlot[] {
    let plots = db.prepare('SELECT * FROM farming_plots WHERE user_id = ? ORDER BY plot_index ASC')
      .all(userId) as any[];

    if (plots.length === 0) {
      // Khởi tạo mặc định ô đất 0 cho nhân vật
      db.prepare("INSERT INTO farming_plots (user_id, plot_index, status, moisture, nutrition, pests) VALUES (?, 0, 'empty', 5, 6, 0)").run(userId);
      plots = db.prepare('SELECT * FROM farming_plots WHERE user_id = ? ORDER BY plot_index ASC').all(userId) as any[];
    }

    const now = Math.floor(Date.now() / 1000);

    return plots.map(p => {
      let plot: FarmingPlot = {
        id: p.id,
        user_id: p.user_id,
        plot_index: p.plot_index,
        seed_item_id: p.seed_item_id,
        planted_at: p.planted_at,
        growth_time: p.growth_time,
        speedup_applied: p.speedup_applied,
        status: p.status,
        moisture: p.moisture,
        nutrition: p.nutrition,
        pests: p.pests
      };

      if (plot.status === 'growing' && plot.seed_item_id && plot.planted_at) {
        // Cập nhật tiến trình sinh trưởng sinh học theo thời gian trôi qua
        const dt = now - plot.planted_at;
        if (dt > 0) {
          // Tính toán sự giảm sút ẩm/phân và xuất hiện sâu hại sau mỗi giờ
          const hours = Math.floor(dt / 3600);
          
          let newMoisture = plot.moisture;
          let newNutrition = plot.nutrition;
          let newPests = plot.pests;
          
          if (hours > 0) {
            // ponytail: tăng decay từ 1→2/giờ, tăng pest từ 15%→25%/giờ để giảm farming profit
            newMoisture = Math.max(0, plot.moisture - hours * 2);
            newNutrition = Math.max(0, plot.nutrition - hours * 2);

            // V14 E-02: Weather auto-water — rain restores moisture
            try {
              const { weatherService } = require('./WeatherService');
              const weather = weatherService.getCurrentWeather?.('default');
              if (weather?.id === 'rainy') {
                newMoisture = 10; // Full moisture from rain
              } else if (weather?.id === 'stormy') {
                newMoisture = Math.min(10, newMoisture + 3);
              }
            } catch {}

            // Mỗi giờ trôi qua có 25% cơ hội xuất hiện sâu bệnh (nếu chưa có)
            for (let h = 0; h < hours; h++) {
              if (newPests === 0 && Math.random() < 0.25) {
                newPests = 1;
              }
            }
          }

          // Tính hệ số sinh trưởng dựa trên trạng thái đất hiện tại (trước khi trừ hao)
          let mult = 1.0;
          if (plot.pests > 0 || plot.moisture < 3 || plot.nutrition < 3) {
            mult = 0.5;
          } else if (plot.moisture >= 4 && plot.nutrition >= 4 && plot.pests === 0) {
            mult = 1.5;
          }

          const growthEarned = Math.round(dt * mult);
          const newGrowthTime = Math.max(0, plot.growth_time - growthEarned);

          // Cập nhật Database
          db.prepare(`
            UPDATE farming_plots
            SET growth_time = ?, planted_at = ?, moisture = ?, nutrition = ?, pests = ?
            WHERE id = ?
          `).run(newGrowthTime, now, newMoisture, newNutrition, newPests, plot.id);

          plot.growth_time = newGrowthTime;
          plot.planted_at = now;
          plot.moisture = newMoisture;
          plot.nutrition = newNutrition;
          plot.pests = newPests;
        }

        // Đọc thông tin hạt giống
        const item = db.prepare('SELECT name, stats FROM items WHERE id = ?').get(plot.seed_item_id) as any;
        if (item) {
          plot.seedName = item.name;
          try {
            const stats = JSON.parse(item.stats || '{}');
            const productItem = db.prepare('SELECT name FROM items WHERE id = ?').get(stats.product) as any;
            plot.productName = productItem ? productItem.name : 'Linh dược';
          } catch (e) {
            plot.productName = 'Linh dược';
          }
        }
        
        plot.timeRemaining = plot.growth_time;
      }

      return plot;
    });
  }

  /**
   * Mở khóa ô đất trồng trọt tiếp theo bằng Linh Thạch (Tối đa 6 ô)
   */
  public unlockPlot(userId: string): { success: boolean; message: string } {
    const currentPlots = db.prepare('SELECT COUNT(*) as count FROM farming_plots WHERE user_id = ?')
      .get(userId) as { count: number };
    
    if (currentPlots.count >= 6) {
      return { success: false, message: 'Đạo hữu đã mở khóa số lượng ô đất tối đa (6 ô)!' };
    }

    const costList = [100, 250, 500, 1000, 2000];
    const cost = costList[currentPlots.count - 1];

    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
    }

    if (user.coin_ha_pham < cost) {
      return { success: false, message: `Đạo hữu không đủ Linh Thạch để khai khẩn ô đất mới! (Cần **${cost}** Linh Thạch, hiện có **${user.coin_ha_pham}**)` };
    }

    // Trừ tiền
    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost });

    // Khai khẩn ô đất
    db.prepare('INSERT INTO farming_plots (user_id, plot_index, status, moisture, nutrition, pests) VALUES (?, ?, \'empty\', 5, 6, 0)')
      .run(userId, currentPlots.count);

    return { 
      success: true, 
      message: `🎉 Đạo hữu tiêu hao **${cost} Linh Thạch** khai khẩn thành công **Ô đất số ${currentPlots.count + 1}**!` 
    };
  }

  /**
   * Gieo hạt giống vào ô đất trống
   */
  public plantSeed(userId: string, plotIndex: number, seedItemId: string): { success: boolean; message: string } {
    const inv = inventoryRepository.getUserInventory(userId);
    const hasSeed = inv.some(i => i.item_id === seedItemId && i.quantity > 0);

    if (!hasSeed) {
      return { success: false, message: 'Đạo hữu không có hạt giống này trong túi hành trang!' };
    }

    const plot = db.prepare('SELECT id, status FROM farming_plots WHERE user_id = ? AND plot_index = ?')
      .get(userId, plotIndex) as { id: number; status: string } | undefined;

    if (!plot) {
      return { success: false, message: 'Ô đất này chưa được khai khẩn!' };
    }

    if (plot.status !== 'empty') {
      return { success: false, message: 'Ô đất này đã được gieo trồng linh thực, không thể trồng đè!' };
    }

    const item = db.prepare('SELECT stats FROM items WHERE id = ?').get(seedItemId) as { stats: string } | undefined;
    if (!item) {
      return { success: false, message: 'Hạt giống này không có trong hồ sơ linh vật.' };
    }

    let growthTime = 300; // Mặc định 5 phút
    try {
      const stats = JSON.parse(item.stats || '{}');
      if (stats.growth_time) growthTime = stats.growth_time;
    } catch (e) {
      // bỏ qua
    }

    const now = Math.floor(Date.now() / 1000);

    // Cập nhật trạng thái ô đất khởi đầu đủ nước ẩm và phân bón
    db.prepare(`
      UPDATE farming_plots
      SET seed_item_id = ?, planted_at = ?, growth_time = ?, speedup_applied = 0, status = 'growing', moisture = 5, nutrition = 6, pests = 0
      WHERE id = ?
    `).run(seedItemId, now, growthTime, plot.id);

    // Trừ 1 hạt giống trong hành trang
    inventoryRepository.removeItem(userId, seedItemId, 1);

    // Kiểm tra thành tựu gieo trồng (đếm từ audit_logs)
    const totalPlant = db.prepare(
      "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'plant_seed'"
    ).get(userId) as { c: number };
    const now2 = Math.floor(Date.now() / 1000);
    db.prepare(
      "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'plant_seed', ?, ?)"
    ).run(userId, JSON.stringify({ seedItemId }), now2);
    const newPlantCount = totalPlant.c + 1;
    achievementService.setProgress(userId, 'sh_6', newPlantCount);
    achievementService.setProgress(userId, 'sh_7', newPlantCount);

    return { success: true, message: 'Gieo hạt giống thành công.' };
  }

  /**
   * Tưới Nước Linh Điền
   */
  public waterPlot(userId: string, plotIndex: number): { success: boolean; message: string } {
    // Gọi getPlots để cập nhật sinh học trước khi tưới nước
    this.getPlots(userId);

    const plot = db.prepare('SELECT id, status, moisture FROM farming_plots WHERE user_id = ? AND plot_index = ?')
      .get(userId, plotIndex) as { id: number; status: string; moisture: number } | undefined;

    if (!plot || plot.status !== 'growing') {
      return { success: false, message: 'Ô đất này chưa gieo hạt giống, không cần tưới nước!' };
    }

    if (plot.moisture >= 5) {
      return { success: false, message: 'Độ ẩm của đất đã đạt bão hòa, không cần tưới thêm!' };
    }

    const now = Math.floor(Date.now() / 1000);
    const newMoisture = Math.min(5, plot.moisture + 2);

    db.prepare('UPDATE farming_plots SET moisture = ?, planted_at = ? WHERE id = ?')
      .run(newMoisture, now, plot.id);

    return { success: true, message: `💧 Đạo hữu tưới nước cho ô đất ${plotIndex + 1}, tăng độ ẩm linh thổ lên **${newMoisture}/5**!` };
  }

  /**
   * Bón Phân Linh Điền
   */
  public fertilizePlot(userId: string, plotIndex: number): { success: boolean; message: string } {
    this.getPlots(userId);

    const plot = db.prepare('SELECT id, status, nutrition FROM farming_plots WHERE user_id = ? AND plot_index = ?')
      .get(userId, plotIndex) as { id: number; status: string; nutrition: number } | undefined;

    if (!plot || plot.status !== 'growing') {
      return { success: false, message: 'Ô đất này chưa gieo hạt giống, không cần bón phân!' };
    }

    if (plot.nutrition >= 6) {
      return { success: false, message: 'Dinh dưỡng của đất đã đầy đủ, bón phân nhiều sẽ làm cháy rễ!' };
    }

    const now = Math.floor(Date.now() / 1000);
    const newNutrition = Math.min(6, plot.nutrition + 2);

    db.prepare('UPDATE farming_plots SET nutrition = ?, planted_at = ? WHERE id = ?')
      .run(newNutrition, now, plot.id);

    return { success: true, message: `🪱 Đạo hữu bón phân cho ô đất ${plotIndex + 1}, tăng dinh dưỡng linh thổ lên **${newNutrition}/6**!` };
  }

  /**
   * Bắt Sâu Diệt Hại
   */
  public catchPests(userId: string, plotIndex: number): { success: boolean; message: string } {
    this.getPlots(userId);

    const plot = db.prepare('SELECT id, status, pests FROM farming_plots WHERE user_id = ? AND plot_index = ?')
      .get(userId, plotIndex) as { id: number; status: string; pests: number } | undefined;

    if (!plot || plot.status !== 'growing') {
      return { success: false, message: 'Ô đất trống không có sâu bệnh.' };
    }

    if (plot.pests === 0) {
      return { success: false, message: 'Linh thực thanh khiết, không phát hiện sâu bọ cắn phá!' };
    }

    const now = Math.floor(Date.now() / 1000);

    db.prepare('UPDATE farming_plots SET pests = 0, planted_at = ? WHERE id = ?')
      .run(now, plot.id);

    return { success: true, message: `🐛 Đạo hữu cẩn thận bắt sâu diệt hại cho ô đất ${plotIndex + 1}, bảo hộ linh dược bình an!` };
  }

  /**
   * Dùng Thần Hành Phù để gia tốc linh thực
   */
  public speedupPlot(userId: string, plotIndex: number): { success: boolean; message: string } {
    const inv = inventoryRepository.getUserInventory(userId);
    const hasTalisman = inv.some(i => i.item_id === ITEMS.TALISMAN_SPEED_1 && i.quantity > 0);

    if (!hasTalisman) {
      return { success: false, message: 'Đạo hữu không có **Thần Hành Phù** trong túi đồ để sử dụng!' };
    }

    // Cập nhật tiến trình sinh học trước khi dùng phù
    this.getPlots(userId);

    const plot = db.prepare('SELECT id, status, growth_time FROM farming_plots WHERE user_id = ? AND plot_index = ?')
      .get(userId, plotIndex) as { id: number; status: string; growth_time: number } | undefined;

    if (!plot || plot.status !== 'growing') {
      return { success: false, message: 'Ô đất này không trong trạng thái sinh trưởng, không cần gia tốc!' };
    }

    if (plot.growth_time <= 0) {
      return { success: false, message: 'Linh thực trên ô đất này đã chín rồi, mau thu hoạch đi!' };
    }

    const now = Math.floor(Date.now() / 1000);
    const newGrowthTime = Math.max(0, plot.growth_time - 3600); // Giảm 1 giờ

    db.prepare(`
      UPDATE farming_plots
      SET growth_time = ?, planted_at = ?, speedup_applied = speedup_applied + 1
      WHERE id = ?
    `).run(newGrowthTime, now, plot.id);

    // Trừ phù lục
    inventoryRepository.removeItem(userId, ITEMS.TALISMAN_SPEED_1, 1);

    return { success: true, message: 'Sử dụng Thần Hành Phù gia tốc thành công! Rút ngắn thời gian lớn đi **1 giờ**.' };
  }

  /**
   * Thu hoạch linh dược khi chín
   */
  public harvestPlot(userId: string, plotIndex: number): { success: boolean; message: string; productName?: string } {
    // Cập nhật tiến trình sinh học để tính toán chín chưa
    this.getPlots(userId);

    const plot = db.prepare('SELECT * FROM farming_plots WHERE user_id = ? AND plot_index = ?')
      .get(userId, plotIndex) as any;

    if (!plot || plot.status !== 'growing') {
      return { success: false, message: 'Ô đất này không có linh thực đang trồng!' };
    }

    if (plot.growth_time > 0) {
      return { success: false, message: `Linh thực chưa trưởng thành hoàn toàn! Vui lòng chờ đợi hoặc chăm bón (Còn lại: **${plot.growth_time} giây**).` };
    }

    // Lấy thông tin sản vật phẩm đầu ra
    const item = db.prepare('SELECT stats FROM items WHERE id = ?').get(plot.seed_item_id) as any;
    let productItemId = ITEMS.MATERIAL_LINH_THAO_1;
    
    try {
      const stats = JSON.parse(item.stats || '{}');
      if (stats.product) productItemId = stats.product;
    } catch (e) {
      // bỏ qua
    }

    const productDetails = db.prepare('SELECT name FROM items WHERE id = ?').get(productItemId) as any;
    const productName = productDetails ? productDetails.name : 'Linh dược';

    let amount = 1;
    let leylineMsg = '';
    // Leyline Buff Thu Thập: 25% cơ hội thu hoạch x2
    if (leylineService.isBuffActive('thuthap') && Math.random() < 0.25) {
      amount = 2;
      leylineMsg = ' *(Linh Mạch Buff x2!)*';
    }

    // V14 E-03: Quality Tiers based on plot care
    let qualityTier = 'common';
    const finalMoisture = plot.moisture ?? 0;
    const finalNutrition = plot.nutrition ?? 0;
    const finalPests = plot.pests ?? 0;
    if (finalMoisture >= 8 && finalNutrition >= 8 && finalPests === 0) {
      qualityTier = 'rare';
    } else if (finalMoisture >= 5 && finalNutrition >= 5 && finalPests === 0) {
      qualityTier = 'uncommon';
    }

    // Thêm vật phẩm thu hoạch vào hành trang
    inventoryRepository.addItem(userId, productItemId, amount);

    // Thành tựu thu hoạch
    const totalHarvest = (db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'harvest'").get(userId) as { c: number });
    db.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'harvest', ?, ?)")
      .run(userId, JSON.stringify({ productItemId, amount, qualityTier }), Math.floor(Date.now() / 1000));
    achievementService.setProgress(userId, 'sh_18', totalHarvest.c + 1);

    // Reset ô đất về rỗng
    db.prepare(`
      UPDATE farming_plots
      SET seed_item_id = NULL, planted_at = NULL, growth_time = 0, speedup_applied = 0, status = 'empty', moisture = 5, nutrition = 6, pests = 0
      WHERE id = ?
    `).run(plot.id);

    const qualityEmoji = qualityTier === 'rare' ? '🔵' : qualityTier === 'uncommon' ? '🟢' : '⚪';
    return {
      success: true,
      message: `✨ Thu hoạch thành công **${amount}x ${productName}**! ${qualityEmoji} [${qualityTier}]${leylineMsg}`,
      productName
    };
  }
}

export const farmingService = new FarmingService();
