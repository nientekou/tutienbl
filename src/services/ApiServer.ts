/**
 * REST API Server — read-only endpoints cho bảng xếp hạng và thông tin game
 * Yêu cầu: npm install express cors
 */

import { leaderboardService } from './LeaderboardService';
import { userRepository } from '../database/repositories/UserRepository';

let express: any;
try {
  express = require('express');
} catch {
  // Express chưa được cài, bỏ qua
}

const API_PORT = process.env.API_PORT || 3000;

export class ApiServer {
  private app: any;
  private server: any;
  private running = false;

  public start(): void {
    if (!express) {
      console.log('[API] Express chưa được cài đặt. Bỏ qua API Server.');
      return;
    }
    if (this.running) return;

    try {
      this.app = express();
      this.app.use(require('cors')());

      // GET /api/leaderboard/:type
      this.app.get('/api/leaderboard/:type', (req: any, res: any) => {
        try {
          const type = req.params.type;
          const map: Record<string, (limit: number) => any[]> = {
            combat_power: (l) => leaderboardService.getTopCombatPower(l),
            level: (l) => leaderboardService.getTopRealm(l),
            wealth: (l) => leaderboardService.getTopWealth(l),
            sect_contribution: (l) => leaderboardService.getTopSectContribution(l),
          };
          const fn = map[type];
          if (!fn) {
            return res.status(400).json({ error: `Invalid type. Valid: ${Object.keys(map).join(', ')}` });
          }

          const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
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
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      // GET /api/user/:id
      this.app.get('/api/user/:id', (req: any, res: any) => {
        try {
          const user = userRepository.get(req.params.id);
          if (!user) return res.status(404).json({ error: 'User not found' });

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
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      // Health check
      this.app.get('/api/health', (_req: any, res: any) => {
        res.json({ status: 'ok', timestamp: Date.now() });
      });

      this.server = this.app.listen(API_PORT, () => {
        this.running = true;
        console.log(`[API] REST API server đang chạy tại port ${API_PORT}`);
      });
    } catch (err) {
      console.error('[API] Lỗi khởi động API server:', err);
    }
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.running = false;
      console.log('[API] REST API server đã dừng.');
    }
  }
}

export const apiServer = new ApiServer();
