"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.leylineService = exports.LeylineService = void 0;
const database_1 = __importDefault(require("../database/database"));
const UserRepository_1 = require("../database/repositories/UserRepository");
class LeylineService {
    discordClient = null;
    init(client) {
        this.discordClient = client;
        // Đăng ký tiến trình chạy ngầm mỗi giờ để trừ năng lượng (Decay)
        setInterval(() => {
            this.processDecay();
        }, 60 * 60 * 1000);
        // B-01: Leyline Surges — check mỗi phút
        setInterval(() => {
            this.checkSurges();
        }, 60 * 1000);
        // Chạy decay lần đầu lúc khởi động
        this.processDecay();
    }
    getLeyline(id) {
        return database_1.default.prepare('SELECT * FROM leylines WHERE id = ?').get(id);
    }
    getAllLeylines() {
        return database_1.default.prepare('SELECT * FROM leylines').all();
    }
    getUserLeyline(userId) {
        let data = database_1.default.prepare('SELECT * FROM user_leylines WHERE user_id = ?').get(userId);
        if (!data) {
            database_1.default.prepare('INSERT INTO user_leylines (user_id) VALUES (?)').run(userId);
            data = database_1.default.prepare('SELECT * FROM user_leylines WHERE user_id = ?').get(userId);
        }
        return data;
    }
    isBuffActive(id) {
        const data = this.getLeyline(id);
        if (!data)
            return false;
        return data.buff_active_until > Math.floor(Date.now() / 1000);
    }
    setChanneling(userId, target) {
        const data = this.getUserLeyline(userId);
        const nowSec = Math.floor(Date.now() / 1000);
        if (data.channeling_cooldown > nowSec) {
            const remainMins = Math.ceil((data.channeling_cooldown - nowSec) / 60);
            return { success: false, message: `Thuật dẫn dòng chưa hồi phục. Đạo hữu cần chờ ${remainMins} phút nữa.` };
        }
        database_1.default.prepare('UPDATE user_leylines SET channeling_target = ?, channeling_cooldown = ? WHERE user_id = ?')
            .run(target, nowSec + (6 * 3600), userId); // Cooldown 6h
        return { success: true, message: target ? `Đã tập trung dẫn dòng linh khí vào linh mạch **${target}**.` : `Đã hủy dẫn dòng linh khí.` };
    }
    /**
     * Thêm năng lượng vào linh mạch từ các hoạt động của người chơi
     */
    addEnergy(userId, type, baseAmount) {
        const user = UserRepository_1.userRepository.get(userId);
        if (!user)
            return;
        const data = this.getUserLeyline(userId);
        let targetLeyline = type;
        let amount = Math.round(baseAmount * (1 + (user.level / 100)));
        // Channeling Logic
        if (data.channeling_target) {
            if (data.channeling_target === type) {
                amount = Math.round(amount * 1.5); // +150% nếu đang dẫn dòng vào đúng mạch này
            }
            else {
                return; // Không nạp vào các mạch khác nếu đang dẫn dòng
            }
        }
        const currentHour = Math.floor(Date.now() / 3600000);
        let hourlyContribs = {};
        if (data.last_contribution_hour === currentHour) {
            try {
                hourlyContribs = JSON.parse(data.hourly_contributions);
            }
            catch (e) {
                console.warn('[LeylineService] Failed to parse hourly_contributions:', e);
            }
        }
        else {
            hourlyContribs = {};
        }
        const currentContrib = hourlyContribs[targetLeyline] || 0;
        if (currentContrib >= 100)
            return; // Đạt giới hạn 100 energy/giờ cho mạch này
        const spaceLeft = 100 - currentContrib;
        const actualAdd = Math.min(amount, spaceLeft);
        hourlyContribs[targetLeyline] = currentContrib + actualAdd;
        database_1.default.prepare('UPDATE user_leylines SET hourly_contributions = ?, last_contribution_hour = ? WHERE user_id = ?')
            .run(JSON.stringify(hourlyContribs), currentHour, userId);
        // Nạp vào Leyline
        const leyline = this.getLeyline(targetLeyline);
        if (!leyline)
            return;
        // Nếu buff đang chạy thì không nạp được
        if (leyline.buff_active_until > Math.floor(Date.now() / 1000))
            return;
        database_1.default.prepare('UPDATE leylines SET current_energy = MIN(current_energy + ?, max_energy) WHERE id = ?')
            .run(actualAdd, targetLeyline);
        // Kiểm tra và Kích hoạt Buff
        this.checkAndActivateBuff(targetLeyline);
    }
    checkAndActivateBuff(id) {
        const data = this.getLeyline(id);
        if (!data)
            return;
        if (data.current_energy >= data.max_energy && data.buff_active_until <= Math.floor(Date.now() / 1000)) {
            const nowSec = Math.floor(Date.now() / 1000);
            const expire = nowSec + (2 * 3600); // Buff 2h
            database_1.default.prepare('UPDATE leylines SET buff_active_until = ?, current_energy = 0 WHERE id = ?').run(expire, id);
            // Gửi thông báo đến kênh world event (nếu có thể)
            this.announceBuff(id);
        }
    }
    announceBuff(id) {
        if (!this.discordClient)
            return;
        const names = {
            'tuluyen': 'Tu Luyện (+20% EXP)',
            'chiendau': 'Chiến Đấu (+10% ATK)',
            'thuthap': 'Thu Thập (+25% Tỷ lệ Rơi Đồ)',
            'kinhte': 'Kinh Tế (-10% Phí Chợ Trời)',
            'tongmon': 'Tông Môn (+15% Điểm Cống Hiến)'
        };
        const msg = `🌟 **[LINH MẠCH ĐỊA ĐỒ]** Năng lượng Linh mạch **${names[id] || id}** đã tích tụ đến cực hạn và bùng nổ!\nToàn bộ tu sĩ trên đại lục sẽ nhận được phúc khí trong **2 giờ** tới!`;
        // Gửi tin nhắn vào kênh global event của tất cả guild (Giả lập)
        try {
            const configs = database_1.default.prepare('SELECT guild_id, event_channel_id FROM guild_configs WHERE event_channel_id IS NOT NULL').all();
            configs.forEach(conf => {
                const guild = this.discordClient.guilds.cache.get(conf.guild_id);
                if (guild) {
                    const channel = guild.channels.cache.get(conf.event_channel_id);
                    if (channel)
                        channel.send(msg).catch(() => null);
                }
            });
        }
        catch (e) {
            console.error('Announce Leyline Buff Error:', e);
        }
    }
    processDecay() {
        const leylines = this.getAllLeylines();
        const nowSec = Math.floor(Date.now() / 1000);
        for (const l of leylines) {
            // Nếu buff đang chạy, không bị decay
            if (l.buff_active_until > nowSec)
                continue;
            // Decay sau 12h không đầy (tăng gấp đôi tốc độ decay từ 24h xuống 12h)
            if (nowSec - l.last_decay_at >= 12 * 3600) {
                const decayAmount = Math.floor(l.max_energy * 0.2);
                database_1.default.prepare('UPDATE leylines SET current_energy = MAX(0, current_energy - ?), last_decay_at = ? WHERE id = ?')
                    .run(decayAmount, nowSec, l.id);
            }
        }
    }
    /**
     * Kiểm tra xem người chơi có linh căn hợp hệ với linh mạch đang buff không
     * Tu Luyện -> Mộc, Chiến Đấu -> Hỏa, Thu Thập -> Thủy, Kinh Tế -> Kim, Tông Môn -> Thổ
     */
    isLeylineElementMatch(linhCanJson) {
        if (!linhCanJson)
            return false;
        const mapping = {
            'tuluyen': 'Mộc',
            'chiendau': 'Hỏa',
            'thuthap': 'Thủy',
            'kinhte': 'Kim',
            'tongmon': 'Thổ'
        };
        try {
            const linhCan = JSON.parse(linhCanJson || '{}');
            for (const [key, element] of Object.entries(mapping)) {
                if (this.isBuffActive(key) && linhCan[element]) {
                    return true; // Có linh căn khớp với linh mạch đang buff
                }
            }
        }
        catch (e) {
            // Ignored
        }
        return false;
    }
    // === B-01: Leyline Surges & History ===
    surgeTableInit = false;
    initSurgeTable() {
        if (this.surgeTableInit)
            return;
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS leyline_surges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leyline_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        was_contaminated INTEGER DEFAULT 0
      );
    `);
        this.surgeTableInit = true;
    }
    /**
     * B-01: Check and trigger leyline surges every 4h
     */
    checkSurges() {
        this.initSurgeTable();
        const now = Math.floor(Date.now() / 1000);
        const fourHoursAgo = now - 4 * 3600;
        // Check if there's an active surge
        const activeSurge = database_1.default.prepare('SELECT * FROM leyline_surges WHERE ends_at > ? LIMIT 1').get(now);
        if (activeSurge)
            return; // Surge still active
        // Check last surge time
        const lastSurge = database_1.default.prepare('SELECT * FROM leyline_surges ORDER BY started_at DESC LIMIT 1').get();
        if (lastSurge && (now - lastSurge.started_at) < 4 * 3600)
            return; // Too soon
        // Roll random leyline for surge
        const leylines = ['tuluyen', 'chiendau', 'thuthap', 'kinhte', 'tongmon'];
        const surgeLeyline = leylines[Math.floor(Math.random() * leylines.length)];
        const surgeEnd = now + 30 * 60; // 30 minutes
        database_1.default.prepare('INSERT INTO leyline_surges (leyline_id, started_at, ends_at) VALUES (?, ?, ?)')
            .run(surgeLeyline, now, surgeEnd);
        // 10% chance of contamination
        if (Math.random() < 0.10) {
            database_1.default.prepare('UPDATE leyline_surges SET was_contaminated = 1 WHERE started_at = ?').run(now);
        }
        // Announce surge
        const names = {
            'tuluyen': 'Tu Luyện', 'chiendau': 'Chiến Đấu', 'thuthap': 'Thu Thập',
            'kinhte': 'Kinh Tế', 'tongmon': 'Tông Môn'
        };
        const isContaminated = Math.random() < 0.10;
        const msg = `⚡ **[LINH MẠCH DÂNG TRÀO]** Linh mạch **${names[surgeLeyline]}** đang surging!\n` +
            `🔥 **x2 contribution reward** trong **30 phút**!\n` +
            (isContaminated ? `⚠️ **CẢNH BÁO:** Linh mạch có dấu hiệu ô nhiễm!` : '');
        try {
            const configs = database_1.default.prepare('SELECT guild_id, event_channel_id FROM guild_configs WHERE event_channel_id IS NOT NULL').all();
            configs.forEach(conf => {
                const guild = this.discordClient?.guilds.cache.get(conf.guild_id);
                if (guild) {
                    const channel = guild.channels.cache.get(conf.event_channel_id);
                    if (channel)
                        channel.send(msg).catch(() => null);
                }
            });
        }
        catch { }
    }
    /**
     * B-01: Check if a leyline is currently surging (double rewards)
     */
    isSurging(leylineId) {
        this.initSurgeTable();
        const now = Math.floor(Date.now() / 1000);
        const surge = database_1.default.prepare('SELECT * FROM leyline_surges WHERE leyline_id = ? AND ends_at > ? LIMIT 1')
            .get(leylineId, now);
        return !!surge;
    }
    /**
     * B-01: Get surge multiplier (2x during surge)
     */
    getSurgeMultiplier(leylineId) {
        return this.isSurging(leylineId) ? 2.0 : 1.0;
    }
    /**
     * B-01: Get leyline history (last 7 days)
     */
    getLeylineHistory() {
        this.initSurgeTable();
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
        const surges = database_1.default.prepare('SELECT * FROM leyline_surges WHERE started_at > ? ORDER BY started_at ASC')
            .all(sevenDaysAgo);
        const history = {};
        for (const s of surges) {
            const date = new Date(s.started_at * 1000).toISOString().slice(0, 10);
            if (!history[date])
                history[date] = {};
            history[date][s.leyline_id] = (history[date][s.leyline_id] || 0) + 1;
        }
        return Object.entries(history).map(([date, leylines]) => ({ date, leylines }));
    }
    /**
     * B-01: Get leyline prediction based on history
     */
    getPrediction() {
        const history = this.getLeylineHistory();
        const leylines = ['tuluyen', 'chiendau', 'thuthap', 'kinhte', 'tongmon'];
        const counts = {};
        let total = 0;
        for (const h of history) {
            for (const [l, c] of Object.entries(h.leylines)) {
                counts[l] = (counts[l] || 0) + c;
                total += c;
            }
        }
        if (total === 0)
            return '📊 Chưa đủ dữ liệu dự báo.';
        const names = {
            'tuluyen': 'Tu Luyện', 'chiendau': 'Chiến Đấu', 'thuthap': 'Thu Thập',
            'kinhte': 'Kinh Tế', 'tongmon': 'Tông Môn'
        };
        let prediction = `**Dự báo Leyline (7 ngày qua):**\n`;
        for (const l of leylines) {
            const pct = Math.round(((counts[l] || 0) / total) * 100);
            const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
            prediction += `${names[l]}: ${bar} **${pct}%**\n`;
        }
        return prediction;
    }
}
exports.LeylineService = LeylineService;
exports.leylineService = new LeylineService();
