const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vault-add-item')
        .setDescription('🆕 Tambah jenis item baru ke vault')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Nama item baru')
                .setRequired(true)
        ),

    async execute(interaction) {
        const name = interaction.options.getString('name').trim();
        const vault = db.getVault();

        if (name in vault) {
            return interaction.reply({
                content: `❌ Item **${name}** sudah ada di vault! (stok: ${vault[name]})`,
                ephemeral: true
            });
        }

        db.addItem(name, 0);
        const updatedVault = db.getVault();
        const items = Object.entries(updatedVault);

        const embed = new EmbedBuilder()
            .setTitle('🆕 Item Baru Ditambahkan')
            .setColor(0x5865f2)
            .addFields(
                { name: '📦 Item', value: name, inline: true },
                { name: '📊 Total Jenis', value: `${items.length}`, inline: true }
            )
            .setDescription(`**Daftar Item di Vault:**\n${items.map(([n, q]) => `• **${n}** — ${q}`).join('\n')}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
