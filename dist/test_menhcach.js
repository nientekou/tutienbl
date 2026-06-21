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
const DestinyService_1 = require("./services/DestinyService");
const DestinyRepository_1 = require("./database/repositories/DestinyRepository");
async function testMenhCach() {
    console.log('🔮 Bắt đầu kiểm tra Mệnh Cách...');
    (0, database_1.initDatabase)();
    const testUser = 'test_user_menhcach';
    database_1.default.prepare('DELETE FROM users WHERE discord_id = ?').run(testUser);
    database_1.default.prepare('DELETE FROM user_destinies WHERE user_id = ?').run(testUser);
    UserRepository_1.userRepository.create({
        discord_id: testUser,
        name: 'Mệnh Cách Tử',
        base_hp: 1000,
        base_mp: 500,
        base_atk: 100,
        base_def: 50,
        base_crit: 0.05,
        base_crit_res: 0.01,
        base_luck: 10,
        linh_can: JSON.stringify({ 'Hỏa': 100 }),
        coin_ha_pham: 50000
    });
    const user = UserRepository_1.userRepository.get(testUser);
    console.log(`Đã tạo test user: ${user.name}, Linh Thạch: ${user.coin_ha_pham}`);
    // Test boi-que
    console.log('-> Đang bốc quẻ (rollGacha)...');
    try {
        const rollRes = DestinyService_1.destinyService.rollGacha(testUser);
        console.log(`RollGacha Result: Success=${rollRes.success}, Message=${rollRes.message}`);
    }
    catch (e) {
        console.error('❌ Lỗi khi bốc quẻ:', e);
    }
    // Test tu-do
    console.log('-> Đang kiểm tra túi đồ Mệnh Cách...');
    try {
        const destinies = DestinyRepository_1.destinyRepository.getUserDestinies(testUser);
        console.log(`Đã bốc quẻ được ${destinies.length} mệnh cách.`);
        // Test slot count
        const maxSlots = DestinyService_1.destinyService.getMaxSlotsByRealm('Trúc Cơ Kỳ');
        console.log(`Max slots cho Trúc Cơ Kỳ: ${maxSlots}`);
    }
    catch (e) {
        console.error('❌ Lỗi khi đọc tủ đồ:', e);
    }
}
testMenhCach().catch(e => console.error(e));
