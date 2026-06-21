"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partyService = void 0;
exports.getStrongestElement = getStrongestElement;
exports.checkPartyElementalCycle = checkPartyElementalCycle;
const discord_js_1 = require("discord.js");
const UserRepository_1 = require("../database/repositories/UserRepository");
class PartyService {
    parties = new discord_js_1.Collection();
    createParty(hostId, dungeonId, maxMembers = 4) {
        const partyId = `party_${Date.now()}_${hostId}`;
        const newParty = {
            id: partyId,
            hostId,
            members: [hostId],
            maxMembers,
            dungeonId,
            status: 'waiting'
        };
        this.parties.set(partyId, newParty);
        return newParty;
    }
    getParty(partyId) {
        return this.parties.get(partyId);
    }
    joinParty(partyId, userId) {
        const party = this.parties.get(partyId);
        if (!party)
            return { success: false, message: 'Phòng này không tồn tại hoặc đã kết thúc.' };
        if (party.status !== 'waiting')
            return { success: false, message: 'Trận chiến đã bắt đầu, không thể tham gia.' };
        if (party.members.includes(userId))
            return { success: false, message: 'Đạo hữu đã ở trong tổ đội này rồi!' };
        if (party.members.length >= party.maxMembers)
            return { success: false, message: 'Tổ đội đã đầy.' };
        party.members.push(userId);
        return { success: true, message: 'Đã tham gia tổ đội thành công!' };
    }
    leaveParty(partyId, userId) {
        const party = this.parties.get(partyId);
        if (!party)
            return { success: false, message: 'Phòng này không tồn tại.' };
        if (party.hostId === userId) {
            // Nếu là chủ phòng rời đi -> giải tán
            this.parties.delete(partyId);
            return { success: true, message: 'Chủ phòng đã rời đi. Tổ đội giải tán.' };
        }
        const index = party.members.indexOf(userId);
        if (index > -1) {
            party.members.splice(index, 1);
            return { success: true, message: 'Đã rời khỏi tổ đội.' };
        }
        return { success: false, message: 'Không tìm thấy đạo hữu trong tổ đội này.' };
    }
    startParty(partyId, userId) {
        const party = this.parties.get(partyId);
        if (!party)
            return { success: false, message: 'Phòng này không tồn tại.' };
        if (party.hostId !== userId)
            return { success: false, message: 'Chỉ chủ phòng mới có quyền bắt đầu.' };
        if (party.status !== 'waiting')
            return { success: false, message: 'Trận chiến này đang diễn ra hoặc đã xong.' };
        party.status = 'in_progress';
        return { success: true, message: 'Trận chiến bắt đầu!', party };
    }
    endParty(partyId) {
        this.parties.delete(partyId);
    }
}
exports.partyService = new PartyService();
function getStrongestElement(userId) {
    const user = UserRepository_1.userRepository.get(userId);
    if (!user || !user.linh_can)
        return '';
    try {
        const lc = JSON.parse(user.linh_can);
        const entries = Object.entries(lc);
        if (entries.length === 0)
            return '';
        let strongest = entries[0][0];
        let maxVal = entries[0][1];
        for (const [el, val] of entries) {
            if (val > maxVal) {
                strongest = el;
                maxVal = val;
            }
        }
        return strongest;
    }
    catch (e) {
        return '';
    }
}
function checkPartyElementalCycle(memberIds) {
    const elementSet = new Set();
    for (const mId of memberIds) {
        const el = getStrongestElement(mId);
        if (el)
            elementSet.add(el);
    }
    const cycles = [
        { elements: ['Mộc', 'Hỏa', 'Thổ'], name: 'Mộc 🪵 -> Hỏa 🔥 -> Thổ 🪨' },
        { elements: ['Hỏa', 'Thổ', 'Kim'], name: 'Hỏa 🔥 -> Thổ 🪨 -> Kim 🗡️' },
        { elements: ['Thổ', 'Kim', 'Thủy'], name: 'Thổ 🪨 -> Kim 🗡️ -> Thủy 💧' },
        { elements: ['Kim', 'Thủy', 'Mộc'], name: 'Kim 🗡️ -> Thủy 💧 -> Mộc 🪵' },
        { elements: ['Thủy', 'Mộc', 'Hỏa'], name: 'Thủy 💧 -> Mộc 🪵 -> Hỏa 🔥' }
    ];
    for (const cycle of cycles) {
        if (cycle.elements.every(el => elementSet.has(el))) {
            return {
                active: true,
                text: `✨ **Ngũ Hành Trận Pháp:** Đang kích hoạt chuỗi tương sinh **[${cycle.name}]**! Buff **+10% Công & Thủ** cho toàn đội.`
            };
        }
    }
    return {
        active: false,
        text: '⚠️ Đội hình chưa tạo thành chu trình tương sinh Ngũ Hành (Cần ít nhất 3 thành viên tạo chu trình tương sinh để nhận +10% Công & Thủ).'
    };
}
