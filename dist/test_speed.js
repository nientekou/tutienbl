"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database/database");
const bangphongthan_1 = require("./commands/general/bangphongthan");
async function main() {
    console.log('Initializing database...');
    (0, database_1.initDatabase)();
    const userId = '1234567890';
    const categories = ['combatPower', 'realm', 'wealth', 'sectContribution', 'arena', 'alchemy', 'forging'];
    for (const cat of categories) {
        const start = Date.now();
        try {
            (0, bangphongthan_1.buildLeaderboardMessage)(userId, cat, 1);
            const duration = Date.now() - start;
            console.log(`Category: ${cat} -> ${duration}ms`);
        }
        catch (e) {
            console.error(`Error in ${cat}:`, e);
        }
    }
}
main().catch(console.error);
