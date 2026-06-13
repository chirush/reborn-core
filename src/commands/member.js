const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

const memberAdd = {
    data: new SlashCommandBuilder()
        .setName('member-add')
        .setDescription('➕ Tambah member ke database')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Nama member (in-game name)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const name = interaction.options.getString('name');
        const success = db.addMember(name);

        if (!success) {
            return interaction.reply({
                content: `❌ Member **${name}** sudah ada di database!`,
                ephemeral: true
            });
        }

        const members = db.getMembers();
        const embed = new EmbedBuilder()
            .setTitle('✅ Member Ditambahkan')
            .setColor(0x57f287)
            .addFields(
                { name: '👤 Nama', value: name, inline: true },
                { name: '📊 Total Member', value: `${members.length}`, inline: true }
            )
            .setDescription(`**Daftar Member:**\n${members.map((m, i) => `${i + 1}. ${m}`).join('\n')}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

const memberRemove = {
    data: new SlashCommandBuilder()
        .setName('member-remove')
        .setDescription('➖ Hapus member dari database')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Nama member yang mau dihapus')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        const name = interaction.options.getString('name');
        const success = db.removeMember(name);

        if (!success) {
            return interaction.reply({
                content: `❌ Member **${name}** tidak ditemukan!`,
                ephemeral: true
            });
        }

        const members = db.getMembers();
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Member Dihapus')
            .setColor(0xed4245)
            .addFields(
                { name: '👤 Nama', value: name, inline: true },
                { name: '📊 Total Member', value: `${members.length}`, inline: true }
            )
            .setDescription(members.length > 0
                ? `**Daftar Member:**\n${members.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
                : '*Tidak ada member.*'
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const members = db.getMembers();
        const filtered = members
            .filter(m => m.toLowerCase().includes(focused))
            .slice(0, 25);
        await interaction.respond(filtered.map(m => ({ name: m, value: m })));
    }
};

const memberList = {
    data: new SlashCommandBuilder()
        .setName('member-list')
        .setDescription('📋 Lihat daftar semua member'),

    async execute(interaction) {
        const members = db.getMembers();

        const embed = new EmbedBuilder()
            .setTitle('📋 Daftar Member')
            .setColor(0x5865f2)
            .setTimestamp();

        if (members.length === 0) {
            embed.setDescription('*Belum ada member. Tambah pakai `/member-add`.*');
        } else {
            embed.setDescription(members.map((m, i) => `**${i + 1}.** ${m}`).join('\n'));
            embed.setFooter({ text: `Total: ${members.length} member` });
        }

        await interaction.reply({ embeds: [embed] });
    }
};

module.exports = { memberAdd, memberRemove, memberList };
