"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const UserRepository_1 = require("./database/repositories/UserRepository");
const MinigameService_1 = require("./services/MinigameService");
const CultivationService_1 = require("./services/CultivationService");
const database_2 = __importDefault(require("./database/database"));
console.log('=== CHẠY KIỂM THỬ TỰ ĐỘNG CÁC TÍNH NĂNG MINIGAMES (QUẺ XĂM & QUYẾT ĐẤU) ===');
try {
    // 1. Khởi tạo DB
    (0, database_1.initDatabase)();
    const userA = '888888888888888881';
    const userB = '888888888888888882';
    // Dọn dẹp dữ liệu cũ
    database_2.default.prepare('DELETE FROM users WHERE discord_id = ?').run(userA);
    database_2.default.prepare('DELETE FROM users WHERE discord_id = ?').run(userB);
    database_2.default.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(userA);
    database_2.default.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(userB);
    // Khởi tạo nhân vật test A
    UserRepository_1.userRepository.create({
        discord_id: userA,
        name: 'Lâm Phàm',
        base_hp: 200,
        base_mp: 100,
        base_atk: 30,
        base_def: 15,
        base_crit: 0.05,
        base_crit_res: 0.0,
        base_luck: 10,
        linh_can: JSON.stringify({ 'Hỏa': 100 })
    });
    // Khởi tạo nhân vật test B
    UserRepository_1.userRepository.create({
        discord_id: userB,
        name: 'Tiêu Viêm',
        base_hp: 250,
        base_mp: 80,
        base_atk: 35,
        base_def: 12,
        base_crit: 0.08,
        base_crit_res: 0.01,
        base_luck: 12,
        linh_can: JSON.stringify({ 'Hỏa': 70, 'Thổ': 30 })
    });
    console.log('✅ Khởi tạo thành công hai nhân vật test: Lâm Phàm và Tiêu Viêm.');
    // Cho mỗi người 1000 Linh Thạch để cược
    UserRepository_1.userRepository.update(userA, { coin_ha_pham: 1000 });
    UserRepository_1.userRepository.update(userB, { coin_ha_pham: 1000 });
    // ============================================
    // 2. KIỂM THỬ DAILY FORTUNE STICKS (/quexam)
    // ============================================
    console.log('\n--- 2. Kiểm Thử Quẻ Xăm Chiêm Bốc Hàng Ngày ---');
    // Lần rút đầu tiên
    const draw1 = MinigameService_1.minigameService.drawFortuneStick(userA);
    console.log(`- Lần rút 1: ${draw1.success ? 'THÀNH CÔNG (Đúng)' : 'THẤT BẠI (Sai)'}`);
    console.log(`  Outcome: ${draw1.title} | Biến động Linh Thạch: ${draw1.coinDiff} | Biến động May Mắn: ${draw1.luckDiff}`);
    const userAAfterDraw = UserRepository_1.userRepository.get(userA);
    console.log(`  Linh Thạch hiện tại: ${userAAfterDraw.coin_ha_pham} | May Mắn hiện tại: ${userAAfterDraw.base_luck}`);
    // Thử rút lần thứ 2 khi còn cooldown
    const draw2 = MinigameService_1.minigameService.drawFortuneStick(userA);
    console.log(`- Lần rút 2 (Cooldown): ${!draw2.success && draw2.cooldownRemaining !== undefined ? 'BỊ CHẶN VÀ HIỂN THỊ COOLDOWN THÀNH CÔNG (Đúng)' : 'LỖI RÚT ĐƯỢC THẺ XĂM (Sai)'}`);
    if (draw2.cooldownRemaining) {
        console.log(`  Thời gian hồi còn lại: ${draw2.cooldownRemaining} giây`);
    }
    // Thử đột phá cấp độ nhỏ xem May Mắn có bị reset về 10 không
    console.log('\n- Kiểm thử bảo toàn May Mắn khi đột phá cảnh giới:');
    const initialLuck = userAAfterDraw.base_luck;
    // Thiết lập đủ tu vi để đột phá
    UserRepository_1.userRepository.update(userA, { tu_vi: 200, exp_needed: 100 });
    const breakthroughResult = CultivationService_1.cultivationService.breakthrough(userA, false);
    console.log(`  Kết quả đột phá: ${breakthroughResult.success ? 'THÀNH CÔNG' : 'THẤT BẠI'}`);
    const userAAfterBreak = UserRepository_1.userRepository.get(userA);
    console.log(`  May Mắn trước đột phá: ${initialLuck} | May Mắn sau đột phá: ${userAAfterBreak.base_luck}`);
    if (userAAfterBreak.base_luck === initialLuck) {
        console.log('  ✅ Bảo toàn May Mắn thành công khi đột phá!');
    }
    else {
        throw new Error('❌ May Mắn bị reset về 10 sau khi đột phá!');
    }
    // ============================================
    // 3. KIỂM THỬ QUYẾT ĐẤU WAGER DUELS (/quyetau)
    // ============================================
    console.log('\n--- 3. Kiểm Thử Quyết Đấu Oẳn Tù Tì Đặt Cược ---');
    // Lời khiêu chiến không đủ tiền
    UserRepository_1.userRepository.update(userA, { coin_ha_pham: 5 }); // Set còn 5 tiền
    const challengeLowMoney = MinigameService_1.minigameService.createChallenge(userA, userB, 100);
    console.log(`- Khiêu chiến khi bản thân thiếu tiền: ${!challengeLowMoney.success ? 'BỊ TỪ CHỐI THÀNH CÔNG (Đúng)' : 'LỖI: TẠO ĐƯỢC KÈO (Sai)'}`);
    console.log(`  Thông điệp hệ thống: "${challengeLowMoney.message}"`);
    // Phục hồi tiền
    UserRepository_1.userRepository.update(userA, { coin_ha_pham: 1000 });
    UserRepository_1.userRepository.update(userB, { coin_ha_pham: 5 }); // Set đối thủ còn 5 tiền
    const challengeOpponentLowMoney = MinigameService_1.minigameService.createChallenge(userA, userB, 100);
    console.log(`- Khiêu chiến khi đối thủ thiếu tiền: ${!challengeOpponentLowMoney.success ? 'BỊ TỪ CHỐI THÀNH CÔNG (Đúng)' : 'LỖI: TẠO ĐƯỢC KÈO (Sai)'}`);
    console.log(`  Thông điệp hệ thống: "${challengeOpponentLowMoney.message}"`);
    // Phục hồi tiền đối thủ
    UserRepository_1.userRepository.update(userB, { coin_ha_pham: 1000 });
    // Lời khiêu chiến hợp lệ
    const challengeOk = MinigameService_1.minigameService.createChallenge(userA, userB, 200);
    console.log(`- Lời khiêu chiến hợp lệ: ${challengeOk.success && challengeOk.duel ? 'THÀNH CÔNG (Đúng)' : 'THẤT BẠI (Sai)'}`);
    const duel = challengeOk.duel;
    console.log(`  Mã quyết đấu: ${duel.id} | Tiền cược: ${duel.wager} | Trạng thái: ${duel.status}`);
    // Thử chấp nhận thách đấu từ người thứ 3 (không hợp lệ)
    const acceptWrong = MinigameService_1.minigameService.acceptChallenge(duel.id, 'someone_else');
    console.log(`- Người lạ chấp nhận lời thách đấu: ${!acceptWrong.success ? 'BỊ CHẶN THÀNH CÔNG (Đúng)' : 'LỖI: CHẤP NHẬN ĐƯỢC (Sai)'}`);
    // Chấp nhận thách đấu hợp lệ
    const acceptOk = MinigameService_1.minigameService.acceptChallenge(duel.id, userB);
    console.log(`- Đối thủ chấp nhận lời thách đấu: ${acceptOk.success && acceptOk.duel?.status === 'accepted' ? 'THÀNH CÔNG (Đúng)' : 'THẤT BẠI (Sai)'}`);
    // Thử ra chiêu: Người chơi A ra Kiếm Pháp, Người chơi B ra Hộ Thể (Hộ Thể thắng Kiếm Pháp)
    console.log('\n- Bắt đầu ra chiêu quyết đấu:');
    const moveA = MinigameService_1.minigameService.chooseMove(duel.id, userA, 'kiem');
    console.log(`  Lâm Phàm ra chiêu Kiếm Pháp: ${moveA.success && moveA.duel?.challengerChoice === 'kiem' ? 'ĐỒNG Ý (Đúng)' : 'LỖI (Sai)'}`);
    // Thử đổi chiêu
    const moveA2 = MinigameService_1.minigameService.chooseMove(duel.id, userA, 'phu');
    console.log(`  Lâm Phàm thử đổi chiêu sang Phù Pháp: ${!moveA2.success ? 'BỊ CHẶN THÀNH CÔNG (Đúng)' : 'LỖI: ĐỔI ĐƯỢC (Sai)'}`);
    // Người chơi B ra chiêu Hộ Thể -> Kèo hoàn thành, B thắng
    const moveB = MinigameService_1.minigameService.chooseMove(duel.id, userB, 'hothe');
    console.log(`  Tiêu Viêm ra chiêu Hộ Thể: ${moveB.success && moveB.duel?.status === 'completed' ? 'KẾT THÚC THÀNH CÔNG (Đúng)' : 'LỖI (Sai)'}`);
    console.log(`  Người thắng cuộc: ${moveB.winnerId === userB ? 'Tiêu Viêm (Đúng)' : 'Lâm Phàm (Sai)'}`);
    console.log(`  Tiền thắng cuộc nhận được (Trừ 5% thuế trên tổng hũ cược 400): +${moveB.winnings} (Thuế: ${moveB.tax})`);
    // Kiểm tra tài sản trong DB của hai bên sau trận đấu
    const balanceA = UserRepository_1.userRepository.get(userA).coin_ha_pham;
    const balanceB = UserRepository_1.userRepository.get(userB).coin_ha_pham;
    console.log(`  Linh Thạch Lâm Phàm sau trận (cược 200, thua): ${balanceA} (Đúng = 800)`);
    console.log(`  Linh Thạch Tiêu Viêm sau trận (cược 200, thắng): ${balanceB} (Đúng = 1180)`);
    if (balanceA === 800 && balanceB === 1180) {
        console.log('✅ Đạt chuẩn: Kết chuyển Linh Thạch của quyết đấu hoàn toàn chính xác!');
    }
    else {
        throw new Error(`Kết chuyển Linh Thạch sai: A=${balanceA}, B=${balanceB}`);
    }
    // ============================================
    // 4. KIỂM THỬ TRẬN ĐẤU HÒA
    // ============================================
    console.log('\n--- 4. Kiểm Thử Quyết Đấu Trận Hòa ---');
    // Tạo khiêu chiến mới
    const challengeTie = MinigameService_1.minigameService.createChallenge(userA, userB, 100);
    const duelTie = challengeTie.duel;
    MinigameService_1.minigameService.acceptChallenge(duelTie.id, userB);
    // Cả hai cùng ra Kiếm Pháp
    MinigameService_1.minigameService.chooseMove(duelTie.id, userA, 'kiem');
    const moveTieResult = MinigameService_1.minigameService.chooseMove(duelTie.id, userB, 'kiem');
    console.log(`- Kết quả đấu pháp: ${moveTieResult.isTie ? 'HÒA (Đúng)' : 'THẮNG THUA (Sai)'}`);
    // Kiểm tra tài sản trong DB phải giữ nguyên không bị trừ thuế
    const balanceATie = UserRepository_1.userRepository.get(userA).coin_ha_pham;
    const balanceBTie = UserRepository_1.userRepository.get(userB).coin_ha_pham;
    console.log(`  Linh Thạch Lâm Phàm sau trận hòa: ${balanceATie} (Đúng = 800)`);
    console.log(`  Linh Thạch Tiêu Viêm sau trận hòa: ${balanceBTie} (Đúng = 1180)`);
    if (balanceATie === 800 && balanceBTie === 1180) {
        console.log('✅ Đạt chuẩn: Trận hòa không khấu trừ tiền cược và thuế!');
    }
    else {
        throw new Error('Lỗi hoàn trả tiền cược trận hòa.');
    }
    console.log('\n🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ ĐẠT CHUẨN VÀ ĐỀU VƯỢT QUA THÀNH CÔNG! 🎉');
}
catch (error) {
    console.error('\n❌ PHÁT HIỆN LỖI TRONG QUÁ TRÌNH KIỂM THỬ:');
    console.error(error);
    process.exit(1);
}
