const { AttachmentBuilder } = require('discord.js');
const db = require('./database');
const { getConfig } = require('./paths');

async function sendAutoBackup(client) {
    try {
        const config = getConfig();
        const channel = await client.channels.fetch(config.backupChannelId);
        if (!channel) return;

        const backup = {
            version: 1,
            createdAt: new Date().toISOString(),
            vault: db.getVault(),
            members: db.getMembers(),
            transactions: db.getTransactions()
        };

        const json = JSON.stringify(backup, null, 2);
        const buffer = Buffer.from(json, 'utf-8');
        const date = new Date().toISOString().slice(0, 10);
        const time = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        const attachment = new AttachmentBuilder(buffer, { name: `backup_${date}_${time}.json` });

        await channel.send({ files: [attachment] });
    } catch (err) {
        console.error('[BACKUP] Auto-backup failed:', err.message);
    }
}

module.exports = { sendAutoBackup };
