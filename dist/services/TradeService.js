"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeService = exports.TradeService = void 0;
const discord_js_1 = require("discord.js");
const uiSystem_1 = require("../utils/uiSystem");
const UserRepository_1 = require("../database/repositories/UserRepository");
const InventoryRepository_1 = require("../database/repositories/InventoryRepository");
const database_1 = __importDefault(require("../database/database"));
const globalAny = global;
if (!globalAny.__activeTrades) {
    globalAny.__activeTrades = new Map();
}
class TradeService {
    activeTrades = globalAny.__activeTrades;
    // Create a new trade request
    initiateTrade(initiatorId, targetId) {
        if (initiatorId === targetId) {
            return { success: false, message: 'Đạo hữu không thể giao dịch với chính mình!' };
        }
        const initiator = UserRepository_1.userRepository.get(initiatorId);
        const target = UserRepository_1.userRepository.get(targetId);
        if (!initiator || !target) {
            return { success: false, message: 'Một trong hai người chưa tạo nhân vật!' };
        }
        // Check if either is already in a trade
        for (const trade of this.activeTrades.values()) {
            if (trade.status !== 'completed' && trade.status !== 'cancelled') {
                if (trade.initiator.discordId === initiatorId || trade.target.discordId === initiatorId) {
                    return { success: false, message: 'Đạo hữu đang trong một giao dịch khác!' };
                }
                if (trade.initiator.discordId === targetId || trade.target.discordId === targetId) {
                    return { success: false, message: 'Đối phương đang bận giao dịch với người khác!' };
                }
            }
        }
        const tradeId = `trade_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.activeTrades.set(tradeId, {
            id: tradeId,
            initiator: { discordId: initiatorId, name: initiator.name, coins: 0, items: [], isLocked: false, isConfirmed: false },
            target: { discordId: targetId, name: target.name, coins: 0, items: [], isLocked: false, isConfirmed: false },
            status: 'pending',
            updatedAt: Date.now()
        });
        return { success: true, message: `Yêu cầu giao dịch đã được gửi.`, tradeId };
    }
    getTrade(tradeId) {
        return this.activeTrades.get(tradeId);
    }
    acceptTrade(tradeId, userId) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade)
            return { success: false, message: 'Giao dịch không tồn tại hoặc đã hết hạn.' };
        if (trade.target.discordId !== userId) {
            return { success: false, message: 'Đạo hữu không có quyền chấp nhận giao dịch này!' };
        }
        if (trade.status !== 'pending') {
            return { success: false, message: 'Trạng thái giao dịch không hợp lệ.' };
        }
        trade.status = 'active';
        trade.updatedAt = Date.now();
        return { success: true, message: 'Giao dịch bắt đầu.' };
    }
    cancelTrade(tradeId, userId) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade)
            return { success: false, message: 'Giao dịch không tồn tại.' };
        if (trade.initiator.discordId !== userId && trade.target.discordId !== userId) {
            return { success: false, message: 'Đạo hữu không ở trong giao dịch này!' };
        }
        trade.status = 'cancelled';
        this.activeTrades.delete(tradeId);
        return { success: true, message: 'Giao dịch đã bị hủy bỏ.' };
    }
    addCoins(tradeId, userId, amount) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade || trade.status !== 'active')
            return { success: false, message: 'Giao dịch không hợp lệ.' };
        const participant = trade.initiator.discordId === userId ? trade.initiator : trade.target;
        if (participant.discordId !== userId)
            return { success: false, message: 'Không thuộc giao dịch.' };
        if (participant.isLocked)
            return { success: false, message: 'Đã khóa giao dịch, không thể thay đổi!' };
        const user = UserRepository_1.userRepository.get(userId);
        if (!user || user.coin_ha_pham < amount) {
            return { success: false, message: 'Đạo hữu không có đủ Hạ Phẩm Linh Thạch.' };
        }
        participant.coins = amount;
        this.unlockBoth(trade); // Any change unlocks both to prevent scam
        trade.updatedAt = Date.now();
        return { success: true, message: `Đã đặt ${amount} Linh Thạch.` };
    }
    addItem(tradeId, userId, inventoryId, quantity = 1) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade || trade.status !== 'active')
            return { success: false, message: 'Giao dịch không hợp lệ.' };
        const participant = trade.initiator.discordId === userId ? trade.initiator : trade.target;
        if (participant.discordId !== userId)
            return { success: false, message: 'Không thuộc giao dịch.' };
        if (participant.isLocked)
            return { success: false, message: 'Đã khóa giao dịch, không thể thay đổi!' };
        const item = InventoryRepository_1.inventoryRepository.get(inventoryId);
        if (!item || item.user_id !== userId || item.is_equipped === 1) {
            return { success: false, message: 'Vật phẩm không tồn tại hoặc đang được trang bị.' };
        }
        // Verify quantity bounds
        if (quantity <= 0)
            return { success: false, message: 'Số lượng không hợp lệ.' };
        // Total quantity added across all existing added items of the same inventoryId
        const existingQty = participant.items.reduce((sum, i) => i.inventoryId === inventoryId ? sum + i.quantity : sum, 0);
        if (existingQty + quantity > item.quantity) {
            return { success: false, message: 'Không đủ số lượng vật phẩm này.' };
        }
        const existingItem = participant.items.find(i => i.inventoryId === inventoryId);
        if (existingItem) {
            existingItem.quantity += quantity;
        }
        else {
            participant.items.push({
                inventoryId,
                itemId: item.item_id,
                name: item.name,
                quantity
            });
        }
        this.unlockBoth(trade);
        trade.updatedAt = Date.now();
        return { success: true, message: `Đã đưa ${quantity}x ${item.name} vào giao dịch.` };
    }
    removeItem(tradeId, userId, inventoryId) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade || trade.status !== 'active')
            return { success: false, message: 'Giao dịch không hợp lệ.' };
        const participant = trade.initiator.discordId === userId ? trade.initiator : trade.target;
        if (participant.discordId !== userId)
            return { success: false, message: 'Không thuộc giao dịch.' };
        if (participant.isLocked)
            return { success: false, message: 'Đã khóa giao dịch, không thể thay đổi!' };
        participant.items = participant.items.filter(i => i.inventoryId !== inventoryId);
        this.unlockBoth(trade);
        trade.updatedAt = Date.now();
        return { success: true, message: `Đã lấy vật phẩm ra khỏi giao dịch.` };
    }
    toggleLock(tradeId, userId) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade || trade.status !== 'active')
            return { success: false, message: 'Giao dịch không hợp lệ.' };
        const participant = trade.initiator.discordId === userId ? trade.initiator : trade.target;
        if (participant.discordId !== userId)
            return { success: false, message: 'Không thuộc giao dịch.' };
        participant.isLocked = !participant.isLocked;
        // If unlocking, also unconfirm
        if (!participant.isLocked) {
            participant.isConfirmed = false;
        }
        trade.updatedAt = Date.now();
        return { success: true, message: participant.isLocked ? 'Đã KHÓA giao dịch.' : 'Đã MỞ KHÓA giao dịch.' };
    }
    toggleConfirm(tradeId, userId) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade || trade.status !== 'active')
            return { success: false, message: 'Giao dịch không hợp lệ.' };
        const participant = trade.initiator.discordId === userId ? trade.initiator : trade.target;
        if (participant.discordId !== userId)
            return { success: false, message: 'Không thuộc giao dịch.' };
        if (!participant.isLocked) {
            return { success: false, message: 'Phải KHÓA giao dịch trước khi XÁC NHẬN.' };
        }
        participant.isConfirmed = !participant.isConfirmed;
        trade.updatedAt = Date.now();
        // Check if both confirmed
        if (trade.initiator.isConfirmed && trade.target.isConfirmed) {
            return this.finalizeTrade(trade);
        }
        return { success: true, message: participant.isConfirmed ? 'Đã XÁC NHẬN.' : 'Đã HỦY XÁC NHẬN.' };
    }
    unlockBoth(trade) {
        trade.initiator.isLocked = false;
        trade.initiator.isConfirmed = false;
        trade.target.isLocked = false;
        trade.target.isConfirmed = false;
    }
    finalizeTrade(trade) {
        // 1. Double check resources
        const initiatorUser = UserRepository_1.userRepository.get(trade.initiator.discordId);
        const targetUser = UserRepository_1.userRepository.get(trade.target.discordId);
        if (!initiatorUser || initiatorUser.coin_ha_pham < trade.initiator.coins) {
            return { success: false, message: `Giao dịch thất bại: ${trade.initiator.name} không đủ linh thạch.` };
        }
        if (!targetUser || targetUser.coin_ha_pham < trade.target.coins) {
            return { success: false, message: `Giao dịch thất bại: ${trade.target.name} không đủ linh thạch.` };
        }
        // Verify items
        const checkItems = (participant) => {
            const inv = InventoryRepository_1.inventoryRepository.getUserInventory(participant.discordId);
            for (const tItem of participant.items) {
                const item = inv.find(i => i.id === tItem.inventoryId && i.is_equipped === 0);
                if (!item || item.quantity < tItem.quantity) {
                    return false;
                }
            }
            return true;
        };
        if (!checkItems(trade.initiator))
            return { success: false, message: `Giao dịch thất bại: ${trade.initiator.name} không đủ vật phẩm.` };
        if (!checkItems(trade.target))
            return { success: false, message: `Giao dịch thất bại: ${trade.target.name} không đủ vật phẩm.` };
        // 2. Perform Trade in Transaction
        try {
            const tradeTx = database_1.default.transaction(() => {
                // Thuế phường thị (5% trên số Linh Thạch chuyển đi)
                const taxRate = 0.05;
                const initiatorTax = Math.floor(trade.initiator.coins * taxRate);
                const targetTax = Math.floor(trade.target.coins * taxRate);
                const initiatorReceive = trade.target.coins - targetTax;
                const targetReceive = trade.initiator.coins - initiatorTax;
                // Exchange Coins
                database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - ? + ? WHERE discord_id = ?')
                    .run(trade.initiator.coins, initiatorReceive, trade.initiator.discordId);
                database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - ? + ? WHERE discord_id = ?')
                    .run(trade.target.coins, targetReceive, trade.target.discordId);
                // Exchange Items
                const transferItems = (from, to) => {
                    for (const tItem of from.items) {
                        // Remove from 'from'
                        const fullItem = InventoryRepository_1.inventoryRepository.get(tItem.inventoryId);
                        if (!fullItem)
                            throw new Error('Item missing');
                        InventoryRepository_1.inventoryRepository.removeItemById(tItem.inventoryId, tItem.quantity);
                        // Add to 'to'
                        InventoryRepository_1.inventoryRepository.addItem(to, tItem.itemId, tItem.quantity, fullItem.custom_stats);
                    }
                };
                transferItems(trade.initiator, trade.target.discordId);
                transferItems(trade.target, trade.initiator.discordId);
            });
            tradeTx();
            trade.status = 'completed';
            this.activeTrades.delete(trade.id);
            let message = 'GIAO DỊCH THÀNH CÔNG!';
            if (trade.initiator.coins > 0 || trade.target.coins > 0) {
                message += '\n*Giao dịch Linh Thạch đã được tính phí Phường Thị 5%.*';
            }
            return { success: true, message, isComplete: true };
        }
        catch (e) {
            console.error('Trade Error:', e);
            return { success: false, message: 'Lỗi hệ thống trong lúc giao dịch.' };
        }
    }
    renderTradeUI(tradeId) {
        const trade = this.activeTrades.get(tradeId);
        if (!trade)
            return null;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🤝 GIAO DỊCH TRỰC TIẾP')
            .setColor(trade.status === 'pending' ? uiSystem_1.EMBED_COLORS.ORANGE : uiSystem_1.EMBED_COLORS.SUCCESS)
            .setDescription(trade.status === 'pending'
            ? `Đang chờ **${trade.target.name}** chấp nhận giao dịch...`
            : `Giao dịch giữa **${trade.initiator.name}** và **${trade.target.name}**`)
            .setTimestamp();
        if (trade.status === 'pending') {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`trade_accept_${tradeId}`).setLabel('Đồng Ý').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`trade_cancel_${tradeId}`).setLabel('Từ Chối').setStyle(discord_js_1.ButtonStyle.Danger));
            return { embeds: [embed], components: [row] };
        }
        const renderParticipant = (p) => {
            let text = `💰 Linh Thạch: **${p.coins}**\n\n**Vật Phẩm:**\n`;
            if (p.items.length === 0)
                text += `*(Trống)*`;
            else {
                for (const item of p.items) {
                    text += `• ${item.name} x${item.quantity}\n`;
                }
            }
            const statusIcon = p.isConfirmed ? '✅ ĐÃ XÁC NHẬN' : (p.isLocked ? '🔒 ĐÃ KHÓA' : '✏️ Đang điều chỉnh');
            return `${statusIcon}\n\n${text}`;
        };
        embed.addFields({ name: `🧑 ${trade.initiator.name}`, value: renderParticipant(trade.initiator), inline: true }, { name: '🔄', value: '----', inline: true }, { name: `🧑 ${trade.target.name}`, value: renderParticipant(trade.target), inline: true });
        const controlsRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`trade_lock_${tradeId}`).setLabel('Khóa/Mở').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`trade_confirm_${tradeId}`).setLabel('Xác Nhận').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`trade_cancel_${tradeId}`).setLabel('Hủy Giao Dịch').setStyle(discord_js_1.ButtonStyle.Danger));
        // Dùng SelectMenu để thêm item
        // Trong Discord JS, SelectMenu không thể dùng chung ActionRow với Buttons nếu quá không gian,
        // nhưng ta có thể hướng dẫn user dùng subcommands /trade them hoặc dùng button để show modal.
        // Tạm thời, do giới hạn UI Discord, ta sẽ hướng dẫn dùng lệnh /trade them và /trade linhthach 
        embed.setFooter({ text: 'Dùng lệnh: /trade them <id_tui_do> | /trade linhthach <số_lượng> | /trade xoa <id_tui_do>' });
        return { embeds: [embed], components: [controlsRow] };
    }
}
exports.TradeService = TradeService;
exports.tradeService = new TradeService();
