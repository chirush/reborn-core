const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const { configExists, getConfig } = require('./paths');
const { runSetup } = require('./setup');

async function main() {
    // First-run setup wizard
    if (!configExists()) {
        await runSetup();
        console.log('  ℹ️  Restart bot setelah menjalankan deploy-commands.exe');
        process.exit(0);
    }

    const config = getConfig();

    // Import commands
    const vaultInfo = require('./commands/vault-info');
    const vaultDeposit = require('./commands/vault-deposit');
    const vaultWithdraw = require('./commands/vault-withdraw');
    const setoran = require('./commands/setoran');
    const vaultAddItem = require('./commands/vault-add-item');
    const vaultRemoveItem = require('./commands/vault-remove-item');
    const { memberAdd, memberRemove, memberList } = require('./commands/member');
    const undo = require('./commands/undo');
    const setoranStatus = require('./commands/setoran-status');
    const exportCmd = require('./commands/export');
    const backupCmd = require('./commands/backup');
    const importCmd = require('./commands/import');

    // Create client
    const client = new Client({
        intents: [GatewayIntentBits.Guilds]
    });

    // Register commands in collection
    client.commands = new Collection();
    const commandList = [vaultInfo, vaultDeposit, vaultWithdraw, setoran, vaultAddItem, vaultRemoveItem, memberAdd, memberRemove, memberList, undo, setoranStatus, exportCmd, backupCmd, importCmd];
    for (const cmd of commandList) {
        client.commands.set(cmd.data.name, cmd);
    }

    // Ready
    client.once(Events.ClientReady, c => {
        console.log(`✅ Bot online as ${c.user.tag}`);
        console.log(`📦 ${client.commands.size} commands loaded`);
        console.log(`🏠 Guilds: ${c.guilds.cache.size}`);
    });

    // Handle interactions
    client.on(Events.InteractionCreate, async interaction => {
        // Handle autocomplete
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (err) {
                    console.error(`Autocomplete error (${interaction.commandName}):`, err);
                }
            }
            return;
        }

        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.warn(`Unknown command: ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (err) {
                console.error(`Command error (${interaction.commandName}):`, err);
                const reply = { content: '❌ Terjadi error saat menjalankan command!', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply).catch(() => {});
                } else {
                    await interaction.reply(reply).catch(() => {});
                }
            }
        }
    });

    // Login
    client.login(config.token);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
