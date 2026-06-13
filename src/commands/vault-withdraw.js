const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const db = require('../database');
const { sendAutoBackup } = require('../auto-backup');
const { sendVaultInfo, buildPaginatedItemSelect, formatNumber } = require('../vault-utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vault-withdraw')
        .setDescription('Ambil barang dari Brankas')
        .addAttachmentOption(option =>
            option.setName('bukti')
                .setDescription('Upload bukti/screenshot withdraw')
                .setRequired(true)
        ),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('bukti');

        // Validate image
        if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
            return interaction.reply({ content: '❌ File harus berupa gambar (PNG, JPG, dll)!', flags: MessageFlags.Ephemeral });
        }

        const items = db.getItemNames();
        const members = db.getMembers();

        if (items.length === 0) {
            return interaction.reply({ content: 'Vault kosong, tidak ada yang bisa diambil.', flags: MessageFlags.Ephemeral });
        }
        if (members.length === 0) {
            return interaction.reply({ content: 'Belum ada member. Tambah member dulu pakai `/member-add`.', flags: MessageFlags.Ephemeral });
        }

        const sessionId = `withdraw_${interaction.user.id}_${Date.now()}`;
        const state = { item: null, member: null, responsible: null, amount: null, itemPage: 0 };

        const buildEmbed = () => {
            return new EmbedBuilder()
                .setTitle('Vault Withdraw')
                .setDescription('Pilih item, member, penanggung jawab, dan jumlah.')
                .setColor(0xed4245)
                .addFields(
                    { name: 'Item', value: state.item || '_Belum dipilih_', inline: true },
                    { name: 'Member', value: state.member || '_Belum dipilih_', inline: true },
                    { name: 'Penanggung Jawab', value: state.responsible || '_Belum dipilih_', inline: true },
                    { name: 'Jumlah', value: state.amount ? formatNumber(state.amount) : '_Belum diisi_', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Isi semua field lalu tekan Submit' });
        };

        const buildComponents = () => {
            const vault = db.getVault();
            const currentItems = db.getItemNames();
            const { row: itemRow, paginationRow: itemPagRow } = buildPaginatedItemSelect(
                currentItems, state.itemPage, sessionId, 'item', state.item, 'Pilih Item',
                (name) => `${name} (stok: ${formatNumber(vault[name] || 0)})`
            );

            const memberOptions = members.slice(0, 25).map(name => ({
                label: name,
                value: name,
                default: state.member === name
            }));

            const responsibleOptions = members.slice(0, 25).map(name => ({
                label: name,
                value: name,
                default: state.responsible === name
            }));

            const rows = [itemRow];
            if (itemPagRow) rows.push(itemPagRow);

            rows.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`${sessionId}_member`)
                        .setPlaceholder('Pilih Member')
                        .addOptions(memberOptions)
                )
            );

            rows.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`${sessionId}_responsible`)
                        .setPlaceholder('Pilih Penanggung Jawab')
                        .addOptions(responsibleOptions)
                )
            );

            rows.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${sessionId}_amount`)
                        .setLabel(state.amount ? `Jumlah: ${formatNumber(state.amount)}` : 'Set Jumlah')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`${sessionId}_submit`)
                        .setLabel('Submit Withdraw')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(!(state.item && state.member && state.responsible && state.amount))
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
            time: 300_000
        });

        collector.on('collect', async i => {
            const action = i.customId.replace(`${sessionId}_`, '');

            if (action === 'item') {
                state.item = i.values[0];
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'item_prev') {
                state.itemPage = Math.max(0, state.itemPage - 1);
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'item_next') {
                state.itemPage++;
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'member') {
                state.member = i.values[0];
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'responsible') {
                state.responsible = i.values[0];
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'amount') {
                const modal = new ModalBuilder()
                    .setCustomId(`${sessionId}_amount_modal`)
                    .setTitle('Jumlah Withdraw')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('amount_input')
                                .setLabel('Masukkan jumlah yang diambil')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('Contoh: 5')
                                .setRequired(true)
                        )
                    );
                await i.showModal(modal);

                try {
                    const modalResponse = await i.awaitModalSubmit({ time: 60_000 });
                    const val = parseInt(modalResponse.fields.getTextInputValue('amount_input'));
                    if (isNaN(val) || val <= 0) {
                        await modalResponse.reply({ content: 'Jumlah harus angka positif!', flags: MessageFlags.Ephemeral });
                        return;
                    }
                    state.amount = val;
                    await modalResponse.update({ embeds: [buildEmbed()], components: buildComponents() });
                } catch {
                    // modal timeout
                }
            } else if (action === 'submit') {
                if (!(state.item && state.member && state.responsible && state.amount)) {
                    await i.reply({ content: 'Lengkapi semua field dulu!', flags: MessageFlags.Ephemeral });
                    return;
                }

                const vault = db.getVault();
                const current = vault[state.item] || 0;
                if (current < state.amount) {
                    await i.reply({ content: `Stok tidak cukup! **${state.item}** hanya ada **${formatNumber(current)}**, kamu mau ambil **${formatNumber(state.amount)}**.`, flags: MessageFlags.Ephemeral });
                    return;
                }

                const updatedVault = db.removeItem(state.item, state.amount);
                const tx = db.logTransaction({
                    type: 'withdraw',
                    item: state.item,
                    amount: state.amount,
                    member: state.member,
                    responsible: state.responsible
                });

                const successEmbed = new EmbedBuilder()
                    .setTitle('Withdraw Berhasil')
                    .setColor(0xed4245)
                    .addFields(
                        { name: 'Item', value: state.item, inline: true },
                        { name: 'Jumlah', value: `-${formatNumber(state.amount)}`, inline: true },
                        { name: 'Stok Sekarang', value: formatNumber(updatedVault[state.item]), inline: true },
                        { name: 'Member', value: state.member, inline: true },
                        { name: 'Penanggung Jawab', value: state.responsible, inline: true },
                        { name: 'Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setImage(attachment.url)
                    .setTimestamp()
                    .setFooter({ text: `Transaction #${tx.id}` });

                const undoRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${sessionId}_undo_${tx.id}`)
                        .setLabel('Undo Withdraw')
                        .setStyle(ButtonStyle.Secondary)
                );

                await i.update({ embeds: [successEmbed], components: [undoRow] });
                await sendLog(interaction.client, successEmbed);
                await sendVaultInfo(interaction.client);
                await sendAutoBackup(interaction.client);
            } else if (action.startsWith('undo_')) {
                const txId = parseInt(action.split('_')[1]);

                db.addItem(state.item, state.amount);
                const vault = db.getVault();

                db.logTransaction({
                    type: 'undo_withdraw',
                    item: state.item,
                    amount: state.amount,
                    member: state.member,
                    responsible: state.responsible
                });

                const undoEmbed = new EmbedBuilder()
                    .setTitle('Withdraw Di-undo')
                    .setColor(0x57f287)
                    .setDescription(`Withdraw ${formatNumber(state.amount)} **${state.item}** oleh **${state.member}** dibatalkan.`)
                    .addFields(
                        { name: 'Stok Sekarang', value: formatNumber(vault[state.item]), inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Undo of Transaction #${txId}` });

                await i.update({ embeds: [undoEmbed], components: [] });
                await sendLog(interaction.client, undoEmbed);
                await sendVaultInfo(interaction.client);
                await sendAutoBackup(interaction.client);
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'Withdraw timeout. Silakan coba lagi.', embeds: [], components: [] }).catch(() => {});
            }
        });
    }
};

async function sendLog(client, embed) {
    try {
        const { getConfig } = require('../paths');
        const config = getConfig();
        const channelId = config.logChannels.withdraw;
        console.log(`[LOG] Sending withdraw log to channel ${channelId}`);
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
            console.log('[LOG] Withdraw log sent successfully');
        } else {
            console.error('[LOG] Channel not found:', channelId);
        }
    } catch (err) {
        console.error('[LOG] Failed to send withdraw log:', err.message);
    }
}
