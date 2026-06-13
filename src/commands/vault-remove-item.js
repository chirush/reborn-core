const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../database');
const { sendAutoBackup } = require('../auto-backup');
const { sendVaultInfo, buildPaginatedItemSelect, formatNumber } = require('../vault-utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vault-remove-item')
        .setDescription('🗑️ Hapus jenis item dari vault'),

    async execute(interaction) {
        const items = db.getItemNames();

        if (items.length === 0) {
            return interaction.reply({ content: 'Vault kosong, tidak ada item yang bisa dihapus.', flags: MessageFlags.Ephemeral });
        }

        const sessionId = `removeitem_${interaction.user.id}_${Date.now()}`;
        const state = { selected: null, itemPage: 0 };

        const buildEmbed = () => {
            const vault = db.getVault();
            return new EmbedBuilder()
                .setTitle('🗑️ Hapus Item dari Vault')
                .setDescription(state.selected
                    ? `Kamu akan menghapus **${state.selected}** (stok: ${formatNumber(vault[state.selected] || 0)}) dari vault.\n\n⚠️ **Ini akan menghapus item dan semua stoknya secara permanen!**`
                    : 'Pilih item yang ingin dihapus dari vault.')
                .setColor(state.selected ? 0xed4245 : 0x5865f2)
                .setTimestamp()
                .setFooter({ text: 'Pilih item lalu tekan Confirm' });
        };

        const buildComponents = () => {
            const currentItems = db.getItemNames();
            const vault = db.getVault();
            const { row: itemRow, paginationRow: itemPagRow } = buildPaginatedItemSelect(
                currentItems, state.itemPage, sessionId, 'item', state.selected, 'Pilih Item untuk dihapus',
                (name) => `${name} (stok: ${formatNumber(vault[name] || 0)})`
            );

            const rows = [itemRow];
            if (itemPagRow) rows.push(itemPagRow);

            rows.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${sessionId}_confirm`)
                        .setLabel('🗑️ Confirm Hapus')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(!state.selected),
                    new ButtonBuilder()
                        .setCustomId(`${sessionId}_cancel`)
                        .setLabel('Batal')
                        .setStyle(ButtonStyle.Secondary)
                )
            );

            return rows;
        };

        const response = await interaction.reply({
            embeds: [buildEmbed()],
            components: buildComponents(),
            flags: MessageFlags.Ephemeral,
            withResponse: true
        });

        const reply = response.resource.message;

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId.startsWith(sessionId),
            time: 120_000
        });

        collector.on('collect', async i => {
            const action = i.customId.replace(`${sessionId}_`, '');

            if (action === 'item') {
                state.selected = i.values[0];
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'item_prev') {
                state.itemPage = Math.max(0, state.itemPage - 1);
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'item_next') {
                state.itemPage++;
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'confirm') {
                if (!state.selected) {
                    await i.reply({ content: 'Pilih item dulu!', flags: MessageFlags.Ephemeral });
                    return;
                }

                const vault = db.getVault();
                const removedStock = vault[state.selected] || 0;
                const success = db.deleteVaultItem(state.selected);

                if (!success) {
                    await i.reply({ content: `❌ Item **${state.selected}** tidak ditemukan di vault.`, flags: MessageFlags.Ephemeral });
                    return;
                }

                const updatedVault = db.getVault();
                const remaining = Object.entries(updatedVault);

                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Item Dihapus dari Vault')
                    .setColor(0xed4245)
                    .addFields(
                        { name: '📦 Item Dihapus', value: state.selected, inline: true },
                        { name: '📉 Stok yang Dihapus', value: formatNumber(removedStock), inline: true },
                        { name: '📊 Sisa Jenis Item', value: `${remaining.length}`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Brankas System' });

                if (remaining.length > 0) {
                    embed.setDescription(`**Daftar Item Tersisa:**\n${remaining.map(([n, q]) => `• **${n}** — ${formatNumber(q)}`).join('\n')}`);
                } else {
                    embed.setDescription('Vault sekarang kosong.');
                }

                await i.update({ embeds: [embed], components: [] });
                await sendVaultInfo(interaction.client);
                await sendAutoBackup(interaction.client);
                collector.stop('done');
            } else if (action === 'cancel') {
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('Dibatalkan').setDescription('Penghapusan item dibatalkan.').setColor(0x99aab5)],
                    components: []
                });
                collector.stop('cancelled');
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'Timeout. Silakan coba lagi.', embeds: [], components: [] }).catch(() => {});
            }
        });
    }
};
