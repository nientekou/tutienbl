"use strict";
/**
 * REST API Server — read-only endpoints cho bảng xếp hạng và thông tin game
 * Yêu cầu: npm install express cors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiServer = exports.ApiServer = void 0;
const LeaderboardService_1 = require("./LeaderboardService");
const UserRepository_1 = require("../database/repositories/UserRepository");
let express;
try {
    express = require('express');
}
catch {
    // Express chưa được cài, bỏ qua
}
const API_PORT = process.env.API_PORT || 3000;
class ApiServer {
    app;
    server;
    running = false;
    start() {
        if (!express) {
            console.log('[API] Express chưa được cài đặt. Bỏ qua API Server.');
            return;
        }
        if (this.running)
            return;
        try {
            this.app = express();
            this.app.use(require('cors')());
            // GET /api/leaderboard/:type
            this.app.get('/api/leaderboard/:type', (req, res) => {
                try {
                    const type = req.params.type;
                    const map = {
                        combat_power: (l) => LeaderboardService_1.leaderboardService.getTopCombatPower(l),
                        level: (l) => LeaderboardService_1.leaderboardService.getTopRealm(l),
                        wealth: (l) => LeaderboardService_1.leaderboardService.getTopWealth(l),
                        sect_contribution: (l) => LeaderboardService_1.leaderboardService.getTopSectContribution(l),
                    };
                    const fn = map[type];
                    if (!fn) {
                        return res.status(400).json({ error: `Invalid type. Valid: ${Object.keys(map).join(', ')}` });
                    }
                    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
                    const entries = fn(limit);
                    res.json({
                        type,
                        count: entries.length,
                        entries: entries.map(e => ({
                            rank: e.rank,
                            userId: e.userId,
                            name: e.name,
                            value: e.value,
                            displayValue: e.displayValue,
                        })),
                    });
                }
                catch (err) {
                    res.status(500).json({ error: err.message });
                }
            });
            // GET /api/user/:id
            this.app.get('/api/user/:id', (req, res) => {
                try {
                    const user = UserRepository_1.userRepository.get(req.params.id);
                    if (!user)
                        return res.status(404).json({ error: 'User not found' });
                    res.json({
                        id: user.discord_id,
                        name: user.name,
                        level: user.level,
                        tu_vi: user.tu_vi,
                        exp_needed: user.exp_needed,
                        coin_ha_pham: user.coin_ha_pham,
                        alignment: user.alignment,
                        created_at: user.created_at,
                    });
                }
                catch (err) {
                    res.status(500).json({ error: err.message });
                }
            });
            // Health check
            this.app.get('/api/health', (_req, res) => {
                res.json({ status: 'ok', timestamp: Date.now() });
            });
            this.server = this.app.listen(API_PORT, () => {
                this.running = true;
                console.log(`[API] REST API server đang chạy tại port ${API_PORT}`);
            });
        }
        catch (err) {
            console.error('[API] Lỗi khởi động API server:', err);
        }
    }
    stop() {
        if (this.server) {
            this.server.close();
            this.running = false;
            console.log('[API] REST API server đã dừng.');
        }
    }
}
exports.ApiServer = ApiServer;
exports.apiServer = new ApiServer();
