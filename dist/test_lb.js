"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const LeaderboardService_1 = require("./services/LeaderboardService");
async function main() {
    console.log('Initializing database...');
    (0, database_1.initDatabase)();
    console.log('Testing getTopCombatPower...');
    try {
        const cp = LeaderboardService_1.leaderboardService.getTopCombatPower(5);
        console.log(`Success: found ${cp.length} entries`);
    }
    catch (e) {
        console.error('Error in getTopCombatPower:', e);
    }
    console.log('Testing getTopRealm...');
    try {
        const realm = LeaderboardService_1.leaderboardService.getTopRealm(5);
        console.log(`Success: found ${realm.length} entries`);
    }
    catch (e) {
        console.error('Error in getTopRealm:', e);
    }
    console.log('Testing getTopWealth...');
    try {
        const wealth = LeaderboardService_1.leaderboardService.getTopWealth(5);
        console.log(`Success: found ${wealth.length} entries`);
    }
    catch (e) {
        console.error('Error in getTopWealth:', e);
    }
    console.log('Testing getTopSectContribution...');
    try {
        const sect = LeaderboardService_1.leaderboardService.getTopSectContribution(5);
        console.log(`Success: found ${sect.length} entries`);
    }
    catch (e) {
        console.error('Error in getTopSectContribution:', e);
    }
    console.log('Testing getTopArena...');
    try {
        const arena = LeaderboardService_1.leaderboardService.getTopArena(5);
        console.log(`Success: found ${arena.length} entries`);
    }
    catch (e) {
        console.error('Error in getTopArena:', e);
    }
    console.log('Testing getTopAlchemy...');
    try {
        const alc = LeaderboardService_1.leaderboardService.getTopAlchemy(5);
        console.log(`Success: found ${alc.length} entries`);
    }
    catch (e) {
        console.error('Error in getTopAlchemy:', e);
    }
    console.log('Testing getTopForging...');
    try {
        const forge = LeaderboardService_1.leaderboardService.getTopForging(5);
        console.log(`Success: found ${forge.length} entries`);
    }
    catch (e) {
        console.error('Error in getTopForging:', e);
    }
    console.log('All tests completed.');
}
main().catch(console.error);
