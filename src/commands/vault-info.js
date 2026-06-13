const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

function formatNumber(n) {
    return n.toLocaleString('id-ID');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vault-info')
        .setDescription('Lihat isi Brankas saat ini'),

    async execute(interaction) {
        const vault = db.getVault();
        const items = Object.entries(vault);

        const embed = new EmbedBuilder()
            .setTitle('Brankas Inventory')
            .setColor(0x2b2d31)
            .setTimestamp()
            .setFooter({ text: 'Brankas System' });

        if (items.length === 0) {
            embed.setDescription('Vault kosong.');
        } else {
            const lines = items.map(([name, qty]) => `**${name}** — ${formatNumber(qty)}`);
            embed.setDescription(lines.join('\n'));
        }

        const totalUnits = items.reduce((sum, [, q]) => sum + q, 0);
        embed.addFields({
            name: 'Total',
            value: `${items.length} jenis barang | ${formatNumber(totalUnits)} total unit`,
            inline: false
        });

        await interaction.reply({ embeds: [embed] });
    }
};
