import Database from 'better-sqlite3';
import { config } from '../config';

// Khởi tạo Database với better-sqlite3
const db = new Database(config.dbPath, { verbose: console.log });

// Cấu hình tối ưu hiệu năng cho SQLite
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

/**
 * Tạo các bảng dữ liệu nếu chưa tồn tại
 */
export function initDatabase() {
  // Bảng Tông Môn (Sects) - Cần tạo trước để bảng Users tham chiếu foreign key
  db.exec(`
    CREATE TABLE IF NOT EXISTS sects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      master_id TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      resources INTEGER DEFAULT 0,
      description TEXT,
      buildings TEXT, -- JSON quản lý lãnh địa Tông Môn
      created_at INTEGER NOT NULL
    );
  `);

  // Bảng Người Chơi / Nhân Vật (Users)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT DEFAULT 'Tán Tu',
      level INTEGER DEFAULT 1,
      tu_vi INTEGER DEFAULT 0,
      exp_needed INTEGER DEFAULT 100,
      
      -- Chỉ số chiến đấu cơ bản
      base_hp INTEGER DEFAULT 100,
      base_mp INTEGER DEFAULT 50,
      base_atk INTEGER DEFAULT 15,
      base_def INTEGER DEFAULT 10,
      base_crit REAL DEFAULT 0.05,
      base_crit_res REAL DEFAULT 0.0,
      base_luck INTEGER DEFAULT 10,
      base_speed INTEGER DEFAULT 100,
      base_dodge REAL DEFAULT 0.05,
      
      -- Linh căn dưới dạng JSON (ví dụ: '{"Hỏa": 80, "Mộc": 20}')
      linh_can TEXT NOT NULL,
      
      -- Tiền tệ
      coin_ha_pham INTEGER DEFAULT 0,
      coin_trung_pham INTEGER DEFAULT 0,
      coin_thuong_pham INTEGER DEFAULT 0,
      knb INTEGER DEFAULT 0,
      
      -- Quan hệ Tông môn
      sect_id INTEGER REFERENCES sects(id) ON DELETE SET NULL,
      sect_role TEXT DEFAULT 'member',
      sect_contribution INTEGER DEFAULT 0,
      joined_sect_at INTEGER,
      
      -- Chiến tích PvP
      pvp_points INTEGER DEFAULT 1000,
      pvp_wins INTEGER DEFAULT 0,
      pvp_losses INTEGER DEFAULT 0,

      -- Nâng cấp Ý Cảnh & Luân Hồi
      luan_hoi_count INTEGER DEFAULT 0,
      y_canh TEXT DEFAULT '{}',
      ngotinh INTEGER DEFAULT 0,
      last_quexam_at INTEGER DEFAULT 0,
      -- Hệ thống Đạo Lữ
      partner_id TEXT,
      intimacy INTEGER DEFAULT 0,
      last_songtu_at INTEGER DEFAULT 0,
      
      -- Bí Cảnh Co-op
      dungeon_clears INTEGER DEFAULT 0,
      
      -- Hệ thống Tiên Ma
      alignment TEXT DEFAULT 'neutral',
      qi_deviation_until INTEGER DEFAULT 0,
      
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migration: thêm cột mới cho users nếu chưa có (hỗ trợ DB cũ)
  const userCols = db.prepare("PRAGMA table_info(users)").all() as any[];
  const userColNames = userCols.map(c => c.name);
  if (!userColNames.includes('forging_level')) {
    db.exec("ALTER TABLE users ADD COLUMN forging_level INTEGER DEFAULT 1");
  }
  if (!userColNames.includes('forging_exp')) {
    db.exec("ALTER TABLE users ADD COLUMN forging_exp INTEGER DEFAULT 0");
  }
  if (!userColNames.includes('partner_id')) {
    db.exec("ALTER TABLE users ADD COLUMN partner_id TEXT");
  }
  if (!userColNames.includes('intimacy')) {
    db.exec("ALTER TABLE users ADD COLUMN intimacy INTEGER DEFAULT 0");
  }
  if (!userColNames.includes('dungeon_clears')) {
    db.exec("ALTER TABLE users ADD COLUMN dungeon_clears INTEGER DEFAULT 0");
  }
  if (!userColNames.includes('last_songtu_at')) {
    db.exec("ALTER TABLE users ADD COLUMN last_songtu_at INTEGER DEFAULT 0");
  }
  if (!userColNames.includes('background')) {
    db.exec("ALTER TABLE users ADD COLUMN background TEXT DEFAULT ''");
  }
  if (!userColNames.includes('destiny')) {
    db.exec("ALTER TABLE users ADD COLUMN destiny TEXT DEFAULT ''");
  }
  if (!userColNames.includes('starting_skills')) {
    db.exec("ALTER TABLE users ADD COLUMN starting_skills TEXT DEFAULT '[]'");
  }
  if (!userColNames.includes('prophecy')) {
    db.exec("ALTER TABLE users ADD COLUMN prophecy TEXT DEFAULT ''");
  }
  if (!userColNames.includes('heirloom')) {
    db.exec("ALTER TABLE users ADD COLUMN heirloom TEXT DEFAULT ''");
  }
  if (!userColNames.includes('claimed_starting_bonus')) {
    db.exec("ALTER TABLE users ADD COLUMN claimed_starting_bonus INTEGER DEFAULT 0");
  }
  if (!userColNames.includes('alignment')) {
    db.exec("ALTER TABLE users ADD COLUMN alignment TEXT DEFAULT 'neutral'");
  }
  if (!userColNames.includes('qi_deviation_until')) {
    db.exec("ALTER TABLE users ADD COLUMN qi_deviation_until INTEGER DEFAULT 0");
  }

  // Migration: thêm cột mới cho inventories
  try {
    const invCols = db.prepare("PRAGMA table_info(inventories)").all() as any[];
    const invColNames = invCols.map(c => c.name);
    if (!invColNames.includes('is_life_bound')) {
      db.exec("ALTER TABLE inventories ADD COLUMN is_life_bound INTEGER DEFAULT 0");
    }
    if (!invColNames.includes('bound_exp')) {
      db.exec("ALTER TABLE inventories ADD COLUMN bound_exp INTEGER DEFAULT 0");
    }
    if (!invColNames.includes('bound_level')) {
      db.exec("ALTER TABLE inventories ADD COLUMN bound_level INTEGER DEFAULT 1");
    }
  } catch (e) {
    console.error('Lỗi di trú cột inventories:', e);
  }

  // Bảng Danh Mục Vật Phẩm Tĩnh (Items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      rarity TEXT NOT NULL,
      description TEXT,
      stats TEXT, -- JSON chỉ số cộng thêm
      value_ha_pham INTEGER DEFAULT 0,
      usable INTEGER DEFAULT 0,
      equipable INTEGER DEFAULT 0
    );
  `);

  // Bảng Túi Đồ Người Chơi (Inventories)
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id),
      quantity INTEGER DEFAULT 1,
      is_equipped INTEGER DEFAULT 0,
      equipment_slot TEXT,
      custom_stats TEXT, -- JSON chỉ số rèn ngẫu nhiên
      durability INTEGER DEFAULT 100, -- Độ bền hiện tại (0-100)
      max_durability INTEGER DEFAULT 100, -- Độ bền tối đa
      enhance_level INTEGER DEFAULT 0, -- Cấp độ cường hóa
      is_life_bound INTEGER DEFAULT 0, -- 1 = Bản Mệnh Pháp Bảo
      bound_exp INTEGER DEFAULT 0,
      bound_level INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, item_id, is_equipped, equipment_slot, custom_stats)
    );
    CREATE INDEX IF NOT EXISTS idx_inventories_user ON inventories(user_id);
  `);

  // Bảng Sủng Thú (Pets)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      rarity TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      base_hp INTEGER NOT NULL,
      base_atk INTEGER NOT NULL,
      base_def INTEGER NOT NULL,
      is_deployed INTEGER DEFAULT 0,
      
      -- Hệ thống sinh sản & Đột biến
      gender INTEGER DEFAULT 0, -- 0: Đực, 1: Cái
      mutations TEXT, -- JSON chỉ số đột biến
      
      -- Trạng thái đi thám hiểm tự động (Idle Adventure)
      adventure_status TEXT DEFAULT 'idle',
      adventure_end_time INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pets_user ON pets(user_id);
  `);

  // Bảng Linh Điền (Farming Plots)
  db.exec(`
    CREATE TABLE IF NOT EXISTS farming_plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      plot_index INTEGER NOT NULL,
      seed_item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
      planted_at INTEGER,
      growth_time INTEGER DEFAULT 0,
      speedup_applied INTEGER DEFAULT 0,
      status TEXT DEFAULT 'empty',
      UNIQUE(user_id, plot_index)
    );
  `);

  // Bảng Leo Tháp Roguelike (Roguelike Progress)
  db.exec(`
    CREATE TABLE IF NOT EXISTS roguelike_progress (
      user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
      current_floor INTEGER DEFAULT 1,
      max_floor INTEGER DEFAULT 1,
      hp_percent REAL DEFAULT 1.0,
      mp_percent REAL DEFAULT 1.0,
      buffs TEXT DEFAULT '[]', -- Mảng JSON chứa các buff
      lives INTEGER DEFAULT 3,
      last_reset_at INTEGER NOT NULL
    );
  `);

  // Bảng Giới Hạn và Cooldown Bí Cảnh (Dungeon Cooldowns)
  db.exec(`
    CREATE TABLE IF NOT EXISTS dungeon_cooldowns (
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      dungeon_id TEXT NOT NULL,
      daily_entries INTEGER DEFAULT 0,
      last_entry_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, dungeon_id)
    );
  `);

  // Bảng Mệnh Cách / Bảng Ngọc (Destinies/Runes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_destinies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      destiny_id TEXT NOT NULL, -- Ví dụ: atk_percent, crit_rate
      rarity TEXT NOT NULL, -- thuong, hiem, cuc_pham, tien_pham
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      is_equipped INTEGER DEFAULT 0,
      slot INTEGER DEFAULT 0, -- 1 đến 6
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_destinies_user ON user_destinies(user_id);
  `);

  // Bảng Phường Thị / Chợ Đấu Giá (Market Listings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      inventory_id INTEGER REFERENCES inventories(id) ON DELETE SET NULL,
      item_id TEXT NOT NULL REFERENCES items(id),
      quantity INTEGER DEFAULT 1,
      price_type TEXT NOT NULL,
      price INTEGER NOT NULL,
      listed_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_market_status ON market_listings(status);
  `);

  // Bảng Chế Tạo (Crafting Queues)
  db.exec(`
    CREATE TABLE IF NOT EXISTS crafting_queues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      recipe_id TEXT NOT NULL,
      type TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      status TEXT DEFAULT 'crafting'
    );
  `);

  // Bảng Đạo Lữ (Couples)
  db.exec(`
    CREATE TABLE IF NOT EXISTS couples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      user2_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      intimacy INTEGER DEFAULT 0,
      marriage_date INTEGER NOT NULL,
      last_dual_cultivation INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_couples_user1 ON couples(user1_id);
    CREATE INDEX IF NOT EXISTS idx_couples_user2 ON couples(user2_id);
  `);

  // Bảng Pháp Bảo Bản Mệnh (Soul Weapons)
  db.exec(`
    CREATE TABLE IF NOT EXISTS soul_weapons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(discord_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- Kiem, Dinh, An
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  // Bảng World Boss (Boss Thế Giới)
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_boss (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      atk INTEGER NOT NULL,
      def INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      last_spawned_at INTEGER NOT NULL,
      defeated_at INTEGER,
      defeated_by TEXT
    );
  `);

  // Bảng đóng góp sát thương World Boss
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_boss_contributions (
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      boss_id TEXT NOT NULL,
      damage INTEGER DEFAULT 0,
      attacks INTEGER DEFAULT 0,
      last_attack_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, boss_id)
    );
  `);

  // Bảng Audit Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Bảng Lịch Sử Quyết Đấu (Duel History)
  db.exec(`
    CREATE TABLE IF NOT EXISTS duel_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      winner_id TEXT NOT NULL,
      loser_id TEXT NOT NULL,
      winner_name TEXT NOT NULL,
      loser_name TEXT NOT NULL,
      wager INTEGER NOT NULL,
      tax INTEGER DEFAULT 0,
      winnings INTEGER DEFAULT 0,
      rounds INTEGER NOT NULL,
      challenger_hp_left INTEGER NOT NULL,
      target_hp_left INTEGER NOT NULL,
      is_tie INTEGER DEFAULT 0,
      fought_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_duel_history_winner ON duel_history(winner_id);
    CREATE INDEX IF NOT EXISTS idx_duel_history_loser ON duel_history(loser_id);
    CREATE INDEX IF NOT EXISTS idx_duel_history_fought ON duel_history(fought_at);
  `);

  // Bảng Mùa Giải Quyết Đấu Hàng Tuần (Duel Weekly Seasons)
  db.exec(`
    CREATE TABLE IF NOT EXISTS duel_weekly_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER NOT NULL,
      week_start INTEGER NOT NULL,
      week_end INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'ended')),
      rewards_given INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(season_number)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS duel_top_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL REFERENCES duel_weekly_seasons(id) ON DELETE CASCADE,
      rank INTEGER NOT NULL CHECK(rank BETWEEN 1 AND 3),
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      wins INTEGER DEFAULT 0,
      net_winnings INTEGER DEFAULT 0,
      win_rate INTEGER DEFAULT 0,
      reward_coins INTEGER DEFAULT 0,
      reward_tu_vi INTEGER DEFAULT 0,
      reward_ngotinh INTEGER DEFAULT 0,
      reward_items TEXT DEFAULT '[]', -- JSON mảng các vật phẩm thưởng
      claimed INTEGER DEFAULT 0,
      claimed_at INTEGER,
      created_at INTEGER NOT NULL,
      UNIQUE(season_id, rank)
    );
    CREATE INDEX IF NOT EXISTS idx_duel_top_rewards_user ON duel_top_rewards(user_id);
    CREATE INDEX IF NOT EXISTS idx_duel_top_rewards_season ON duel_top_rewards(season_id);
  `);

  // Bảng Cấu hình hệ thống
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Bảng Vọng Tưởng (Dreamscape)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_dreamscapes (
      user_id TEXT PRIMARY KEY,
      current_floor INTEGER DEFAULT 1,
      max_floor INTEGER DEFAULT 1,
      score INTEGER DEFAULT 0,
      weekly_entries INTEGER DEFAULT 0,
      hp_remaining INTEGER DEFAULT -1,
      last_reset INTEGER DEFAULT 0
    );
  `);

  // Bảng Linh Mạch (Leyline) Toàn Máy Chủ
  db.exec(`
    CREATE TABLE IF NOT EXISTS leylines (
      id TEXT PRIMARY KEY,
      current_energy INTEGER DEFAULT 0,
      max_energy INTEGER DEFAULT 10000,
      buff_active_until INTEGER DEFAULT 0,
      last_decay_at INTEGER DEFAULT 0
    );
  `);
  
  // Khởi tạo các linh mạch nếu chưa có
  const initLeylines = db.prepare('INSERT OR IGNORE INTO leylines (id, max_energy, last_decay_at) VALUES (?, ?, ?)');
  const nowSec = Math.floor(Date.now() / 1000);
  initLeylines.run('tuluyen', 10000, nowSec);
  initLeylines.run('chiendau', 8000, nowSec);
  initLeylines.run('thuthap', 6000, nowSec);
  initLeylines.run('kinhte', 5000, nowSec);
  initLeylines.run('tongmon', 12000, nowSec);

  // Bảng theo dõi nạp linh mạch của user
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_leylines (
      user_id TEXT PRIMARY KEY,
      channeling_target TEXT,
      channeling_cooldown INTEGER DEFAULT 0,
      hourly_contributions TEXT DEFAULT '{}',
      last_contribution_hour INTEGER DEFAULT 0
    );
  `);

  // Bảng Lữ Khách Thần Bí (Traveler Events)
  db.exec(`
    CREATE TABLE IF NOT EXISTS traveler_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT 'active',
      spawned_at INTEGER,
      expires_at INTEGER,
      inventory TEXT DEFAULT '{}',
      channel_id TEXT,
      message_id TEXT
    );
  `);

  // Bảng Hồ Sơ Đấu Trường (Arena PvP)
  db.exec(`
    CREATE TABLE IF NOT EXISTS arena_profiles (
      user_id TEXT PRIMARY KEY,
      elo INTEGER DEFAULT 1000,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      win_streak INTEGER DEFAULT 0,
      highest_elo INTEGER DEFAULT 1000,
      last_season_rank INTEGER DEFAULT 0,
      season_id TEXT DEFAULT 'season_1'
    );
  `);

  // Bảng Lịch Sử Đấu Trường (Arena History)
  db.exec(`
    CREATE TABLE IF NOT EXISTS arena_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger_id TEXT,
      opponent_id TEXT,
      winner_id TEXT,
      elo_change INTEGER DEFAULT 0,
      created_at INTEGER,
      combat_log TEXT
    );
  `);

  // Bảng Cấu hình Guild / Máy chủ
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id TEXT PRIMARY KEY,
      category_id TEXT,
      tuluyen_channel_id TEXT,
      linhdien_channel_id TEXT,
      tongmon_channel_id TEXT,
      bicanh_channel_id TEXT,
      boss_channel_id TEXT
    );
  `);

  // Migration: thêm cột mới cho guild_configs nếu chưa có
  const guildConfigCols = db.prepare("PRAGMA table_info(guild_configs)").all() as any[];
  const guildConfigNames = guildConfigCols.map(c => c.name);
  if (!guildConfigNames.includes('market_channel_id')) {
    db.exec("ALTER TABLE guild_configs ADD COLUMN market_channel_id TEXT");
  }
  if (!guildConfigNames.includes('combat_channel_id')) {
    db.exec("ALTER TABLE guild_configs ADD COLUMN combat_channel_id TEXT");
  }
  if (!guildConfigNames.includes('chat_channel_id')) {
    db.exec("ALTER TABLE guild_configs ADD COLUMN chat_channel_id TEXT");
  }
  if (!guildConfigNames.includes('event_channel_id')) {
    db.exec("ALTER TABLE guild_configs ADD COLUMN event_channel_id TEXT");
  }
  if (!guildConfigNames.includes('guide_channel_id')) {
    db.exec("ALTER TABLE guild_configs ADD COLUMN guide_channel_id TEXT");
  }

  // Bảng tin nhắn thông báo Boss Thế Giới
  db.exec(`
    CREATE TABLE IF NOT EXISTS boss_announcements (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL
    );
  `);

  // Bảng Kỹ Năng Đã Học (User Skills)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      is_equipped INTEGER DEFAULT 0,
      equipped_slot INTEGER DEFAULT 0,
      PRIMARY KEY(user_id, skill_id)
    );
  `);

  // === BẢNG THÀNH TỰU (ACHIEVEMENTS) - V6 ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('tu_luyen', 'chien_dau', 'pvp', 'sung_thu', 'sinh_hoat')),
      description TEXT,
      icon TEXT DEFAULT '🏆',
      target_value INTEGER NOT NULL,
      reward_title TEXT,
      reward_exp INTEGER DEFAULT 0,
      reward_coins INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      progress INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      completed_at INTEGER,
      UNIQUE(user_id, achievement_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_completed ON user_achievements(is_completed);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      source TEXT DEFAULT 'achievement',
      unlocked_at INTEGER NOT NULL,
      UNIQUE(user_id, title)
    );
    CREATE INDEX IF NOT EXISTS idx_user_titles_user ON user_titles(user_id);
  `);

  // Thêm các cấu hình mặc định nếu chưa có
  const checkMaintenance = db.prepare("SELECT key FROM system_config WHERE key = 'maintenance_mode'").get();
  if (!checkMaintenance) {
    db.prepare("INSERT INTO system_config (key, value) VALUES ('maintenance_mode', '0')").run();
  }

  // Thêm người dùng hệ thống 'market' phục vụ Vạn Bảo Lâu đấu giá
  const checkMarketUser = db.prepare("SELECT discord_id FROM users WHERE discord_id = 'market'").get();
  if (!checkMarketUser) {
    db.prepare(`
      INSERT INTO users (discord_id, name, title, level, linh_can, created_at, updated_at)
      VALUES ('market', 'Vạn Bảo Sàn', 'Thương Nhân Hệ Thống', 1, '{}', 0, 0)
    `).run();
  }

  // Cập nhật cấu trúc bảng users nếu thiếu cột (phục vụ database cũ nâng cấp)
  const userColumns = db.prepare("PRAGMA table_info(users)").all() as any[];
  const columnNames = userColumns.map(c => c.name);
  if (!columnNames.includes('luan_hoi_count')) {
    db.exec("ALTER TABLE users ADD COLUMN luan_hoi_count INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('y_canh')) {
    db.exec("ALTER TABLE users ADD COLUMN y_canh TEXT DEFAULT '{}'");
  }
  if (!columnNames.includes('ngotinh')) {
    db.exec("ALTER TABLE users ADD COLUMN ngotinh INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('last_quexam_at')) {
    db.exec("ALTER TABLE users ADD COLUMN last_quexam_at INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('stamina')) {
    db.exec("ALTER TABLE users ADD COLUMN stamina INTEGER DEFAULT 500");
  }
  if (!columnNames.includes('last_stamina_recover_at')) {
    db.exec("ALTER TABLE users ADD COLUMN last_stamina_recover_at INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('base_speed')) {
    db.exec("ALTER TABLE users ADD COLUMN base_speed INTEGER DEFAULT 100");
  }
  if (!columnNames.includes('base_dodge')) {
    db.exec("ALTER TABLE users ADD COLUMN base_dodge REAL DEFAULT 0.05");
  }
  if (!columnNames.includes('alchemy_level')) {
    db.exec("ALTER TABLE users ADD COLUMN alchemy_level INTEGER DEFAULT 1");
  }
  if (!columnNames.includes('alchemy_exp')) {
    db.exec("ALTER TABLE users ADD COLUMN alchemy_exp INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('injury_end_time')) {
    db.exec("ALTER TABLE users ADD COLUMN injury_end_time INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('sect_role')) {
    db.exec("ALTER TABLE users ADD COLUMN sect_role TEXT DEFAULT 'member'");
  }

  // Cập nhật cấu trúc bảng sects nếu thiếu cột (phục vụ database cũ nâng cấp)
  const sectColumns = db.prepare("PRAGMA table_info(sects)").all() as any[];
  const sectColumnNames = sectColumns.map(c => c.name);
  if (!sectColumnNames.includes('tu_linh_level')) {
    db.exec("ALTER TABLE sects ADD COLUMN tu_linh_level INTEGER DEFAULT 0");
  }
  if (!sectColumnNames.includes('dan_duong_level')) {
    db.exec("ALTER TABLE sects ADD COLUMN dan_duong_level INTEGER DEFAULT 0");
  }

  // Cập nhật cấu trúc bảng inventories nếu thiếu cột stars, durability
  const invColumns = db.prepare("PRAGMA table_info(inventories)").all() as any[];
  const invColumnNames = invColumns.map(c => c.name);
  if (!invColumnNames.includes('stars')) {
    db.exec("ALTER TABLE inventories ADD COLUMN stars INTEGER DEFAULT 0");
  }
  if (!invColumnNames.includes('durability')) {
    db.exec("ALTER TABLE inventories ADD COLUMN durability INTEGER DEFAULT 100");
  }
  if (!invColumnNames.includes('max_durability')) {
    db.exec("ALTER TABLE inventories ADD COLUMN max_durability INTEGER DEFAULT 100");
  }
  if (!invColumnNames.includes('enhance_level')) {
    db.exec("ALTER TABLE inventories ADD COLUMN enhance_level INTEGER DEFAULT 0");
  }

  // Cập nhật cấu trúc bảng farming_plots nếu thiếu cột ẩm, dinh dưỡng, sâu bệnh
  const plotColumns = db.prepare("PRAGMA table_info(farming_plots)").all() as any[];
  const plotColumnNames = plotColumns.map(c => c.name);
  if (!plotColumnNames.includes('moisture')) {
    db.exec("ALTER TABLE farming_plots ADD COLUMN moisture INTEGER DEFAULT 5");
  }
  if (!plotColumnNames.includes('nutrition')) {
    db.exec("ALTER TABLE farming_plots ADD COLUMN nutrition INTEGER DEFAULT 6");
  }
  if (!plotColumnNames.includes('pests')) {
    db.exec("ALTER TABLE farming_plots ADD COLUMN pests INTEGER DEFAULT 0");
  }

  // Cập nhật cấu trúc bảng pets (V4: thêm kỹ năng + phả hệ lai tạo)
  const petColumns = db.prepare("PRAGMA table_info(pets)").all() as any[];
  const petColumnNames = petColumns.map(c => c.name);
  if (!petColumnNames.includes('skills')) {
    db.exec("ALTER TABLE pets ADD COLUMN skills TEXT DEFAULT '[]'");
  }
  if (!petColumnNames.includes('parent_1')) {
    db.exec("ALTER TABLE pets ADD COLUMN parent_1 INTEGER DEFAULT NULL");
  }
  if (!petColumnNames.includes('parent_2')) {
    db.exec("ALTER TABLE pets ADD COLUMN parent_2 INTEGER DEFAULT NULL");
  }

  // Bảng Thám Hiểm Dã Ngoại (Explorations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS explorations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      location_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      stamina_cost INTEGER DEFAULT 20,
      status TEXT DEFAULT 'traveling',
      result TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_explorations_user ON explorations(user_id);
  `);

  // Bảng Nhiệm Vụ Hàng Ngày (Daily Quests)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      quest_id TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      required INTEGER NOT NULL,
      reward_coin INTEGER DEFAULT 0,
      reward_exp INTEGER DEFAULT 0,
      reward_ngotinh INTEGER DEFAULT 0,
      is_claimed INTEGER DEFAULT 0,
      assigned_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      UNIQUE(user_id, quest_id, assigned_at)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_quests_user ON daily_quests(user_id);
  `);

  // Bảng Sự Kiện Định Kỳ (Events) - V6
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('weekly_boss', 'double_exp', 'seasonal', 'mini_game')),
      description TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'active', 'ended')),
      rewards_config TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      score INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0,
      rewards_claimed INTEGER DEFAULT 0,
      joined_at INTEGER NOT NULL,
      UNIQUE(event_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
  `);

  // Bảng Chiến Tranh Tông Môn (Guild Wars) - V6
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_wars (
      id TEXT PRIMARY KEY,
      challenger_sect_id INTEGER NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
      defender_sect_id INTEGER NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      current_round INTEGER DEFAULT 1,
      max_rounds INTEGER DEFAULT 5,
      challenger_hp INTEGER DEFAULT 100,
      defender_hp INTEGER DEFAULT 100,
      challenger_score INTEGER DEFAULT 0,
      defender_score INTEGER DEFAULT 0,
      winner_sect_id INTEGER,
      turn_order TEXT DEFAULT '[]',
      current_turn_index INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      ended_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_guild_wars_challenger ON guild_wars(challenger_sect_id);
    CREATE INDEX IF NOT EXISTS idx_guild_wars_defender ON guild_wars(defender_sect_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_war_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      war_id TEXT NOT NULL REFERENCES guild_wars(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      sect_id INTEGER NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('challenger', 'defender')),
      damage_dealt INTEGER DEFAULT 0,
      damage_taken INTEGER DEFAULT 0,
      attacks_count INTEGER DEFAULT 0,
      is_alive INTEGER DEFAULT 1,
      UNIQUE(war_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_gw_participants_war ON guild_war_participants(war_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_war_attack_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      war_id TEXT NOT NULL REFERENCES guild_wars(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      attacker_id TEXT NOT NULL,
      target_id TEXT,
      damage INTEGER DEFAULT 0,
      description TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gw_logs_war ON guild_war_attack_logs(war_id);
  `);

  // Bảng Watchlist Vạn Bảo Lâu - V6
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id),
      min_price INTEGER DEFAULT 0,
      max_price INTEGER DEFAULT 999999999,
      min_rarity TEXT DEFAULT 'common',
      auto_bid_enabled INTEGER DEFAULT 0,
      auto_bid_max_price INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_market_watchlist_user ON market_watchlist(user_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_transaction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'auction_win', 'auction_bid')),
      listing_id INTEGER,
      item_id TEXT NOT NULL REFERENCES items(id),
      quantity INTEGER DEFAULT 1,
      price INTEGER NOT NULL,
      tax INTEGER DEFAULT 0,
      counterparty_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_market_tx_user ON market_transaction_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_market_tx_listing ON market_transaction_history(listing_id);
  `);

  // Thêm cột auction cho market_listings
  const marketListingColumns = db.prepare("PRAGMA table_info(market_listings)").all() as any[];
  const mlColumnNames = marketListingColumns.map(c => c.name);
  if (!mlColumnNames.includes('listing_type')) {
    db.exec("ALTER TABLE market_listings ADD COLUMN listing_type TEXT DEFAULT 'fixed' CHECK(listing_type IN ('fixed', 'auction'))");
  }
  if (!mlColumnNames.includes('current_bid')) {
    db.exec("ALTER TABLE market_listings ADD COLUMN current_bid INTEGER DEFAULT NULL");
  }
  if (!mlColumnNames.includes('current_bidder_id')) {
    db.exec("ALTER TABLE market_listings ADD COLUMN current_bidder_id TEXT DEFAULT NULL");
  }
  if (!mlColumnNames.includes('min_bid_increment')) {
    db.exec("ALTER TABLE market_listings ADD COLUMN min_bid_increment INTEGER DEFAULT 50");
  }
  if (!mlColumnNames.includes('bid_count')) {
    db.exec("ALTER TABLE market_listings ADD COLUMN bid_count INTEGER DEFAULT 0");
  }

  // Bảng Phòng Tổ Đội (Party Rooms) - V5 Co-op Dungeon
  db.exec(`
    CREATE TABLE IF NOT EXISTS party_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      host_name TEXT NOT NULL,
      member_ids TEXT NOT NULL DEFAULT '[]',
      dungeon_id TEXT NOT NULL DEFAULT 'coop_dungeon_1',
      status TEXT DEFAULT 'waiting',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_party_rooms_host ON party_rooms(host_id);
  `);

  // Bảng Bảng Xếp Hạng PVP (PvP Seasons) - V5
  db.exec(`
    CREATE TABLE IF NOT EXISTS pvp_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT DEFAULT 'active',
      UNIQUE(season_number)
    );
  `);

  // === BẢNG MỚI V6.0 ===

  // 1. Bang Hội Chiến Mùa Giải (Sect War Seasons)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sect_war_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('upcoming', 'active', 'ended')),
      UNIQUE(season_number)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sect_war_battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL REFERENCES sect_war_seasons(id) ON DELETE CASCADE,
      round_number INTEGER DEFAULT 1,
      sect_ids TEXT NOT NULL DEFAULT '[]',
      scores TEXT NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed')),
      winner_sect_id INTEGER,
      started_at INTEGER,
      ended_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sw_battles_season ON sect_war_battles(season_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sect_war_participant_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      battle_id INTEGER NOT NULL REFERENCES sect_war_battles(id) ON DELETE CASCADE,
      season_id INTEGER NOT NULL REFERENCES sect_war_seasons(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      sect_id INTEGER NOT NULL,
      damage_dealt INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      battles_fought INTEGER DEFAULT 0,
      UNIQUE(battle_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sw_scores_season ON sect_war_participant_scores(season_id);
  `);

  // Bảng Mỏ Linh Thạch (Sect Mines)
  db.exec(`
    CREATE TABLE IF NOT EXISTS mine_ownership (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mine_id TEXT NOT NULL,
      sect_id INTEGER NOT NULL REFERENCES sects(id) ON DELETE CASCADE,
      captured_at INTEGER NOT NULL,
      last_claimed_at INTEGER NOT NULL,
      total_income INTEGER DEFAULT 0,
      UNIQUE(mine_id)
    );
  `);

  // Bảng Huyết Mạch (Bloodlines)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bloodlines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      passives TEXT NOT NULL,
      weakness TEXT NOT NULL,
      rage_effect TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_bloodlines (
      user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
      bloodline_id TEXT NOT NULL REFERENCES bloodlines(id),
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      activated_at INTEGER NOT NULL,
      rage_cooldown INTEGER DEFAULT 0
    );
  `);

  // Seed data cho Bloodlines
  const bloodlineCheck = db.prepare('SELECT count(*) as count FROM bloodlines').get() as { count: number };
  if (bloodlineCheck.count === 0) {
    const insertBloodline = db.prepare('INSERT INTO bloodlines (id, name, description, passives, weakness, rage_effect) VALUES (?, ?, ?, ?, ?, ?)');
    insertBloodline.run('long_huyet', 'Long Huyết', 'Huyết mạch Chân Long, cường hãn nhục thân, lấy chiến dưỡng chiến.', JSON.stringify({ '1': { stat: 'hp_steal', value: 0.05 }, '10': { stat: 'hp_steal', value: 0.08 }, '25': { stat: 'hp_steal', value: 0.12 }, '50': { stat: 'hp_steal', value: 0.20 } }), JSON.stringify({ stat: 'mộc_dmg_taken', value: 0.10 }), JSON.stringify({ multiplier: 2, duration: 3, cooldown: 10 }));
    insertBloodline.run('phuong_hoang', 'Phượng Hoàng', 'Bất tử hỏa điểu, niết bàn trùng sinh.', JSON.stringify({ '1': { stat: 'revive_chance', value: 0.10 }, '10': { stat: 'revive_chance', value: 0.15 }, '25': { stat: 'revive_chance', value: 0.25 }, '50': { stat: 'revive_chance', value: 0.50 } }), JSON.stringify({ stat: 'atk_reduce_on_revive', value: 0.10 }), JSON.stringify({ multiplier: 2, duration: 3, cooldown: 10 }));
    insertBloodline.run('con_luan', 'Côn Luân', 'Núi non vững chãi, vạn kiếp bất diệt.', JSON.stringify({ '1': { stat: 'dmg_reduce', value: 0.08 }, '10': { stat: 'dmg_reduce', value: 0.12 }, '25': { stat: 'dmg_reduce', value: 0.18 }, '50': { stat: 'dmg_reduce', value: 0.25 } }), JSON.stringify({ stat: 'speed_reduce', value: 0.15 }), JSON.stringify({ multiplier: 2, duration: 3, cooldown: 10 }));
    insertBloodline.run('bach_ho', 'Bạch Hổ', 'Sát phạt chi binh, sắc bén vô cùng.', JSON.stringify({ '1': { stat: 'crit_rate', value: 0.03 }, '10': { stat: 'crit_rate', value: 0.05 }, '25': { stat: 'crit_rate', value: 0.10 }, '50': { stat: 'crit_rate', value: 0.15 } }), JSON.stringify({ stat: 'hp_reduce', value: 0.10 }), JSON.stringify({ multiplier: 2, duration: 3, cooldown: 10 }));
    insertBloodline.run('huyen_vu', 'Huyền Vũ', 'Quy xà giao thai, phòng thủ tuyệt luân.', JSON.stringify({ '1': { stat: 'max_hp', value: 0.05 }, '10': { stat: 'max_hp', value: 0.10 }, '25': { stat: 'max_hp', value: 0.15 }, '50': { stat: 'shield_start', value: 0.25 } }), JSON.stringify({ stat: 'atk_reduce', value: 0.10 }), JSON.stringify({ multiplier: 2, duration: 3, cooldown: 10 }));
    insertBloodline.run('thanh_long', 'Thanh Long', 'Đằng vân giá vũ, mau lẹ vô song.', JSON.stringify({ '1': { stat: 'speed', value: 0.05 }, '10': { stat: 'speed', value: 0.08 }, '25': { stat: 'speed', value: 0.12 }, '50': { stat: 'speed', value: 0.20 } }), JSON.stringify({ stat: 'def_reduce', value: 0.10 }), JSON.stringify({ multiplier: 2, duration: 3, cooldown: 10 }));
  }

  // Bảng Động Phủ Cá Nhân (Cave)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_caves (
      user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
      level INTEGER DEFAULT 1,
      decoration TEXT DEFAULT '[]',
      spring_level INTEGER DEFAULT 1,
      spring_available INTEGER DEFAULT 1,
      last_spring_collect TEXT,
      last_raid_time INTEGER DEFAULT 0,
      trap_item_id TEXT,
      meridian_level INTEGER DEFAULT 0,
      array_level INTEGER DEFAULT 0,
      last_meridian_claim INTEGER DEFAULT 0
    );
  `);

  // Migration for user_caves
  try {
    const caveCols = db.prepare("PRAGMA table_info(user_caves)").all() as any[];
    const caveColNames = caveCols.map(c => c.name);
    if (!caveColNames.includes('meridian_level')) {
      db.exec("ALTER TABLE user_caves ADD COLUMN meridian_level INTEGER DEFAULT 0");
    }
    if (!caveColNames.includes('array_level')) {
      db.exec("ALTER TABLE user_caves ADD COLUMN array_level INTEGER DEFAULT 0");
    }
    if (!caveColNames.includes('last_meridian_claim')) {
      db.exec("ALTER TABLE user_caves ADD COLUMN last_meridian_claim INTEGER DEFAULT 0");
    }
  } catch (e) {
    console.error('Lỗi di trú cột user_caves:', e);
  }

  // Bảng Ấn Ký Linh Hồn (Soul Imprint)
  db.exec(`
    CREATE TABLE IF NOT EXISTS soul_imprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_slot TEXT NOT NULL,
      item_rarity TEXT NOT NULL,
      imprint_stats TEXT NOT NULL,
      set_group TEXT,
      set_slot INTEGER,
      is_bound INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_soul_imprints_user ON soul_imprints(user_id);
  `);

  // 2. Kỳ Ngộ (Random Encounters)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      encounter_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('lamviec', 'sanyeuthu', 'exploration')),
      choice_made TEXT,
      result TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_encounters_user ON user_encounters(user_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_treasure_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      coord_x INTEGER NOT NULL,
      coord_y INTEGER NOT NULL,
      rarity TEXT NOT NULL CHECK(rarity IN ('common', 'rare', 'epic', 'legendary')),
      is_found INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_treasure_maps_user ON user_treasure_maps(user_id);
  `);

  // 3. Pháp Bảo Khí Linh (Spirit Weapons)
  db.exec(`
    CREATE TABLE IF NOT EXISTS spirit_weapons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      spirit_name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      affinity INTEGER DEFAULT 0,
      skill_id TEXT,
      awakened_at INTEGER NOT NULL,
      UNIQUE(user_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_spirit_weapons_user ON spirit_weapons(user_id);
  `);

  // 4. Bí Cảnh Thí Luyện (Elite Dungeons)
  db.exec(`
    CREATE TABLE IF NOT EXISTS elite_dungeons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      floors INTEGER DEFAULT 5,
      min_level INTEGER DEFAULT 30,
      max_level INTEGER DEFAULT 999,
      min_party_size INTEGER DEFAULT 2,
      max_party_size INTEGER DEFAULT 4,
      cooldown_hours INTEGER DEFAULT 24,
      rewards_config TEXT DEFAULT '{}'
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS elite_dungeon_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dungeon_id TEXT NOT NULL REFERENCES elite_dungeons(id) ON DELETE CASCADE,
      party_id TEXT NOT NULL REFERENCES party_rooms(id) ON DELETE CASCADE,
      host_id TEXT NOT NULL,
      current_floor INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed')),
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      total_time INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_ed_runs_dungeon ON elite_dungeon_runs(dungeon_id);
    CREATE INDEX IF NOT EXISTS idx_ed_runs_party ON elite_dungeon_runs(party_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS elite_dungeon_leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dungeon_id TEXT NOT NULL REFERENCES elite_dungeons(id) ON DELETE CASCADE,
      party_id TEXT NOT NULL,
      party_members TEXT NOT NULL DEFAULT '[]',
      floors_cleared INTEGER NOT NULL,
      total_time INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      UNIQUE(dungeon_id, party_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ed_lb_dungeon ON elite_dungeon_leaderboard(dungeon_id);
  `);

  // 5. Tọa Kỵ (Mounts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS mounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      speed_bonus REAL DEFAULT 0.0,
      stamina_save REAL DEFAULT 0.0,
      is_active INTEGER DEFAULT 0,
      skills TEXT DEFAULT '[]',
      is_tamed INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mounts_user ON mounts(user_id);
  `);

  try {
    const mountCols = db.prepare("PRAGMA table_info(mounts)").all() as any[];
    if (mountCols.length > 0 && !mountCols.some(c => c.name === 'is_tamed')) {
      db.exec("ALTER TABLE mounts ADD COLUMN is_tamed INTEGER DEFAULT 1");
    }
  } catch (e) {
    // Ignore if table doesn't exist yet somehow
  }

  // 6. Chợ Trời - Đấu Giá Định Kỳ (Auction Events)
  db.exec(`
    CREATE TABLE IF NOT EXISTS auction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('upcoming', 'active', 'ended')),
      created_at INTEGER NOT NULL
    );
  `);

  // 7. Hidden Treasure locations
  db.exec(`
    CREATE TABLE IF NOT EXISTS hidden_treasures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      location_key TEXT NOT NULL,
      found_at INTEGER NOT NULL,
      claimed INTEGER DEFAULT 0,
      reward TEXT,
      UNIQUE(user_id, location_key)
    );
    CREATE INDEX IF NOT EXISTS idx_hidden_treasures_user ON hidden_treasures(user_id);
  `);

  // Spirit Skills table (for Pháp Bảo Khí Linh passive skills)
  db.exec(`
    CREATE TABLE IF NOT EXISTS spirit_skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      effect_type TEXT NOT NULL,
      effect_value REAL DEFAULT 0,
      min_level INTEGER DEFAULT 1
    );
  `);

  // Seed achievements
  seedAchievements();

  // Thực hiện Nạp dữ liệu mẫu
  seedItems();

  // Seed Spirit Skills
  seedSpiritSkills();

  // Seed Elite Dungeons
  seedEliteDungeons();

  // Seed World Boss ban đầu nếu chưa có
  const boss = db.prepare("SELECT id FROM world_boss WHERE id = 'world_boss_current'").get();
  if (!boss) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO world_boss (id, name, hp, max_hp, atk, def, level, status, last_spawned_at)
      VALUES ('world_boss_current', 'Thượng Cổ Hắc Long', 5000, 5000, 80, 50, 1, 'active', ?)
    `).run(now);
    console.log('✅ Đã tạo World Boss ban đầu: Thượng Cổ Hắc Long (Level 1, HP: 5000)');
  }

  // Tạo Sect War season đầu tiên nếu chưa có
  const existingSeason = db.prepare("SELECT id FROM sect_war_seasons WHERE status = 'active'").get();
  if (!existingSeason) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO sect_war_seasons (season_number, started_at, status)
      VALUES (1, ?, 'active')
    `).run(now);
    console.log('✅ Đã tạo mùa giải Sect War đầu tiên.');
  }

  // === THÊM CHỈ MỤC TỐI ƯU HIỆU NĂNG (GIAI ĐOẠN 2) ===
  db.exec(`
    -- Tối ưu truy vấn kho đồ có lọc theo trang bị
    CREATE INDEX IF NOT EXISTS idx_inventories_user_equipped ON inventories(user_id, is_equipped);
    
    -- Tối ưu truy vấn sủng thú đang xuất chiến
    CREATE INDEX IF NOT EXISTS idx_pets_user_deployed ON pets(user_id, is_deployed);
    
    -- Tối ưu truy vấn bảng xếp hạng (Leaderboards)
    CREATE INDEX IF NOT EXISTS idx_users_level_tuvi ON users(level DESC, tu_vi DESC);
    CREATE INDEX IF NOT EXISTS idx_users_pvp_points ON users(pvp_points DESC);
    CREATE INDEX IF NOT EXISTS idx_users_sect_contribution ON users(sect_id, sect_contribution DESC);
    
    -- Tối ưu truy vấn World Boss
    CREATE INDEX IF NOT EXISTS idx_wbc_boss_damage ON world_boss_contributions(boss_id, damage DESC);
    
    -- Tối ưu truy vấn Chợ Đấu Giá
    CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_id);
    CREATE INDEX IF NOT EXISTS idx_market_item ON market_listings(item_id);
  `);

  // Bảng theo dõi hồi stamina trong voice channel
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_recovery (
      user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
      session_start INTEGER DEFAULT 0,
      total_bonus_today INTEGER DEFAULT 0,
      last_bonus_date TEXT,
      last_session_end INTEGER DEFAULT 0,
      stamina_at_join INTEGER DEFAULT 0,
      session_bonus_added INTEGER DEFAULT 0
    );
  `);

  // Bảng Sư Đồ (Mentorship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentorships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mentor_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      apprentice_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'graduated', 'cancelled')),
      graduated_at INTEGER,
      UNIQUE(mentor_id, apprentice_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mentorships_mentor ON mentorships(mentor_id);
    CREATE INDEX IF NOT EXISTS idx_mentorships_apprentice ON mentorships(apprentice_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_apprentice ON mentorships(apprentice_id) WHERE status = 'active';
  `);

  // Bảng Tâm Pháp (Heart Laws)
  db.exec(`
    CREATE TABLE IF NOT EXISTS heart_laws (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      base_effect TEXT NOT NULL,
      element TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_heart_laws (
      user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
      heart_law_id TEXT NOT NULL REFERENCES heart_laws(id) ON DELETE CASCADE,
      level INTEGER DEFAULT 1,
      fragments INTEGER DEFAULT 0,
      is_equipped INTEGER DEFAULT 0 CHECK(is_equipped IN (0, 1, 2, 3)),
      PRIMARY KEY (user_id, heart_law_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_hl_user ON user_heart_laws(user_id);
  `);

  // Bảng Cửu Trùng Tháp (Nine Heavens Tower)
  db.exec(`
    CREATE TABLE IF NOT EXISTS nine_heavens_progress (
      user_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
      highest_floor INTEGER DEFAULT 0,
      current_floor INTEGER DEFAULT 0,
      attempts_this_week INTEGER DEFAULT 0,
      last_reset_week TEXT
    );
  `);

  // Seed Tâm Pháp
  seedHeartLaws();

  console.log('✅ Cơ sở dữ liệu Hệ Thống Tu Hành đã được khởi tạo hoàn tất.');
}

/**
 * Seed 50+ thành tựu vào cơ sở dữ liệu
 */
function seedAchievements() {

  const achievements: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    icon: string;
    target_value: number;
    reward_title: string | null;
    reward_exp: number;
    reward_coins: number;
    sort_order: number;
  }> = [
    // ===== TU LUYỆN (Tu Luyen) - Cấp độ, đột phá, thiền định, linh căn =====
    { id: 'tl_1',      name: 'Sơ Nhập Tu Đạo',          category: 'tu_luyen', description: 'Đạt cấp độ 10',                          icon: '🌱', target_value: 10,   reward_title: 'Sơ Đạo',           reward_exp: 100,   reward_coins: 500,    sort_order: 1 },
    { id: 'tl_2',      name: 'Tiểu Hữu Thành Tựu',      category: 'tu_luyen', description: 'Đạt cấp độ 25',                          icon: '🌿', target_value: 25,   reward_title: 'Hữu Đạo',          reward_exp: 500,   reward_coins: 2000,   sort_order: 2 },
    { id: 'tl_3',      name: 'Trúc Cơ Tinh Anh',        category: 'tu_luyen', description: 'Đạt cấp độ 50 (Trúc Cơ)',                icon: '🎋', target_value: 50,   reward_title: 'Trúc Cơ Tinh Anh', reward_exp: 2000,  reward_coins: 5000,   sort_order: 3 },
    { id: 'tl_4',      name: 'Kim Đan Đại Sư',          category: 'tu_luyen', description: 'Đạt cấp độ 100 (Kim Đan)',               icon: '🟡', target_value: 100,  reward_title: 'Kết Đan Chân Nhân', reward_exp: 5000,  reward_coins: 15000,  sort_order: 4 },
    { id: 'tl_5',      name: 'Nguyên Anh Lão Quái',     category: 'tu_luyen', description: 'Đạt cấp độ 150 (Nguyên Anh)',            icon: '🔮', target_value: 150,  reward_title: 'Nguyên Anh Lão Quái', reward_exp: 10000, reward_coins: 30000,  sort_order: 5 },
    { id: 'tl_6',      name: 'Hóa Thần Chí Tôn',        category: 'tu_luyen', description: 'Đạt cấp độ 200 (Hóa Thần)',              icon: '👁️', target_value: 200,  reward_title: 'Hóa Thần Chí Tôn',  reward_exp: 20000, reward_coins: 60000,  sort_order: 6 },
    { id: 'tl_7',      name: 'Đại Thừa Chân Tiên',      category: 'tu_luyen', description: 'Đạt cấp độ 300 (Đại Thừa)',              icon: '🐉', target_value: 300,  reward_title: 'Đại Thừa Chân Tiên', reward_exp: 50000, reward_coins: 150000, sort_order: 7 },
    { id: 'tl_8',      name: 'Đăng Tiên Chi Lộ',        category: 'tu_luyen', description: 'Đạt cấp độ 380 (Đăng Tiên)',             icon: '🌟', target_value: 380,  reward_title: 'Đăng Tiên Tán Tiên', reward_exp: 100000, reward_coins: 300000, sort_order: 8 },
    { id: 'tl_9',      name: 'Thiền Định Sơ Cấp',       category: 'tu_luyen', description: 'Thiền định (luyện) 10 lần',             icon: '🧘', target_value: 10,   reward_title: null,               reward_exp: 200,   reward_coins: 1000,   sort_order: 9 },
    { id: 'tl_10',     name: 'Thiền Định Cao Cấp',      category: 'tu_luyen', description: 'Thiền định (luyện) 70 lần',             icon: '🧘', target_value: 70,   reward_title: 'Thiền Sư',         reward_exp: 2000,  reward_coins: 10000,  sort_order: 10 },
    { id: 'tl_11',     name: 'Thiền Định Tuyệt Đỉnh',   category: 'tu_luyen', description: 'Thiền định (luyện) 1000 lần',           icon: '🧘', target_value: 1000, reward_title: null,               reward_exp: 20000, reward_coins: 100000, sort_order: 11 },
    { id: 'tl_12',     name: 'Luân Hồi Chuyển Thế',     category: 'tu_luyen', description: 'Luân hồi lần đầu',                      icon: '🌀', target_value: 1,    reward_title: 'Luân Hồi Chi Chủ', reward_exp: 50000, reward_coins: 100000, sort_order: 12 },
    { id: 'tl_13',     name: 'Đa Trọng Luân Hồi',       category: 'tu_luyen', description: 'Luân hồi 3 lần',                        icon: '🌀', target_value: 3,    reward_title: 'Thường Luân Hồi',  reward_exp: 100000, reward_coins: 250000, sort_order: 13 },
    { id: 'tl_14',     name: 'Ngộ Tính Chi Nhân',       category: 'tu_luyen', description: 'Tích lũy 50 điểm Ngộ Tính',             icon: '💡', target_value: 50,   reward_title: null,               reward_exp: 1000,  reward_coins: 5000,   sort_order: 14 },
    { id: 'tl_15',     name: 'Kiếm Ý Đại Thành',        category: 'tu_luyen', description: 'Kiếm Ý đạt cấp 7',                     icon: '⚔️', target_value: 7,    reward_title: 'Kiếm Ý Đại Thành',  reward_exp: 10000, reward_coins: 50000,  sort_order: 15 },
    { id: 'tl_16',     name: 'Bất Diệt Chi Tâm',        category: 'tu_luyen', description: 'Bất Diệt Ý đạt cấp 7',                 icon: '💠', target_value: 7,    reward_title: 'Bất Diệt Chi Tâm', reward_exp: 10000, reward_coins: 50000,  sort_order: 16 },
    { id: 'tl_17',     name: 'Huyền Quy Hộ Thể',        category: 'tu_luyen', description: 'Huyền Quy Ý đạt cấp 7',                icon: '🛡️', target_value: 7,    reward_title: 'Huyền Quy Hộ Thể',  reward_exp: 10000, reward_coins: 50000,  sort_order: 17 },
    { id: 'tl_18',     name: 'Toàn Năng Ý Cảnh',        category: 'tu_luyen', description: 'Cả 3 Ý Cảnh đều đạt cấp 7',           icon: '🌟', target_value: 21,   reward_title: 'Ý Cảnh Thông Thiên', reward_exp: 50000, reward_coins: 200000, sort_order: 18 },

    // ===== CHIẾN ĐẤU (Chien Dau) - Bí cảnh, boss, thám hiểm =====
    { id: 'cd_1',      name: 'Tân Binh Bí Cảnh',        category: 'chien_dau', description: 'Vượt bí cảnh 10 lần',                   icon: '🏛️', target_value: 10,   reward_title: null,               reward_exp: 500,   reward_coins: 2000,   sort_order: 19 },
    { id: 'cd_2',      name: 'Thám Hiểm Dũng Sĩ',       category: 'chien_dau', description: 'Vượt bí cảnh 30 lần',                   icon: '🏛️', target_value: 30,   reward_title: 'Phó Bản Dũng Sĩ',  reward_exp: 3000,  reward_coins: 10000,  sort_order: 20 },
    { id: 'cd_3',      name: 'Bí Cảnh Chi Vương',       category: 'chien_dau', description: 'Vượt bí cảnh 200 lần',                  icon: '🏛️', target_value: 200,  reward_title: null,               reward_exp: 15000, reward_coins: 50000,  sort_order: 21 },
    { id: 'cd_4',      name: 'Ác Mộng Khiêu Chiến',     category: 'chien_dau', description: 'Vượt bí cảnh độ khó Ác Mộng 5 lần',    icon: '💀', target_value: 5,    reward_title: 'Ác Mộng Đồ',       reward_exp: 10000, reward_coins: 20000,  sort_order: 22 },
    { id: 'cd_5',      name: 'World Boss Tập Kích',     category: 'chien_dau', description: 'Tấn công World Boss 10 lần',           icon: '👹', target_value: 10,   reward_title: null,               reward_exp: 1000,  reward_coins: 5000,   sort_order: 23 },
    { id: 'cd_6',      name: 'Thợ Săn Boss',            category: 'chien_dau', description: 'Tấn công World Boss 30 lần',           icon: '👹', target_value: 30,   reward_title: 'Thợ Săn Boss',     reward_exp: 5000,  reward_coins: 20000,  sort_order: 24 },
    { id: 'cd_7',      name: 'Boss Hunter',             category: 'chien_dau', description: 'Tấn công World Boss 200 lần',          icon: '👹', target_value: 200,  reward_title: null,               reward_exp: 25000, reward_coins: 100000, sort_order: 25 },
    { id: 'cd_8',      name: 'Trảm Sát Giả',            category: 'chien_dau', description: 'Kết liễu World Boss 1 lần',            icon: '⚔️', target_value: 1,    reward_title: 'Trảm Sát Giả',     reward_exp: 2000,  reward_coins: 10000,  sort_order: 26 },
    { id: 'cd_9',      name: 'Boss Thợ Săn Đại Tài',    category: 'chien_dau', description: 'Kết liễu World Boss 10 lần',           icon: '⚔️', target_value: 10,   reward_title: null,               reward_exp: 20000, reward_coins: 100000, sort_order: 27 },
    { id: 'cd_10',     name: 'Thám Hiểm Địa Đồ',        category: 'chien_dau', description: 'Thám hiểm dã ngoại 10 lần',            icon: '🗺️', target_value: 10,   reward_title: 'Thám Hiểm Gia',    reward_exp: 1000,  reward_coins: 3000,   sort_order: 28 },
    { id: 'cd_11',     name: 'Phát Hiện Vĩ Đại',        category: 'chien_dau', description: 'Thám hiểm dã ngoại 100 lần',           icon: '🗺️', target_value: 100,  reward_title: null,               reward_exp: 10000, reward_coins: 30000,  sort_order: 29 },
    { id: 'cd_12',     name: 'Săn Yêu Thú Dũng Cảm',    category: 'chien_dau', description: 'Săn yêu thú 10 lần',                  icon: '🐺', target_value: 10,   reward_title: null,               reward_exp: 500,   reward_coins: 2000,   sort_order: 30 },
    { id: 'cd_13',     name: 'Yêu Thú Đồ Tể',           category: 'chien_dau', description: 'Săn yêu thú 60 lần',                  icon: '🐺', target_value: 60,   reward_title: 'Yêu Thú Đồ Tể',    reward_exp: 5000,  reward_coins: 20000,  sort_order: 31 },

    // ===== PVP =====
    { id: 'pvp_1',     name: 'PvP Tân Thủ',             category: 'pvp',       description: 'Thắng 1 trận PvP',                    icon: '⚔️', target_value: 1,    reward_title: null,               reward_exp: 200,   reward_coins: 500,    sort_order: 32 },
    { id: 'pvp_2',     name: 'PvP Chiến Binh',          category: 'pvp',       description: 'Thắng 5 trận PvP',                    icon: '⚔️', target_value: 5,    reward_title: 'PvP Chiến Binh',   reward_exp: 2000,  reward_coins: 5000,   sort_order: 33 },
    { id: 'pvp_3',     name: 'PvP Tinh Anh',            category: 'pvp',       description: 'Thắng 50 trận PvP',                   icon: '⚔️', target_value: 50,   reward_title: null,               reward_exp: 8000,  reward_coins: 20000,  sort_order: 34 },
    { id: 'pvp_4',     name: 'PvP Bất Bại',             category: 'pvp',       description: 'Thắng 100 trận PvP',                  icon: '⚔️', target_value: 100,  reward_title: 'PvP Bất Bại',      reward_exp: 30000, reward_coins: 80000,  sort_order: 35 },
    { id: 'pvp_5',     name: 'PvP Huyền Thoại',         category: 'pvp',       description: 'Thắng 300 trận PvP',                  icon: '⚔️', target_value: 300,  reward_title: 'PvP Huyền Thoại',  reward_exp: 100000, reward_coins: 250000, sort_order: 36 },
    { id: 'pvp_6',     name: 'Điểm Phong Thần Sơ Cấp',  category: 'pvp',       description: 'Đạt 1500 điểm PvP',                   icon: '🏆', target_value: 1500, reward_title: null,               reward_exp: 3000,  reward_coins: 10000,  sort_order: 37 },
    { id: 'pvp_7',     name: 'Điểm Phong Thần Cao Cấp', category: 'pvp',       description: 'Đạt 2500 điểm PvP',                   icon: '🏆', target_value: 2500, reward_title: 'Phong Thần Giả',    reward_exp: 20000, reward_coins: 50000,  sort_order: 38 },
    { id: 'pvp_8',     name: 'Điểm Phong Thần Huyền Thoại', category: 'pvp',  description: 'Đạt 4000 điểm PvP',                   icon: '🏆', target_value: 4000, reward_title: 'Phong Thần Huyền Thoại', reward_exp: 100000, reward_coins: 200000, sort_order: 39 },
    { id: 'pvp_9',     name: 'Top 10 PvP',              category: 'pvp',       description: 'Lọt top 10 bảng xếp hạng PvP',         icon: '🎖️', target_value: 1,    reward_title: 'Top 10 PvP',       reward_exp: 20000, reward_coins: 100000, sort_order: 40 },

    // ===== SỦNG THÚ (Sung Thu) =====
    { id: 'st_1',      name: 'Người Bạn Đầu Tiên',      category: 'sung_thu', description: 'Thu phục 1 linh thú',                  icon: '🐾', target_value: 1,    reward_title: null,               reward_exp: 200,   reward_coins: 500,    sort_order: 41 },
    { id: 'st_2',      name: 'Ươm Mầm Sủng Thú',        category: 'sung_thu', description: 'Sở hữu 3 linh thú',                    icon: '🐾', target_value: 3,    reward_title: 'Sủng Thú Sư',      reward_exp: 1000,  reward_coins: 3000,   sort_order: 42 },
    { id: 'st_3',      name: 'Bộ Sưu Tập Phong Phú',    category: 'sung_thu', description: 'Sở hữu 15 linh thú',                   icon: '🐾', target_value: 15,   reward_title: null,               reward_exp: 5000,  reward_coins: 15000,  sort_order: 43 },
    { id: 'st_4',      name: 'Sủng Thú Đại Gia',        category: 'sung_thu', description: 'Sở hữu 20 linh thú',                   icon: '🐾', target_value: 20,   reward_title: 'Ngự Thú Đại Gia', reward_exp: 20000, reward_coins: 50000,  sort_order: 44 },
    { id: 'st_5',      name: 'Linh Thú Cao Cấp',        category: 'sung_thu', description: 'Sở hữu linh thú hiếm (Rare)',           icon: '🔵', target_value: 1,    reward_title: null,               reward_exp: 1000,  reward_coins: 3000,   sort_order: 45 },
    { id: 'st_6',      name: 'Linh Thú Cực Phẩm',       category: 'sung_thu', description: 'Sở hữu linh thú Epic',                 icon: '🟣', target_value: 1,    reward_title: 'Cực Phẩm Sủng',   reward_exp: 5000,  reward_coins: 15000,  sort_order: 46 },
    { id: 'st_7',      name: 'Linh Thú Huyền Thoại',    category: 'sung_thu', description: 'Sở hữu linh thú Legendary',             icon: '🟡', target_value: 1,    reward_title: 'Huyền Thoại Sủng', reward_exp: 20000, reward_coins: 50000,  sort_order: 47 },
    { id: 'st_8',      name: 'Lai Tạo Thành Công',      category: 'sung_thu', description: 'Lai tạo thành công 1 lần',              icon: '🧬', target_value: 1,    reward_title: null,               reward_exp: 1000,  reward_coins: 5000,   sort_order: 48 },
    { id: 'st_9',      name: 'Dị Biến Sư',              category: 'sung_thu', description: 'Lai tạo ra linh thú dị biến (nâng phẩm)', icon: '🌟', target_value: 1,    reward_title: 'Dị Biến Tông Sư',  reward_exp: 10000, reward_coins: 30000,  sort_order: 49 },
    { id: 'st_10',     name: 'Kỹ Năng Thức Tỉnh',       category: 'sung_thu', description: 'Thức tỉnh kỹ năng cho linh thú 5 lần', icon: '✨', target_value: 5,    reward_title: null,               reward_exp: 2000,  reward_coins: 8000,   sort_order: 50 },
    { id: 'st_11',     name: 'Linh Thú Cao Cấp 10',     category: 'sung_thu', description: 'Đưa linh thú lên cấp 10',              icon: '📈', target_value: 1,    reward_title: null,               reward_exp: 2000,  reward_coins: 5000,   sort_order: 51 },

    // ===== SINH HOẠT (Sinh Hoat) - Tông môn, chế tạo, luyện đan, linh điền, kinh tế =====
    { id: 'sh_1',      name: 'Gia Nhập Tông Môn',       category: 'sinh_hoat', description: 'Gia nhập 1 tông môn',                  icon: '☯️', target_value: 1,    reward_title: 'Môn Đồ',           reward_exp: 500,   reward_coins: 1000,   sort_order: 52 },
    { id: 'sh_2',      name: 'Cống Hiến Cho Tông Môn',  category: 'sinh_hoat', description: 'Tích lũy 700 điểm cống hiến',          icon: '☯️', target_value: 700,  reward_title: 'Trụ Cột Tông Môn',  reward_exp: 5000,  reward_coins: 15000,  sort_order: 53 },
    { id: 'sh_3',      name: 'Luyện Đan Tân Thủ',       category: 'sinh_hoat', description: 'Luyện thành công 10 đan dược',         icon: '🔥', target_value: 10,   reward_title: null,               reward_exp: 500,   reward_coins: 2000,   sort_order: 54 },
    { id: 'sh_4',      name: 'Luyện Đan Trung Cấp',     category: 'sinh_hoat', description: 'Luyện thành công 30 đan dược',         icon: '🔥', target_value: 30,   reward_title: 'Luyện Đan Sư',     reward_exp: 3000,  reward_coins: 10000,  sort_order: 55 },
    { id: 'sh_5',      name: 'Luyện Đan Cao Cấp',       category: 'sinh_hoat', description: 'Luyện thành công 200 đan dược',        icon: '🔥', target_value: 200,  reward_title: null,               reward_exp: 15000, reward_coins: 50000,  sort_order: 56 },
    { id: 'sh_6',      name: 'Linh Điền Khai Hoang',    category: 'sinh_hoat', description: 'Gieo trồng 10 hạt giống',              icon: '🌾', target_value: 10,   reward_title: null,               reward_exp: 500,   reward_coins: 2000,   sort_order: 57 },
    { id: 'sh_7',      name: 'Linh Nông Chăm Chỉ',      category: 'sinh_hoat', description: 'Gieo trồng 30 hạt giống',              icon: '🌾', target_value: 30,   reward_title: 'Linh Nông',        reward_exp: 3000,  reward_coins: 10000,  sort_order: 58 },
    { id: 'sh_8',      name: 'Chế Tạo Tân Thủ',         category: 'sinh_hoat', description: 'Chế tạo thành công 10 món',            icon: '🛠️', target_value: 10,   reward_title: null,               reward_exp: 500,   reward_coins: 2000,   sort_order: 59 },
    { id: 'sh_9',      name: 'Thợ Rèn Tài Ba',          category: 'sinh_hoat', description: 'Chế tạo thành công 30 món',            icon: '🛠️', target_value: 30,   reward_title: 'Thợ Rèn Tài Ba',   reward_exp: 3000,  reward_coins: 10000,  sort_order: 60 },
    { id: 'sh_10',     name: 'Chế Tạo Cao Cấp',         category: 'sinh_hoat', description: 'Chế tạo thành công 200 món',           icon: '🛠️', target_value: 200,  reward_title: null,               reward_exp: 15000, reward_coins: 50000,  sort_order: 61 },
    { id: 'sh_11',     name: 'Thương Nhân Nhỏ',         category: 'sinh_hoat', description: 'Mua/bán 10 giao dịch trên Vạn Bảo Lâu', icon: '🪙', target_value: 10,   reward_title: null,               reward_exp: 500,   reward_coins: 2000,   sort_order: 62 },
    { id: 'sh_12',     name: 'Thương Nhân Thực Thụ',    category: 'sinh_hoat', description: 'Mua/bán 30 giao dịch trên Vạn Bảo Lâu', icon: '🪙', target_value: 30,   reward_title: 'Thương Nhân',      reward_exp: 3000,  reward_coins: 10000,  sort_order: 63 },
    { id: 'sh_13',     name: 'Đại Thương Gia',          category: 'sinh_hoat', description: 'Mua/bán 100 giao dịch trên Vạn Bảo Lâu',icon: '🪙', target_value: 100,  reward_title: 'Đại Thương Gia',   reward_exp: 20000, reward_coins: 100000, sort_order: 64 },
    { id: 'sh_14',     name: 'Chăm Chỉ Làm Việc',       category: 'sinh_hoat', description: 'Làm việc 10 lần',                     icon: '⛏️', target_value: 10,   reward_title: null,               reward_exp: 500,   reward_coins: 2000,   sort_order: 65 },
    { id: 'sh_15',     name: 'Lao Động Cần Cù',         category: 'sinh_hoat', description: 'Làm việc 70 lần',                     icon: '⛏️', target_value: 70,   reward_title: 'Người Lao Động Cần Cù', reward_exp: 5000, reward_coins: 20000, sort_order: 66 },
  ];

  const stmt = db.prepare(`
    INSERT INTO achievements (id, name, category, description, icon, target_value, reward_title, reward_exp, reward_coins, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      description = excluded.description,
      icon = excluded.icon,
      target_value = excluded.target_value,
      reward_title = excluded.reward_title,
      reward_exp = excluded.reward_exp,
      reward_coins = excluded.reward_coins,
      sort_order = excluded.sort_order
  `);

  const transaction = db.transaction((items: typeof achievements) => {
    for (const a of items) {
      stmt.run(a.id, a.name, a.category, a.description, a.icon, a.target_value, a.reward_title, a.reward_exp, a.reward_coins, a.sort_order);
    }
  });
  transaction(achievements);
  console.log(`✅ Đã seed ${achievements.length} thành tựu.`);
}

/**
 * Nạp danh sách vật phẩm ban đầu vào cơ sở dữ liệu
 */
function seedItems() {
  const defaultItems = [
    // Đan Dược
    {
      id: 'pill_tu_vi_low',
      name: 'Sơ Cấp Tụ Khí Đan',
      type: 'pill',
      rarity: 'common',
      description: 'Linh đan ngưng tụ thiên địa linh khí, tăng trực tiếp 50 Tu Vi khi sử dụng.',
      stats: JSON.stringify({ add_tu_vi: 50 }),
      value_ha_pham: 30,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_hp_1',
      name: 'Hồi Huyết Đan - Hạ Phẩm',
      type: 'pill',
      rarity: 'common',
      description: 'Linh đan phổ thông dùng hồi phục 50 Sinh Lực trong chiến đấu.',
      stats: JSON.stringify({ restore_hp: 50 }),
      value_ha_pham: 10,
      usable: 1,
      equipable: 0
    },

    {
      id: 'pill_hp_2',
      name: 'Hồi Huyết Đan - Trung Phẩm',
      type: 'pill',
      rarity: 'uncommon',
      description: 'Linh đan tinh chế giúp hồi phục 150 Sinh Lực.',
      stats: JSON.stringify({ restore_hp: 150 }),
      value_ha_pham: 35,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_break_1',
      name: 'Trúc Cơ Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Bổ trợ đột phá bình cảnh từ Luyện Khí Kỳ lên Trúc Cơ Kỳ, tăng 20% tỷ lệ thành công.',
      stats: JSON.stringify({ break_success_rate: 0.20 }),
      value_ha_pham: 200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_break_minor_1',
      name: 'Tụ Khí Đan',
      type: 'pill',
      rarity: 'uncommon',
      description: 'Hỗ trợ đột phá tầng nhỏ, tăng 15% tỷ lệ thành công.',
      stats: JSON.stringify({ break_minor_rate: 0.15 }),
      value_ha_pham: 80,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_break_minor_2',
      name: 'Bồi Nguyên Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Hỗ trợ đột phá tầng nhỏ, tăng 30% tỷ lệ thành công.',
      stats: JSON.stringify({ break_minor_rate: 0.30 }),
      value_ha_pham: 150,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_break_minor_3',
      name: 'Tạo Hóa Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Hỗ trợ đột phá tầng nhỏ, tăng 50% tỷ lệ thành công.',
      stats: JSON.stringify({ break_minor_rate: 0.50 }),
      value_ha_pham: 400,
      usable: 1,
      equipable: 0
    },
    {
      id: 'talisman_anti_loi',
      name: 'Tị Lôi Phù',
      type: 'talisman',
      rarity: 'rare',
      description: 'Chống đỡ Lôi Kiếp, giảm 80% sát thương từ đạo sét đánh xuống.',
      stats: JSON.stringify({ block_loi: 0.8 }),
      value_ha_pham: 250,
      usable: 1,
      equipable: 0
    },
    {
      id: 'tang_bao_do',
      name: 'Tàng Bảo Đồ',
      type: 'material',
      rarity: 'rare',
      description: 'Một bản đồ da cừu cũ kỹ. Dùng nó để nhận lấy một tọa độ ẩn giấu kho báu bí mật. (Dùng lệnh /khambha toado để tìm)',
      stats: JSON.stringify({}),
      value_ha_pham: 500,
      usable: 1,
      equipable: 0
    },
    // Trang bị
    {
      id: 'weapon_sword_1',
      name: 'Thanh Phong Kiếm',
      type: 'equipment',
      rarity: 'common',
      description: 'Kiếm thép mỏng nhẹ của các đệ tử ngoại môn, tăng 10 Công Kích.',
      stats: JSON.stringify({ atk: 10 }),
      value_ha_pham: 50,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_1',
      name: 'Đạo Bào Thanh Lam',
      type: 'equipment',
      rarity: 'common',
      description: 'Đạo bào thô mộc gia tăng 5 Phòng Thủ.',
      stats: JSON.stringify({ def: 5 }),
      value_ha_pham: 40,
      usable: 0,
      equipable: 1
    },
    // Trang bị trung cấp (Trúc Cơ)
    {
      id: 'weapon_sword_2',
      name: 'Xích Long Kiếm',
      type: 'equipment',
      rarity: 'rare',
      description: 'Linh kiếm rèn từ vảy Xích Long, ẩn chứa hỏa lực cuồn cuộn, tăng 50 Công Kích.',
      stats: JSON.stringify({ atk: 50 }),
      value_ha_pham: 250,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_2',
      name: 'Thăng Long Đạo Bào',
      type: 'equipment',
      rarity: 'rare',
      description: 'Đạo bào thêu rồng bay lượn, gia tăng 30 Phòng Thủ và 100 Sinh Lực.',
      stats: JSON.stringify({ def: 30, hp: 100 }),
      value_ha_pham: 200,
      usable: 0,
      equipable: 1
    },
    {
      id: 'item_tam_sinh_thach',
      name: 'Tam Sinh Thạch',
      type: 'material',
      rarity: 'epic',
      description: 'Hòn đá ba đời ba kiếp, dùng để kết mối lương duyên, cầu hôn một đạo lữ.',
      stats: null,
      value_ha_pham: 5000,
      usable: 0,
      equipable: 0
    },
    {
      id: 'item_tuyet_tinh_nuoc',
      name: 'Tuyệt Tình Nước',
      type: 'material',
      rarity: 'rare',
      description: 'Dùng để cắt đứt tơ hồng, ly hôn đạo lữ (Gây tổn thương tu vi).',
      stats: null,
      value_ha_pham: 2000,
      usable: 0,
      equipable: 0
    },
    // Trang bị cao cấp (Kim Đan)
    {
      id: 'weapon_sword_3',
      name: 'Thiên Cổ Phán Quyết',
      type: 'equipment',
      rarity: 'epic',
      description: 'Cổ kiếm tuyệt thế có khả năng trảm tiên phạt thần, tăng 150 Công Kích và 5% Bạo Kích.',
      stats: JSON.stringify({ atk: 150, crit: 0.05 }),
      value_ha_pham: 1000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_3',
      name: 'Thần Quang Huyền Giáp',
      type: 'equipment',
      rarity: 'epic',
      description: 'Huyền giáp ngưng tụ thần quang bảo vệ nguyên thần, gia tăng 100 Phòng Thủ và 300 Sinh Lực.',
      stats: JSON.stringify({ def: 100, hp: 300 }),
      value_ha_pham: 800,
      usable: 0,
      equipable: 1
    },
    // Nguyên Liệu
    {
      id: 'material_iron_1',
      name: 'Huyền Thiết Sa',
      type: 'material',
      rarity: 'common',
      description: 'Quặng sắt thô chứa linh lực mỏng manh, dùng làm phôi rèn khí.',
      stats: '{}',
      value_ha_pham: 5,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_mythril_1',
      name: 'Bí Ngân Khối',
      type: 'material',
      rarity: 'uncommon',
      description: 'Quặng bạc thần bí, có đặc tính dẫn linh lực cực tốt, là vật liệu thượng đẳng để rèn pháp bảo.',
      stats: '{}',
      value_ha_pham: 20,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_tinh_thiet_1',
      name: 'Tinh Thiết Quang',
      type: 'material',
      rarity: 'rare',
      description: 'Quặng sắt tinh khiết phát ra ánh sáng kỳ ảo, ẩn chứa sức mạnh nguyên thủy có khả năng rèn ra Cực Phẩm.',
      stats: '{}',
      value_ha_pham: 50,
      usable: 0,
      equipable: 0
    },
    // Phù Lục & Hạt giống
    {
      id: 'talisman_speed_1',
      name: 'Thần Hành Phù',
      type: 'talisman',
      rarity: 'uncommon',
      description: 'Bùa vẽ bằng chu sa gia tốc tốc độ tăng trưởng linh điền hoặc rút ngắn thám hiểm 1 giờ.',
      stats: JSON.stringify({ reduce_time: 3600 }),
      value_ha_pham: 15,
      usable: 1,
      equipable: 0
    },
    // Vật phẩm sửa chữa
    {
      id: 'repair_stone_low',
      name: 'Pháp Bảo Dưỡng Thạch - Hạ Phẩm',
      type: 'material',
      rarity: 'uncommon',
      description: 'Linh thạch tẩm linh khí nhẹ, dùng để sửa chữa pháp bảo. Hồi phục 30 độ bền cho một trang bị.',
      stats: JSON.stringify({ repair_amount: 30 }),
      value_ha_pham: 100,
      usable: 1,
      equipable: 0
    },
    {
      id: 'repair_stone_mid',
      name: 'Pháp Bảo Dưỡng Thạch - Trung Phẩm',
      type: 'material',
      rarity: 'rare',
      description: 'Linh thạch thượng hạng chứa tinh hoa linh khí, hồi phục 70 độ bền cho một trang bị.',
      stats: JSON.stringify({ repair_amount: 70 }),
      value_ha_pham: 300,
      usable: 1,
      equipable: 0
    },
    {
      id: 'repair_stone_high',
      name: 'Pháp Bảo Dưỡng Thạch - Thượng Phẩm',
      type: 'material',
      rarity: 'epic',
      description: 'Linh thạch thần bí chứa cơ duyên tạo hóa, hồi phục HOÀN TOÀN độ bền cho một trang bị.',
      stats: JSON.stringify({ repair_amount: 999 }),
      value_ha_pham: 1000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'seed_linh_thao_1',
      name: 'Hạt Giống Linh Thảo',
      type: 'material',
      rarity: 'common',
      description: 'Hạt giống linh dược cơ bản, có thể gieo trồng ở Linh Điền.',
      stats: JSON.stringify({ growth_time: 300, product: 'material_linh_thao_1' }),
      value_ha_pham: 2,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_linh_thao_1',
      name: 'Linh Thảo Hạ Phẩm',
      type: 'material',
      rarity: 'common',
      description: 'Linh thảo cơ bản chứa một lượng linh khí mỏng manh, dùng để luyện chế đan dược.',
      stats: '{}',
      value_ha_pham: 5,
      usable: 0,
      equipable: 0
    },
    {
      id: 'seed_nhan_sam_1',
      name: 'Hạt Giống Nhân Sâm',
      type: 'material',
      rarity: 'uncommon',
      description: 'Hạt giống Huyết Nhân Sâm quý hiếm, có thể gieo trồng ở Linh Điền.',
      stats: JSON.stringify({ growth_time: 600, product: 'material_nhan_sam_1' }),
      value_ha_pham: 10,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_nhan_sam_1',
      name: 'Huyết Nhân Sâm',
      type: 'material',
      rarity: 'uncommon',
      description: 'Dược liệu quý hiếm hấp thụ tinh hoa địa hỏa, chuyên dùng để luyện chế trung/cao cấp đan dược.',
      stats: '{}',
      value_ha_pham: 25,
      usable: 0,
      equipable: 0
    },
    // Vũ Khí F-EX
    {
      id: 'weapon_sword_f',
      name: 'Luyện Thiết Kiếm (F)',
      type: 'equipment',
      rarity: 'common',
      description: 'Thanh kiếm sắt phổ thông rèn bằng phôi thô phẩm F, tăng 10 Công Kích.',
      stats: JSON.stringify({ atk: 10 }),
      value_ha_pham: 15,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_d',
      name: 'Linh Phong Kiếm (D)',
      type: 'equipment',
      rarity: 'common',
      description: 'Linh kiếm rèn bằng phôi phẩm D, tăng 20 Công Kích.',
      stats: JSON.stringify({ atk: 20 }),
      value_ha_pham: 30,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_c',
      name: 'Hàn Thiết Kiếm (C)',
      type: 'equipment',
      rarity: 'uncommon',
      description: 'Linh kiếm rèn bằng phôi phẩm C, tăng 35 Công Kích.',
      stats: JSON.stringify({ atk: 35 }),
      value_ha_pham: 75,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_b',
      name: 'Xích Huyết Kiếm (B)',
      type: 'equipment',
      rarity: 'rare',
      description: 'Linh kiếm rèn bằng phôi phẩm B, tăng 60 Công Kích.',
      stats: JSON.stringify({ atk: 60 }),
      value_ha_pham: 150,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_a',
      name: 'Thanh Quang Bảo Kiếm (A)',
      type: 'equipment',
      rarity: 'epic',
      description: 'Bảo kiếm ngưng tụ quang mang của trời đất rèn bằng phôi phẩm A, tăng 100 Công Kích và 3% Bạo Kích.',
      stats: JSON.stringify({ atk: 100, crit: 0.03 }),
      value_ha_pham: 350,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_s',
      name: 'Vô Ảnh Kiếm (S)',
      type: 'equipment',
      rarity: 'epic',
      description: 'Kiếm pháp xuất thần, vô ảnh vô tung rèn bằng phôi phẩm S, tăng 180 Công Kích và 5% Bạo Kích.',
      stats: JSON.stringify({ atk: 180, crit: 0.05 }),
      value_ha_pham: 750,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_ss',
      name: 'Huyền Thiên Linh Kiếm (SS)',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Linh kiếm chứa huyền thiên quy tắc rèn bằng phôi phẩm SS, tăng 300 Công Kích, 8% Bạo Kích và 10 May Mắn.',
      stats: JSON.stringify({ atk: 300, crit: 0.08, luck: 10 }),
      value_ha_pham: 1500,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_sss',
      name: 'Thần Ma Trảm Tiên Kiếm (SSS)',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Cổ kiếm diệt quỷ phạt thần rèn bằng phôi phẩm SSS, tăng 500 Công Kích, 12% Bạo Kích và 20 May Mắn.',
      stats: JSON.stringify({ atk: 500, crit: 0.12, luck: 20 }),
      value_ha_pham: 3000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_sword_ex',
      name: 'Hỗn Độn Khai Thiên Kiếm (EX)',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Kiếm thần khai thiên lập địa xuất phát từ rương World Boss, tăng 1000 Công Kích, 20% Bạo Kích và 50 May Mắn.',
      stats: JSON.stringify({ atk: 1000, crit: 0.20, luck: 50 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 1
    },
    // Đạo Bào F-EX
    {
      id: 'armor_robe_f',
      name: 'Vải Thô Đạo Bào (F)',
      type: 'equipment',
      rarity: 'common',
      description: 'Đạo bào may từ phôi phẩm F thô sơ, tăng 5 Phòng Thủ.',
      stats: JSON.stringify({ def: 5 }),
      value_ha_pham: 15,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_d',
      name: 'Thanh Y Đạo Bào (D)',
      type: 'equipment',
      rarity: 'common',
      description: 'Đạo bào dệt từ phôi phẩm D, tăng 10 Phòng Thủ và 30 Sinh Lực.',
      stats: JSON.stringify({ def: 10, hp: 30 }),
      value_ha_pham: 30,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_c',
      name: 'Tích Tà Đạo Y (C)',
      type: 'equipment',
      rarity: 'uncommon',
      description: 'Đạo y xua tan tà khí dệt từ phôi phẩm C, tăng 20 Phòng Thủ và 70 Sinh Lực.',
      stats: JSON.stringify({ def: 20, hp: 70 }),
      value_ha_pham: 75,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_b',
      name: 'Huyền Ngọc Giáp (B)',
      type: 'equipment',
      rarity: 'rare',
      description: 'Bảo giáp khảm huyền ngọc dệt từ phôi phẩm B, tăng 40 Phòng Thủ và 150 Sinh Lực.',
      stats: JSON.stringify({ def: 40, hp: 150 }),
      value_ha_pham: 150,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_a',
      name: 'Lưu Ly Đạo Bào (A)',
      type: 'equipment',
      rarity: 'epic',
      description: 'Lưu ly pháp y phòng ngự cực cường dệt từ phôi phẩm A, tăng 75 Phòng Thủ và 300 Sinh Lực.',
      stats: JSON.stringify({ def: 75, hp: 300 }),
      value_ha_pham: 350,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_s',
      name: 'Tử Tiêu Thần Y (S)',
      type: 'equipment',
      rarity: 'epic',
      description: 'Đạo y nhuốm sắc tím của tử khí dệt từ phôi phẩm S, tăng 130 Phòng Thủ và 600 Sinh Lực.',
      stats: JSON.stringify({ def: 130, hp: 600 }),
      value_ha_pham: 750,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_ss',
      name: 'Thái Cực Bát Quái Bào (SS)',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Đạo bào thêu đồ hình bát quái dệt từ phôi phẩm SS, tăng 220 Phòng Thủ và 1200 Sinh Lực.',
      stats: JSON.stringify({ def: 220, hp: 1200 }),
      value_ha_pham: 1500,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_sss',
      name: 'Huyền Hoàng Bất Diệt Giáp (SSS)',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Bảo giáp ngưng tụ sinh mệnh lực huyền hoàng dệt từ phôi phẩm SSS, tăng 400 Phòng Thủ và 2500 Sinh Lực.',
      stats: JSON.stringify({ def: 400, hp: 2500 }),
      value_ha_pham: 3000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'armor_robe_ex',
      name: 'Hỗn Độn Vô Cực Hộ Giáp (EX)',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Hộ giáp hỗn độn phòng ngự vô địch xuất thế từ rương World Boss, tăng 800 Phòng Thủ và 6000 Sinh Lực.',
      stats: JSON.stringify({ def: 800, hp: 6000 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 1
    },
    // Rương Bách Bảo
    {
      id: 'lucky_chest',
      name: 'Rương Cơ Duyên Lucky',
      type: 'chest',
      rarity: 'uncommon',
      description: 'Rương chứa cơ duyên thiên định. Sử dụng mở ra cơ hội nhận Phôi trang bị từ F tới SSS.',
      stats: '{}',
      value_ha_pham: 100,
      usable: 1,
      equipable: 0
    },
    {
      id: 'chest_1tr5',
      name: 'Rương Tôn Quý Đại Cát (1.5M)',
      type: 'chest',
      rarity: 'epic',
      description: 'Rương bảo vật tôn quý trị giá 1.5 triệu Linh Thạch. Tỷ lệ rơi kỳ trân dị bảo cực cao.',
      stats: '{}',
      value_ha_pham: 1500000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'server_raid_chest',
      name: 'Rương Thảo Phạt Boss Thế Giới',
      type: 'chest',
      rarity: 'legendary',
      description: 'Phần thưởng thảo phạt Thượng Cổ Yêu Thú. Cơ hội duy nhất mở ra trang bị phẩm chất cực hạn EX.',
      stats: '{}',
      value_ha_pham: 5000,
      usable: 1,
      equipable: 0
    },
    // Mảnh trang bị
    {
      id: 'item_fragment',
      name: 'Mảnh Trang Bị',
      type: 'material',
      rarity: 'uncommon',
      description: 'Mảnh vỡ tinh chế từ trang bị tu chân. Dùng để nâng sao trang bị hoặc ghép thành trang bị hiếm.',
      stats: '{}',
      value_ha_pham: 10,
      usable: 0,
      equipable: 0
    },
    // Sách Kỹ Năng
    {
      id: 'book_fire',
      name: 'Bí Tịch: Liệt Diễm Quyết',
      type: 'book',
      rarity: 'rare',
      description: 'Sách cổ ghi chép hỏa hệ tâm pháp, dùng học kỹ năng Liệt Diễm Quyết (Linh Căn Hỏa).',
      stats: JSON.stringify({ skill_id: 'skill_fire' }),
      value_ha_pham: 500,
      usable: 1,
      equipable: 0
    },
    {
      id: 'book_water',
      name: 'Bí Tịch: Thủy Linh Quyết',
      type: 'book',
      rarity: 'rare',
      description: 'Sách cổ ghi chép thủy hệ tâm pháp, dùng học kỹ năng Thủy Linh Quyết (Linh Căn Thủy).',
      stats: JSON.stringify({ skill_id: 'skill_water' }),
      value_ha_pham: 500,
      usable: 1,
      equipable: 0
    },
    {
      id: 'book_wood',
      name: 'Bí Tịch: Hấp Huyết Quyết',
      type: 'book',
      rarity: 'rare',
      description: 'Sách cổ ghi chép mộc hệ tâm pháp, dùng học kỹ năng Hấp Huyết Quyết (Linh Căn Mộc).',
      stats: JSON.stringify({ skill_id: 'skill_wood' }),
      value_ha_pham: 500,
      usable: 1,
      equipable: 0
    },
    {
      id: 'book_earth',
      name: 'Bí Tịch: Thổ Giáp Quyết',
      type: 'book',
      rarity: 'rare',
      description: 'Sách cổ ghi chép thổ hệ tâm pháp, dùng học kỹ năng Thổ Giáp Quyết (Linh Căn Thổ).',
      stats: JSON.stringify({ skill_id: 'skill_earth' }),
      value_ha_pham: 500,
      usable: 1,
      equipable: 0
    },
    {
      id: 'book_lightning',
      name: 'Bí Tịch: Lôi Phạt Quyết',
      type: 'book',
      rarity: 'epic',
      description: 'Sách cổ ghi chép lôi hệ thần thông, dùng học kỹ năng Lôi Phạt Quyết (Linh Căn Lôi).',
      stats: JSON.stringify({ skill_id: 'skill_lightning' }),
      value_ha_pham: 1000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'book_wind',
      name: 'Bí Tịch: Phong Hành Quyết',
      type: 'book',
      rarity: 'rare',
      description: 'Sách cổ ghi chép phong hệ tâm pháp, dùng học kỹ năng Phong Hành Quyết (Linh Căn Phong).',
      stats: JSON.stringify({ skill_id: 'skill_wind' }),
      value_ha_pham: 500,
      usable: 1,
      equipable: 0
    },
    // Phôi Trang bị (F đến SSS)
    {
      id: 'phoi_weapon_f',
      name: 'Phôi Vũ Khí - Phẩm F',
      type: 'phoi',
      rarity: 'common',
      description: 'Phôi rèn vũ khí phẩm chất F. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 10,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_weapon_d',
      name: 'Phôi Vũ Khí - Phẩm D',
      type: 'phoi',
      rarity: 'common',
      description: 'Phôi rèn vũ khí phẩm chất D. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 20,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_weapon_c',
      name: 'Phôi Vũ Khí - Phẩm C',
      type: 'phoi',
      rarity: 'uncommon',
      description: 'Phôi rèn vũ khí phẩm chất C. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 50,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_weapon_b',
      name: 'Phôi Vũ Khí - Phẩm B',
      type: 'phoi',
      rarity: 'rare',
      description: 'Phôi rèn vũ khí phẩm chất B. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 100,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_weapon_a',
      name: 'Phôi Vũ Khí - Phẩm A',
      type: 'phoi',
      rarity: 'epic',
      description: 'Phôi rèn vũ khí phẩm chất A. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 250,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_weapon_s',
      name: 'Phôi Vũ Khí - Phẩm S',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi rèn vũ khí phẩm chất S. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 500,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_weapon_ss',
      name: 'Phôi Vũ Khí - Phẩm SS',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi rèn vũ khí phẩm chất SS. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 750,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_weapon_sss',
      name: 'Phôi Vũ Khí - Phẩm SSS',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi rèn vũ khí phẩm chất SSS. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 1000,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_f',
      name: 'Phôi Đạo Bào - Phẩm F',
      type: 'phoi',
      rarity: 'common',
      description: 'Phôi đạo bào phẩm chất F. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 10,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_d',
      name: 'Phôi Đạo Bào - Phẩm D',
      type: 'phoi',
      rarity: 'common',
      description: 'Phôi đạo bào phẩm chất D. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 20,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_c',
      name: 'Phôi Đạo Bào - Phẩm C',
      type: 'phoi',
      rarity: 'uncommon',
      description: 'Phôi đạo bào phẩm chất C. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 50,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_b',
      name: 'Phôi Đạo Bào - Phẩm B',
      type: 'phoi',
      rarity: 'rare',
      description: 'Phôi đạo bào phẩm chất B. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 100,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_a',
      name: 'Phôi Đạo Bào - Phẩm A',
      type: 'phoi',
      rarity: 'epic',
      description: 'Phôi đạo bào phẩm chất A. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 250,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_s',
      name: 'Phôi Đạo Bào - Phẩm S',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi đạo bào phẩm chất S. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 500,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_ss',
      name: 'Phôi Đạo Bào - Phẩm SS',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi đạo bào phẩm chất SS. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 750,
      usable: 0,
      equipable: 0
    },
    {
      id: 'phoi_armor_sss',
      name: 'Phôi Đạo Bào - Phẩm SSS',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi đạo bào phẩm chất SSS. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 1000,
      usable: 0,
      equipable: 0
    },
    // Lò Luyện Đan
    {
      id: 'cauldron_low',
      name: 'Lò Luyện Đan - Hạ Phẩm',
      type: 'cauldron',
      rarity: 'common',
      description: 'Lò luyện đan thô sơ bằng đất sét nung, tăng 0% tỷ lệ thành công.',
      stats: JSON.stringify({ success_rate_bonus: 0.0, time_reduction_bonus: 0.0 }),
      value_ha_pham: 500,
      usable: 0,
      equipable: 0
    },
    {
      id: 'cauldron_mid',
      name: 'Lò Luyện Đan - Trung Phẩm',
      type: 'cauldron',
      rarity: 'rare',
      description: 'Lò luyện đan đúc từ đồng đen tinh thiết, tăng 10% tỷ lệ thành công.',
      stats: JSON.stringify({ success_rate_bonus: 0.10, time_reduction_bonus: 0.15 }),
      value_ha_pham: 2000,
      usable: 0,
      equipable: 0
    },
    {
      id: 'cauldron_high',
      name: 'Lò Luyện Đan - Thượng Phẩm',
      type: 'cauldron',
      rarity: 'epic',
      description: 'Cổ đỉnh luyện đan khảm ngọc hấp thu linh khí thiên địa, tăng 25% tỷ lệ thành công.',
      stats: JSON.stringify({ success_rate_bonus: 0.25, time_reduction_bonus: 0.30 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 0
    },
    // Đan dược đặc chế mới
    {
      id: 'pill_alchemy_tuvi',
      name: 'Luyện Khí Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Linh đan nén tụ linh khí cực hạn, sử dụng nhận trực tiếp +1000 Tu Vi.',
      stats: JSON.stringify({ add_tu_vi: 1000 }),
      value_ha_pham: 1000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_alchemy_break',
      name: 'Thanh Tâm Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Giúp tịnh hóa tâm ma, dùng tăng +10% tỷ lệ đột phá thành công.',
      stats: JSON.stringify({ break_success_rate_bonus: 0.10 }),
      value_ha_pham: 1500,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_alchemy_stamina',
      name: 'Bổ Thiên Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Bổ sung tiên thiên khí huyết, hồi phục tức thì +100 điểm Thể Lực (Stamina). Limit: 3 viên/ngày.',
      stats: JSON.stringify({ restore_stamina: 100 }),
      value_ha_pham: 3000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_stamina_1',
      name: 'Hồi Thể Đan - Sơ Cấp',
      type: 'pill',
      rarity: 'common',
      description: 'Đan dược cơ bản luyện từ thảo dược dã ngoại, khôi phục +50 Thể Lực (Stamina). Limit: 3 viên/ngày.',
      stats: JSON.stringify({ restore_stamina: 50 }),
      value_ha_pham: 500,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_stamina_2',
      name: 'Hồi Thể Đan - Trung Cấp',
      type: 'pill',
      rarity: 'rare',
      description: 'Linh đan chứa đựng linh khí dồi dào, khôi phục +100 Thể Lực (Stamina). Limit: 3 viên/ngày.',
      stats: JSON.stringify({ restore_stamina: 100 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_stamina_3',
      name: 'Hồi Thể Đan - Cao Cấp',
      type: 'pill',
      rarity: 'epic',
      description: 'Cực phẩm đan dược bồi bổ khí lực, khôi phục +200 Thể Lực (Stamina). Limit: 3 viên/ngày.',
      stats: JSON.stringify({ restore_stamina: 200 }),
      value_ha_pham: 3000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'potion_stamina_weekly',
      name: 'Bình Thể Lực (Tuần)',
      type: 'pill',
      rarity: 'rare',
      description: 'Dịch thể linh mạch ngưng tụ, hồi phục tức thì +150 điểm Thể Lực (Stamina). Giới hạn mua 6 bình/tuần.',
      stats: JSON.stringify({ restore_stamina: 150 }),
      value_ha_pham: 200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_alchemy_anti_loi',
      name: 'Ngự Lôi Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Đan dược kháng sét, giúp giảm 30% sát thương lôi kiếp khi đột phá cảnh giới.',
      stats: JSON.stringify({ loi_res: 0.30 }),
      value_ha_pham: 2500,
      usable: 1,
      equipable: 0
    },
    // --- PHỤ KIỆN (V7) ---
    {
      id: 'ring_1',
      name: 'Lưu Ly Giới Chỉ',
      type: 'equipment',
      rarity: 'rare',
      description: 'Nhẫn lưu ly tụ linh, tăng 5% Tỷ lệ Bạo Kích và 5% Công Kích.',
      stats: JSON.stringify({ crit: 0.05, atk_percent: 0.05 }),
      value_ha_pham: 500,
      usable: 0,
      equipable: 1
    },
    {
      id: 'necklace_1',
      name: 'Hồn Kính Hạng Liên',
      type: 'equipment',
      rarity: 'epic',
      description: 'Dây chuyền chứa hồn thú cường đại, tăng 5% Hồi Tị (Dodge) và 10% Tốc Độ.',
      stats: JSON.stringify({ dodge: 0.05, speed_percent: 0.1 }),
      value_ha_pham: 1000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'amulet_1',
      name: 'Hộ Mệnh Ngọc Phù',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Ngọc bùa tùy thân, tăng 15% Sinh Lực (HP) tối đa.',
      stats: JSON.stringify({ hp_percent: 0.15 }),
      value_ha_pham: 2000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'phoi_accessory_s',
      name: 'Phôi Phụ Kiện - Phẩm S',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi luyện phụ kiện phẩm S. Dùng lệnh /trangbi giamdinh để chế tác.',
      stats: '{}',
      value_ha_pham: 600,
      usable: 0,
      equipable: 0
    },
    // --- TỌA KỴ (V7) ---
    {
      id: 'mount_sword_1',
      name: 'Phi Kiếm Thanh Phong',
      type: 'equipment',
      rarity: 'epic',
      description: 'Ngự kiếm phi hành sơ cấp, tăng 20% Tốc Độ và 5% Né Tránh.',
      stats: JSON.stringify({ speed_percent: 0.20, dodge: 0.05 }),
      value_ha_pham: 1500,
      usable: 0,
      equipable: 1
    },
    {
      id: 'mount_beast_1',
      name: 'Cửu Vĩ Yêu Hồ',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Thần thú thời viễn cổ, tăng 40% Tốc Độ, 10% Sinh Lực và 10% Né Tránh.',
      stats: JSON.stringify({ speed_percent: 0.40, hp_percent: 0.10, dodge: 0.10 }),
      value_ha_pham: 5000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'phoi_mount_s',
      name: 'Phôi Tọa Kỵ - Phẩm S',
      type: 'phoi',
      rarity: 'legendary',
      description: 'Phôi linh thạch thuần hóa thú cưỡi phẩm S. Dùng lệnh /trangbi giamdinh để ấp/triệu hồi.',
      stats: '{}',
      value_ha_pham: 1000,
      usable: 0,
      equipable: 0
    },
    // --- GIAI ĐOẠN 7 (PHÁP BẢO & ĐẠO LỮ) ---
    {
      id: 'mat_huyen_thiet',
      name: 'Huyền Thiết',
      type: 'material',
      rarity: 'rare',
      description: 'Tinh hoa kim loại sinh ra từ việc phân rã trang bị. Dùng để Tinh Luyện đập sao.',
      stats: '{}',
      value_ha_pham: 500,
      usable: 0,
      equipable: 0
    },
    {
      id: 'item_nhan_dinh_hon',
      name: 'Nhẫn Đính Hôn',
      type: 'special',
      rarity: 'legendary',
      description: 'Tín vật thiêng liêng để kết bái Đạo Lữ. Dùng lệnh /daolu cau-hon để sử dụng.',
      stats: '{}',
      value_ha_pham: 500000,
      usable: 0,
      equipable: 0
    },
    {
      id: 'item_bloodline_pill',
      name: 'Huyết Mạch Chuyển Hóa Đan',
      type: 'consumable',
      rarity: 'epic',
      description: 'Đan dược dùng để thay đổi huyết mạch giác tỉnh. Tu vi huyết mạch sẽ trở về Cấp 1.',
      stats: '{}',
      value_ha_pham: 50000,
      usable: 0,
      equipable: 0
    },
    {
      id: 'tinh_thach_shard',
      name: 'Mảnh Tinh Thạch',
      type: 'material',
      rarity: 'rare',
      description: 'Mảnh đá chứa năng lượng tinh tú dùng để Cường Hóa trang bị.',
      stats: '{}',
      value_ha_pham: 200,
      usable: 0,
      equipable: 0
    },
    {
      id: 'item_life_bind_scroll',
      name: 'Huyết Tế Ma Bảng',
      type: 'special',
      rarity: 'legendary',
      description: 'Bảo cuộn cổ xưa dùng để chuyển đổi Bản Mệnh Pháp Bảo sang trang bị khác, giữ 80% EXP.',
      stats: '{}',
      value_ha_pham: 150000,
      usable: 0,
      equipable: 0
    },
    {
      id: 'pill_tay_tuy',
      name: 'Tẩy Tủy Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Linh đan tẩy tủy phạt cốt, dùng để tẩy và tái tạo ngẫu nhiên toàn bộ thuộc tính Linh Căn của tu sĩ.',
      stats: '{}',
      value_ha_pham: 5000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_y_canh',
      name: 'Ý Cảnh Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Đan dược bồi bổ thần thức, giúp gia tăng mạnh tốc độ lĩnh ngộ Ý Cảnh.',
      stats: '{}',
      value_ha_pham: 8000,
      usable: 1,
      equipable: 0
    },
    // Đan Dược Ngũ Hành Hộ Mệnh
    {
      id: 'pill_protect_hoa',
      name: 'Hỏa Linh Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Kháng Kim Lôi Kiếp, giảm 40% sát thương từ Kim Lôi Kiếp.',
      stats: JSON.stringify({ block_element: 'Kim', rate: 0.4 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_protect_thuy',
      name: 'Thủy Nguyên Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Kháng Hỏa Lôi Kiếp, giảm 40% sát thương từ Hỏa Lôi Kiếp.',
      stats: JSON.stringify({ block_element: 'Hỏa', rate: 0.4 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_protect_moc',
      name: 'Mộc Linh Hoàn',
      type: 'pill',
      rarity: 'rare',
      description: 'Kháng Thổ Lôi Kiếp, giảm 40% sát thương từ Thổ Lôi Kiếp.',
      stats: JSON.stringify({ block_element: 'Thổ', rate: 0.4 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_protect_tho',
      name: 'Địa Thổ Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Kháng Thủy Lôi Kiếp, giảm 40% sát thương từ Thủy Lôi Kiếp.',
      stats: JSON.stringify({ block_element: 'Thủy', rate: 0.4 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_protect_kim',
      name: 'Kim Cương Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Kháng Mộc Lôi Kiếp, giảm 40% sát thương từ Mộc Lôi Kiếp.',
      stats: JSON.stringify({ block_element: 'Mộc', rate: 0.4 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_protect_phong',
      name: 'Phong Linh Đan',
      type: 'pill',
      rarity: 'rare',
      description: 'Kháng Lôi Lôi Kiếp, giảm 40% sát thương từ Lôi Lôi Kiếp.',
      stats: JSON.stringify({ block_element: 'Lôi', rate: 0.4 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_protect_loi',
      name: 'Lôi Linh Hoàn',
      type: 'pill',
      rarity: 'rare',
      description: 'Kháng Phong Lôi Kiếp, giảm 40% sát thương từ Phong Lôi Kiếp.',
      stats: JSON.stringify({ block_element: 'Phong', rate: 0.4 }),
      value_ha_pham: 1200,
      usable: 1,
      equipable: 0
    },
    // Hạt Giống
    {
      id: 'seed_tuyet_lien',
      name: 'Thiên Sơn Tuyết Liên Hạt',
      type: 'seed',
      rarity: 'rare',
      description: 'Hạt giống linh thực dùng gieo trồng Thiên Sơn Tuyết Liên.',
      stats: JSON.stringify({ growth_time: 720, product: 'material_tuyet_lien' }),
      value_ha_pham: 300,
      usable: 0,
      equipable: 0
    },
    {
      id: 'seed_lingzhi',
      name: 'Cửu Diệp Linh Chi Hạt',
      type: 'seed',
      rarity: 'rare',
      description: 'Hạt giống linh thực dùng gieo trồng Cửu Diệp Linh Chi.',
      stats: JSON.stringify({ growth_time: 1200, product: 'material_lingzhi' }),
      value_ha_pham: 50,
      usable: 0,
      equipable: 0
    },
    {
      id: 'seed_ngodong',
      name: 'Ngô Đồng Quả Hạt',
      type: 'seed',
      rarity: 'rare',
      description: 'Hạt giống linh thực dùng gieo trồng Ngô Đồng Quả.',
      stats: JSON.stringify({ growth_time: 1800, product: 'material_ngodong' }),
      value_ha_pham: 800,
      usable: 0,
      equipable: 0
    },
    {
      id: 'seed_blood_flower',
      name: 'Hạt Giống Huyết Hoa',
      type: 'seed',
      rarity: 'uncommon',
      description: 'Hạt giống linh thực dùng gieo trồng Huyết Hoa.',
      stats: null,
      value_ha_pham: 50,
      usable: 0,
      equipable: 0
    },
    {
      id: 'seed_void_herb',
      name: 'Hạt Giống Hư Không Thảo',
      type: 'seed',
      rarity: 'rare',
      description: 'Hạt giống linh thực dùng gieo trồng Hư Không Thảo.',
      stats: null,
      value_ha_pham: 100,
      usable: 0,
      equipable: 0
    },
    {
      id: 'seed_wind_leaf',
      name: 'Hạt Giống Thiên Phong Diệp',
      type: 'seed',
      rarity: 'rare',
      description: 'Hạt giống linh thực dùng gieo trồng Thiên Phong Diệp.',
      stats: null,
      value_ha_pham: 100,
      usable: 0,
      equipable: 0
    },
    // Linh Thảo Thu Hoạch
    {
      id: 'material_tuyet_lien',
      name: 'Thiên Sơn Tuyết Liên',
      type: 'material',
      rarity: 'rare',
      description: 'Đóa sen tuyết cực hàn nở trên đỉnh tuyết sơn, dùng để luyện Cửu Chuyển Hoàn Hồn Đan.',
      stats: null,
      value_ha_pham: 900,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_lingzhi',
      name: 'Cửu Diệp Linh Chi',
      type: 'material',
      rarity: 'rare',
      description: 'Linh chi chín lá hấp thu tinh hoa trời đất, dùng để luyện Huyền Âm Kiếp Đan.',
      stats: null,
      value_ha_pham: 1500,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_ngodong',
      name: 'Ngô Đồng Quả',
      type: 'material',
      rarity: 'rare',
      description: 'Linh quả sinh trưởng trên cây Ngô Đồng cổ thụ, dùng để luyện Ngô Đồng Trường Sinh Đan.',
      stats: null,
      value_ha_pham: 2400,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_blood_flower',
      name: 'Huyết Hoa',
      type: 'material',
      rarity: 'uncommon',
      description: 'Linh thảo đỏ như máu, dùng làm nguyên liệu luyện Huyết Nguyên Đan.',
      stats: null,
      value_ha_pham: 150,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_void_herb',
      name: 'Hư Không Thảo',
      type: 'material',
      rarity: 'rare',
      description: 'Linh thảo ẩn chứa không gian chi lực, dùng làm nguyên liệu luyện Hư Không Đan.',
      stats: null,
      value_ha_pham: 300,
      usable: 0,
      equipable: 0
    },
    {
      id: 'material_wind_leaf',
      name: 'Thiên Phong Diệp',
      type: 'material',
      rarity: 'rare',
      description: 'Lá cây lướt nhanh mang theo ngọn gió, dùng làm nguyên liệu luyện Thiên Phong Đan.',
      stats: null,
      value_ha_pham: 300,
      usable: 0,
      equipable: 0
    },
    // Đan dược mới
    {
      id: 'pill_cuu_chuyen',
      name: 'Cửu Chuyển Hoàn Hồn Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Linh đan gia tăng vĩnh viễn +1000 HP tối đa cơ bản.',
      stats: JSON.stringify({ add_hp_perm: 1000 }),
      value_ha_pham: 4000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_ngo_dong',
      name: 'Ngô Đồng Trường Sinh Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Linh đan gia tăng vĩnh viễn +50 Công Kích (ATK) tối đa cơ bản.',
      stats: JSON.stringify({ add_atk_perm: 50 }),
      value_ha_pham: 6000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_huyen_am',
      name: 'Huyền Âm Kiếp Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Linh đan gia tăng vĩnh viễn +30 Phòng Ngự (DEF) tối đa cơ bản.',
      stats: JSON.stringify({ add_def_perm: 30 }),
      value_ha_pham: 5000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_hp_max_perm',
      name: 'Huyết Nguyên Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Linh dược gia tăng vĩnh viễn +500 HP tối đa cơ bản.',
      stats: JSON.stringify({ add_hp_perm: 500 }),
      value_ha_pham: 2000,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_mp_50',
      name: 'Hư Không Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Khôi phục ngay lập tức 50% MP tối đa trong chiến đấu.',
      stats: JSON.stringify({ restore_mp_percent: 0.5 }),
      value_ha_pham: 1500,
      usable: 1,
      equipable: 0
    },
    {
      id: 'pill_speed_buff',
      name: 'Thiên Phong Đan',
      type: 'pill',
      rarity: 'epic',
      description: 'Gia tăng +15% Tốc độ chiến đấu trong vòng 30 phút.',
      stats: JSON.stringify({ speed_buff: 0.15, duration: 1800 }),
      value_ha_pham: 1500,
      usable: 1,
      equipable: 0
    },
    // Trang Sức
    {
      id: 'accessory_ring_1',
      name: 'Nhẫn Pháp Hồn',
      type: 'equipment',
      rarity: 'rare',
      description: 'Nhẫn hộ thần gia tăng bạo kích và kháng bạo.',
      stats: JSON.stringify({ crit: 0.05, crit_res: 0.05 }),
      value_ha_pham: 800,
      usable: 0,
      equipable: 1
    },
    {
      id: 'accessory_pendant_1',
      name: 'Bội Phẩm Thần Hành',
      type: 'equipment',
      rarity: 'rare',
      description: 'Ngọc bội ôn nhuận tăng mana tối đa và tốc độ hồi MP.',
      stats: JSON.stringify({ mp: 200, speed: 10 }),
      value_ha_pham: 800,
      usable: 0,
      equipable: 1
    },
    // Vật phẩm sủng vật & Cơ duyên
    {
      id: 'item_pet_evolve',
      name: 'Linh Thú Tiến Hóa Đan',
      type: 'material',
      rarity: 'epic',
      description: 'Linh đan thần bí dùng hỗ trợ sủng vật cấp 50 tiến hóa lên phẩm Sử Thi.',
      stats: null,
      value_ha_pham: 5000,
      usable: 0,
      equipable: 0
    },
    {
      id: 'item_fortune_elixir',
      name: 'Cơ Duyên Đơn',
      type: 'pill',
      rarity: 'rare',
      description: 'Gia tăng +10% May mắn (Luck) cơ bản trong 1 giờ.',
      stats: JSON.stringify({ luck_buff: 10, duration: 3600 }),
      value_ha_pham: 1000,
      usable: 1,
      equipable: 0
    },
    // 5 Pháp bảo huyền thoại mới từ drop Cấm Khu
    {
      id: 'weapon_legendary_1',
      name: 'Bàn Cổ Phủ',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Phù thiên cự rìu chém rách hồng hoang, tăng 500 Công Kích, +10% Bạo Kích.',
      stats: JSON.stringify({ atk: 500, crit: 0.1 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_legendary_2',
      name: 'Đông Hoàng Chuông',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Thượng cổ thần khí trấn áp khí vận, tăng 2000 HP, 200 Thủ, +10% Né Tránh.',
      stats: JSON.stringify({ hp: 2000, def: 200, dodge: 0.1 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_legendary_3',
      name: 'Kính Côn Luân',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Gương thần nhìn thấu quá khứ tương lai, tăng 1000 HP, 30 Tốc, +10% Kháng Bạo.',
      stats: JSON.stringify({ hp: 1000, speed: 30, crit_res: 0.1 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_legendary_4',
      name: 'Nữ Oa Đá',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Thần thạch vá trời cứu độ chúng sinh, tăng 3000 HP, +50 Thủ.',
      stats: JSON.stringify({ hp: 3000, def: 50 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 1
    },
    {
      id: 'weapon_legendary_5',
      name: 'Thần Nông Đỉnh',
      type: 'equipment',
      rarity: 'legendary',
      description: 'Luyện đan đỉnh kỳ bảo thế gian, tăng 1500 HP, 150 Thủ, +5% Hút Máu.',
      stats: JSON.stringify({ hp: 1500, def: 150, hp_steal: 0.05 }),
      value_ha_pham: 10000,
      usable: 0,
      equipable: 1
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO items (id, name, type, rarity, description, stats, value_ha_pham, usable, equipable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      rarity = excluded.rarity,
      description = excluded.description,
      stats = excluded.stats,
      value_ha_pham = excluded.value_ha_pham,
      usable = excluded.usable,
      equipable = excluded.equipable
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      stmt.run(
        item.id,
        item.name,
        item.type,
        item.rarity,
        item.description,
        item.stats,
        item.value_ha_pham,
        item.usable,
        item.equipable
      );
    }
  });

  transaction(defaultItems);
}

/**
 * Seed kỹ năng khí linh
 */
function seedSpiritSkills() {
  const existingCount = db.prepare("SELECT COUNT(*) as c FROM spirit_skills").get() as { c: number };
  if (existingCount.c > 0) return;

  const skills = [
    { id: 'ss_crit', name: 'Sát Phạt Chi Ý', description: 'Tăng 3% tỷ lệ bạo kích khi chiến đấu.', effect_type: 'crit_up', effect_value: 0.03, min_level: 1 },
    { id: 'ss_dmg_reduce', name: 'Huyền Hoàng Chi Lực', description: 'Giảm 5% sát thương nhận vào.', effect_type: 'dmg_reduce', effect_value: 0.05, min_level: 3 },
    { id: 'ss_regen', name: 'Sinh Mệnh Chi Nguyên', description: 'Hồi phục 2% HP mỗi hiệp.', effect_type: 'hp_regen', effect_value: 0.02, min_level: 5 },
    { id: 'ss_atk', name: 'Chiến Ý Bộc Phát', description: 'Tăng 5% công kích.', effect_type: 'atk_up', effect_value: 0.05, min_level: 7 },
    { id: 'ss_dodge', name: 'Vô Ảnh Bộ', description: 'Tăng 3% tỷ lệ né tránh.', effect_type: 'dodge_up', effect_value: 0.03, min_level: 10 },
    { id: 'ss_def', name: 'Kim Cương Bất Hoại', description: 'Tăng 8% phòng thủ.', effect_type: 'def_up', effect_value: 0.08, min_level: 12 },
  ];

  const stmt = db.prepare(`
    INSERT INTO spirit_skills (id, name, description, effect_type, effect_value, min_level)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, description = excluded.description,
      effect_type = excluded.effect_type, effect_value = excluded.effect_value,
      min_level = excluded.min_level
  `);

  const tx = db.transaction(() => {
    for (const s of skills) {
      stmt.run(s.id, s.name, s.description, s.effect_type, s.effect_value, s.min_level);
    }
  });
  tx();
  console.log(`✅ Đã seed ${skills.length} kỹ năng khí linh.`);
}

/**
 * Seed dữ liệu Bí Cảnh Thí Luyện
 */
function seedEliteDungeons() {
  const dungeons = [
    {
      id: 'ed_thien_lao', name: 'Thiên Lao Ma Động',
      description: 'Nhà tù cổ xưa giam giữ ma thú, tầng càng sâu yêu ma càng mạnh. Phần thưởng: Trang bị Thần Khí + Mảnh Pháp Bảo.',
      floors: 5, min_level: 30, max_level: 999, min_party_size: 2, max_party_size: 4, cooldown_hours: 4,
      rewards_config: JSON.stringify({
        floor_rewards: [
          { min: { atk: 10, def: 5, hp: 50 }, max: { atk: 30, def: 15, hp: 150 } },
          { min: { atk: 25, def: 10, hp: 100 }, max: { atk: 60, def: 30, hp: 300 } },
          { min: { atk: 50, def: 20, hp: 200 }, max: { atk: 120, def: 50, hp: 600 } },
          { min: { atk: 80, def: 35, hp: 400 }, max: { atk: 200, def: 80, hp: 1000 } },
          { min: { atk: 150, def: 60, hp: 800 }, max: { atk: 350, def: 150, hp: 2000 } },
        ],
        boss_drop_rate: { epic: 0.3, legendary: 0.05, material: 0.8 }
      })
    },
    {
      id: 'ed_cam_khu', name: 'Thánh Địa Cấm Khu',
      description: 'Vùng đất cấm kỵ cổ xưa chứa các ma đầu thượng cổ bảo vật huyền thoại. Cần cấp 50. Phần thưởng: Tỷ lệ rơi Vũ Khí Huyền Thoại.',
      floors: 5, min_level: 50, max_level: 999, min_party_size: 2, max_party_size: 4, cooldown_hours: 24,
      rewards_config: JSON.stringify({
        floor_rewards: [
          { min: { exp: 1500, coins: 1000 }, max: { exp: 3000, coins: 2000 } },
          { min: { exp: 3000, coins: 2000 }, max: { exp: 6000, coins: 4000 } },
          { min: { exp: 6000, coins: 4000 }, max: { exp: 12000, coins: 8000 } },
          { min: { exp: 12000, coins: 8000 }, max: { exp: 24000, coins: 16000 } },
          { min: { exp: 24000, coins: 16000 }, max: { exp: 48000, coins: 32000 } },
        ],
        boss_drop_rate: { epic: 0.3, legendary: 0.20, material: 1.0 }
      })
    },
    {
      id: 'ed_tuyet_san', name: 'Băng Sơn Tuyệt Cốc',
      description: 'Thung lũng băng giá vĩnh cửu, nơi ẩn náu của Huyền Băng Cự Thú. Phần thưởng: Ngọc Băng Phách + KNB.',
      floors: 5, min_level: 60, max_level: 999, min_party_size: 2, max_party_size: 4, cooldown_hours: 12,
      rewards_config: JSON.stringify({
        floor_rewards: [
          { min: { atk: 20, def: 10, hp: 100 }, max: { atk: 50, def: 25, hp: 300 } },
          { min: { atk: 40, def: 20, hp: 200 }, max: { atk: 100, def: 50, hp: 600 } },
          { min: { atk: 80, def: 40, hp: 400 }, max: { atk: 200, def: 100, hp: 1200 } },
          { min: { atk: 150, def: 70, hp: 800 }, max: { atk: 350, def: 150, hp: 2500 } },
          { min: { atk: 250, def: 120, hp: 1500 }, max: { atk: 500, def: 250, hp: 4000 } },
        ],
        boss_drop_rate: { epic: 0.4, legendary: 0.08, material: 0.9 }
      })
    },
    {
      id: 'ed_hoa_diem', name: 'Hỏa Diễm Uyên Đình',
      description: 'Vực sâu lửa cháy ngàn năm, Hỏa Long thống trị. Phần thưởng: Long Lân + Trang bị hỏa hệ hiếm.',
      floors: 5, min_level: 90, max_level: 999, min_party_size: 3, max_party_size: 4, cooldown_hours: 12,
      rewards_config: JSON.stringify({
        floor_rewards: [
          { min: { atk: 40, def: 20, hp: 200 }, max: { atk: 80, def: 40, hp: 500 } },
          { min: { atk: 80, def: 40, hp: 400 }, max: { atk: 180, def: 80, hp: 1000 } },
          { min: { atk: 150, def: 70, hp: 800 }, max: { atk: 350, def: 150, hp: 2000 } },
          { min: { atk: 250, def: 120, hp: 1500 }, max: { atk: 500, def: 250, hp: 4000 } },
          { min: { atk: 400, def: 200, hp: 3000 }, max: { atk: 800, def: 400, hp: 8000 } },
        ],
        boss_drop_rate: { epic: 0.5, legendary: 0.12, material: 1.0 }
      })
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO elite_dungeons (id, name, description, floors, min_level, max_level, min_party_size, max_party_size, cooldown_hours, rewards_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, description = excluded.description,
      floors = excluded.floors, min_level = excluded.min_level,
      max_level = excluded.max_level, min_party_size = excluded.min_party_size,
      max_party_size = excluded.max_party_size, cooldown_hours = excluded.cooldown_hours,
      rewards_config = excluded.rewards_config
  `);

  const tx = db.transaction(() => {
    for (const d of dungeons) {
      stmt.run(d.id, d.name, d.description, d.floors, d.min_level, d.max_level, d.min_party_size, d.max_party_size, d.cooldown_hours, d.rewards_config);
    }
  });
  tx();
  console.log(`✅ Đã seed ${dungeons.length} bí cảnh thí luyện.`);
}

function seedHeartLaws() {
  const existingCount = db.prepare("SELECT COUNT(*) as c FROM heart_laws").get() as { c: number };
  if (existingCount.c > 0) return;

  const laws = [
    { id: 'hl_hoa', name: 'Hỏa Linh Quyết', description: 'Tâm pháp hệ Hỏa, dung hợp hỏa lực tăng 5% sát thương hệ Hỏa.', base_effect: JSON.stringify({ type: 'element_fire_dmg', value: 0.05 }), element: 'Hỏa' },
    { id: 'hl_thuy', name: 'Băng Tâm Quyết', description: 'Tâm pháp hệ Thủy, giữ vững bản tâm, miễn nhiễm hoàn toàn trạng thái choáng (stun).', base_effect: JSON.stringify({ type: 'stun_immune', value: 1 }), element: 'Thủy' },
    { id: 'hl_moc', name: 'Tụ Linh Quyết', description: 'Tâm pháp hệ Mộc, hấp thụ linh khí mộc diệp tăng thêm 10% Tu Vi nhận được.', base_effect: JSON.stringify({ type: 'exp_boost', value: 0.10 }), element: 'Mộc' },
    { id: 'hl_tho', name: 'Trường Sinh Quyết', description: 'Tâm pháp hệ Thổ, dồi dào sinh cơ, hồi phục 2% HP tối đa ở mỗi đầu hiệp đấu.', base_effect: JSON.stringify({ type: 'hp_regen', value: 0.02 }), element: 'Thổ' },
    { id: 'hl_kim', name: 'Thần Hành Quyết', description: 'Tâm pháp hệ Kim, sắc bén nhanh nhạy, tăng 10% tốc độ trong chiến đấu.', base_effect: JSON.stringify({ type: 'speed_boost', value: 0.10 }), element: 'Kim' },
    { id: 'hl_vo', name: 'Phá Cấm Quyết', description: 'Tâm pháp vô hệ, tăng thêm 15% sát thương khi công kích đối thủ có cấp độ cao hơn bản thân.', base_effect: JSON.stringify({ type: 'level_suppression_dmg', value: 0.15 }), element: 'Vô' }
  ];

  const stmt = db.prepare(`
    INSERT INTO heart_laws (id, name, description, base_effect, element)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, description = excluded.description,
      base_effect = excluded.base_effect, element = excluded.element
  `);

  const tx = db.transaction(() => {
    for (const l of laws) {
      stmt.run(l.id, l.name, l.description, l.base_effect, l.element);
    }
  });
  tx();
  console.log(`✅ Đã seed ${laws.length} bí kíp tâm pháp.`);
}

export default db;
