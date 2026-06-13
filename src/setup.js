const readline = require('readline');
const fs = require('fs');
const { getConfigPath } = require('./paths');

function ask(rl, question, defaultValue = '') {
    const suffix = defaultValue ? ` (default: ${defaultValue})` : '';
    return new Promise(resolve => {
        rl.question(`  ${question}${suffix}: `, answer => {
            resolve(answer.trim() || defaultValue);
        });
    });
}

async function runSetup() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║     FiveM Vault Bot — First-Time Setup       ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  Belum ada config.json. Mari setup konfigurasi bot.');
    console.log('  Kamu butuh: Bot Token, Client ID, Guild ID, dan Channel IDs.');
    console.log('');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const token = await ask(rl, '🔑 Bot Token');
        if (!token) {
            console.log('  ❌ Token wajib diisi! Setup dibatalkan.');
            process.exit(1);
        }

        const clientId = await ask(rl, '🆔 Client ID (Application ID)');
        if (!clientId) {
            console.log('  ❌ Client ID wajib diisi! Setup dibatalkan.');
            process.exit(1);
        }

        const guildId = await ask(rl, '🏠 Guild ID (Server ID)');
        if (!guildId) {
            console.log('  ❌ Guild ID wajib diisi! Setup dibatalkan.');
            process.exit(1);
        }

        console.log('');
        console.log('  📢 Log Channel IDs (kosongkan kalau belum ada):');

        const depositChannel = await ask(rl, '  → Channel ID untuk log Deposit', '');
        const withdrawChannel = await ask(rl, '  → Channel ID untuk log Withdraw', '');
        const setoranChannel = await ask(rl, '  → Channel ID untuk log Setoran', '');

        console.log('');
        const backupChannelId = await ask(rl, '💾 Channel ID untuk Auto-Backup', '');

        const embedColor = await ask(rl, '🎨 Embed Color (hex)', '#2b2d31');

        const config = {
            token,
            clientId,
            guildId,
            logChannels: {
                deposit: depositChannel,
                withdraw: withdrawChannel,
                setoran: setoranChannel
            },
            backupChannelId,
            embedColor
        };

        const configPath = getConfigPath();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

        console.log('');
        console.log(`  ✅ Config saved ke: ${configPath}`);
        console.log('');
        console.log('  Langkah selanjutnya:');
        console.log('  1. Jalankan deploy-commands.exe untuk register slash commands');
        console.log('  2. Jalankan fivem-vault-bot.exe lagi untuk start bot');
        console.log('');

        rl.close();
        return config;
    } catch (err) {
        rl.close();
        throw err;
    }
}

module.exports = { runSetup };
