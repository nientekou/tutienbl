"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.farmingService = exports.FarmingService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const AchievementService_1 = require("./AchievementService");
const LeylineService_1 = require("./LeylineService");
const itemConstants_1 = require("../config/itemConstants");
class FarmingService {
    /**
     * Lấy danh sách ô đất của người chơi, tự động cập nhật tiến trình sinh trưởng sinh học
     */
    getPlots(userId) {
        let plots = database_1.default.prepare('SELECT * FROM farming_plots WHERE user_id = ? ORDER BY plot_index ASC')
            .all(userId);
        if (plots.length === 0) {
            // Khởi tạo mặc định ô đất 0 cho nhân vật
            database_1.default.prepare("INSERT INTO farming_plots (user_id, plot_index, status, moisture, nutrition, pests) VALUES (?, 0, 'empty', 5, 6, 0)").run(userId);
            plots = database_1.default.prepare('SELECT * FROM farming_plots WHERE user_id = ? ORDER BY plot_index ASC').all(userId);
        }
        const now = Math.floor(Date.now() / 1000);
        return plots.map(p => {
            let plot = {
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
                        newMoisture = Math.max(0, plot.moisture - hours);
                        newNutrition = Math.max(0, plot.nutrition - hours);
                        // Mỗi giờ trôi qua có 15% cơ hội xuất hiện sâu bệnh (nếu chưa có)
                        for (let h = 0; h < hours; h++) {
                            if (newPests === 0 && Math.random() < 0.15) {
                                newPests = 1;
                            }
                        }
                    }
                    // Tính hệ số sinh trưởng dựa trên trạng thái đất hiện tại (trước khi trừ hao)
                    let mult = 1.0;
                    if (plot.pests > 0 || plot.moisture < 3 || plot.nutrition < 3) {
                        mult = 0.5;
                    }
                    else if (plot.moisture >= 4 && plot.nutrition >= 4 && plot.pests === 0) {
                        mult = 1.5;
                    }
                    const growthEarned = Math.round(dt * mult);
                    const newGrowthTime = Math.max(0, plot.growth_time - growthEarned);
                    // Cập nhật Database
                    database_1.default.prepare(`
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
                const item = database_1.default.prepare('SELECT name, stats FROM items WHERE id = ?').get(plot.seed_item_id);
                if (item) {
                    plot.seedName = item.name;
                    try {
                        const stats = JSON.parse(item.stats || '{}');
                        const productItem = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(stats.product);
                        plot.productName = productItem ? productItem.name : 'Linh dược';
                    }
                    catch (e) {
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
    unlockPlot(userId) {
        const currentPlots = database_1.default.prepare('SELECT COUNT(*) as count FROM farming_plots WHERE user_id = ?')
            .get(userId);
        if (currentPlots.count >= 6) {
            return { success: false, message: 'Đạo hữu đã mở khóa số lượng ô đất tối đa (6 ô)!' };
        }
        const costList = [100, 250, 500, 1000, 2000];
        const cost = costList[currentPlots.count - 1];
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa khởi tạo nhân vật.' };
        }
        if (user.coin_ha_pham < cost) {
            return { success: false, message: `Đạo hữu không đủ Linh Thạch để khai khẩn ô đất mới! (Cần **${cost}** Linh Thạch, hiện có **${user.coin_ha_pham}**)` };
        }
        // Trừ tiền
        UserRepository_1.userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - cost });
        // Khai khẩn ô đất
        database_1.default.prepare('INSERT INTO farming_plots (user_id, plot_index, status, moisture, nutrition, pests) VALUES (?, ?, \'empty\', 5, 6, 0)')
            .run(userId, currentPlots.count);
        return {
            success: true,
            message: `🎉 Đạo hữu tiêu hao **${cost} Linh Thạch** khai khẩn thành công **Ô đất số ${currentPlots.count + 1}**!`
        };
    }
    /**
     * Gieo hạt giống vào ô đất trống
     */
    plantSeed(userId, plotIndex, seedItemId) {
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const hasSeed = inv.some(i => i.item_id === seedItemId && i.quantity > 0);
        if (!hasSeed) {
            return { success: false, message: 'Đạo hữu không có hạt giống này trong túi hành trang!' };
        }
        const plot = database_1.default.prepare('SELECT id, status FROM farming_plots WHERE user_id = ? AND plot_index = ?')
            .get(userId, plotIndex);
        if (!plot) {
            return { success: false, message: 'Ô đất này chưa được khai khẩn!' };
        }
        if (plot.status !== 'empty') {
            return { success: false, message: 'Ô đất này đã được gieo trồng linh thực, không thể trồng đè!' };
        }
        const item = database_1.default.prepare('SELECT stats FROM items WHERE id = ?').get(seedItemId);
        if (!item) {
            return { success: false, message: 'Hạt giống này không có trong hồ sơ linh vật.' };
        }
        let growthTime = 300; // Mặc định 5 phút
        try {
            const stats = JSON.parse(item.stats || '{}');
            if (stats.growth_time)
                growthTime = stats.growth_time;
        }
        catch (e) {
            // bỏ qua
        }
        const now = Math.floor(Date.now() / 1000);
        // Cập nhật trạng thái ô đất khởi đầu đủ nước ẩm và phân bón
        database_1.default.prepare(`
      UPDATE farming_plots
      SET seed_item_id = ?, planted_at = ?, growth_time = ?, speedup_applied = 0, status = 'growing', moisture = 5, nutrition = 6, pests = 0
      WHERE id = ?
    `).run(seedItemId, now, growthTime, plot.id);
        // Trừ 1 hạt giống trong hành trang
        InventoryRepository_1.inventoryRepository.removeItem(userId, seedItemId, 1);
        // Kiểm tra thành tựu gieo trồng (đếm từ audit_logs)
        const totalPlant = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'plant_seed'").get(userId);
        const now2 = Math.floor(Date.now() / 1000);
        database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'plant_seed', ?, ?)").run(userId, JSON.stringify({ seedItemId }), now2);
        const newPlantCount = totalPlant.c + 1;
        AchievementService_1.achievementService.setProgress(userId, 'sh_6', newPlantCount);
        AchievementService_1.achievementService.setProgress(userId, 'sh_7', newPlantCount);
        return { success: true, message: 'Gieo hạt giống thành công.' };
    }
    /**
     * Tưới Nước Linh Điền
     */
    waterPlot(userId, plotIndex) {
        // Gọi getPlots để cập nhật sinh học trước khi tưới nước
        this.getPlots(userId);
        const plot = database_1.default.prepare('SELECT id, status, moisture FROM farming_plots WHERE user_id = ? AND plot_index = ?')
            .get(userId, plotIndex);
        if (!plot || plot.status !== 'growing') {
            return { success: false, message: 'Ô đất này chưa gieo hạt giống, không cần tưới nước!' };
        }
        if (plot.moisture >= 5) {
            return { success: false, message: 'Độ ẩm của đất đã đạt bão hòa, không cần tưới thêm!' };
        }
        const now = Math.floor(Date.now() / 1000);
        const newMoisture = Math.min(5, plot.moisture + 2);
        database_1.default.prepare('UPDATE farming_plots SET moisture = ?, planted_at = ? WHERE id = ?')
            .run(newMoisture, now, plot.id);
        return { success: true, message: `💧 Đạo hữu tưới nước cho ô đất ${plotIndex + 1}, tăng độ ẩm linh thổ lên **${newMoisture}/5**!` };
    }
    /**
     * Bón Phân Linh Điền
     */
    fertilizePlot(userId, plotIndex) {
        this.getPlots(userId);
        const plot = database_1.default.prepare('SELECT id, status, nutrition FROM farming_plots WHERE user_id = ? AND plot_index = ?')
            .get(userId, plotIndex);
        if (!plot || plot.status !== 'growing') {
            return { success: false, message: 'Ô đất này chưa gieo hạt giống, không cần bón phân!' };
        }
        if (plot.nutrition >= 6) {
            return { success: false, message: 'Dinh dưỡng của đất đã đầy đủ, bón phân nhiều sẽ làm cháy rễ!' };
        }
        const now = Math.floor(Date.now() / 1000);
        const newNutrition = Math.min(6, plot.nutrition + 2);
        database_1.default.prepare('UPDATE farming_plots SET nutrition = ?, planted_at = ? WHERE id = ?')
            .run(newNutrition, now, plot.id);
        return { success: true, message: `🪱 Đạo hữu bón phân cho ô đất ${plotIndex + 1}, tăng dinh dưỡng linh thổ lên **${newNutrition}/6**!` };
    }
    /**
     * Bắt Sâu Diệt Hại
     */
    catchPests(userId, plotIndex) {
        this.getPlots(userId);
        const plot = database_1.default.prepare('SELECT id, status, pests FROM farming_plots WHERE user_id = ? AND plot_index = ?')
            .get(userId, plotIndex);
        if (!plot || plot.status !== 'growing') {
            return { success: false, message: 'Ô đất trống không có sâu bệnh.' };
        }
        if (plot.pests === 0) {
            return { success: false, message: 'Linh thực thanh khiết, không phát hiện sâu bọ cắn phá!' };
        }
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('UPDATE farming_plots SET pests = 0, planted_at = ? WHERE id = ?')
            .run(now, plot.id);
        return { success: true, message: `🐛 Đạo hữu cẩn thận bắt sâu diệt hại cho ô đất ${plotIndex + 1}, bảo hộ linh dược bình an!` };
    }
    /**
     * Dùng Thần Hành Phù để gia tốc linh thực
     */
    speedupPlot(userId, plotIndex) {
        const inv = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        const hasTalisman = inv.some(i => i.item_id === itemConstants_1.ITEMS.TALISMAN_SPEED_1 && i.quantity > 0);
        if (!hasTalisman) {
            return { success: false, message: 'Đạo hữu không có **Thần Hành Phù** trong túi đồ để sử dụng!' };
        }
        // Cập nhật tiến trình sinh học trước khi dùng phù
        this.getPlots(userId);
        const plot = database_1.default.prepare('SELECT id, status, growth_time FROM farming_plots WHERE user_id = ? AND plot_index = ?')
            .get(userId, plotIndex);
        if (!plot || plot.status !== 'growing') {
            return { success: false, message: 'Ô đất này không trong trạng thái sinh trưởng, không cần gia tốc!' };
        }
        if (plot.growth_time <= 0) {
            return { success: false, message: 'Linh thực trên ô đất này đã chín rồi, mau thu hoạch đi!' };
        }
        const now = Math.floor(Date.now() / 1000);
        const newGrowthTime = Math.max(0, plot.growth_time - 3600); // Giảm 1 giờ
        database_1.default.prepare(`
      UPDATE farming_plots
      SET growth_time = ?, planted_at = ?, speedup_applied = speedup_applied + 1
      WHERE id = ?
    `).run(newGrowthTime, now, plot.id);
        // Trừ phù lục
        InventoryRepository_1.inventoryRepository.removeItem(userId, itemConstants_1.ITEMS.TALISMAN_SPEED_1, 1);
        return { success: true, message: 'Sử dụng Thần Hành Phù gia tốc thành công! Rút ngắn thời gian lớn đi **1 giờ**.' };
    }
    /**
     * Thu hoạch linh dược khi chín
     */
    harvestPlot(userId, plotIndex) {
        // Cập nhật tiến trình sinh học để tính toán chín chưa
        this.getPlots(userId);
        const plot = database_1.default.prepare('SELECT * FROM farming_plots WHERE user_id = ? AND plot_index = ?')
            .get(userId, plotIndex);
        if (!plot || plot.status !== 'growing') {
            return { success: false, message: 'Ô đất này không có linh thực đang trồng!' };
        }
        if (plot.growth_time > 0) {
            return { success: false, message: `Linh thực chưa trưởng thành hoàn toàn! Vui lòng chờ đợi hoặc chăm bón (Còn lại: **${plot.growth_time} giây**).` };
        }
        // Lấy thông tin sản vật phẩm đầu ra
        const item = database_1.default.prepare('SELECT stats FROM items WHERE id = ?').get(plot.seed_item_id);
        let productItemId = itemConstants_1.ITEMS.MATERIAL_LINH_THAO_1;
        try {
            const stats = JSON.parse(item.stats || '{}');
            if (stats.product)
                productItemId = stats.product;
        }
        catch (e) {
            // bỏ qua
        }
        const productDetails = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(productItemId);
        const productName = productDetails ? productDetails.name : 'Linh dược';
        let amount = 1;
        let leylineMsg = '';
        // Leyline Buff Thu Thập: 25% cơ hội thu hoạch x2
        if (LeylineService_1.leylineService.isBuffActive('thuthap') && Math.random() < 0.25) {
            amount = 2;
            leylineMsg = ' *(Linh Mạch Buff x2!)*';
        }
        // Thêm vật phẩm thu hoạch vào hành trang
        InventoryRepository_1.inventoryRepository.addItem(userId, productItemId, amount);
        // Reset ô đất về rỗng
        database_1.default.prepare(`
      UPDATE farming_plots
      SET seed_item_id = NULL, planted_at = NULL, growth_time = 0, speedup_applied = 0, status = 'empty', moisture = 5, nutrition = 6, pests = 0
      WHERE id = ?
    `).run(plot.id);
        return {
            success: true,
            message: `✨ Thu hoạch thành công **${amount}x ${productName}**!${leylineMsg}`,
            productName
        };
    }
}
exports.FarmingService = FarmingService;
exports.farmingService = new FarmingService();
