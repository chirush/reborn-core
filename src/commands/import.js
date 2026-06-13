const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../database');
const https = require('https');
const http = require('http');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('import')
        .setDescription('Import data dari file backup JSON')
        .addAttachmentOption(opt =>
            opt.setName('file')
                .setDescription('File backup JSON')
                .setRequired(true)
        ),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('file');

        if (!attachment.name.endsWith('.json')) {
            return interaction.reply({ content: 'File harus format .json', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const raw = await fetchUrl(attachment.url);
            const backup = JSON.parse(raw);

            // Validate structure
            if (!backup.vault || !backup.members || !backup.transactions) {
                return interaction.editReply({ content: 'Format backup tidak valid. Harus ada vault, members, dan transactions.' });
            }

            // Restore
            db.saveVault(backup.vault);
            const { saveMembers } = require('../database');
            saveMembers(backup.members);

            // Restore transactions
            const fs = require('fs');
            const path = require('path');
            const { getDataDir } = require('../paths');
            const txPath = path.join(getDataDir(), 'transactions.json');
            fs.writeFileSync(txPath, JSON.stringify(backup.transactions, null, 2), 'utf-8');

            await interaction.editReply({
                content: `Import berhasil!\n${Object.keys(backup.vault).length} item, ${backup.members.length} member, ${backup.transactions.length} transaksi.\nBackup dari: ${backup.createdAt || 'unknown'}`
            });
        } catch (err) {
            console.error('Import error:', err);
            await interaction.editReply({ content: `Import gagal: ${err.message}` });
        }
    }
};
