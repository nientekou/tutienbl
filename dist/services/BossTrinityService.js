"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bossTrinityService = void 0;
// V13 B-03: Tam Tinh Liên Đài (Boss Trinity)
const database_1 = __importDefault(require("../database/database"));
const TRINITY_BOSSES = [
    { id: 1, name: 'Hỏa Ma Vương', element: 'Hỏa', immuneElements: ['Hỏa'], weakElements: ['Thủy'], baseHp: 50000, baseAtk: 3000, baseDef: 2000 },
    { id: 2, name: 'Thủy Tinh Nữ', element: 'Thủy', immuneElements: ['Thủy'], weakElements: ['Lôi'], baseHp: 60000, baseAtk: 3500, baseDef: 2500 },
    { id: 3, name: 'Hỏa Thủy Song Đế', element: 'Hỏa', immuneElements: ['Hỏa', 'Thủy'], weakElements: ['Mộc', 'Kim'], baseHp: 80000, baseAtk: 4000, baseDef: 3000 },
];
class BossTrinityService {
    initTable() {
        database_1.default.exec(`
      CREATE TABLE IF NOT EXISTS boss_trinity_runs (
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        boss_index INTEGER DEFAULT 0,
        enrages INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, date)
      );
    `);
    }
    getToday() {
        return new Date().toISOString().slice(0, 10);
    }
    canEnter(userId, userLevel) {
        this.initTable();
        if (userLevel < 100)
            return { eligible: false, reason: 'Cần level 100+' };
        const today = this.getToday();
        const run = database_1.default.prepare('SELECT completed FROM boss_trinity_runs WHERE user_id = ? AND date = ?')
            .get(userId, today);
        if (run?.completed)
            return { eligible: false, reason: 'Đã hoàn thành Tam Tinh Liên Đài hôm nay.' };
        return { eligible: true, reason: '' };
    }
    getBoss(bossIndex) {
        return TRINITY_BOSSES[bossIndex] || null;
    }
    getProgress(userId) {
        this.initTable();
        const today = this.getToday();
        return database_1.default.prepare('SELECT * FROM boss_trinity_runs WHERE user_id = ? AND date = ?')
            .get(userId, today);
    }
    /**
     * Called after combat with a trinity boss.
     * Determines if boss was enraged and updates progress.
     */
    recordCombatResult(userId, bossIndex, usedImmuneElement) {
        this.initTable();
        const today = this.getToday();
        let run = this.getProgress(userId);
        if (!run) {
            database_1.default.prepare('INSERT INTO boss_trinity_runs (user_id, date, boss_index, enrages, completed) VALUES (?, ?, 0, 0, 0)')
                .run(userId, today);
            run = this.getProgress(userId);
        }
        let enrages = run.enrages;
        let enrageTriggered = false;
        if (usedImmuneElement) {
            enrages++;
            enrageTriggered = true;
        }
        const nextBoss = bossIndex + 1;
        const allCleared = bossIndex >= 2; // 0-indexed, 3 bosses
        if (allCleared) {
            database_1.default.prepare('UPDATE boss_trinity_runs SET enrages = ?, completed = 1, boss_index = 3 WHERE user_id = ? AND date = ?')
                .run(enrages, userId, today);
        }
        else {
            database_1.default.prepare('UPDATE boss_trinity_runs SET enrages = ?, boss_index = ? WHERE user_id = ? AND date = ?')
                .run(enrages, nextBoss, userId, today);
        }
        return { nextBoss: allCleared ? null : nextBoss, enrageTriggered, allCleared };
    }
    getEfficiency(userId) {
        const run = this.getProgress(userId);
        if (!run || !run.completed)
            return 'normal';
        if (run.enrages === 0)
            return 'perfect';
        if (run.enrages === 1)
            return 'good';
        return 'normal';
    }
    getRewardsMultiplier(userId) {
        const eff = this.getEfficiency(userId);
        if (eff === 'perfect')
            return 3.0;
        if (eff === 'good')
            return 2.0;
        return 1.0;
    }
    getDescription(userId) {
        const run = this.getProgress(userId);
        let msg = '**Tam Tinh Liên Đài** — 3 Boss tuần tự\n';
        msg += 'Mỗi boss immune 1 element, yếu element khác.\n';
        msg += 'Dùng element immune → boss enraged (+50% ATK, +30% DEF)\n\n';
        for (let i = 0; i < 3; i++) {
            const boss = TRINITY_BOSSES[i];
            const cleared = run && ((run.completed && i <= run.boss_index) || i < run.boss_index);
            const status = cleared ? '✅' : run?.boss_index === i ? '⚔️' : '🔒';
            msg += `${status} **${boss.name}** — Immune: ${boss.immuneElements.join(', ')} | Yếu: ${boss.weakElements.join(', ')}\n`;
        }
        if (run?.completed) {
            const eff = this.getEfficiency(userId);
            const mult = this.getRewardsMultiplier(userId);
            msg += `\nKết quả: **${eff.toUpperCase()}** (${run.enrages} enrages) → x${mult} rewards`;
        }
        return msg;
    }
}
exports.bossTrinityService = new BossTrinityService();
