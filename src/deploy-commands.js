const { REST, Routes } = require('discord.js');
const { getConfig, configExists } = require('./paths');

// Load all command data
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

const commands = [
    vaultInfo.data.toJSON(),
    vaultDeposit.data.toJSON(),
    vaultWithdraw.data.toJSON(),
    setoran.data.toJSON(),
    vaultAddItem.data.toJSON(),
    vaultRemoveItem.data.toJSON(),
    memberAdd.data.toJSON(),
    memberRemove.data.toJSON(),
    memberList.data.toJSON(),
    undo.data.toJSON(),
    setoranStatus.data.toJSON(),
    exportCmd.data.toJSON(),
    backupCmd.data.toJSON(),
    importCmd.data.toJSON(),
];

(async () => {
    if (!configExists()) {
        console.log('❌ config.json belum ada! Jalankan fivem-vault-bot.exe dulu untuk setup.');
        process.exit(1);
    }

    const config = getConfig();
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
        console.log(`🔄 Registering ${commands.length} slash commands...`);

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log('✅ Slash commands registered successfully!');
        console.log('Commands:', commands.map(c => `/${c.name}`).join(', '));
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
})();
