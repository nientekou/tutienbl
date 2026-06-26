"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.daoHeartService = void 0;
// V16 A-01: Dao Heart System (Đạo Tâm)
const database_1 = __importDefault(require("../database/database"));
const DAO_PATHS = {
    chinh_dao: {
        id: 'chinh_dao',
        name: 'Chính Đạo',
        description: 'Phòng thủ vững chắc, tỷ lệ đột phá cao',
        bonuses: [
            { stat: 'def_percent', value: 0.10 },
            { stat: 'breakthrough_rate', value: 0.05 },
        ],
        nodes: [
            { name: 'Thiên Ý Bảo Hộ', description: '+5% DEF', cost: 10, stat: 'def_percent', value: 0.05 },
            { name: 'Đại Đạo Tự Nhiên', description: '+3% breakthrough rate', cost: 15, stat: 'breakthrough_rate', value: 0.03 },
            { name: 'Hộ Pháp Thiên Kinh', description: '+10% DEF, +5% HP', cost: 25, stat: 'def_percent', value: 0.10 },
            { name: 'Bất Hoại Kim Thân', description: '+5% DEF, thorns 3%', cost: 35, stat: 'def_percent', value: 0.05 },
            { name: 'Thánh Thể Vô Song', description: '+10% DEF, +10% HP,免疫 1 debuff', cost: 50, stat: 'def_percent', value: 0.10 },
        ],
    },
    ma_dao: {
        id: 'ma_dao',
        name: 'Ma Đạo',
        description: 'Tấn công mạnh, tốc độ tu luyện nhanh, rủi ro cao',
        bonuses: [
            { stat: 'atk_percent', value: 0.15 },
            { stat: 'cultivation_speed', value: 0.10 },
        ],
        nodes: [
            { name: 'Ma Lực Tăng Trưởng', description: '+5% ATK', cost: 10, stat: 'atk_percent', value: 0.05 },
            { name: 'Huyết Ma Thuật', description: '+3% lifesteal', cost: 15, stat: 'lifesteal', value: 0.03 },
            { name: 'Ma Nhãn Sát Lục', description: '+10% ATK, +5% crit', cost: 25, stat: 'atk_percent', value: 0.10 },
            { name: 'Vô Tận Ma Hỏa', description: '+8% ATK, burn chance 5%', cost: 35, stat: 'atk_percent', value: 0.08 },
            { name: 'Ma Vương Giáng Lâm', description: '+15% ATK, +10% crit damage, -5% DEF', cost: 50, stat: 'atk_percent', value: 0.15 },
        ],
    },
    trung_dao: {
        id: 'trung_dao',
        name: 'Trung Đạo',
        description: 'Cân bằng tất cả, ổn định và an toàn',
        bonuses: [
            { stat: 'all_stats', value: 0.05 },
            { stat: 'breakthrough_rate', value: 0.05 },
        ],
        nodes: [
            { name: 'Vạn Vật Bình Đẳng', description: '+3% all stats', cost: 10, stat: 'all_stats', value: 0.03 },
            { name: 'Đại Đạo Viên Mãn', description: '+5% HP, +5% MP', cost: 15, stat: 'hp_percent', value: 0.05 },
            { name: 'Thiên Địa Hợp Nhất', description: '+5% all stats, +3% speed', cost: 25, stat: 'all_stats', value: 0.05 },
            { name: 'Vô Vi Nhi Nhiên', description: '+5% all stats, +5% crit', cost: 35, stat: 'all_stats', value: 0.05 },
            { name: 'Đại Đạo Vô Thanh', description: '+8% all stats, +10% EXP', cost: 50, stat: 'all_stats', value: 0.08 },
        ],
    },
};
class DaoHeartService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS dao_heart (
        user_id TEXT NOT NULL,
        path TEXT DEFAULT NULL,
        dao_points INTEGER DEFAULT 0,
        unlocked_nodes TEXT DEFAULT '[]',
        PRIMARY KEY (user_id)
      );
    `);
    }
    getPath(userId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT path FROM dao_heart WHERE user_id = ?').get(userId);
        return row?.path || null;
    }
    getDaoPoints(userId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT dao_points FROM dao_heart WHERE user_id = ?').get(userId);
        return row?.dao_points || 0;
    }
    choosePath(userId, pathId) {
        this.initTable();
        if (!DAO_PATHS[pathId])
            return { success: false, message: '❌ Đạo tâm không hợp lệ.' };
        const existing = this.getPath(userId);
        if (existing)
            return { success: false, message: '❌ Đã chọn đạo tâm rồi! Không thể thay đổi.' };
        database_1.default.prepare('INSERT INTO dao_heart (user_id, path, dao_points, unlocked_nodes) VALUES (?, ?, 0, \'[]\')')
            .run(userId, pathId);
        const path = DAO_PATHS[pathId];
        return { success: true, message: `✅ Đã chọn **${path.name}**!\n${path.description}` };
    }
    addDaoPoints(userId, amount) {
        this.initTable();
        database_1.default.prepare('INSERT INTO dao_heart (user_id, path, dao_points, unlocked_nodes) VALUES (?, NULL, ?, \'[]\') ON CONFLICT(user_id) DO UPDATE SET dao_points = dao_points + ?')
            .run(userId, amount, amount);
    }
    unlockNode(userId, nodeIndex) {
        this.initTable();
        const pathId = this.getPath(userId);
        if (!pathId)
            return { success: false, message: '❌ Chưa chọn đạo tâm.' };
        const path = DAO_PATHS[pathId];
        const node = path.nodes[nodeIndex];
        if (!node)
            return { success: false, message: '❌ Node không hợp lệ.' };
        const row = database_1.default.prepare('SELECT unlocked_nodes FROM dao_heart WHERE user_id = ?').get(userId);
        const unlocked = JSON.parse(row?.unlocked_nodes || '[]');
        if (unlocked.includes(nodeIndex))
            return { success: false, message: '❌ Đã mở node này.' };
        if (nodeIndex > 0 && !unlocked.includes(nodeIndex - 1))
            return { success: false, message: `❌ Cần mở node ${nodeIndex} trước.` };
        const points = this.getDaoPoints(userId);
        if (points < node.cost)
            return { success: false, message: `❌ Cần ${node.cost} Đạo Điểm (hiện có: ${points}).` };
        unlocked.push(nodeIndex);
        database_1.default.prepare('UPDATE dao_heart SET dao_points = dao_points - ?, unlocked_nodes = ? WHERE user_id = ?')
            .run(node.cost, JSON.stringify(unlocked), userId);
        return { success: true, message: `✅ Đã mở **${node.name}**! ${node.description}` };
    }
    getUnlockedNodes(userId) {
        this.initTable();
        const row = database_1.default.prepare('SELECT unlocked_nodes FROM dao_heart WHERE user_id = ?').get(userId);
        return row ? JSON.parse(row.unlocked_nodes) : [];
    }
    getDescription(userId) {
        const pathId = this.getPath(userId);
        if (!pathId)
            return '📭 Chưa chọn đạo tâm. Dùng `/daotam chon <chinh_dao|ma_dao|trung_dao>`';
        const path = DAO_PATHS[pathId];
        const points = this.getDaoPoints(userId);
        const unlocked = this.getUnlockedNodes(userId);
        let msg = `🌀 **${path.name}** — ${path.description}\n`;
        msg += `💎 Đạo Điểm: **${points}**\n\n`;
        for (let i = 0; i < path.nodes.length; i++) {
            const node = path.nodes[i];
            const isUnlocked = unlocked.includes(i);
            const canUnlock = i === 0 || unlocked.includes(i - 1);
            const status = isUnlocked ? '✅' : canUnlock ? '🔓' : '🔒';
            msg += `${status} **${node.name}**: ${node.description} (${node.cost} ĐĐ)\n`;
        }
        return msg;
    }
}
exports.daoHeartService = new DaoHeartService();
