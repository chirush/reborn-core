const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Backup semua data brankas ke file JSON'),

    async execute(interaction) {
        const vault = db.getVault();
        const members = db.getMembers();
        const transactions = db.getTransactions();

        const backup = {
            version: 1,
            createdAt: new Date().toISOString(),
            vault,
            members,
            transactions
        };

        const json = JSON.stringify(backup, null, 2);
        const buffer = Buffer.from(json, 'utf-8');
        const date = new Date().toISOString().slice(0, 10);
        const time = new Date().toISOString().slice(11, 16).replace(':', '');
        const attachment = new AttachmentBuilder(buffer, { name: `brankas_backup_${date}_${time}.json` });

        await interaction.reply({
            content: `Backup selesai.\n${Object.keys(vault).length} item, ${members.length} member, ${transactions.length} transaksi.`,
            files: [attachment],
            flags: MessageFlags.Ephemeral
        });
    }
};
