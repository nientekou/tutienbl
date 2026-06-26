"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialService = void 0;
const database_1 = __importDefault(require("../database/database"));
// B-04: Social Features Deep
class SocialService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS friendships (
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        PRIMARY KEY(user_id, friend_id)
      );

      CREATE TABLE IF NOT EXISTS gifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        gift_type TEXT NOT NULL,
        message TEXT,
        sent_at INTEGER NOT NULL,
        claimed INTEGER DEFAULT 0
      );
    `);
    }
    /**
     * B-04: Send friend request
     */
    sendFriendRequest(userId, friendId) {
        this.initTable();
        if (userId === friendId)
            return { success: false, message: '❌ Cannot add yourself!' };
        const existing = database_1.default.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?')
            .get(userId, friendId);
        if (existing)
            return { success: false, message: '❌ Already friends or request pending!' };
        database_1.default.prepare('INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)')
            .run(userId, friendId, 'pending', Math.floor(Date.now() / 1000));
        return { success: true, message: '📨 Friend request sent!' };
    }
    /**
     * B-04: Accept friend request
     */
    acceptFriendRequest(userId, friendId) {
        this.initTable();
        const request = database_1.default.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?')
            .get(friendId, userId, 'pending');
        if (!request)
            return { success: false, message: '❌ No pending request!' };
        database_1.default.prepare('UPDATE friendships SET status = ? WHERE user_id = ? AND friend_id = ?')
            .run('accepted', friendId, userId);
        return { success: true, message: '✅ Friend request accepted!' };
    }
    /**
     * B-04: Get friends list
     */
    getFriends(userId) {
        this.initTable();
        const rows = database_1.default.prepare(`
      SELECT f.friend_id, u.name, u.level FROM friendships f
      JOIN users u ON f.friend_id = u.discord_id
      WHERE f.user_id = ? AND f.status = 'accepted'
    `).all(userId);
        return rows.map(r => ({ userId: r.friend_id, name: r.name, level: r.level }));
    }
    /**
     * B-04: Send gift
     */
    sendGift(senderId, receiverId, giftType, message) {
        this.initTable();
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('INSERT INTO gifts (sender_id, receiver_id, gift_type, message, sent_at) VALUES (?, ?, ?, ?, ?)')
            .run(senderId, receiverId, giftType, message || '', now);
        return { success: true, message: `🎁 Gift sent!` };
    }
    /**
     * B-04: Get pending gifts
     */
    getPendingGifts(userId) {
        this.initTable();
        const rows = database_1.default.prepare(`
      SELECT g.*, u.name as sender_name FROM gifts g
      JOIN users u ON g.sender_id = u.discord_id
      WHERE g.receiver_id = ? AND g.claimed = 0
    `).all(userId);
        return rows.map(r => ({
            id: r.id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            giftType: r.gift_type,
            message: r.message
        }));
    }
    /**
     * B-04: Get social description
     */
    getSocialDescription(userId) {
        const friends = this.getFriends(userId);
        const gifts = this.getPendingGifts(userId);
        let msg = `👥 **Social**\n`;
        msg += `👥 Friends: **${friends.length}**\n`;
        msg += `🎁 Pending Gifts: **${gifts.length}**\n`;
        if (friends.length > 0) {
            msg += `\n**Friends:**\n`;
            for (const f of friends.slice(0, 5)) {
                msg += `• ${f.name} (Lv.${f.level})\n`;
            }
        }
        return msg;
    }
}
exports.socialService = new SocialService();
