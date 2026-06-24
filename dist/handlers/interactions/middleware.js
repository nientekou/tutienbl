"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCtx = loadCtx;
exports.loadUser = loadUser;
exports.checkInjury = checkInjury;
exports.requireChecks = requireChecks;
const uiSystem_1 = require("../../utils/uiSystem");
const db = require('../../database/database').default ?? require('../../database/database').db;
function loadCtx(interaction, parts, userId) {
    return { interaction, userId, parts };
}
async function loadUser(ctx) {
    const row = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(ctx.userId);
    if (!row) {
        try {
            await (0, uiSystem_1.safeV2Update)(ctx.interaction, [{ description: '❌ Chưa tạo nhân vật. Dùng `/taonhanvat` để bắt đầu.' }]);
        }
        catch { }
        return false;
    }
    ctx.user = row;
    return true;
}
async function checkInjury(ctx) {
    if (!ctx.user)
        return true;
    const now = Math.floor(Date.now() / 1000);
    if (ctx.user.injury_end_time && ctx.user.injury_end_time > now) {
        const m = Math.ceil((ctx.user.injury_end_time - now) / 60);
        try {
            await (0, uiSystem_1.safeV2Update)(ctx.interaction, [{ description: `❌ Đang bị thương — còn ${m} phút.` }]);
        }
        catch { }
        return false;
    }
    return true;
}
async function requireChecks(ctx, fns, body) {
    for (const fn of fns) {
        if (!(await fn(ctx)))
            return;
    }
    await body();
}
