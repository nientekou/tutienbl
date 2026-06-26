"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rareBeastService = void 0;
const database_1 = __importDefault(require("../database/database"));
const rareBeastConstants_1 = require("../config/rareBeastConstants");
const CacheService_1 = require("./CacheService");
class RareBeastService {
    attemptTame(userId, beastType, luckBonus) {
        const def = rareBeastConstants_1.RARE_BEASTS.find(b => b.type === beastType);
        if (!def)
            return { success: false };
        const existing = database_1.default.prepare('SELECT id FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        // V13 A-02: Duplicate beast → give Máu Thú Nguyên instead
        if (existing) {
            const rate = Math.min(0.5, def.tamingRate + luckBonus * 0.001);
            if (Math.random() > rate)
                return { success: false };
            // ponytail: duplicate taming always gives 1 bloodline material
            return { success: true, bloodlineMaterial: 1 };
        }
        const rate = Math.min(0.5, def.tamingRate + luckBonus * 0.001);
        if (Math.random() > rate)
            return { success: false };
        const info = database_1.default.prepare(`
      INSERT INTO rare_beasts (user_id, beast_type, beast_name, rarity, level, skills)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(userId, beastType, def.name, def.rarity, JSON.stringify([def.passiveSkill]));
        return { success: true, beast: { id: info.lastInsertRowid, ...def } };
    }
    equip(userId, beastType) {
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        if (!beast)
            return false;
        database_1.default.prepare('UPDATE rare_beasts SET equipped = 0 WHERE user_id = ?').run(userId);
        database_1.default.prepare('UPDATE rare_beasts SET equipped = 1 WHERE id = ?').run(beast.id);
        CacheService_1.cacheService.invalidatePrefix(`stats:${userId}`);
        CacheService_1.cacheService.invalidatePrefix(`rarebeast:${userId}`);
        return true;
    }
    getEquippedBonuses(userId) {
        const cached = CacheService_1.cacheService.get(`rarebeast:${userId}`);
        if (cached)
            return cached;
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND equipped = 1').get(userId);
        if (!beast) {
            const empty = { atk: 0, def: 0, hp: 0, passive: '', passiveValue: 0 };
            CacheService_1.cacheService.set(`rarebeast:${userId}`, empty, 30_000);
            return empty;
        }
        const def = rareBeastConstants_1.RARE_BEASTS.find(b => b.type === beast.beast_type);
        const starIdx = Math.min((beast.stars || 1) - 1, def.evolveBonus.length - 1);
        const evolveBonus = def.evolveBonus[starIdx] || { atk: 0, def: 0, hp: 0 };
        const levelMult = 1 + (beast.level - 1) * 0.015;
        const result = {
            atk: Math.floor((def.baseAtk + evolveBonus.atk) * levelMult),
            def: Math.floor((def.baseDef + evolveBonus.def) * levelMult),
            hp: Math.floor((def.baseHp + evolveBonus.hp) * levelMult),
            passive: def.passiveSkill,
            // P1-03: Fix passiveValue — scale with stars and level, not array length
            passiveValue: Math.floor((beast.stars || 1) * 2 + (beast.level || 1) * 0.5)
        };
        CacheService_1.cacheService.set(`rarebeast:${userId}`, result, 30_000);
        return result;
    }
    evolve(userId, beastType) {
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        if (!beast)
            return { success: false, newStars: 0, message: 'Linh thú không tồn tại.' };
        const currentStars = beast.stars || 1;
        const MAX_STARS = 8; // P1-03: Evolution 8 stages (from 5)
        if (currentStars >= MAX_STARS)
            return { success: false, newStars: currentStars, message: 'Đã đạt giai đoạn tiến hóa tối đa (8).' };
        // P1-03: Evolution gates
        const beastLevel = beast.level || 1;
        if (currentStars >= 3 && beastLevel < 30) {
            return { success: false, newStars: currentStars, message: `Cần Linh Thú đạt cấp 30+ để tiến hóa giai đoạn ${currentStars + 1}.` };
        }
        if (currentStars >= 5 && beastLevel < 60) {
            return { success: false, newStars: currentStars, message: `Cần Linh Thú đạt cấp 60+ để tiến hóa giai đoạn ${currentStars + 1}.` };
        }
        // P1-03: Stage 6+ has 20% failure chance
        if (currentStars >= 5 && Math.random() < 0.20) {
            return { success: false, newStars: currentStars, message: 'Tiến hóa thất bại! Nguyên liệu bị mất.' };
        }
        const newStars = currentStars + 1;
        database_1.default.prepare('UPDATE rare_beasts SET stars = ? WHERE id = ?').run(newStars, beast.id);
        CacheService_1.cacheService.invalidatePrefix(`rarebeast:${userId}`);
        return { success: true, newStars, message: `Tiến hóa thành công lên giai đoạn ${newStars}!` };
    }
    feedExp(userId, beastType, exp) {
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND beast_type = ?')
            .get(userId, beastType);
        if (!beast)
            return { levelUp: false, newLevel: 0 };
        const newExp = (beast.exp || 0) + exp;
        const needed = beast.level * 100;
        if (newExp >= needed) {
            const newLevel = beast.level + 1;
            database_1.default.prepare('UPDATE rare_beasts SET level = ?, exp = ? WHERE id = ?')
                .run(newLevel, newExp - needed, beast.id);
            CacheService_1.cacheService.invalidatePrefix(`rarebeast:${userId}`);
            return { levelUp: true, newLevel };
        }
        database_1.default.prepare('UPDATE rare_beasts SET exp = ? WHERE id = ?').run(newExp, beast.id);
        return { levelUp: false, newLevel: beast.level };
    }
    getUserBeasts(userId) {
        return database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ?').all(userId);
    }
    // === W9-05: Beast Arena & Training Ground ===
    arenaInit = false;
    initArena() {
        if (this.arenaInit)
            return;
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS beast_arena_seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season_number INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS beast_arena_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        season_id INTEGER NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        UNIQUE(user_id, season_id)
      );

      CREATE TABLE IF NOT EXISTS beast_training (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        beast_id INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'training'
      );
    `);
        this.arenaInit = true;
    }
    /**
     * W9-05: Beast Arena — Auto-fight 3 beasts vs opponent
     */
    arenaFight(userId, opponentId) {
        this.initArena();
        const myBeasts = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? ORDER BY level DESC LIMIT 3').all(userId);
        const oppBeasts = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? ORDER BY level DESC LIMIT 3').all(opponentId);
        if (myBeasts.length === 0)
            return { success: false, message: '❌ Cần ít nhất 1 linh thú để tham gia Arena!' };
        if (oppBeasts.length === 0)
            return { success: false, message: '❌ Đối thủ không có linh thú!' };
        // Simple auto-fight: compare total power
        const myPower = myBeasts.reduce((sum, b) => sum + (b.level * 10) + (b.stars || 1) * 50, 0);
        const oppPower = oppBeasts.reduce((sum, b) => sum + (b.level * 10) + (b.stars || 1) * 50, 0);
        // Add some randomness (±20%)
        const myRoll = myPower * (0.8 + Math.random() * 0.4);
        const oppRoll = oppPower * (0.8 + Math.random() * 0.4);
        const won = myRoll > oppRoll;
        // Update scores
        const now = Math.floor(Date.now() / 1000);
        let season = database_1.default.prepare("SELECT * FROM beast_arena_seasons WHERE status = 'active' LIMIT 1").get();
        if (!season) {
            const twoWeeks = 14 * 86400;
            database_1.default.prepare('INSERT INTO beast_arena_seasons (season_number, start_time, end_time, status) VALUES (1, ?, ?, ?)')
                .run(now, now + twoWeeks, 'active');
            season = database_1.default.prepare("SELECT * FROM beast_arena_seasons WHERE status = 'active' LIMIT 1").get();
        }
        if (season) {
            const existing = database_1.default.prepare('SELECT * FROM beast_arena_scores WHERE user_id = ? AND season_id = ?')
                .get(userId, season.id);
            if (existing) {
                database_1.default.prepare('UPDATE beast_arena_scores SET wins = wins + ?, losses = losses + ?, score = score + ? WHERE user_id = ? AND season_id = ?')
                    .run(won ? 1 : 0, won ? 0 : 1, won ? 10 : 2, userId, season.id);
            }
            else {
                database_1.default.prepare('INSERT INTO beast_arena_scores (user_id, season_id, wins, losses, score) VALUES (?, ?, ?, ?, ?)')
                    .run(userId, season.id, won ? 1 : 0, won ? 0 : 1, won ? 10 : 2);
            }
        }
        const myNames = myBeasts.map(b => b.beast_name).join(', ');
        const oppNames = oppBeasts.map(b => b.beast_name).join(', ');
        const msg = `⚔️ **Đấu Trường Linh Thú**\n` +
            `🧑 ${myNames} (Power: ${Math.round(myRoll)})\n` +
            `🤖 ${oppNames} (Power: ${Math.round(oppRoll)})\n\n` +
            (won ? `🎉 **THẮNG!** +10 điểm Arena` : `💀 **THUA!** +2 điểm (tham gia)`);
        return { success: true, message: msg, won };
    }
    /**
     * W9-05: Start beast training (offline EXP, 4-8h)
     */
    startTraining(userId, beastId) {
        this.initArena();
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE id = ? AND user_id = ?').get(beastId, userId);
        if (!beast)
            return { success: false, message: '❌ Linh thú không tồn tại!' };
        // Check if already training
        const existing = database_1.default.prepare("SELECT * FROM beast_training WHERE user_id = ? AND beast_id = ? AND status = 'training'")
            .get(userId, beastId);
        if (existing)
            return { success: false, message: '❌ Linh thú này đang huấn luyện!' };
        // Check max 3 training at once
        const trainingCount = database_1.default.prepare("SELECT COUNT(*) as c FROM beast_training WHERE user_id = ? AND status = 'training'")
            .get(userId);
        if (trainingCount.c >= 3)
            return { success: false, message: '❌ Đã đủ 3 linh thú huấn luyện! Đợi một trong số chúng hoàn thành.' };
        const now = Math.floor(Date.now() / 1000);
        const duration = (4 + Math.floor(Math.random() * 5)) * 3600; // 4-8 hours
        database_1.default.prepare('INSERT INTO beast_training (user_id, beast_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)')
            .run(userId, beastId, now, now + duration, 'training');
        const hours = Math.round(duration / 3600);
        return { success: true, message: `🏋️ **${beast.beast_name}** bắt đầu huấn luyện trong **${hours}h**!` };
    }
    /**
     * W9-05: Claim training rewards
     */
    claimTraining(userId, beastId) {
        this.initArena();
        const training = database_1.default.prepare("SELECT * FROM beast_training WHERE user_id = ? AND beast_id = ? AND status = 'training'")
            .get(userId, beastId);
        if (!training)
            return { success: false, message: '❌ Không có huấn luyện nào đang diễn ra!' };
        const now = Math.floor(Date.now() / 1000);
        if (now < training.end_time) {
            const remainMin = Math.ceil((training.end_time - now) / 60);
            return { success: false, message: `❌ Còn **${remainMin} phút** nữa huấn luyện hoàn thành!` };
        }
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE id = ?').get(beastId);
        if (!beast)
            return { success: false, message: '❌ Linh thú không tồn tại!' };
        // Grant EXP
        const expGained = 100 + beast.level * 20;
        const result = this.feedExp(userId, beast.beast_type, expGained);
        database_1.default.prepare("UPDATE beast_training SET status = 'completed' WHERE id = ?").run(training.id);
        const msg = `🏋️ **${beast.beast_name}** hoàn thành huấn luyện!\n+${expGained} Tu Vi` +
            (result.levelUp ? `\n🎉 Lên cấp! → Cấp **${result.newLevel}**` : '');
        return { success: true, message: msg };
    }
    /**
     * W9-05: Get arena leaderboard
     */
    getArenaLeaderboard(limit = 10) {
        this.initArena();
        const rows = database_1.default.prepare(`
      SELECT bas.*, u.name
      FROM beast_arena_scores bas
      JOIN users u ON bas.user_id = u.discord_id
      JOIN beast_arena_seasons s ON bas.season_id = s.id AND s.status = 'active'
      ORDER BY bas.score DESC, bas.wins DESC
      LIMIT ?
    `).all(limit);
        return rows.map(r => ({
            userId: r.user_id,
            name: r.name,
            wins: r.wins,
            losses: r.losses,
            score: r.score
        }));
    }
    /**
     * W9-05: Beast synergy — match element with Linh Can → +10% passive
     */
    getSynergyBonus(userId) {
        const beast = database_1.default.prepare('SELECT * FROM rare_beasts WHERE user_id = ? AND equipped = 1').get(userId);
        if (!beast || !beast.element || beast.element === 'none')
            return 0;
        const user = database_1.default.prepare('SELECT linh_can FROM users WHERE discord_id = ?').get(userId);
        if (!user)
            return 0;
        try {
            const linhCan = JSON.parse(user.linh_can || '{}');
            const elementMap = {
                'kim': 'Kim', 'moc': 'Moc', 'thuy': 'Thuy', 'hoa': 'Hoa', 'tho': 'Tho', 'loi': 'Loi', 'phong': 'Phong'
            };
            const beastElement = elementMap[beast.element] || beast.element;
            if (linhCan[beastElement] && linhCan[beastElement] > 0) {
                return 0.10; // +10% passive effect
            }
        }
        catch { }
        return 0;
    }
    // === C-03: Beast Collection Deep ===
    /**
     * C-03: Get beast mounts
     */
    getBeastMounts() {
        return [
            { id: 'mount_kim_long', name: 'Tọa Kỵ Kim Long', description: 'Cưỡi Kim Long phi hành', speedBonus: 0.10, requirement: 'Kim Long Cấp 3+' },
            { id: 'mount_bach_ho', name: 'Tọa Kỵ Bạch Hổ', description: 'Cưỡi Bạch Hổ phi hành', speedBonus: 0.15, requirement: 'Bạch Hổ Cấp 4+' },
            { id: 'mount_thien_ma', name: 'Tọa Kỵ Thiên Mã', description: 'Cưỡi Thiên Mã phi hành', speedBonus: 0.20, requirement: 'Thiên Mã Cấp 5+' },
            { id: 'mount_lac_hong', name: 'Tọa Kỵ Lạc Hồng', description: 'Cưỡi Lạc Hồng phi hành', speedBonus: 0.25, requirement: 'Lạc Hồng Cấp 6+' },
        ];
    }
    /**
     * C-03: Get beast descriptions for UI
     */
    getBeastCollectionDescription(userId) {
        const pets = this.getUserBeasts(userId);
        const uniqueTypes = new Set(pets.map((p) => p.beast_type));
        const byRarity = {};
        let highestLevel = 0;
        let totalStars = 0;
        for (const pet of pets) {
            byRarity[pet.rarity || 'common'] = (byRarity[pet.rarity || 'common'] || 0) + 1;
            highestLevel = Math.max(highestLevel, pet.level || 1);
            totalStars += pet.stars || 1;
        }
        let msg = `🐉 **Bộ Sưu Tập Linh Thú**\n`;
        msg += `📊 Loại: **${uniqueTypes.size}** | Tổng: **${pets.length}**\n`;
        msg += `🏆 Cấp Cao Nhất: **${highestLevel}**\n`;
        msg += `⭐ Tổng Sao: **${totalStars}**\n\n`;
        if (Object.keys(byRarity).length > 0) {
            msg += `**Theo Độ Hiếm:**\n`;
            for (const [rarity, count] of Object.entries(byRarity)) {
                msg += `• ${rarity}: ${count}\n`;
            }
        }
        return msg;
    }
    // V13 A-02: Beast Bloodline Fusion
    BLOODLINE_BRANCHES = {
        attack: {
            name: 'Sát Thương',
            nodes: [
                { name: 'ATK +%5', effect: 'atk_percent', value: 0.05, cost: 1 },
                { name: 'Crit +%3', effect: 'crit', value: 0.03, cost: 1 },
                { name: 'Crit Damage +%10%', effect: 'crit_damage', value: 0.10, cost: 2 },
                { name: 'Lifesteal +%5%', effect: 'lifesteal', value: 0.05, cost: 3 },
                { name: 'Berserk: HP<30% → +20% ATK', effect: 'berserk', value: 0.20, cost: 5 },
            ],
        },
        defense: {
            name: 'Sinh Tồn',
            nodes: [
                { name: 'HP +%5', effect: 'hp_percent', value: 0.05, cost: 1 },
                { name: 'DEF +%5', effect: 'def_percent', value: 0.05, cost: 1 },
                { name: 'HP Regen +2%', effect: 'hp_regen', value: 0.02, cost: 2 },
                { name: 'Thorns 5%', effect: 'thorns', value: 0.05, cost: 3 },
                { name: 'Revive 10%', effect: 'revive', value: 0.10, cost: 5 },
            ],
        },
        support: {
            name: 'Hỗ Trợ',
            nodes: [
                { name: 'Speed +10', effect: 'speed', value: 10, cost: 1 },
                { name: 'Aura: +2% crit team', effect: 'aura_crit', value: 0.02, cost: 1 },
                { name: 'Debuff Resist +15%', effect: 'debuff_resist', value: 0.15, cost: 2 },
                { name: 'Party Heal 3%', effect: 'party_heal', value: 0.03, cost: 3 },
                { name: 'Counter Element +10%', effect: 'counter_element', value: 0.10, cost: 5 },
            ],
        },
    };
    initBloodlineTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS beast_bloodline (
        user_id TEXT NOT NULL,
        beast_type TEXT NOT NULL,
        branch TEXT NOT NULL,
        node_index INTEGER NOT NULL,
        unlocked INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, beast_type, branch, node_index)
      );
    `);
    }
    getBloodlineMaterials(userId) {
        const row = database_1.default.prepare("SELECT SUM(count) as total FROM user_inventory WHERE user_id = ? AND item_id = 'material_mau_thu_nguyen'").get(userId);
        return row?.total ?? 0;
    }
    addBloodlineMaterial(userId, amount) {
        const existing = database_1.default.prepare("SELECT id, quantity FROM user_inventory WHERE user_id = ? AND item_id = 'material_mau_thu_nguyen'").get(userId);
        if (existing) {
            database_1.default.prepare('UPDATE user_inventory SET quantity = quantity + ? WHERE id = ?').run(amount, existing.id);
        }
        else {
            database_1.default.prepare("INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, 'material_mau_thu_nguyen', ?)").run(userId, amount);
        }
    }
    getBloodlineNodes(userId, beastType) {
        this.initBloodlineTable();
        return database_1.default.prepare('SELECT branch, node_index as nodeIndex, unlocked FROM beast_bloodline WHERE user_id = ? AND beast_type = ?').all(userId, beastType);
    }
    canUnlockBloodlineNode(userId, beastType, branch, nodeIndex) {
        this.initBloodlineTable();
        const branchDef = this.BLOODLINE_BRANCHES[branch];
        if (!branchDef)
            return { eligible: false, reason: 'Nhánh không hợp lệ.', cost: 0 };
        const nodeDef = branchDef.nodes[nodeIndex];
        if (!nodeDef)
            return { eligible: false, reason: 'Node không hợp lệ.', cost: 0 };
        // Check prerequisite: previous node must be unlocked
        if (nodeIndex > 0) {
            const prev = database_1.default.prepare('SELECT unlocked FROM beast_bloodline WHERE user_id = ? AND beast_type = ? AND branch = ? AND node_index = ?').get(userId, beastType, branch, nodeIndex - 1);
            if (!prev || !prev.unlocked)
                return { eligible: false, reason: `Cần mở node ${nodeIndex} trước.`, cost: 0 };
        }
        // Check already unlocked
        const existing = database_1.default.prepare('SELECT unlocked FROM beast_bloodline WHERE user_id = ? AND beast_type = ? AND branch = ? AND node_index = ?').get(userId, beastType, branch, nodeIndex);
        if (existing?.unlocked)
            return { eligible: false, reason: 'Đã mở node này.', cost: 0 };
        // Check materials
        const materials = this.getBloodlineMaterials(userId);
        if (materials < nodeDef.cost)
            return { eligible: false, reason: `Cần ${nodeDef.cost} Máu Thú Nguyên (hiện ${materials}).`, cost: 0 };
        return { eligible: true, reason: '', cost: nodeDef.cost };
    }
    unlockBloodlineNode(userId, beastType, branch, nodeIndex) {
        this.initBloodlineTable();
        const check = this.canUnlockBloodlineNode(userId, beastType, branch, nodeIndex);
        if (!check.eligible)
            return { success: false, message: `❌ ${check.reason}` };
        const branchDef = this.BLOODLINE_BRANCHES[branch];
        const nodeDef = branchDef.nodes[nodeIndex];
        // Deduct materials
        database_1.default.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = 'material_mau_thu_nguyen'").run(check.cost, userId);
        // Upsert node
        database_1.default.prepare(`
      INSERT INTO beast_bloodline (user_id, beast_type, branch, node_index, unlocked)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, beast_type, branch, node_index) DO UPDATE SET unlocked = 1
    `).run(userId, beastType, branch, nodeIndex);
        CacheService_1.cacheService.invalidatePrefix(`stats:${userId}`);
        return { success: true, message: `✅ Đã mở node **${nodeDef.name}**!` };
    }
    getBloodlineBonuses(userId) {
        this.initBloodlineTable();
        const nodes = database_1.default.prepare('SELECT branch, node_index FROM beast_bloodline WHERE user_id = ? AND unlocked = 1').all(userId);
        const bonuses = { atk_percent: 0, def_percent: 0, hp_percent: 0, crit: 0, speed: 0 };
        for (const n of nodes) {
            const branchDef = this.BLOODLINE_BRANCHES[n.branch];
            if (!branchDef)
                continue;
            const nodeDef = branchDef.nodes[n.node_index];
            if (!nodeDef)
                continue;
            if (nodeDef.effect in bonuses) {
                bonuses[nodeDef.effect] += nodeDef.value;
            }
        }
        return bonuses;
    }
    // === V16 D-02: Pet Breeding ===
    BREED_COST = 1000; // LT
    MAX_BREEDS = 3;
    canBreed(userId, beast1Id, beast2Id) {
        const beast1 = database_1.default.prepare('SELECT * FROM rare_beasts WHERE id = ? AND user_id = ?').get(beast1Id, userId);
        const beast2 = database_1.default.prepare('SELECT * FROM rare_beasts WHERE id = ? AND user_id = ?').get(beast2Id, userId);
        if (!beast1 || !beast2)
            return { eligible: false, reason: '❌ Linh thú không tồn tại.' };
        if (beast1Id === beast2Id)
            return { eligible: false, reason: '❌ Không thể phối giống chính mình.' };
        const breed1 = beast1.breed_count || 0;
        const breed2 = beast2.breed_count || 0;
        if (breed1 >= this.MAX_BREEDS)
            return { eligible: false, reason: `❌ ${beast1.beast_name} đã phối giống tối đa (${this.MAX_BREEDS} lần).` };
        if (breed2 >= this.MAX_BREEDS)
            return { eligible: false, reason: `❌ ${beast2.beast_name} đã phối giống tối đa (${this.MAX_BREEDS} lần).` };
        const user = database_1.default.prepare('SELECT coin_ha_pham FROM users WHERE discord_id = ?').get(userId);
        if (user.coin_ha_pham < this.BREED_COST)
            return { eligible: false, reason: `❌ Cần ${this.BREED_COST} LT.` };
        return { eligible: true, reason: '' };
    }
    breed(userId, beast1Id, beast2Id) {
        const check = this.canBreed(userId, beast1Id, beast2Id);
        if (!check.eligible)
            return { success: false, message: check.reason };
        const beast1 = database_1.default.prepare('SELECT * FROM rare_beasts WHERE id = ?').get(beast1Id);
        const beast2 = database_1.default.prepare('SELECT * FROM rare_beasts WHERE id = ?').get(beast2Id);
        // Deduct cost
        database_1.default.prepare('UPDATE users SET coin_ha_pham = coin_ha_pham - ? WHERE discord_id = ?').run(this.BREED_COST, userId);
        // Increment breed count
        database_1.default.prepare('UPDATE rare_beasts SET breed_count = COALESCE(breed_count, 0) + 1 WHERE id = ?').run(beast1Id);
        database_1.default.prepare('UPDATE rare_beasts SET breed_count = COALESCE(breed_count, 0) + 1 WHERE id = ?').run(beast2Id);
        // Generate offspring: random stats from parents
        const parent1 = rareBeastConstants_1.RARE_BEASTS.find(b => b.type === beast1.beast_type);
        const parent2 = rareBeastConstants_1.RARE_BEASTS.find(b => b.type === beast2.beast_type);
        if (!parent1 || !parent2)
            return { success: false, message: '❌ Lỗi dữ liệu linh thú.' };
        // Offspring inherits random element from one parent
        const offspringElement = Math.random() < 0.5 ? parent1 : parent2;
        const offspringType = offspringElement.type;
        const offspringDef = rareBeastConstants_1.RARE_BEASTS.find(b => b.type === offspringType);
        if (!offspringDef)
            return { success: false, message: '❌ Lỗi tạo linh thú con.' };
        // Chance for mutation (rare)
        const isMutation = Math.random() < 0.15; // 15% mutation chance
        const offspringRarity = isMutation ? 'epic' : offspringDef.rarity;
        // Create offspring
        const info = database_1.default.prepare(`
      INSERT INTO rare_beasts (user_id, beast_type, beast_name, rarity, level, skills)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(userId, offspringType, `${offspringDef.name} Con`, offspringRarity, JSON.stringify([offspringDef.passiveSkill]));
        const mutationText = isMutation ? ' 🎉 **Đột Biến!**' : '';
        return {
            success: true,
            message: `🥚 **Phối Giống Thành Công!**\nĐã tạo **${offspringDef.name} Con** [${offspringRarity}]${mutationText}\nTừ: ${beast1.beast_name} × ${beast2.beast_name}`,
        };
    }
}
exports.rareBeastService = new RareBeastService();
