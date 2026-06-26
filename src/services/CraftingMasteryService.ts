import db from '../database/database';

// A-04: Crafting Mastery System

type CraftingType = 'alchemy' | 'forging' | 'cooking';

interface CraftingMastery {
  user_id: string;
  craft_type: CraftingType;
  mastery_level: number;
  mastery_exp: number;
}

const MASTERY_EXP_PER_LEVEL = 150;
const MAX_MASTERY_LEVEL = 10;

const QUALITY_TIERS = [
  { name: 'Thường', color: '⚪', bonus: 0, minLevel: 1 },
  { name: 'Tinh Xảo', color: '🟢', bonus: 0.05, minLevel: 3 },
  { name: 'Kiệt Tác', color: '🔵', bonus: 0.10, minLevel: 5 },
  { name: 'Huyền Thoại', color: '🟡', bonus: 0.25, minLevel: 8 },
];

// Recipe discovery: unlocked at certain mastery levels
const RECIPE_DISCOVERIES: Record<CraftingType, { level: number; recipe: string; name: string }[]> = {
  alchemy: [
    { level: 2, recipe: 'pill_fury', name: 'Phẫn Nộ Đan' },
    { level: 4, recipe: 'pill_shield', name: 'Hộ Thân Đan' },
    { level: 6, recipe: 'pill_rebirth', name: 'Hồi Sinh Đan' },
    { level: 8, recipe: 'pill_transmutation', name: 'Hóa Hư Đan' },
  ],
  forging: [
    { level: 2, recipe: 'equip_flame_sword', name: 'Hỏa Kiếm' },
    { level: 4, recipe: 'equip_frost_armor', name: 'Băng Giáp' },
    { level: 6, recipe: 'equip_storm_ring', name: 'Lôi Giới' },
    { level: 8, recipe: 'equip_earth_shield', name: 'Thổ Khiên' },
  ],
  cooking: [
    { level: 2, recipe: 'food_herb_salad', name: 'Rau Sâm' },
    { level: 4, recipe: 'food_meat_feast', name: 'Yến Tiệc' },
    { level: 6, recipe: 'food_elixir_soup', name: 'Canh Linh Lung' },
    { level: 8, recipe: 'food_dragon_fruit', name: 'Quả Rồng' },
  ],
};

class CraftingMasteryService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS crafting_mastery (
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        craft_type TEXT NOT NULL,
        mastery_level INTEGER DEFAULT 1,
        mastery_exp INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, craft_type)
      );
    `);
  }

  /**
   * A-04: Get crafting mastery
   */
  getMastery(userId: string, craftType: CraftingType): CraftingMastery {
    this.initTable();
    let row = db.prepare('SELECT * FROM crafting_mastery WHERE user_id = ? AND craft_type = ?')
      .get(userId, craftType) as CraftingMastery | undefined;

    if (!row) {
      db.prepare('INSERT INTO crafting_mastery (user_id, craft_type, mastery_level, mastery_exp) VALUES (?, ?, 1, 0)')
        .run(userId, craftType);
      row = db.prepare('SELECT * FROM crafting_mastery WHERE user_id = ? AND craft_type = ?')
        .get(userId, craftType) as CraftingMastery;
    }

    return row!;
  }

  /**
   * A-04: Add crafting EXP (call after crafting)
   */
  addCraftingExp(userId: string, craftType: CraftingType, exp: number = 20): { levelUp: boolean; newLevel: number } {
    this.initTable();
    const mastery = this.getMastery(userId, craftType);

    const newExp = mastery.mastery_exp + exp;
    const needed = MASTERY_EXP_PER_LEVEL * mastery.mastery_level;

    if (newExp >= needed && mastery.mastery_level < MAX_MASTERY_LEVEL) {
      const newLevel = mastery.mastery_level + 1;
      db.prepare('UPDATE crafting_mastery SET mastery_level = ?, mastery_exp = ? WHERE user_id = ? AND craft_type = ?')
        .run(newLevel, newExp - needed, userId, craftType);
      return { levelUp: true, newLevel };
    }

    db.prepare('UPDATE crafting_mastery SET mastery_exp = ? WHERE user_id = ? AND craft_type = ?')
      .run(Math.min(newExp, needed), userId, craftType);
    return { levelUp: false, newLevel: mastery.mastery_level };
  }

  /**
   * A-04: Get quality tier based on mastery level
   */
  getQualityTier(masteryLevel: number): typeof QUALITY_TIERS[0] {
    for (let i = QUALITY_TIERS.length - 1; i >= 0; i--) {
      if (masteryLevel >= QUALITY_TIERS[i].minLevel) return QUALITY_TIERS[i];
    }
    return QUALITY_TIERS[0];
  }

  /**
   * A-04: Get quality chance for a specific tier
   */
  getQualityChance(masteryLevel: number): Record<string, number> {
    const chances: Record<string, number> = { Normal: 100 };

    if (masteryLevel >= 3) chances.Fine = Math.min(20 + masteryLevel * 2, 40);
    if (masteryLevel >= 5) chances.Masterwork = Math.min(10 + masteryLevel, 25);
    if (masteryLevel >= 8) chances.Legendary = Math.min(masteryLevel - 5, 10);

    // Normalize
    const total = Object.values(chances).reduce((s, v) => s + v, 0);
    for (const key of Object.keys(chances)) {
      chances[key] = Math.round((chances[key] / total) * 100);
    }

    return chances;
  }

  /**
   * A-04: Roll quality tier
   */
  rollQuality(masteryLevel: number): typeof QUALITY_TIERS[0] {
    const chances = this.getQualityChance(masteryLevel);
    let rand = Math.random() * 100;

    for (const tier of QUALITY_TIERS) {
      if (chances[tier.name]) {
        rand -= chances[tier.name];
        if (rand <= 0) return tier;
      }
    }

    return QUALITY_TIERS[0];
  }

  /**
   * A-04: Get discovered recipes
   */
  getDiscoveredRecipes(userId: string, craftType: CraftingType): { recipe: string; name: string; discovered: boolean }[] {
    const mastery = this.getMastery(userId, craftType);
    const discoveries = RECIPE_DISCOVERIES[craftType] || [];

    return discoveries.map(d => ({
      recipe: d.recipe,
      name: d.name,
      discovered: mastery.mastery_level >= d.level
    }));
  }

  /**
   * A-04: Get crafting mastery description
   */
  getMasteryDescription(userId: string, craftType: CraftingType): string {
    const mastery = this.getMastery(userId, craftType);
    const needed = MASTERY_EXP_PER_LEVEL * mastery.mastery_level;
    const progress = Math.round((mastery.mastery_exp / needed) * 100);
    const quality = this.getQualityTier(mastery.mastery_level);

    let msg = `⚒️ **${craftType.toUpperCase()}** — Cấp **${mastery.mastery_level}**/${MAX_MASTERY_LEVEL}\n`;
    msg += `EXP: ${mastery.mastery_exp}/${needed} (${progress}%)\n`;
    msg += `Quality: ${quality.color} **${quality.name}** (+${Math.round(quality.bonus * 100)}% stats)\n`;

    const recipes = this.getDiscoveredRecipes(userId, craftType);
    const discovered = recipes.filter(r => r.discovered);
    if (discovered.length > 0) {
      msg += `\n**Công thức đã mở khóa:**\n`;
      for (const r of discovered) {
        msg += `• ${r.name}\n`;
      }
    }

    return msg;
  }

  // === A-02: Crafting Recipes Expansion ===

  /**
   * A-02: Get all recipes for a craft type (including undiscovered)
   */
  getAllRecipes(craftType: CraftingType): { id: string; name: string; description: string; materials: string; discoveryLevel: number; discovered: boolean }[] {
    const recipes: Record<CraftingType, any[]> = {
      alchemy: [
        { id: 'pill_hp', name: 'Hồi Huyết Đan', description: 'Hồi phục 20% HP', materials: 'Thảo dược', discoveryLevel: 1 },
        { id: 'pill_mana', name: 'Bổ Nguyên Đan', description: 'Hồi phục 20% MP', materials: 'Thảo dược + Linh Lung', discoveryLevel: 1 },
        { id: 'pill_atk', name: 'Phẫn Nộ Đan', description: '+10% ATK trong 5 phút', materials: 'Hỏa Thảo', discoveryLevel: 2 },
        { id: 'pill_def', name: 'Hộ Thân Đan', description: '+10% DEF trong 5 phút', materials: 'Thổ Thạch', discoveryLevel: 3 },
        { id: 'pill_speed', name: 'Thần Hành Đan', description: '+15% Speed trong 5 phút', materials: 'Phong Thảo', discoveryLevel: 4 },
        { id: 'pill_break', name: 'Phá Cảnh Đan', description: 'Giúp đột phá cảnh giới', materials: 'Tinh Thach + Thảo dược hiếm', discoveryLevel: 5 },
        { id: 'pill_rebirth', name: 'Hồi Sinh Đan', description: 'Tái sinh 1 lần trong combat', materials: 'Huyết Thạch + Linh Lung', discoveryLevel: 7 },
        { id: 'pill_transmutation', name: 'Hoá Hư Đan', description: 'Biến đổi 1 vật phẩm thành vật phẩm khác', materials: 'Tinh Thach + Vật liệu hiếm', discoveryLevel: 9 },
      ],
      forging: [
        { id: 'equip_sword', name: 'Kiếm Cơ Bản', description: 'Kiếm thường', materials: 'Sắt', discoveryLevel: 1 },
        { id: 'equip_armor', name: 'Giáp Cơ Bản', description: 'Giáp thường', materials: 'Sắt + Da', discoveryLevel: 1 },
        { id: 'equip_flame_sword', name: 'Hỏa Kiếm', description: 'Kiếm kèm hiệu ứng lửa', materials: 'Sắt + Hỏa Thạch', discoveryLevel: 3 },
        { id: 'equip_frost_armor', name: 'Băng Giáp', description: 'Giáp kèm hiệu ứng băng', materials: 'Sắt + Băng Thạch', discoveryLevel: 4 },
        { id: 'equip_storm_ring', name: 'Lôi Giới', description: 'Nhẫn kèm hiệu ứng sấm', materials: 'Bạc + Lôi Thạch', discoveryLevel: 6 },
        { id: 'equip_earth_shield', name: 'Thổ Khiên', description: 'Khiên kèm hiệu ứng đất', materials: 'Sắt + Thổ Thạch', discoveryLevel: 7 },
        { id: 'equip_legendary', name: 'Vũ Khí Thần Thoại', description: 'Vũ khí cực mạnh', materials: 'Tinh Thach + Vật liệu thần thoại', discoveryLevel: 9 },
      ],
      cooking: [
        { id: 'food_herb_salad', name: 'Rau Sâm', description: '+5% EXP trong 30 phút', materials: 'Rau', discoveryLevel: 1 },
        { id: 'food_meat_feast', name: 'Yến Tiệc', description: '+10% ATK trong 30 phút', materials: 'Thịt', discoveryLevel: 2 },
        { id: 'food_fish_soup', name: 'Canh Cá', description: '+10% DEF trong 30 phút', materials: 'Cá', discoveryLevel: 3 },
        { id: 'food_elixir_soup', name: 'Canh Linh Lung', description: '+15% EXP trong 30 phút', materials: 'Linh Lung + Thảo dược', discoveryLevel: 5 },
        { id: 'food_dragon_fruit', name: 'Quả Rồng', description: '+20% ATK + DEF trong 30 phút', materials: 'Rồng Thảo + Hỏa Thạch', discoveryLevel: 7 },
        { id: 'food_immortal', name: 'Tiên Đan', description: 'Bất tử 1 lần trong combat', materials: 'Tinh Thach + Huyết Thạch', discoveryLevel: 9 },
      ],
    };

    return (recipes[craftType] || []).map(r => ({ ...r, discovered: false }));
  }

  /**
   * A-02: Check for crafting event (double quality chance)
   */
  isCraftingEventActive(): boolean {
    // 5% chance of crafting event being active
    return Math.random() < 0.05;
  }

  /**
   * A-02: Get crafting event description
   */
  getCraftingEventDescription(): string {
    if (this.isCraftingEventActive()) {
      return '⚒️ **SỰ KIỆN LUYỆN CHẾ!** Double quality chance trong 30 phút!';
    }
    return 'Không có sự kiện luyện chế nào đang diễn ra.';
  }

  /**
   * A-02: Get recipe discovery progress
   */
  getRecipeDiscoveryProgress(userId: string, craftType: CraftingType): { discovered: number; total: number; percentage: number } {
    const allRecipes = this.getAllRecipes(craftType);
    const mastery = this.getMastery(userId, craftType);
    const discovered = allRecipes.filter(r => mastery.mastery_level >= r.discoveryLevel).length;

    return {
      discovered,
      total: allRecipes.length,
      percentage: allRecipes.length > 0 ? Math.round((discovered / allRecipes.length) * 100) : 0
    };
  }

  // === A-01: Crafting Mastery Expansion ===

  /**
   * A-01: Get crafting leaderboard
   */
  getCraftingLeaderboard(limit: number = 10): { userId: string; name: string; alchemyLevel: number; forgingLevel: number }[] {
    const rows = db.prepare(`
      SELECT u.discord_id as userId, u.name,
        COALESCE((SELECT mastery_level FROM crafting_mastery WHERE user_id = u.discord_id AND craft_type = 'alchemy'), 0) as alchemyLevel,
        COALESCE((SELECT mastery_level FROM crafting_mastery WHERE user_id = u.discord_id AND craft_type = 'forging'), 0) as forgingLevel
      FROM users u
      ORDER BY alchemyLevel + forgingLevel DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows;
  }

  /**
   * A-01: Get crafting description for UI
   */
  getCraftingDescription(userId: string): string {
    const alchemy = this.getMastery(userId, 'alchemy');
    const forging = this.getMastery(userId, 'forging');
    const cooking = this.getMastery(userId, 'cooking');

    let msg = `⚒️ **Luyện Chế**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🧪 **Luyện Đan:** Cấp ${alchemy.mastery_level}/10\n`;
    msg += `🔨 **Rèn:** Cấp ${forging.mastery_level}/10\n`;
    msg += `🍳 **Nấu Ăn:** Cấp ${cooking.mastery_level}/10\n`;

    if (this.isCraftingEventActive()) {
      msg += `\n🎉 **Sự Kiện Luyện Chế!** Nhân đôi cơ hội chất lượng!`;
    }

    return msg;
  }

  // === B-03: Secret Crafting Recipes ===

  private static readonly SECRET_RECIPES = [
    { id: 'secret_thien_hoa', name: 'Thiên Hỏa Đan', type: 'alchemy', condition: 'burn_100', description: 'Đốt cháy 100 vật phẩm' },
    { id: 'secret_binh_phach', name: 'Băng Phách Kiếm', type: 'forging', condition: 'fail_5', description: 'Thất bại 5 lần liên tiếp' },
    { id: 'secret_van_doc', name: 'Vạn Độc Tán', type: 'alchemy', condition: 'gather_50', description: 'Thu thập 50 thảo dược' },
    { id: 'secret_phoi_sinh', name: 'Phục Sinh Đan', type: 'alchemy', condition: 'boss_100', description: 'Đánh bại 100 boss' },
    { id: 'secret_thien_ly', name: 'Thiên Lý Truyền Thư', type: 'forging', condition: 'trade_50', description: 'Giao dịch 50 lần' },
  ];

  getSecretRecipes(userId: string): { recipe: typeof CraftingMasteryService.SECRET_RECIPES[0]; discovered: boolean }[] {
    this.initTable();
    const discovered = db.prepare("SELECT value FROM system_config WHERE key = ?").get(`secret_recipes:${userId}`) as any;
    const discoveredIds: string[] = discovered ? JSON.parse(discovered.value) : [];

    return CraftingMasteryService.SECRET_RECIPES.map(r => ({
      recipe: r,
      discovered: discoveredIds.includes(r.id)
    }));
  }

  discoverSecretRecipe(userId: string, recipeId: string): boolean {
    this.initTable();
    const recipe = CraftingMasteryService.SECRET_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;

    const discovered = db.prepare("SELECT value FROM system_config WHERE key = ?").get(`secret_recipes:${userId}`) as any;
    const ids: string[] = discovered ? JSON.parse(discovered.value) : [];
    if (ids.includes(recipeId)) return false;

    ids.push(recipeId);
    db.prepare('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)')
      .run(`secret_recipes:${userId}`, JSON.stringify(ids));
    return true;
  }

  checkSecretRecipeTriggers(userId: string): { recipe: string; name: string } | null {
    // Check audit_logs for trigger conditions
    const checks = [
      { condition: 'burn_100', query: "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'item_salvage'" },
      { condition: 'fail_5', query: "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'enhance_fail'" },
      { condition: 'boss_100', query: "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'world_boss'" },
      { condition: 'trade_50', query: "SELECT COUNT(*) as c FROM audit_logs WHERE user_id = ? AND action = 'market_buy'" },
    ];

    for (const check of checks) {
      const row = db.prepare(check.query).get(userId) as any;
      if (!row) continue;
      const recipe = CraftingMasteryService.SECRET_RECIPES.find(r => r.condition === check.condition);
      if (!recipe) continue;

      const target = check.condition === 'burn_100' ? 100 : check.condition === 'fail_5' ? 5 : check.condition === 'boss_100' ? 100 : 50;
      if (row.c >= target) {
        const result = this.discoverSecretRecipe(userId, recipe.id);
        if (result) return { recipe: recipe.id, name: recipe.name };
      }
    }

    return null;
  }
}

export const craftingMasteryService = new CraftingMasteryService();
