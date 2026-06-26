"use strict";
// B-06: Load Testing
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTestRunner = void 0;
class LoadTestRunner {
    /**
     * B-06: Run a load test
     */
    async runLoadTest(name, testFn, options = {}) {
        const { concurrency = 10, duration = 10000, rampUp = 1000 } = options;
        const startTime = Date.now();
        let successes = 0;
        let failures = 0;
        let totalResponseTime = 0;
        const activePromises = [];
        const runSingle = async () => {
            const reqStart = Date.now();
            try {
                const result = await testFn();
                if (result)
                    successes++;
                else
                    failures++;
            }
            catch {
                failures++;
            }
            totalResponseTime += Date.now() - reqStart;
        };
        // Ramp up
        for (let i = 0; i < concurrency; i++) {
            await new Promise(resolve => setTimeout(resolve, rampUp / concurrency));
            activePromises.push(runSingle());
        }
        // Wait for duration
        await new Promise(resolve => setTimeout(resolve, duration));
        const elapsed = (Date.now() - startTime) / 1000;
        const totalRequests = successes + failures;
        return {
            name,
            duration: Math.round(elapsed * 1000),
            requests: totalRequests,
            successes,
            failures,
            avgResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
            requestsPerSecond: Math.round(totalRequests / elapsed)
        };
    }
    /**
     * B-06: Get load test description
     */
    getLoadTestDescription(result) {
        let msg = `📊 **Load Test: ${result.name}**\n`;
        msg += `⏱️ Duration: **${result.duration}ms**\n`;
        msg += `📈 Requests: **${result.requests}**\n`;
        msg += `✅ Successes: **${result.successes}**\n`;
        msg += `❌ Failures: **${result.failures}**\n`;
        msg += `⏱️ Avg Response: **${result.avgResponseTime}ms**\n`;
        msg += `🚀 RPS: **${result.requestsPerSecond}**\n`;
        return msg;
    }
}
exports.loadTestRunner = new LoadTestRunner();
