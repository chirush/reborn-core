const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const { buildVaultEmbed } = require('../vault-utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vault-info')
        .setDescription('Lihat isi Brankas saat ini'),

    async execute(interaction) {
        const embed = buildVaultEmbed('📦 Brankas Inventory');
        await interaction.reply({ embeds: [embed] });
    }
};
