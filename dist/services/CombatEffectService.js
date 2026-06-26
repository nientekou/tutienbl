"use strict";
// E-02: Combat Effects System
Object.defineProperty(exports, "__esModule", { value: true });
exports.combatEffectService = exports.EFFECT_DEFINITIONS = void 0;
// E-02: Effect definitions
exports.EFFECT_DEFINITIONS = {
    burn: { name: 'Hoả Thú', description: 'Sát thương theo thời gian + tăng sát thương', maxStacks: 3, defaultDuration: 3, isDebuff: true },
    poison: { name: 'Độc', description: 'Sát thương theo thời gian + giảm sát thương', maxStacks: 3, defaultDuration: 3, isDebuff: true },
    bleed: { name: 'Chảy Máu', description: 'Sát thương theo thời gian + giảm hồi phục', maxStacks: 3, defaultDuration: 3, isDebuff: true },
    curse: { name: 'Nguyền Rủa', description: 'Sát thương theo thời gian + giảm chỉ số', maxStacks: 2, defaultDuration: 2, isDebuff: true },
    stun: { name: 'Tê Liệt', description: 'Không thể hành động 1 lượt', maxStacks: 1, defaultDuration: 1, isDebuff: true },
    freeze: { name: 'Đóng Băng', description: 'Không thể hành động + nhận thêm sát thương', maxStacks: 1, defaultDuration: 1, isDebuff: true },
    root: { name: 'Gốc Rễ', description: 'Không thể né tránh', maxStacks: 1, defaultDuration: 2, isDebuff: true },
    sleep: { name: 'Ngủ', description: 'Không thể hành động đến khi bị tấn công', maxStacks: 1, defaultDuration: 2, isDebuff: true },
    confusion: { name: 'Hỗn Loạn', description: '50% tấn công đồng đội', maxStacks: 1, defaultDuration: 2, isDebuff: true },
    silence: { name: 'Câm Tính', description: 'Không thể dùng kỹ năng', maxStacks: 1, defaultDuration: 2, isDebuff: true },
    blind: { name: 'Mù Loà', description: '-50% độ chính xác', maxStacks: 1, defaultDuration: 2, isDebuff: true },
    weakness: { name: 'Yếu Rớt', description: '-30% sát thương', maxStacks: 2, defaultDuration: 3, isDebuff: true },
    vulnerability: { name: 'Lỗ Hổng', description: '+30% sát thương nhận vào', maxStacks: 2, defaultDuration: 3, isDebuff: true },
    haste: { name: 'Tốc Hành', description: '+30% tốc độ', maxStacks: 1, defaultDuration: 3, isDebuff: false },
    shield: { name: 'Khiên', description: 'Hấp thụ sát thương', maxStacks: 1, defaultDuration: 3, isDebuff: false },
};
class CombatEffectService {
    /**
     * E-02: Create a combat effect
     */
    createEffect(type, value, source, duration) {
        const def = exports.EFFECT_DEFINITIONS[type];
        return {
            type,
            value,
            duration: duration || def.defaultDuration,
            source,
            stacks: 1,
            maxStacks: def.maxStacks
        };
    }
    /**
     * E-02: Apply effect to target
     */
    applyEffect(effects, newEffect) {
        const existing = effects.find(e => e.type === newEffect.type);
        if (existing) {
            // Stack or refresh
            if (existing.stacks < existing.maxStacks) {
                existing.stacks = Math.min(existing.stacks + 1, existing.maxStacks);
                existing.duration = Math.max(existing.duration, newEffect.duration);
            }
            else {
                existing.duration = Math.max(existing.duration, newEffect.duration);
            }
        }
        else {
            effects.push({ ...newEffect });
        }
        return effects;
    }
    /**
     * E-02: Process effects at start of turn
     */
    processEffects(effects) {
        let totalDamage = 0;
        let totalHeal = 0;
        const log = [];
        for (const effect of effects) {
            if (effect.type === 'burn' || effect.type === 'poison' || effect.type === 'bleed' || effect.type === 'curse') {
                const dmg = Math.round(effect.value * effect.stacks);
                totalDamage += dmg;
                log.push(`${exports.EFFECT_DEFINITIONS[effect.type].name}: -${dmg} HP`);
            }
            if (effect.type === 'haste') {
                log.push(`${exports.EFFECT_DEFINITIONS[effect.type].name}: +${Math.round(effect.value * 100)}% Speed`);
            }
            if (effect.type === 'shield') {
                log.push(`${exports.EFFECT_DEFINITIONS[effect.type].name}: Shield active`);
            }
        }
        // Decrement durations
        for (let i = effects.length - 1; i >= 0; i--) {
            effects[i].duration--;
            if (effects[i].duration <= 0) {
                effects.splice(i, 1);
            }
        }
        return { damage: totalDamage, heal: totalHeal, log };
    }
    /**
     * E-02: Check if target is stunned/frozen/sleeping
     */
    isCC(effects) {
        return effects.some(e => e.type === 'stun' || e.type === 'freeze' || e.type === 'sleep');
    }
    /**
     * E-02: Check if target is silenced
     */
    isSilenced(effects) {
        return effects.some(e => e.type === 'silence');
    }
    /**
     * E-02: Get effect description for UI
     */
    getEffectsDescription(effects) {
        if (effects.length === 0)
            return 'Không có hiệu ứng nào';
        let msg = `**Hiệu ứng đang có:**\n`;
        for (const effect of effects) {
            const def = exports.EFFECT_DEFINITIONS[effect.type];
            const emoji = effect.type === 'burn' ? '🔥' : effect.type === 'poison' ? '☠️' :
                effect.type === 'stun' ? '💫' : effect.type === 'shield' ? '🛡️' : '✨';
            msg += `${emoji} **${def.name}** (${effect.duration}t, ${effect.stacks}x)\n`;
        }
        return msg;
    }
}
exports.combatEffectService = new CombatEffectService();
