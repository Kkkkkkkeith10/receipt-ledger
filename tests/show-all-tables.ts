import { execSync } from 'child_process';

const tables = ['receipts', 'transactions', 'users', 'sessions', 'app_settings'];

console.log('\n📊 Remote D1 Database Contents\n');

for (const table of tables) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    try {
        const result = execSync(
            `pnpm wrangler d1 execute accounting-db --remote --command "SELECT * FROM ${table}"`,
            { encoding: 'utf8', cwd: process.cwd() }
        );
        console.log(result);
    } catch (e: any) {
        console.log(e.stdout || e.message);
    }
}
