import db from '../database/database';
import { userRepository } from '../database/repositories/UserRepository';
import { inventoryRepository } from '../database/repositories/InventoryRepository';

export interface DailyLoginReward {
  day: number;
  coins: number;
  exp: number;
  itemId?: string;
  itemName?: string;
  title?: string;
}

const LOGIN_REWARDS: DailyLoginReward[] = [
  { day: 1, coins: 100, exp: 50 },
  { day: 2, coins: 150, exp: 75 },
  { day: 3, coins: 200, exp: 100, itemId: 'pill_tu_vi_low', itemName: 'Sơ Cấp Tụ Khí Đan' },
  { day: 4, coins: 250, exp: 125 },
  { day: 5, coins: 300, exp: 150 },
  { day: 6, coins: 400, exp: 200, itemId: 'pill_hp_1', itemName: 'Hồi Huyết Đan - Hạ Phẩm' },
  { day: 7, coins: 1000, exp: 500, title: 'Khách Quý Thiên Đường' },
  { day: 14, coins: 2000, exp: 1000, itemId: 'pill_break_minor_1', itemName: 'Tụ Khí Đan' },
  { day: 21, coins: 3000, exp: 1500, itemId: 'pill_stamina_1', itemName: 'Hồi Thể Đan - Sơ Cấp' },
  { day: 30, coins: 5000, exp: 3000, title: 'Loyal Disciple', itemId: 'pill_break_1', itemName: 'Trúc Cơ Đan' },
];

class DailyLoginService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_daily_logins (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        streak INTEGER DEFAULT 0,
        last_login_date TEXT,
        total_logins INTEGER DEFAULT 0,
        PRIMARY KEY(user_id)
      );
    `);
  }

  public claimLogin(userId: string): { success: boolean; message: string; reward?: DailyLoginReward } {
    this.initTable();

    const user = userRepository.get(userId);
    if (!user) {
      return { success: false, message: '❌ Đạo hữu chưa khởi tạo nhân vật!' };
    }

    const today = new Date().toLocaleDateString('en-CA');
    let record = db.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId) as any;

    if (!record) {
      db.prepare('INSERT INTO user_daily_logins (user_id, streak, last_login_date, total_logins) VALUES (?, 0, ?, 0)').run(userId, '');
      record = { user_id: userId, streak: 0, last_login_date: '', total_logins: 0 };
    }

    if (record.last_login_date === today) {
      return { success: false, message: '📅 Đạo hữu đã nhận thưởng đăng nhập hôm nay rồi!' };
    }

    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
    let newStreak = record.last_login_date === yesterday ? record.streak + 1 : 1;

    const reward = this.getRewardForDay(newStreak);
    if (!reward) {
      return { success: false, message: 'Không tìm thấy phần thưởng!' };
    }

    db.prepare('UPDATE user_daily_logins SET streak = ?, last_login_date = ?, total_logins = total_logins + 1 WHERE user_id = ?')
      .run(newStreak, today, userId);

    if (reward.coins > 0) {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + reward.coins });
    }
    if (reward.exp > 0) {
      userRepository.update(userId, { tu_vi: user.tu_vi + reward.exp });
    }
    if (reward.itemId) {
      inventoryRepository.addItem(userId, reward.itemId, 1, null);
    }
    if (reward.title) {
      db.prepare('INSERT OR IGNORE INTO user_titles (user_id, title, source, unlocked_at) VALUES (?, ?, ?, ?)')
        .run(userId, reward.title, 'daily_login', Math.floor(Date.now() / 1000));
    }

    let msg = `📅 **ĐĂNG NHẬP THÀNH CÔNG!** Streak: **${newStreak}** ngày\n`;
    msg += `┌─ Phần thưởng:\n`;
    if (reward.coins > 0) msg += `│ • **+${reward.coins}** Hạ Phẩm Linh Thạch 🟤\n`;
    if (reward.exp > 0) msg += `│ • **+${reward.exp}** Tu Vi 🌿\n`;
    if (reward.itemName) msg += `│ • **${reward.itemName}** 🎁\n`;
    if (reward.title) msg += `│ • Danh hiệu: **${reward.title}** 🏆\n`;
    msg += `└─ Tiếp tục đăng nhập ngày mai để nhận thưởng lớn hơn!`;

    return { success: true, message: msg, reward };
  }

  public getLoginInfo(userId: string): { streak: number; totalLogins: number; nextReward: DailyLoginReward | null } {
    this.initTable();

    let record = db.prepare('SELECT * FROM user_daily_logins WHERE user_id = ?').get(userId) as any;
    if (!record) {
      return { streak: 0, totalLogins: 0, nextReward: LOGIN_REWARDS[0] };
    }

    const nextDay = record.streak + 1;
    const nextReward = LOGIN_REWARDS.find(r => r.day === nextDay) || LOGIN_REWARDS[LOGIN_REWARDS.length - 1];

    return { streak: record.streak, totalLogins: record.total_logins, nextReward };
  }

  private getRewardForDay(day: number): DailyLoginReward | null {
    for (let i = LOGIN_REWARDS.length - 1; i >= 0; i--) {
      if (day >= LOGIN_REWARDS[i].day) {
        return LOGIN_REWARDS[i];
      }
    }
    return LOGIN_REWARDS[0];
  }
}

export const dailyLoginService = new DailyLoginService();
