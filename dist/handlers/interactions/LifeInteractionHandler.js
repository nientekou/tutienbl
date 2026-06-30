"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifeInteractionHandler = void 0;
const uiSystem_1 = require("../../utils/uiSystem");
const AlchemyService_1 = require("../../services/AlchemyService");
const InventoryRepository_1 = require("../../database/repositories/InventoryRepository");
const UserRepository_1 = require("../../database/repositories/UserRepository");
const luyendan_1 = __importDefault(require("../../commands/general/luyendan"));
const DailyQuestService_1 = require("../../services/DailyQuestService");
const QuestChainService_1 = require("../../services/QuestChainService");
const v2Components_1 = require("../../utils/v2Components");
class LifeInteractionHandler {
    static async handle(interaction, action, parts, targetUserId) {
        if (action === 'alch') {
            const subAction = parts[1];
            if (subAction === 'toggleqty') {
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (!user)
                    return;
                let yCanh = {};
                try {
                    yCanh = JSON.parse(user.y_canh || '{}');
                }
                catch (e) {
                    yCanh = {};
                }
                const currentQty = yCanh.active_craft_quantity || 1;
                const newQty = currentQty === 1 ? 2 : 1;
                yCanh.active_craft_quantity = newQty;
                UserRepository_1.userRepository.update(targetUserId, { y_canh: JSON.stringify(yCanh) });
                const luyenDanCmd = new luyendan_1.default();
                const updatedEmbed = luyenDanCmd.getAlchemyEmbed(targetUserId);
                const updatedComponents = luyenDanCmd.getAlchemyComponents(targetUserId);
                await (0, uiSystem_1.safeV2Update)(interaction, [updatedEmbed], updatedComponents);
                return;
            }
            if (subAction === 'craft' || subAction === 'select') {
                const user = UserRepository_1.userRepository.get(targetUserId);
                if (!user)
                    return;
                let yCanh = {};
                try {
                    yCanh = JSON.parse(user.y_canh || '{}');
                }
                catch (e) {
                    yCanh = {};
                }
                const activeQty = yCanh.active_craft_quantity || 1;
                const inv = InventoryRepository_1.inventoryRepository.getUserInventory(targetUserId);
                const cauldrons = inv.filter(i => i.type === 'cauldron');
                let bestCauldron = null;
                if (cauldrons.length > 0) {
                    const order = ['cauldron_high', 'cauldron_mid', 'cauldron_low'];
                    for (const cid of order) {
                        bestCauldron = cauldrons.find(i => i.item_id === cid);
                        if (bestCauldron)
                            break;
                    }
                }
                let recipeId;
                if (subAction === 'select') {
                    recipeId = interaction.values[0];
                }
                else {
                    recipeId = parts.slice(2, -1).join('_');
                }
                const res = AlchemyService_1.alchemyService.craftPill(targetUserId, recipeId, bestCauldron?.id, activeQty);
                if (res.success) {
                    DailyQuestService_1.dailyQuestService.updateProgress(targetUserId, 'daily_luyendan', activeQty);
                    QuestChainService_1.questChainService.updateProgress(targetUserId, 'craft', activeQty);
                }
                const luyenDanCmd = new luyendan_1.default();
                const updatedEmbed = luyenDanCmd.getAlchemyEmbed(targetUserId);
                const updatedComponents = luyenDanCmd.getAlchemyComponents(targetUserId);
                let resultIcon = res.success ? '✅' : '💥';
                const feedbackContainer = (0, v2Components_1.container)(res.success ? v2Components_1.V2_COLORS.success : v2Components_1.V2_COLORS.danger, [
                    (0, v2Components_1.header)(`🔔 Kết quả luyện chế: ${resultIcon} ${res.message}`)
                ]);
                await (0, uiSystem_1.safeV2Update)(interaction, [feedbackContainer, updatedEmbed], updatedComponents);
            }
            return;
        }
    }
}
exports.LifeInteractionHandler = LifeInteractionHandler;
