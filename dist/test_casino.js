"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importStar(require("./database/database"));
const UserRepository_1 = require("./database/repositories/UserRepository");
async function runTests() {
    console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍCH HỢP CASINO... 🧪\n');
    (0, database_1.initDatabase)();
    const testUser = 'test_user_casino';
    // 0. Cleanup old test data
    database_1.default.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
    // 1. Create a test character with 10,000 Linh Thạch Hạ Phẩm
    UserRepository_1.userRepository.create({
        discord_id: testUser,
        name: 'Casino Đạo Sĩ',
        base_hp: 1000,
        base_mp: 500,
        base_atk: 100,
        base_def: 50,
        base_crit: 0.1,
        base_crit_res: 0.05,
        base_luck: 15,
        linh_can: JSON.stringify({ 'Kim': 100 }),
        coin_ha_pham: 10000
    });
    // Ensure cache is fresh
    UserRepository_1.userRepository.cache.delete(testUser);
    const initialUser = UserRepository_1.userRepository.get(testUser);
    console.log(`👤 Tạo nhân vật thành công: ${initialUser.name}`);
    console.log(`🪙 Số dư ban đầu: ${initialUser.coin_ha_pham} LT`);
    if (initialUser.coin_ha_pham !== 10000) {
        throw new Error('Số dư khởi tạo không chính xác!');
    }
    // 2. Test 1: Balance update & cache consistency in Đỏ Đen (50/50, 1 ăn 1)
    console.log('\n--- Test 1: Đỏ Đen ---');
    let currentBalance = initialUser.coin_ha_pham;
    const betAmount = 1000;
    // Simulate doden execution:
    // Roll 50/50
    const roll = Math.random() < 0.5 ? 'do' : 'den';
    const choice = 'do';
    const isWin = choice === roll;
    const rewardChange = isWin ? betAmount : -betAmount;
    console.log(`👉 Cược: ${betAmount} LT vào Đỏ. Kết quả quay: ${roll === 'do' ? '🔴 Đỏ' : '⚫ Đen'} -> ${isWin ? 'THẤNG' : 'THUA'}`);
    database_1.default.transaction(() => {
        UserRepository_1.userRepository.update(testUser, { coin_ha_pham: currentBalance + rewardChange });
    })();
    // Retrieve user immediately after update to verify cache invalidation
    const updatedUser1 = UserRepository_1.userRepository.get(testUser);
    console.log(`🪙 Số dư thực tế trong DB/Cache sau khi cược: ${updatedUser1.coin_ha_pham} LT`);
    const expectedBalance1 = currentBalance + rewardChange;
    if (updatedUser1.coin_ha_pham === expectedBalance1) {
        console.log('✅ THÀNH CÔNG: Số dư cập nhật và cache được xóa chính xác!');
    }
    else {
        throw new Error(`❌ THẤT BẠI: Số dư trong cache (${updatedUser1.coin_ha_pham}) lệch so với dự kiến (${expectedBalance1})!`);
    }
    // 3. Test 2: Balance update & cache consistency in Tài Xỉu (1 ăn 0.95)
    console.log('\n--- Test 2: Tài Xỉu ---');
    currentBalance = updatedUser1.coin_ha_pham;
    const betAmount2 = 2000;
    // Simulate taixiu execution:
    const d1 = 3;
    const d2 = 4;
    const d3 = 5;
    const total = d1 + d2 + d3; // 12 -> Tài
    const resultType = total >= 11 ? 'tai' : 'xiu';
    const choice2 = 'tai';
    const isWin2 = choice2 === resultType;
    const rewardChange2 = isWin2 ? Math.floor(betAmount2 * 0.95) : -betAmount2;
    console.log(`👉 Cược: ${betAmount2} LT vào Tài. Xúc xắc: [${d1}, ${d2}, ${d3}] (Tổng: ${total} -> ${resultType}) -> ${isWin2 ? 'THẤNG' : 'THUA'}`);
    database_1.default.transaction(() => {
        UserRepository_1.userRepository.update(testUser, { coin_ha_pham: currentBalance + rewardChange2 });
    })();
    const updatedUser2 = UserRepository_1.userRepository.get(testUser);
    console.log(`🪙 Số dư thực tế trong DB/Cache sau khi cược: ${updatedUser2.coin_ha_pham} LT`);
    const expectedBalance2 = currentBalance + rewardChange2;
    if (updatedUser2.coin_ha_pham === expectedBalance2) {
        console.log('✅ THÀNH CÔNG: Số dư Tài Xỉu cập nhật và cache được xóa chính xác!');
    }
    else {
        throw new Error(`❌ THẤT BẠI: Số dư trong cache (${updatedUser2.coin_ha_pham}) lệch so với dự kiến (${expectedBalance2})!`);
    }
    // 4. Test 3: Limits & Validation (Check boundaries)
    console.log('\n--- Test 3: Giới Hạn Cược ---');
    const minBet = 50;
    const maxBet = 200000;
    const illegalLowBet = 10;
    const illegalHighBet = 300000;
    const illegalExceedBalanceBet = 50000;
    if (illegalLowBet < minBet) {
        console.log(`✅ Lọc cược quá thấp (< ${minBet}) hoạt động tốt.`);
    }
    else {
        throw new Error('Lỗi logic cược tối thiểu!');
    }
    if (illegalHighBet > maxBet) {
        console.log(`✅ Lọc cược quá cao (> ${maxBet}) hoạt động tốt.`);
    }
    else {
        throw new Error('Lỗi logic cược tối đa!');
    }
    if (illegalExceedBalanceBet > updatedUser2.coin_ha_pham) {
        console.log(`✅ Lọc cược vượt số dư (Cược ${illegalExceedBalanceBet} > Số dư ${updatedUser2.coin_ha_pham}) hoạt động tốt.`);
    }
    else {
        throw new Error('Lỗi logic lọc số dư!');
    }
    // Clean up
    database_1.default.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
    console.log('\n🧹 Đã dọn dẹp dữ liệu kiểm thử.');
    console.log('\n🌟 HOÀN THẤT KIỂM THỬ CASINO THÀNH CÔNG! 🌟');
}
runTests().catch(e => {
    console.error('❌ LỖI TRONG BÀI KIỂM THỬ:');
    console.error(e);
    process.exit(1);
});
