import db from '../database/database';

export type BountyTier = 'common' | 'elite' | 'rare' | 'epic' | 'legendary';
export type BountyCategory = 'life' | 'work' | 'craft' | 'exploration' | 'special';

export interface BountyQuest {
  id: string;
  name: string;
  description: string;
  category: BountyCategory;
  tier: BountyTier;
  requirement: string;
  target: number;
  rewardExp: number;
  rewardCoins: number;
  rewardKnb: number;
}

interface BountyBoardRow {
  user_id: string;
  day: string;
  cards_json: string;
  selected_json: string | null;
  progress_json: string | null;
  completed: number;
}

interface BountyStreakRow {
  user_id: string;
  streak: number;
  last_completed_day: string | null;
}

interface CompleteResult {
  success: boolean;
  streakBonus: number;
  message: string;
}

export interface BountySelectionResult {
  success: boolean;
  selected: string[];
  locked: boolean;
  added?: boolean;
  message: string;
}

/**
 * V17 — Bảng Nghĩa Vụ · Trấn Hải Các
 *
 * Quy ước requirement phải khớp với LifeQuestHandler V17:
 * - activity : hoàn thành một hoạt động hợp lệ bất kỳ
 * - work     : hoàn thành một lần Làm Việc
 * - mine     : Khai Thác
 * - herb     : Hái Lượm / thu hoạch Linh Điền
 * - harvest  : thu hoạch Linh Điền
 * - patrol   : Tuần Tra
 * - escort   : Hộ Tiêu
 * - adventure: Phiêu Lưu Bản Đồ từ /lamviec
 * - archaeology: Khảo Cổ Cổ Mộ từ /lamviec
 * - explore  : hoàn thành Khám Phá
 * - craft    : nhận thành phẩm Chế Tạo / Luyện Khí thành công
 * - forge    : Luyện Khí thành công
 *
 * Không có nhiệm vụ câu cá.
 */
const BOUNTY_POOL: BountyQuest[] = [
  // ============================================================
  // PHÀM PHẨM — COMMON
  // ============================================================
  {
    id: 'b_common_activity_1',
    name: 'Vạn Sự Khởi Đầu',
    description: 'Hoàn thành 3 hoạt động trong ngày',
    category: 'special',
    tier: 'common',
    requirement: 'activity',
    target: 3,
    rewardExp: 150,
    rewardCoins: 300,
    rewardKnb: 0
  },
  {
    id: 'b_common_activity_2',
    name: 'Hành Tẩu Thường Nhật',
    description: 'Hoàn thành 5 hoạt động trong ngày',
    category: 'special',
    tier: 'common',
    requirement: 'activity',
    target: 5,
    rewardExp: 220,
    rewardCoins: 450,
    rewardKnb: 0
  },
  {
    id: 'b_common_work_1',
    name: 'Cần Mẫn Tu Hành',
    description: 'Hoàn thành 3 lần làm việc',
    category: 'work',
    tier: 'common',
    requirement: 'work',
    target: 3,
    rewardExp: 180,
    rewardCoins: 500,
    rewardKnb: 0
  },
  {
    id: 'b_common_mine_1',
    name: 'Khai Sơn',
    description: 'Khai thác khoáng mạch 3 lần',
    category: 'work',
    tier: 'common',
    requirement: 'mine',
    target: 3,
    rewardExp: 180,
    rewardCoins: 480,
    rewardKnb: 0
  },
  {
    id: 'b_common_herb_1',
    name: 'Thu Thập Linh Thảo',
    description: 'Thu thập 4 phần linh thảo hoặc linh thực',
    category: 'life',
    tier: 'common',
    requirement: 'herb',
    target: 4,
    rewardExp: 180,
    rewardCoins: 420,
    rewardKnb: 0
  },
  {
    id: 'b_common_harvest_1',
    name: 'Linh Điền Sơ Thu',
    description: 'Thu hoạch 3 linh thực từ Linh Điền',
    category: 'life',
    tier: 'common',
    requirement: 'harvest',
    target: 3,
    rewardExp: 200,
    rewardCoins: 450,
    rewardKnb: 0
  },
  {
    id: 'b_common_patrol_1',
    name: 'Tuần Sơn',
    description: 'Hoàn thành 2 lần tuần tra',
    category: 'work',
    tier: 'common',
    requirement: 'patrol',
    target: 2,
    rewardExp: 180,
    rewardCoins: 450,
    rewardKnb: 0
  },
  {
    id: 'b_common_escort_1',
    name: 'Hộ Tống Linh Hàng',
    description: 'Hoàn thành 2 lần hộ tiêu',
    category: 'work',
    tier: 'common',
    requirement: 'escort',
    target: 2,
    rewardExp: 200,
    rewardCoins: 520,
    rewardKnb: 0
  },
  {
    id: 'b_common_adventure_1',
    name: 'Ngự Kiếm Sơ Hành',
    description: 'Hoàn thành 1 lần phiêu lưu bản đồ',
    category: 'exploration',
    tier: 'common',
    requirement: 'adventure',
    target: 1,
    rewardExp: 240,
    rewardCoins: 600,
    rewardKnb: 0
  },
  {
    id: 'b_common_archaeology_1',
    name: 'Tầm Cổ Sơ Thám',
    description: 'Hoàn thành 1 lần khảo cổ cổ mộ',
    category: 'exploration',
    tier: 'common',
    requirement: 'archaeology',
    target: 1,
    rewardExp: 260,
    rewardCoins: 650,
    rewardKnb: 0
  },
  {
    id: 'b_common_explore_1',
    name: 'Bước Chân Giang Hồ',
    description: 'Hoàn thành 1 lần khám phá',
    category: 'exploration',
    tier: 'common',
    requirement: 'explore',
    target: 1,
    rewardExp: 220,
    rewardCoins: 500,
    rewardKnb: 0
  },
  {
    id: 'b_common_explore_2',
    name: 'Tầm U Sơ Hành',
    description: 'Hoàn thành 2 lần khám phá',
    category: 'exploration',
    tier: 'common',
    requirement: 'explore',
    target: 2,
    rewardExp: 280,
    rewardCoins: 650,
    rewardKnb: 0
  },
  {
    id: 'b_common_craft_1',
    name: 'Bách Nghệ Sơ Học',
    description: 'Hoàn thành 1 lần chế tạo hoặc luyện khí',
    category: 'craft',
    tier: 'common',
    requirement: 'craft',
    target: 1,
    rewardExp: 220,
    rewardCoins: 500,
    rewardKnb: 0
  },
  {
    id: 'b_common_forge_1',
    name: 'Lô Hỏa Sơ Minh',
    description: 'Luyện khí thành công 1 lần',
    category: 'craft',
    tier: 'common',
    requirement: 'forge',
    target: 1,
    rewardExp: 250,
    rewardCoins: 550,
    rewardKnb: 0
  },

  // ============================================================
  // LINH PHẨM — ELITE
  // ============================================================
  {
    id: 'b_elite_activity_1',
    name: 'Đạo Đồ Vạn Hành',
    description: 'Hoàn thành 8 hoạt động trong ngày',
    category: 'special',
    tier: 'elite',
    requirement: 'activity',
    target: 8,
    rewardExp: 450,
    rewardCoins: 1000,
    rewardKnb: 2
  },
  {
    id: 'b_elite_work_1',
    name: 'Cần Tu Bất Đãi',
    description: 'Hoàn thành 6 lần làm việc',
    category: 'work',
    tier: 'elite',
    requirement: 'work',
    target: 6,
    rewardExp: 420,
    rewardCoins: 1200,
    rewardKnb: 2
  },
  {
    id: 'b_elite_mine_1',
    name: 'Tầm Ngọc',
    description: 'Khai thác khoáng mạch 6 lần',
    category: 'work',
    tier: 'elite',
    requirement: 'mine',
    target: 6,
    rewardExp: 450,
    rewardCoins: 1250,
    rewardKnb: 2
  },
  {
    id: 'b_elite_herb_1',
    name: 'Thảo Dược Đầy Nang',
    description: 'Thu thập 10 phần linh thảo hoặc linh thực',
    category: 'life',
    tier: 'elite',
    requirement: 'herb',
    target: 10,
    rewardExp: 430,
    rewardCoins: 1050,
    rewardKnb: 2
  },
  {
    id: 'b_elite_harvest_1',
    name: 'Linh Điền Phong Thu',
    description: 'Thu hoạch 8 linh thực từ Linh Điền',
    category: 'life',
    tier: 'elite',
    requirement: 'harvest',
    target: 8,
    rewardExp: 480,
    rewardCoins: 1150,
    rewardKnb: 2
  },
  {
    id: 'b_elite_patrol_1',
    name: 'Trấn Sơn Tuần Hành',
    description: 'Hoàn thành 5 lần tuần tra',
    category: 'work',
    tier: 'elite',
    requirement: 'patrol',
    target: 5,
    rewardExp: 450,
    rewardCoins: 1150,
    rewardKnb: 2
  },
  {
    id: 'b_elite_escort_1',
    name: 'Vạn Lý Hộ Tiêu',
    description: 'Hoàn thành 5 lần hộ tiêu',
    category: 'work',
    tier: 'elite',
    requirement: 'escort',
    target: 5,
    rewardExp: 500,
    rewardCoins: 1350,
    rewardKnb: 2
  },
  {
    id: 'b_elite_adventure_1',
    name: 'Vân Du Sơn Hà',
    description: 'Hoàn thành 3 lần phiêu lưu bản đồ',
    category: 'exploration',
    tier: 'elite',
    requirement: 'adventure',
    target: 3,
    rewardExp: 560,
    rewardCoins: 1500,
    rewardKnb: 3
  },
  {
    id: 'b_elite_archaeology_1',
    name: 'Cổ Mộ Tầm Tung',
    description: 'Hoàn thành 2 lần khảo cổ cổ mộ',
    category: 'exploration',
    tier: 'elite',
    requirement: 'archaeology',
    target: 2,
    rewardExp: 600,
    rewardCoins: 1600,
    rewardKnb: 3
  },
  {
    id: 'b_elite_explore_1',
    name: 'Du Ngoạn Tứ Phương',
    description: 'Hoàn thành 4 lần khám phá',
    category: 'exploration',
    tier: 'elite',
    requirement: 'explore',
    target: 4,
    rewardExp: 550,
    rewardCoins: 1400,
    rewardKnb: 3
  },

  // ============================================================
  // HUYỀN PHẨM — RARE
  // ============================================================
  {
    id: 'b_rare_activity_1',
    name: 'Bách Sự Luyện Tâm',
    description: 'Hoàn thành 12 hoạt động trong ngày',
    category: 'special',
    tier: 'rare',
    requirement: 'activity',
    target: 12,
    rewardExp: 800,
    rewardCoins: 2000,
    rewardKnb: 4
  },
  {
    id: 'b_rare_work_1',
    name: 'Công Hành Nhật Tiến',
    description: 'Hoàn thành 10 lần làm việc',
    category: 'work',
    tier: 'rare',
    requirement: 'work',
    target: 10,
    rewardExp: 750,
    rewardCoins: 2200,
    rewardKnb: 4
  },
  {
    id: 'b_rare_mine_1',
    name: 'Sơn Tàng Vạn Ngọc',
    description: 'Khai thác khoáng mạch 10 lần',
    category: 'work',
    tier: 'rare',
    requirement: 'mine',
    target: 10,
    rewardExp: 820,
    rewardCoins: 2400,
    rewardKnb: 4
  },
  {
    id: 'b_rare_adventure_1',
    name: 'Ngự Kiếm Tầm Cơ',
    description: 'Hoàn thành 5 lần phiêu lưu bản đồ',
    category: 'exploration',
    tier: 'rare',
    requirement: 'adventure',
    target: 5,
    rewardExp: 950,
    rewardCoins: 2700,
    rewardKnb: 5
  },
  {
    id: 'b_rare_archaeology_1',
    name: 'Thám Mộ Tầm Trân',
    description: 'Hoàn thành 4 lần khảo cổ cổ mộ',
    category: 'exploration',
    tier: 'rare',
    requirement: 'archaeology',
    target: 4,
    rewardExp: 1000,
    rewardCoins: 2850,
    rewardKnb: 5
  },
  {
    id: 'b_rare_herb_1',
    name: 'Dược Hương Mãn Tụ',
    description: 'Thu thập 16 phần linh thảo hoặc linh thực',
    category: 'life',
    tier: 'rare',
    requirement: 'herb',
    target: 16,
    rewardExp: 780,
    rewardCoins: 2100,
    rewardKnb: 4
  },
  {
    id: 'b_rare_patrol_1',
    name: 'Sơn Môn Bất Thất',
    description: 'Hoàn thành 8 lần tuần tra',
    category: 'work',
    tier: 'rare',
    requirement: 'patrol',
    target: 8,
    rewardExp: 850,
    rewardCoins: 2350,
    rewardKnb: 4
  },
  {
    id: 'b_rare_escort_1',
    name: 'Trường Lộ Hộ Thương',
    description: 'Hoàn thành 7 lần hộ tiêu',
    category: 'work',
    tier: 'rare',
    requirement: 'escort',
    target: 7,
    rewardExp: 900,
    rewardCoins: 2550,
    rewardKnb: 5
  },
  {
    id: 'b_rare_explore_1',
    name: 'Vạn Cảnh Tầm U',
    description: 'Hoàn thành 7 lần khám phá',
    category: 'exploration',
    tier: 'rare',
    requirement: 'explore',
    target: 7,
    rewardExp: 900,
    rewardCoins: 2500,
    rewardKnb: 5
  },
  {
    id: 'b_rare_craft_1',
    name: 'Bách Luyện Thành Khí',
    description: 'Hoàn thành 4 lần chế tạo hoặc luyện khí',
    category: 'craft',
    tier: 'rare',
    requirement: 'craft',
    target: 4,
    rewardExp: 850,
    rewardCoins: 2300,
    rewardKnb: 5
  },
  {
    id: 'b_rare_forge_1',
    name: 'Khí Hỏa Thuần Thanh',
    description: 'Luyện khí thành công 3 lần',
    category: 'craft',
    tier: 'rare',
    requirement: 'forge',
    target: 3,
    rewardExp: 900,
    rewardCoins: 2500,
    rewardKnb: 5
  },

  // ============================================================
  // ĐỊA PHẨM — EPIC
  // ============================================================
  {
    id: 'b_epic_activity_1',
    name: 'Bách Nghệ Tu Hành',
    description: 'Hoàn thành 18 hoạt động trong ngày',
    category: 'special',
    tier: 'epic',
    requirement: 'activity',
    target: 18,
    rewardExp: 1400,
    rewardCoins: 3800,
    rewardKnb: 8
  },
  {
    id: 'b_epic_mine_1',
    name: 'Đào Sơn Tầm Bảo',
    description: 'Khai thác khoáng mạch 15 lần',
    category: 'work',
    tier: 'epic',
    requirement: 'mine',
    target: 15,
    rewardExp: 1350,
    rewardCoins: 4000,
    rewardKnb: 8
  },
  {
    id: 'b_epic_adventure_1',
    name: 'Vân Hải Du Tung',
    description: 'Hoàn thành 8 lần phiêu lưu bản đồ',
    category: 'exploration',
    tier: 'epic',
    requirement: 'adventure',
    target: 8,
    rewardExp: 1600,
    rewardCoins: 4600,
    rewardKnb: 10
  },
  {
    id: 'b_epic_archaeology_1',
    name: 'U Minh Khảo Cổ',
    description: 'Hoàn thành 6 lần khảo cổ cổ mộ',
    category: 'exploration',
    tier: 'epic',
    requirement: 'archaeology',
    target: 6,
    rewardExp: 1700,
    rewardCoins: 4800,
    rewardKnb: 10
  },
  {
    id: 'b_epic_herb_1',
    name: 'Vạn Thảo Quy Nang',
    description: 'Thu thập 24 phần linh thảo hoặc linh thực',
    category: 'life',
    tier: 'epic',
    requirement: 'herb',
    target: 24,
    rewardExp: 1450,
    rewardCoins: 4100,
    rewardKnb: 9
  },
  {
    id: 'b_epic_patrol_1',
    name: 'Trấn Vực Tuần Thiên',
    description: 'Hoàn thành 12 lần tuần tra',
    category: 'work',
    tier: 'epic',
    requirement: 'patrol',
    target: 12,
    rewardExp: 1500,
    rewardCoins: 4300,
    rewardKnb: 9
  },
  {
    id: 'b_epic_escort_1',
    name: 'Thiên Lý Hộ Đạo',
    description: 'Hoàn thành 10 lần hộ tiêu',
    category: 'work',
    tier: 'epic',
    requirement: 'escort',
    target: 10,
    rewardExp: 1650,
    rewardCoins: 4700,
    rewardKnb: 10
  },
  {
    id: 'b_epic_explore_1',
    name: 'Tầm U Thám Huyền',
    description: 'Hoàn thành 10 lần khám phá',
    category: 'exploration',
    tier: 'epic',
    requirement: 'explore',
    target: 10,
    rewardExp: 1500,
    rewardCoins: 4200,
    rewardKnb: 9
  },
  {
    id: 'b_epic_craft_1',
    name: 'Lô Hỏa Thông Linh',
    description: 'Hoàn thành 7 lần chế tạo hoặc luyện khí',
    category: 'craft',
    tier: 'epic',
    requirement: 'craft',
    target: 7,
    rewardExp: 1450,
    rewardCoins: 4000,
    rewardKnb: 9
  },
  {
    id: 'b_epic_forge_1',
    name: 'Khí Đạo Đại Thành',
    description: 'Luyện khí thành công 5 lần',
    category: 'craft',
    tier: 'epic',
    requirement: 'forge',
    target: 5,
    rewardExp: 1550,
    rewardCoins: 4500,
    rewardKnb: 10
  },

  // ============================================================
  // THIÊN PHẨM — LEGENDARY
  // Ngày thứ 5 của chuỗi sẽ bảo đảm bảng có ít nhất một Thiên phẩm.
  // ============================================================
  {
    id: 'b_legendary_activity_1',
    name: 'Thiên Cơ Giáng Lâm',
    description: 'Hoàn thành 25 hoạt động trong ngày',
    category: 'special',
    tier: 'legendary',
    requirement: 'activity',
    target: 25,
    rewardExp: 2600,
    rewardCoins: 7500,
    rewardKnb: 18
  },
  {
    id: 'b_legendary_mine_1',
    name: 'Khai Mạch Tầm Cơ',
    description: 'Khai thác khoáng mạch 20 lần',
    category: 'work',
    tier: 'legendary',
    requirement: 'mine',
    target: 20,
    rewardExp: 2400,
    rewardCoins: 8000,
    rewardKnb: 18
  },
  {
    id: 'b_legendary_adventure_1',
    name: 'Thiên Nhai Vấn Đạo',
    description: 'Hoàn thành 12 lần phiêu lưu bản đồ',
    category: 'exploration',
    tier: 'legendary',
    requirement: 'adventure',
    target: 12,
    rewardExp: 3000,
    rewardCoins: 9000,
    rewardKnb: 20
  },
  {
    id: 'b_legendary_archaeology_1',
    name: 'Thái Cổ Tầm Bí',
    description: 'Hoàn thành 10 lần khảo cổ cổ mộ',
    category: 'exploration',
    tier: 'legendary',
    requirement: 'archaeology',
    target: 10,
    rewardExp: 3200,
    rewardCoins: 9500,
    rewardKnb: 22
  },
  {
    id: 'b_legendary_herb_1',
    name: 'Bách Thảo Triều Tông',
    description: 'Thu thập 36 phần linh thảo hoặc linh thực',
    category: 'life',
    tier: 'legendary',
    requirement: 'herb',
    target: 36,
    rewardExp: 2700,
    rewardCoins: 8200,
    rewardKnb: 18
  },
  {
    id: 'b_legendary_patrol_1',
    name: 'Tuần Thiên Trấn Giới',
    description: 'Hoàn thành 18 lần tuần tra',
    category: 'work',
    tier: 'legendary',
    requirement: 'patrol',
    target: 18,
    rewardExp: 2900,
    rewardCoins: 8800,
    rewardKnb: 20
  },
  {
    id: 'b_legendary_escort_1',
    name: 'Vạn Dặm Hộ Mệnh',
    description: 'Hoàn thành 15 lần hộ tiêu',
    category: 'work',
    tier: 'legendary',
    requirement: 'escort',
    target: 15,
    rewardExp: 3100,
    rewardCoins: 9300,
    rewardKnb: 21
  },
  {
    id: 'b_legendary_explore_1',
    name: 'Thiên Ngoại Tầm Tung',
    description: 'Hoàn thành 15 lần khám phá',
    category: 'exploration',
    tier: 'legendary',
    requirement: 'explore',
    target: 15,
    rewardExp: 2800,
    rewardCoins: 8500,
    rewardKnb: 20
  },
  {
    id: 'b_legendary_forge_1',
    name: 'Bách Luyện Thông Thiên',
    description: 'Luyện khí thành công 8 lần',
    category: 'craft',
    tier: 'legendary',
    requirement: 'forge',
    target: 8,
    rewardExp: 3000,
    rewardCoins: 9000,
    rewardKnb: 20
  }
];

class BountyBoardService {
  constructor() {
    this.initTables();
  }

  // ============================================================
  // DATABASE / MIGRATION
  // ============================================================

  private initTables(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bounty_board (
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        cards_json TEXT NOT NULL,
        selected_json TEXT DEFAULT '[]',
        progress_json TEXT DEFAULT '{}',
        completed INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, day)
      );

      CREATE TABLE IF NOT EXISTS bounty_streak (
        user_id TEXT PRIMARY KEY,
        streak INTEGER DEFAULT 0,
        last_completed_day TEXT
      );
    `);

    // Migration cho bounty_board phiên bản cũ.
    const columns = db.prepare(`PRAGMA table_info(bounty_board)`).all() as Array<{ name: string }>;
    const names = new Set(columns.map(c => c.name));

    if (!names.has('selected_json')) {
      db.exec(`ALTER TABLE bounty_board ADD COLUMN selected_json TEXT DEFAULT '[]'`);
    }

    if (!names.has('progress_json')) {
      db.exec(`ALTER TABLE bounty_board ADD COLUMN progress_json TEXT DEFAULT '{}'`);
    }

    if (!names.has('completed')) {
      db.exec(`ALTER TABLE bounty_board ADD COLUMN completed INTEGER DEFAULT 0`);
    }
  }

  // ============================================================
  // DATE — UTC+7 / VIỆT NAM
  // ============================================================

  private getToday(): string {
    const now = new Date();
    const vietnam = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return vietnam.toISOString().slice(0, 10);
  }

  private getPreviousDay(day: string): string {
    const date = new Date(`${day}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  // ============================================================
  // JSON HELPERS
  // ============================================================

  private parseArray<T = string>(raw: string | null | undefined): T[] {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private parseObject(raw: string | null | undefined): Record<string, number> {
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const numberValue = Number(value);
        result[key] = Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
      }
      return result;
    } catch {
      return {};
    }
  }

  private parseCards(raw: string | null | undefined): BountyQuest[] {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as BountyQuest[] : [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // RANDOM / GENERATION
  // ============================================================

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  private randomFrom<T>(items: T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[Math.floor(Math.random() * items.length)];
  }

  private allowedTiers(level: number): BountyTier[] {
    const tiers: BountyTier[] = ['common'];

    if (level >= 10) tiers.push('elite');
    if (level >= 25) tiers.push('rare');
    if (level >= 45) tiers.push('epic');
    if (level >= 65) tiers.push('legendary');

    return tiers;
  }

  private rollTier(level: number): BountyTier {
    const roll = Math.random();

    if (level >= 65 && roll < 0.06) return 'legendary';
    if (level >= 45 && roll < 0.16) return 'epic';
    if (level >= 25 && roll < 0.33) return 'rare';
    if (level >= 10 && roll < 0.58) return 'elite';

    return 'common';
  }

  private generateCards(level: number, currentStreak: number): BountyQuest[] {
    const result: BountyQuest[] = [];
    const usedIds = new Set<string>();
    const usedRequirements = new Set<string>();
    const allowed = new Set(this.allowedTiers(level));

    // Ngày thứ 5 của chuỗi: bảo đảm xuất hiện một Thiên Phẩm.
    // currentStreak = 4 nghĩa là hôm nay là ngày thứ 5 nếu hoàn thành.
    if (currentStreak === 4) {
      const legendaryPool = this.shuffle(
        BOUNTY_POOL.filter(q => q.tier === 'legendary')
      );

      const heavenly = legendaryPool[0];
      if (heavenly) {
        result.push(heavenly);
        usedIds.add(heavenly.id);
        usedRequirements.add(heavenly.requirement);
      }
    }

    // Ưu tiên 6 requirement khác nhau để bảng đa dạng hơn.
    let guard = 0;
    while (result.length < 6 && guard < 200) {
      guard += 1;

      const tier = this.rollTier(level);
      if (!allowed.has(tier)) continue;

      let pool = BOUNTY_POOL.filter(q =>
        q.tier === tier &&
        !usedIds.has(q.id) &&
        !usedRequirements.has(q.requirement)
      );

      if (pool.length === 0) {
        pool = BOUNTY_POOL.filter(q =>
          allowed.has(q.tier) &&
          !usedIds.has(q.id) &&
          !usedRequirements.has(q.requirement)
        );
      }

      const picked = this.randomFrom(pool);
      if (!picked) break;

      result.push(picked);
      usedIds.add(picked.id);
      usedRequirements.add(picked.requirement);
    }

    // Nếu chưa đủ 6 thì cho phép trùng requirement, nhưng tuyệt đối không trùng quest.
    if (result.length < 6) {
      const fallback = this.shuffle(
        BOUNTY_POOL.filter(q => allowed.has(q.tier) && !usedIds.has(q.id))
      );

      for (const quest of fallback) {
        if (result.length >= 6) break;
        result.push(quest);
        usedIds.add(quest.id);
      }
    }

    // Trường hợp người chơi cấp thấp nhưng bảng vẫn thiếu do pool thay đổi về sau.
    if (result.length < 6) {
      const ultimateFallback = this.shuffle(
        BOUNTY_POOL.filter(q => !usedIds.has(q.id))
      );

      for (const quest of ultimateFallback) {
        if (result.length >= 6) break;
        result.push(quest);
        usedIds.add(quest.id);
      }
    }

    return this.shuffle(result.slice(0, 6));
  }

  // ============================================================
  // DAILY BOARD
  // ============================================================

  public getTodayCards(userId: string, userLevel: number): BountyQuest[] {
    const today = this.getToday();

    const existing = db.prepare(`
      SELECT cards_json
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, today) as { cards_json: string } | undefined;

    if (existing) {
      const cards = this.parseCards(existing.cards_json);
      if (cards.length > 0) return cards;
    }

    const streak = this.getStreak(userId);
    const cards = this.generateCards(userLevel, streak);

    db.prepare(`
      INSERT INTO bounty_board (
        user_id,
        day,
        cards_json,
        selected_json,
        progress_json,
        completed
      )
      VALUES (?, ?, ?, '[]', '{}', 0)
      ON CONFLICT(user_id, day)
      DO UPDATE SET cards_json = excluded.cards_json
    `).run(
      userId,
      today,
      JSON.stringify(cards)
    );

    return cards;
  }

  public isCompletedToday(userId: string): boolean {
    const row = db.prepare(`
      SELECT completed
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, this.getToday()) as { completed: number } | undefined;

    return Boolean(row?.completed);
  }

  // ============================================================
  // SELECT 3 / 6
  // ============================================================

  public selectBounties(userId: string, questIds: string[]): void {
    const today = this.getToday();
    const uniqueIds = [...new Set(questIds)];

    if (uniqueIds.length !== 3) {
      throw new Error('Mỗi ngày phải chọn đúng 3 nghĩa vụ.');
    }

    const row = db.prepare(`
      SELECT cards_json, selected_json, completed
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, today) as Pick<BountyBoardRow, 'cards_json' | 'selected_json' | 'completed'> | undefined;

    if (!row) {
      throw new Error('Bảng Nghĩa Vụ hôm nay chưa được khởi tạo.');
    }

    if (row.completed) {
      throw new Error('Bảng Nghĩa Vụ hôm nay đã hoàn thành.');
    }

    const existing = this.parseArray<string>(row.selected_json);
    if (existing.length > 0) {
      throw new Error('Đạo hữu đã tiếp nhận nghĩa vụ hôm nay.');
    }

    const cards = this.parseCards(row.cards_json);
    const validIds = new Set(cards.map(q => q.id));

    if (uniqueIds.some(id => !validIds.has(id))) {
      throw new Error('Có nghĩa vụ không thuộc bảng hôm nay.');
    }

    const progress: Record<string, number> = {};
    for (const id of uniqueIds) {
      progress[id] = 0;
    }

    db.prepare(`
      UPDATE bounty_board
      SET selected_json = ?, progress_json = ?
      WHERE user_id = ? AND day = ?
    `).run(
      JSON.stringify(uniqueIds),
      JSON.stringify(progress),
      userId,
      today
    );
  }

  /**
   * Chọn từng nghĩa vụ bằng button. Trước khi đủ 3 có thể bấm lại để bỏ chọn.
   * Khi đã đủ 3, lựa chọn được khóa cho tới hết ngày.
   */
  public toggleBountySelection(userId: string, questId: string): BountySelectionResult {
    const today = this.getToday();

    const row = db.prepare(`
      SELECT cards_json, selected_json, completed
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, today) as Pick<
      BountyBoardRow,
      'cards_json' | 'selected_json' | 'completed'
    > | undefined;

    if (!row) {
      return {
        success: false,
        selected: [],
        locked: false,
        message: '📜 Bảng Nghĩa Vụ hôm nay chưa được khởi tạo.'
      };
    }

    if (row.completed) {
      return {
        success: false,
        selected: this.parseArray<string>(row.selected_json),
        locked: true,
        message: '✅ Bảng Nghĩa Vụ hôm nay đã được kết toán.'
      };
    }

    const cards = this.parseCards(row.cards_json);
    const validIds = new Set(cards.map(q => q.id));
    if (!validIds.has(questId)) {
      return {
        success: false,
        selected: this.parseArray<string>(row.selected_json),
        locked: false,
        message: '❌ Nghĩa vụ này không thuộc bảng hôm nay.'
      };
    }

    const selected = this.parseArray<string>(row.selected_json);

    // Đủ 3 là khóa lựa chọn, không cho đổi giữa chừng.
    if (selected.length >= 3) {
      return {
        success: false,
        selected,
        locked: true,
        message: '📜 Đạo hữu đã tiếp nhận đủ ba nghĩa vụ hôm nay; không thể đổi giữa chừng.'
      };
    }

    const index = selected.indexOf(questId);
    let added = false;

    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(questId);
      added = true;
    }

    // Chỉ giữ tiến độ của các quest còn đang được chọn.
    const oldProgress = this.getProgress(userId);
    const progress: Record<string, number> = {};
    for (const id of selected) {
      progress[id] = oldProgress[id] ?? 0;
    }

    db.prepare(`
      UPDATE bounty_board
      SET selected_json = ?, progress_json = ?
      WHERE user_id = ? AND day = ?
    `).run(JSON.stringify(selected), JSON.stringify(progress), userId, today);

    const locked = selected.length === 3;
    const quest = cards.find(q => q.id === questId);

    return {
      success: true,
      selected,
      locked,
      added,
      message: locked
        ? `📜 Đã tiếp nhận đủ **3/3 nghĩa vụ**. Lựa chọn hôm nay đã được khóa.`
        : added
          ? `✅ Đã chọn **${quest?.name ?? questId}** · ${selected.length}/3.`
          : `↩️ Đã bỏ chọn **${quest?.name ?? questId}** · ${selected.length}/3.`
    };
  }

  public getSelectedBounties(userId: string): string[] {
    const row = db.prepare(`
      SELECT selected_json
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, this.getToday()) as { selected_json: string | null } | undefined;

    return this.parseArray<string>(row?.selected_json);
  }

  // ============================================================
  // PROGRESS
  // ============================================================

  public getProgress(userId: string): Record<string, number> {
    const row = db.prepare(`
      SELECT progress_json
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, this.getToday()) as { progress_json: string | null } | undefined;

    return this.parseObject(row?.progress_json);
  }

  public updateProgress(
    userId: string,
    requirement: string,
    amount = 1
  ): void {
    if (!requirement) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const today = this.getToday();

    const row = db.prepare(`
      SELECT cards_json, selected_json, progress_json, completed
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, today) as Pick<
      BountyBoardRow,
      'cards_json' | 'selected_json' | 'progress_json' | 'completed'
    > | undefined;

    // Chưa mở /bangnghiavu hôm nay, chưa chọn nhiệm vụ, hoặc đã hoàn thành.
    if (!row || row.completed) return;

    const selected = this.parseArray<string>(row.selected_json);
    if (selected.length !== 3) return;

    const cards = this.parseCards(row.cards_json);
    const progress = this.parseObject(row.progress_json);

    let changed = false;

    for (const quest of cards) {
      if (!selected.includes(quest.id)) continue;
      if (quest.requirement !== requirement) continue;

      const current = progress[quest.id] ?? 0;
      const next = Math.min(quest.target, current + amount);

      if (next !== current) {
        progress[quest.id] = next;
        changed = true;
      }
    }

    if (!changed) return;

    db.prepare(`
      UPDATE bounty_board
      SET progress_json = ?
      WHERE user_id = ? AND day = ?
    `).run(
      JSON.stringify(progress),
      userId,
      today
    );
  }

  public canCompleteToday(userId: string): boolean {
    const row = db.prepare(`
      SELECT cards_json, selected_json, progress_json, completed
      FROM bounty_board
      WHERE user_id = ? AND day = ?
    `).get(userId, this.getToday()) as Pick<
      BountyBoardRow,
      'cards_json' | 'selected_json' | 'progress_json' | 'completed'
    > | undefined;

    if (!row || row.completed) return false;

    const selected = this.parseArray<string>(row.selected_json);
    if (selected.length !== 3) return false;

    const cards = this.parseCards(row.cards_json);
    const progress = this.parseObject(row.progress_json);

    for (const id of selected) {
      const quest = cards.find(q => q.id === id);
      if (!quest) return false;

      if ((progress[id] ?? 0) < quest.target) {
        return false;
      }
    }

    return true;
  }

  // ============================================================
  // STREAK
  // ============================================================

  private getRawStreakRow(userId: string): BountyStreakRow | undefined {
    return db.prepare(`
      SELECT user_id, streak, last_completed_day
      FROM bounty_streak
      WHERE user_id = ?
    `).get(userId) as BountyStreakRow | undefined;
  }

  /**
   * Streak hiển thị theo chu kỳ 5 ngày.
   * - Vừa hoàn thành ngày thứ 5: hôm đó vẫn hiển thị 5/5.
   * - Sang ngày kế tiếp: bắt đầu chu kỳ mới, hiển thị 0/5.
   */
  public getStreak(userId: string): number {
    const row = this.getRawStreakRow(userId);
    if (!row || !row.last_completed_day) return 0;

    const today = this.getToday();
    const yesterday = this.getPreviousDay(today);
    const raw = Math.max(0, Number(row.streak) || 0);

    if (row.last_completed_day === today) {
      return Math.min(raw, 5);
    }

    if (row.last_completed_day === yesterday) {
      return raw >= 5 ? 0 : Math.min(raw, 4);
    }

    return 0;
  }

  // ============================================================
  // REWARD HELPERS
  // ============================================================

  private findUserStorage(): {
    table: string;
    idColumn: string;
    columns: Set<string>;
  } | null {
    const tableCandidates = ['users', 'user_profiles', 'players'];

    for (const table of tableCandidates) {
      const exists = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `).get(table) as { name: string } | undefined;

      if (!exists) continue;

      const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      const columns = new Set(info.map(c => c.name));

      const idColumn = ['user_id', 'id', 'discord_id'].find(c => columns.has(c));
      if (!idColumn) continue;

      return { table, idColumn, columns };
    }

    return null;
  }

  private applyRewards(
    userId: string,
    exp: number,
    coins: number,
    knb: number
  ): { expApplied: boolean } {
    const storage = this.findUserStorage();

    if (!storage) {
      throw new Error('Không tìm thấy bảng dữ liệu nhân vật để trao thưởng Bảng Nghĩa Vụ.');
    }

    const { table, idColumn, columns } = storage;
    const updates: string[] = [];
    const values: number[] = [];

    if (columns.has('coin_ha_pham')) {
      updates.push(`coin_ha_pham = COALESCE(coin_ha_pham, 0) + ?`);
      values.push(coins);
    }

    if (columns.has('knb')) {
      updates.push(`knb = COALESCE(knb, 0) + ?`);
      values.push(knb);
    }

    const expColumn = [
      'exp',
      'experience',
      'tu_vi',
      'tuvi',
      'cultivation_exp',
      'cultivation'
    ].find(column => columns.has(column));

    let expApplied = false;

    if (expColumn) {
      updates.push(`${expColumn} = COALESCE(${expColumn}, 0) + ?`);
      values.push(exp);
      expApplied = true;
    }

    if (updates.length === 0) {
      throw new Error('Không tìm thấy cột Linh Thạch/KNB/Tu Vi phù hợp để trao thưởng.');
    }

    const result = db.prepare(`
      UPDATE ${table}
      SET ${updates.join(', ')}
      WHERE ${idColumn} = ?
    `).run(...values, userId);

    if (result.changes <= 0) {
      throw new Error('Không tìm thấy nhân vật để trao thưởng Bảng Nghĩa Vụ.');
    }

    return { expApplied };
  }

  // ============================================================
  // COMPLETE / CLAIM
  // ============================================================

  public completeToday(userId: string): CompleteResult {
    const today = this.getToday();

    const transaction = db.transaction((): CompleteResult => {
      const row = db.prepare(`
        SELECT cards_json, selected_json, progress_json, completed
        FROM bounty_board
        WHERE user_id = ? AND day = ?
      `).get(userId, today) as Pick<
        BountyBoardRow,
        'cards_json' | 'selected_json' | 'progress_json' | 'completed'
      > | undefined;

      if (!row) {
        return {
          success: false,
          streakBonus: 0,
          message: '📜 Hôm nay đạo hữu vẫn chưa mở Bảng Nghĩa Vụ.'
        };
      }

      if (row.completed) {
        return {
          success: false,
          streakBonus: 0,
          message: '✅ Bảng Nghĩa Vụ hôm nay đã được kết toán rồi.'
        };
      }

      const selected = this.parseArray<string>(row.selected_json);
      if (selected.length !== 3) {
        return {
          success: false,
          streakBonus: 0,
          message: '📜 Đạo hữu cần tiếp nhận đủ **3 nghĩa vụ** trước.'
        };
      }

      const cards = this.parseCards(row.cards_json);
      const progress = this.parseObject(row.progress_json);

      const selectedQuests: BountyQuest[] = [];

      for (const id of selected) {
        const quest = cards.find(q => q.id === id);

        if (!quest) {
          return {
            success: false,
            streakBonus: 0,
            message: '❌ Dữ liệu nghĩa vụ hôm nay không còn hợp lệ.'
          };
        }

        if ((progress[id] ?? 0) < quest.target) {
          return {
            success: false,
            streakBonus: 0,
            message: `⏳ **${quest.name}** vẫn chưa hoàn thành (${progress[id] ?? 0}/${quest.target}).`
          };
        }

        selectedQuests.push(quest);
      }

      let totalExp = selectedQuests.reduce((sum, q) => sum + q.rewardExp, 0);
      let totalCoins = selectedQuests.reduce((sum, q) => sum + q.rewardCoins, 0);
      let totalKnb = selectedQuests.reduce((sum, q) => sum + q.rewardKnb, 0);

      const streakRow = this.getRawStreakRow(userId);
      const yesterday = this.getPreviousDay(today);

      let newStreak = 1;

      if (streakRow?.last_completed_day === yesterday) {
        // Sau mốc 5 ngày, chu kỳ kế tiếp bắt đầu lại từ 1.
        newStreak = streakRow.streak >= 5
          ? 1
          : Math.max(1, streakRow.streak + 1);
      }

      const reachedFiveDayMilestone = newStreak === 5;

      // Thiên Cơ 5 ngày: thưởng thêm một phần ngoài ba nghĩa vụ.
      let streakBonus = 0;
      if (reachedFiveDayMilestone) {
        streakBonus = 1;
        totalExp += 1000;
        totalCoins += 3000;
        totalKnb += 10;
      }

      const rewardResult = this.applyRewards(
        userId,
        totalExp,
        totalCoins,
        totalKnb
      );

      db.prepare(`
        UPDATE bounty_board
        SET completed = 1
        WHERE user_id = ? AND day = ?
      `).run(userId, today);

      db.prepare(`
        INSERT INTO bounty_streak (user_id, streak, last_completed_day)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id)
        DO UPDATE SET
          streak = excluded.streak,
          last_completed_day = excluded.last_completed_day
      `).run(userId, newStreak, today);

      const completedNames = selectedQuests
        .map(q => `• **${q.name}**`)
        .join('\n');

      let message =
        `✅ **Ba đạo nghĩa vụ đã viên mãn.**\n` +
        `${completedNames}\n\n` +
        `🎁 **Công thưởng Trấn Hải Các**\n`;

      if (rewardResult.expApplied) {
        message += `• Tu Vi: **+${totalExp.toLocaleString()}**\n`;
      }

      message +=
        `• Linh Thạch: **+${totalCoins.toLocaleString()} LT**\n` +
        `• Cống Phẩm Linh Thạch: **+${totalKnb.toLocaleString()}**\n` +
        `• Liên Tục Tu Hành: **${newStreak}/5 ngày**`;

      if (reachedFiveDayMilestone) {
        message +=
          `\n\n🌌 **Thiên Cơ Hữu Ứng**\n` +
          `Năm ngày nghĩa vụ không gián đoạn, thiên cơ khẽ động. ` +
          `Trấn Hải Các ban thêm **1.000 Tu Vi · 3.000 LT · 10 Cống Phẩm Linh Thạch**.`;
      }

      return {
        success: true,
        streakBonus,
        message
      };
    });

    try {
      return transaction();
    } catch (error) {
      console.error('[BountyBoardService] completeToday failed:', error);

      return {
        success: false,
        streakBonus: 0,
        message: '❌ Thiên cơ hỗn loạn, Bảng Nghĩa Vụ chưa thể kết toán. Vui lòng thử lại.'
      };
    }
  }
}

export const bountyBoardService = new BountyBoardService();
