"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alchemyService = exports.AlchemyService = exports.ALCHEMY_RECIPES = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const AchievementService_1 = require("./AchievementService");
exports.ALCHEMY_RECIPES = [
    {
        id: 'recipe_tuvi',
        name: 'Luyện Khí Đan',
        targetPillId: 'pill_alchemy_tuvi',
        requiredMaterials: [{ itemId: 'material_linh_thao_1', quantity: 5 }],
        costCoin: 100,
        staminaCost: 10,
        requiredAlchemyLevel: 1,
        baseSuccessRate: 0.65, // giảm từ 0.80
        expGained: 10
    },
    {
        id: 'recipe_loi',
        name: 'Ngự Lôi Đan',
        targetPillId: 'pill_alchemy_anti_loi',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 10 },
            { itemId: 'material_nhan_sam_1', quantity: 5 },
            { itemId: 'material_iron_1', quantity: 2 }
        ],
        costCoin: 400,
        staminaCost: 15,
        requiredAlchemyLevel: 2,
        baseSuccessRate: 0.50, // giảm từ 0.65
        expGained: 35
    },
    {
        id: 'recipe_break',
        name: 'Thanh Tâm Đan',
        targetPillId: 'pill_alchemy_break',
        requiredMaterials: [
            { itemId: 'material_nhan_sam_1', quantity: 3 },
            { itemId: 'material_linh_thao_1', quantity: 3 }
        ],
        costCoin: 250,
        staminaCost: 15,
        requiredAlchemyLevel: 2,
        baseSuccessRate: 0.55, // giảm từ 0.70
        expGained: 25
    },
    {
        id: 'recipe_stamina',
        name: 'Bổ Thiên Đan',
        targetPillId: 'pill_alchemy_stamina',
        requiredMaterials: [
            { itemId: 'material_nhan_sam_1', quantity: 5 },
            { itemId: 'material_linh_thao_1', quantity: 5 },
            { itemId: 'item_fragment', quantity: 1 }
        ],
        costCoin: 500,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.45, // giảm từ 0.60
        expGained: 50
    },
    {
        id: 'recipe_stamina_1',
        name: 'Hồi Thể Đan - Sơ Cấp',
        targetPillId: 'pill_stamina_1',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 3 },
            { itemId: 'material_nhan_sam_1', quantity: 1 }
        ],
        costCoin: 100,
        staminaCost: 10,
        requiredAlchemyLevel: 1,
        baseSuccessRate: 0.70, // giảm từ 0.85
        expGained: 15
    },
    {
        id: 'recipe_stamina_2',
        name: 'Hồi Thể Đan - Trung Cấp',
        targetPillId: 'pill_stamina_2',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 5 },
            { itemId: 'material_nhan_sam_1', quantity: 3 }
        ],
        costCoin: 200,
        staminaCost: 15,
        requiredAlchemyLevel: 2,
        baseSuccessRate: 0.55, // giảm từ 0.70
        expGained: 30
    },
    {
        id: 'recipe_stamina_3',
        name: 'Hồi Thể Đan - Cao Cấp',
        targetPillId: 'pill_stamina_3',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 10 },
            { itemId: 'material_nhan_sam_1', quantity: 5 },
            { itemId: 'material_blood_flower', quantity: 1 }
        ],
        costCoin: 400,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.45, // giảm từ 0.60
        expGained: 60
    },
    {
        id: 'recipe_linh_tuyen',
        name: 'Linh Tuyền Phù',
        targetPillId: 'pill_linh_tuyen',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 15 },
            { itemId: 'material_nhan_sam_1', quantity: 10 },
            { itemId: 'material_blood_flower', quantity: 3 }
        ],
        costCoin: 1500,
        staminaCost: 30,
        requiredAlchemyLevel: 5,
        baseSuccessRate: 0.35,
        expGained: 100
    },
    {
        id: 'recipe_nhan_tu',
        name: 'Nhàn Tu Đan',
        targetPillId: 'pill_nhan_tu',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 20 },
            { itemId: 'material_nhan_sam_1', quantity: 15 },
            { itemId: 'material_blood_flower', quantity: 5 }
        ],
        costCoin: 3000,
        staminaCost: 40,
        requiredAlchemyLevel: 8,
        baseSuccessRate: 0.25,
        expGained: 150
    },
    {
        id: 'recipe_hp_max_perm',
        name: 'Huyết Nguyên Đan',
        targetPillId: 'pill_hp_max_perm',
        requiredMaterials: [
            { itemId: 'material_blood_flower', quantity: 5 },
            { itemId: 'material_nhan_sam_1', quantity: 5 }
        ],
        costCoin: 1000,
        staminaCost: 25,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.35, // giảm từ 0.50
        expGained: 100
    },
    {
        id: 'recipe_mp_50',
        name: 'Hư Không Đan',
        targetPillId: 'pill_mp_50',
        requiredMaterials: [
            { itemId: 'material_void_herb', quantity: 5 },
            { itemId: 'material_linh_thao_1', quantity: 10 }
        ],
        costCoin: 800,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.35, // giảm từ 0.50
        expGained: 80
    },
    {
        id: 'recipe_speed_buff',
        name: 'Thiên Phong Đan',
        targetPillId: 'pill_speed_buff',
        requiredMaterials: [
            { itemId: 'material_wind_leaf', quantity: 5 },
            { itemId: 'material_linh_thao_1', quantity: 10 }
        ],
        costCoin: 800,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.35, // giảm từ 0.50
        expGained: 80
    },
    {
        id: 'recipe_cuu_chuyen',
        name: 'Cửu Chuyển Hoàn Hồn Đan',
        targetPillId: 'pill_cuu_chuyen',
        requiredMaterials: [
            { itemId: 'material_tuyet_lien', quantity: 5 },
            { itemId: 'material_linh_thao_1', quantity: 5 }
        ],
        costCoin: 1500,
        staminaCost: 25,
        requiredAlchemyLevel: 4,
        baseSuccessRate: 0.30, // giảm từ 0.45
        expGained: 150
    },
    {
        id: 'recipe_ngo_dong',
        name: 'Ngô Đồng Trường Sinh Đan',
        targetPillId: 'pill_ngo_dong',
        requiredMaterials: [
            { itemId: 'material_ngodong', quantity: 5 },
            { itemId: 'material_linh_thao_1', quantity: 5 }
        ],
        costCoin: 2000,
        staminaCost: 30,
        requiredAlchemyLevel: 4,
        baseSuccessRate: 0.25, // giảm từ 0.40
        expGained: 200
    },
    {
        id: 'recipe_huyen_am',
        name: 'Huyền Âm Kiếp Đan',
        targetPillId: 'pill_huyen_am',
        requiredMaterials: [
            { itemId: 'material_lingzhi', quantity: 5 },
            { itemId: 'material_linh_thao_1', quantity: 5 }
        ],
        costCoin: 1800,
        staminaCost: 25,
        requiredAlchemyLevel: 4,
        baseSuccessRate: 0.27, // giảm từ 0.42
        expGained: 180
    },
    {
        id: 'recipe_tay_tuy',
        name: 'Tẩy Tủy Đan',
        targetPillId: 'pill_tay_tuy',
        requiredMaterials: [
            { itemId: 'material_blood_flower', quantity: 10 },
            { itemId: 'material_void_herb', quantity: 10 },
            { itemId: 'material_wind_leaf', quantity: 10 },
            { itemId: 'material_tuyet_lien', quantity: 5 }
        ],
        costCoin: 5000,
        staminaCost: 50,
        requiredAlchemyLevel: 5,
        baseSuccessRate: 0.20,
        expGained: 500
    },
    {
        id: 'recipe_protect_hoa',
        name: 'Hỏa Linh Đan',
        targetPillId: 'pill_protect_hoa',
        requiredMaterials: [
            { itemId: 'material_blood_flower', quantity: 3 },
            { itemId: 'material_linh_thao_1', quantity: 5 }
        ],
        costCoin: 800,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.40,
        expGained: 80
    },
    {
        id: 'recipe_protect_thuy',
        name: 'Thủy Nguyên Đan',
        targetPillId: 'pill_protect_thuy',
        requiredMaterials: [
            { itemId: 'material_void_herb', quantity: 3 },
            { itemId: 'material_linh_thao_1', quantity: 5 }
        ],
        costCoin: 800,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.40,
        expGained: 80
    },
    {
        id: 'recipe_protect_moc',
        name: 'Mộc Linh Hoàn',
        targetPillId: 'pill_protect_moc',
        requiredMaterials: [
            { itemId: 'material_tuyet_lien', quantity: 3 },
            { itemId: 'material_linh_thao_1', quantity: 5 }
        ],
        costCoin: 800,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.40,
        expGained: 80
    },
    {
        id: 'recipe_protect_kim',
        name: 'Kim Cương Đan',
        targetPillId: 'pill_protect_kim',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 8 },
            { itemId: 'material_iron_1', quantity: 3 }
        ],
        costCoin: 800,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.40,
        expGained: 80
    },
    {
        id: 'recipe_protect_tho',
        name: 'Địa Thổ Đan',
        targetPillId: 'pill_protect_tho',
        requiredMaterials: [
            { itemId: 'material_linh_thao_1', quantity: 8 },
            { itemId: 'material_nhan_sam_1', quantity: 3 }
        ],
        costCoin: 800,
        staminaCost: 20,
        requiredAlchemyLevel: 3,
        baseSuccessRate: 0.40,
        expGained: 80
    },
    {
        id: 'recipe_co_duyen',
        name: 'Cơ Duyên Đơn',
        targetPillId: 'pill_co_duyen',
        requiredMaterials: [
            { itemId: 'material_ngodong', quantity: 5 },
            { itemId: 'material_linh_thao_1', quantity: 10 }
        ],
        costCoin: 2000,
        staminaCost: 30,
        requiredAlchemyLevel: 4,
        baseSuccessRate: 0.25,
        expGained: 150
    }
];
class AlchemyService {
    /**
     * Lấy danh sách công thức luyện đan
     */
    getRecipes() {
        return exports.ALCHEMY_RECIPES;
    }
    /**
     * Thực hiện Luyện Đan
     */
    craftPill(userId, recipeId, cauldronInventoryId, quantity = 1) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user) {
            return { success: false, message: 'Đạo hữu chưa tạo nhân vật!' };
        }
        if (quantity < 1 || quantity > 2) {
            return { success: false, message: 'Số lượng chế tác không hợp lệ.' };
        }
        // Kiểm tra thương thế
        const now = Math.floor(Date.now() / 1000);
        if (user.injury_end_time && user.injury_end_time > now) {
            const remain = user.injury_end_time - now;
            return { success: false, message: `Đạo hữu đang bị trọng thương, không thể luyện đan! (Còn lại **${remain} giây**).` };
        }
        const recipe = exports.ALCHEMY_RECIPES.find(r => r.id === recipeId);
        if (!recipe) {
            return { success: false, message: 'Công thức luyện đan này không tồn tại.' };
        }
        // 1. Kiểm tra cấp độ luyện đan
        const userAlchemyLevel = user.alchemy_level || 1;
        if (userAlchemyLevel < recipe.requiredAlchemyLevel) {
            return { success: false, message: `Trình độ Luyện Đan của đạo hữu chưa đủ! (Yêu cầu cấp: **${recipe.requiredAlchemyLevel}**, Hiện tại: **${userAlchemyLevel}**).` };
        }
        // 2. Kiểm tra Thể lực
        const totalStaminaCost = recipe.staminaCost * quantity;
        if (user.stamina < totalStaminaCost) {
            return { success: false, message: `Thể lực không đủ để luyện đan x${quantity}! (Yêu cầu: **${totalStaminaCost}**, Hiện tại: **${user.stamina}**).` };
        }
        // 3. Kiểm tra Linh Thạch
        const totalCostCoin = recipe.costCoin * quantity;
        if (user.coin_ha_pham < totalCostCoin) {
            return { success: false, message: `Linh Thạch không đủ để trả phí lò lửa x${quantity}! (Yêu cầu: **${totalCostCoin}**, Hiện tại: **${user.coin_ha_pham}**).` };
        }
        // 4. Kiểm tra nguyên liệu trong hành trang
        const inventory = InventoryRepository_1.inventoryRepository.getUserInventory(userId);
        for (const mat of recipe.requiredMaterials) {
            const invItem = inventory.find(i => i.item_id === mat.itemId);
            const reqQty = mat.quantity * quantity;
            if (!invItem || invItem.quantity < reqQty) {
                const itemInfo = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(mat.itemId);
                const itemName = itemInfo ? itemInfo.name : mat.itemId;
                return { success: false, message: `Thiếu nguyên liệu luyện đan: **${itemName}** (Yêu cầu: **${reqQty}**, Hiện có: **${invItem ? invItem.quantity : 0}**).` };
            }
        }
        // 5. Kiểm tra Lò Luyện Đan
        let successBonus = 0.0;
        let cauldronItem = null;
        if (cauldronInventoryId) {
            cauldronItem = InventoryRepository_1.inventoryRepository.get(cauldronInventoryId);
            if (!cauldronItem || cauldronItem.user_id !== userId || cauldronItem.type !== 'cauldron') {
                return { success: false, message: 'Lò luyện đan đã chọn không hợp lệ hoặc không có trong túi đồ!' };
            }
            try {
                const stats = JSON.parse(cauldronItem.stats || '{}');
                successBonus = stats.success_rate_bonus || 0.0;
            }
            catch (e) {
                // bỏ qua
            }
        }
        // Kiểm tra chế tạo x2 chỉ cho phép Linh Sư hoặc dùng Lò Luyện Đan Cao Cấp
        if (quantity === 2) {
            const isLinhSu = userAlchemyLevel >= 3;
            const hasHighCauldron = cauldronItem && cauldronItem.item_id === 'cauldron_high';
            if (!isLinhSu && !hasHighCauldron) {
                return { success: false, message: '❌ Cần đạt trình độ Linh Sư (Cấp 3 Luyện Đan) hoặc sử dụng Lò Luyện Đan Thượng Phẩm để chế tác x2 cùng lúc!' };
            }
        }
        // Tính toán tỷ lệ thành công cuối cùng
        // Level chênh lệch buff: +2% mỗi cấp
        const levelDiff = userAlchemyLevel - recipe.requiredAlchemyLevel;
        const levelBonus = levelDiff * 0.02;
        // Cộng hưởng từ Luyện Đan Đường của Tông Môn
        let sectBonus = 0.0;
        if (user.sect_id) {
            try {
                const sect = database_1.default.prepare('SELECT dan_duong_level FROM sects WHERE id = ?').get(user.sect_id);
                if (sect && sect.dan_duong_level) {
                    sectBonus = sect.dan_duong_level * 0.02; // +2% mỗi cấp
                }
            }
            catch (e) { }
        }
        // Cộng hưởng Hỏa Linh Căn (+0.1% tỷ lệ thành công / điểm Hỏa Linh Căn)
        let hoaLinhCan = 0;
        try {
            const lc = JSON.parse(user.linh_can || '{}');
            hoaLinhCan = lc['Hỏa'] || 0;
        }
        catch (e) { }
        const hoaBonus = hoaLinhCan * 0.001; // +0.1% mỗi điểm Hỏa Linh Căn
        const finalSuccessRate = Math.min(0.95, recipe.baseSuccessRate + successBonus + levelBonus + sectBonus + hoaBonus);
        // Trừ Thể Lực và Linh Thạch trước
        const postStamina = user.stamina - totalStaminaCost;
        const postCoin = user.coin_ha_pham - totalCostCoin;
        UserRepository_1.userRepository.update(userId, { stamina: postStamina, coin_ha_pham: postCoin });
        // Trừ nguyên liệu
        for (const mat of recipe.requiredMaterials) {
            InventoryRepository_1.inventoryRepository.removeItem(userId, mat.itemId, mat.quantity * quantity);
        }
        let successCount = 0;
        let evolvedCount = 0;
        for (let i = 0; i < quantity; i++) {
            const roll = Math.random();
            if (roll <= finalSuccessRate) {
                successCount++;
                if (Math.random() < 0.05) {
                    evolvedCount++;
                }
            }
        }
        const staticPill = database_1.default.prepare('SELECT name FROM items WHERE id = ?').get(recipe.targetPillId);
        const rewardName = staticPill.name;
        if (successCount > 0) {
            if (evolvedCount > 0) {
                InventoryRepository_1.inventoryRepository.addItem(userId, recipe.targetPillId, evolvedCount, JSON.stringify({ evolved: true }));
            }
            if (successCount - evolvedCount > 0) {
                InventoryRepository_1.inventoryRepository.addItem(userId, recipe.targetPillId, successCount - evolvedCount, null);
            }
            // Tăng EXP luyện đan
            let currentExp = user.alchemy_exp || 0;
            let currentLevel = user.alchemy_level || 1;
            const totalExpGained = recipe.expGained * quantity;
            currentExp += totalExpGained;
            const expNeeded = currentLevel * 100;
            let isLevelUp = false;
            if (currentExp >= expNeeded) {
                currentLevel += 1;
                currentExp -= expNeeded;
                isLevelUp = true;
            }
            UserRepository_1.userRepository.update(userId, {
                alchemy_level: currentLevel,
                alchemy_exp: currentExp
            });
            // Kiểm tra thành tựu luyện đan (đếm từ audit_logs)
            const now2 = Math.floor(Date.now() / 1000);
            database_1.default.prepare("INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, 'alchemy_craft', ?, ?)").run(userId, JSON.stringify({ recipeId, successCount, quantity }), now2);
            const totalAlchemy = database_1.default.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'alchemy_craft'").get(userId);
            const newAlchemyCount = totalAlchemy.c;
            AchievementService_1.achievementService.setProgress(userId, 'sh_3', newAlchemyCount);
            AchievementService_1.achievementService.setProgress(userId, 'sh_4', newAlchemyCount);
            AchievementService_1.achievementService.setProgress(userId, 'sh_5', newAlchemyCount);
            let responseMsg = `🎉 **Luyện đan hoàn tất!** Đạo hữu đã luyện chế thành công **${successCount}x ${rewardName}**${evolvedCount > 0 ? ` (trong đó có ${evolvedCount} viên Biến Dị 🧬)` : ''}!\n`;
            if (successCount < quantity) {
                responseMsg += `⚠️ Có **${quantity - successCount}** mẻ bị nổ lò thất bại do dược lực không ổn định.\n`;
            }
            responseMsg += `📈 Nhận **+${totalExpGained}** EXP Luyện Đan (Hiện tại: **${currentExp}/${currentLevel * 100}**).`;
            if (isLevelUp) {
                responseMsg += `\n🌟 **Chúc mừng!** Đạo hữu đột phá Luyện Đan Thuật thăng lên **Cấp ${currentLevel} Luyện Đan Sư**!`;
            }
            return { success: true, message: responseMsg, isLevelUp, evolved: evolvedCount > 0 };
        }
        else {
            // Thất bại hoàn toàn -> Nổ lò!
            // Trọng thương tỷ lệ thuận với cấp độ yêu cầu của công thức (15, 30, 45, 60 phút)
            const injuryMinutes = recipe.requiredAlchemyLevel * 15;
            const injuryDuration = injuryMinutes * 60;
            const injuryEnd = now + injuryDuration;
            UserRepository_1.userRepository.update(userId, { injury_end_time: injuryEnd });
            let cauldronDestructionMsg = '';
            if (cauldronItem) {
                let breakChance = 0;
                if (cauldronItem.item_id === 'cauldron_low')
                    breakChance = 0.25;
                else if (cauldronItem.item_id === 'cauldron_mid')
                    breakChance = 0.10;
                else if (cauldronItem.item_id === 'cauldron_high')
                    breakChance = 0.05;
                if (Math.random() < breakChance) {
                    InventoryRepository_1.inventoryRepository.removeItemById(cauldronItem.id, 1);
                    cauldronDestructionMsg = `\n🔥 Do linh hỏa phản phệ dữ dội, chiếc **${cauldronItem.name}** của đạo hữu đã bị nứt vỡ thành tro bụi!`;
                }
            }
            return {
                success: false,
                message: `💥 **Nổ lò!** Độc hỏa và linh khí bạo tẩu giăng đầy luyện đan phòng! Đạo hữu luyện chế x${quantity} thất bại hoàn toàn, tiêu hao toàn bộ nguyên liệu, bị phế thương kinh mạch (Trọng thương **${injuryMinutes} phút**).${cauldronDestructionMsg}`
            };
        }
    }
}
exports.AlchemyService = AlchemyService;
exports.alchemyService = new AlchemyService();
