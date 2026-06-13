const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const db = require('../database');
const { sendAutoBackup } = require('../auto-backup');
const { sendVaultInfo } = require('../vault-utils');

function formatNumber(n) {
    return n.toLocaleString('id-ID');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setoran')
        .setDescription('Setor Labu Kemasan (tribute) ke Brankas')
        .addAttachmentOption(option =>
            option.setName('bukti')
                .setDescription('Upload bukti/screenshot setoran')
                .setRequired(true)
        ),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('bukti');

        // Validate image
        if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
            return interaction.reply({ content: '❌ File harus berupa gambar (PNG, JPG, dll)!', flags: MessageFlags.Ephemeral });
        }

        const members = db.getMembers();

        if (members.length === 0) {
            return interaction.reply({ content: 'Belum ada member. Tambah dulu pakai `/member-add`.', flags: MessageFlags.Ephemeral });
        }

        const vault = db.getVault();
        if (!('Labu Kemasan' in vault)) {
            db.addItem('Labu Kemasan', 0);
        }

        const sessionId = `setoran_${interaction.user.id}_${Date.now()}`;
        const state = { member: null, responsible: null, days: null };

        const buildEmbed = () => {
            const currentStock = db.getVault()['Labu Kemasan'] || 0;
            const amount = state.days ? state.days * 25 : null;
            return new EmbedBuilder()
                .setTitle('Setoran Labu Kemasan')
                .setDescription(`Stok saat ini: **${formatNumber(currentStock)}**\nPer hari = 25 Labu Kemasan`)
                .setColor(0xfee75c)
                .addFields(
                    { name: 'Member', value: state.member || '_Belum dipilih_', inline: true },
                    { name: 'Penanggung Jawab', value: state.responsible || '_Belum dipilih_', inline: true },
                    { name: 'Hari', value: state.days ? `${state.days} hari` : '_Belum diisi_', inline: true },
                    { name: 'Total Setoran', value: amount ? `${formatNumber(amount)} Labu Kemasan` : '_-_', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Isi semua field lalu tekan Submit' });
        };

        const buildComponents = () => {
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

            const row1 = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`${sessionId}_member`)
                    .setPlaceholder('Pilih Member yang setor')
                    .addOptions(memberOptions)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`${sessionId}_responsible`)
                    .setPlaceholder('Pilih Penanggung Jawab')
                    .addOptions(responsibleOptions)
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${sessionId}_days`)
                    .setLabel(state.days ? `${state.days} Hari (${formatNumber(state.days * 25)} Labu)` : 'Set Jumlah Hari')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`${sessionId}_submit`)
                    .setLabel('Submit Setoran')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!(state.member && state.responsible && state.days))
            );

            return [row1, row2, row3];
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

            if (action === 'member') {
                state.member = i.values[0];
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'responsible') {
                state.responsible = i.values[0];
                await i.update({ embeds: [buildEmbed()], components: buildComponents() });
            } else if (action === 'days') {
                const modal = new ModalBuilder()
                    .setCustomId(`${sessionId}_days_modal`)
                    .setTitle('Jumlah Hari Setoran')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('days_input')
                                .setLabel('Berapa hari? (per hari = 25 Labu)')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('Contoh: 3 (= 75 Labu Kemasan)')
                                .setRequired(true)
                        )
                    );
                await i.showModal(modal);

                try {
                    const modalResponse = await i.awaitModalSubmit({ time: 60_000 });
                    const val = parseInt(modalResponse.fields.getTextInputValue('days_input'));
                    if (isNaN(val) || val <= 0) {
                        await modalResponse.reply({ content: 'Jumlah hari harus angka positif!', flags: MessageFlags.Ephemeral });
                        return;
                    }
                    state.days = val;
                    await modalResponse.update({ embeds: [buildEmbed()], components: buildComponents() });
                } catch {
                    // modal timeout
                }
            } else if (action === 'submit') {
                if (!(state.member && state.responsible && state.days)) {
                    await i.reply({ content: 'Lengkapi semua field dulu!', flags: MessageFlags.Ephemeral });
                    return;
                }

                const amount = state.days * 25;
                const vault = db.addItem('Labu Kemasan', amount);
                const tx = db.logTransaction({
                    type: 'setoran',
                    item: 'Labu Kemasan',
                    amount: amount,
                    member: state.member,
                    responsible: state.responsible
                });

                const successEmbed = new EmbedBuilder()
                    .setTitle('Setoran Berhasil')
                    .setColor(0xfee75c)
                    .addFields(
                        { name: 'Item', value: 'Labu Kemasan', inline: true },
                        { name: 'Hari', value: `${state.days} hari`, inline: true },
                        { name: 'Jumlah', value: `+${formatNumber(amount)}`, inline: true },
                        { name: 'Stok Sekarang', value: formatNumber(vault['Labu Kemasan']), inline: true },
                        { name: 'Member', value: state.member, inline: true },
                        { name: 'Penanggung Jawab', value: state.responsible, inline: true },
                        { name: 'Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setImage(attachment.url)
                    .setTimestamp()
                    .setFooter({ text: `Transaction #${tx.id}` });

                // Undo button
                const undoRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${sessionId}_undo_${tx.id}`)
                        .setLabel('Undo Setoran')
                        .setStyle(ButtonStyle.Danger)
                );

                await i.update({ embeds: [successEmbed], components: [undoRow] });
                await sendLog(interaction.client, successEmbed);
                await sendVaultInfo(interaction.client);
                await sendAutoBackup(interaction.client);
                // collector stays alive for undo
            } else if (action.startsWith('undo_')) {
                const txId = parseInt(action.split('_')[1]);
                const amount = state.days * 25;

                // Reverse the deposit
                const result = db.removeItem('Labu Kemasan', amount);
                if (!result) {
                    await i.reply({ content: 'Undo gagal — stok sudah berubah.', flags: MessageFlags.Ephemeral });
                    return;
                }

                db.logTransaction({
                    type: 'undo_setoran',
                    item: 'Labu Kemasan',
                    amount: -amount,
                    member: state.member,
                    responsible: state.responsible
                });

                const undoEmbed = new EmbedBuilder()
                    .setTitle('Setoran Di-undo')
                    .setColor(0xed4245)
                    .setDescription(`Setoran ${formatNumber(amount)} Labu Kemasan dari **${state.member}** telah dibatalkan.`)
                    .addFields(
                        { name: 'Stok Sekarang', value: formatNumber(result['Labu Kemasan']), inline: true }
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
                interaction.editReply({ content: 'Setoran timeout. Silakan coba lagi.', embeds: [], components: [] }).catch(() => {});
            }
        });
    }
};

async function sendLog(client, embed) {
    try {
        const { getConfig } = require('../paths');
        const config = getConfig();
        const channelId = config.logChannels.setoran;
        console.log(`[LOG] Sending setoran log to channel ${channelId}`);
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
            console.log('[LOG] Setoran log sent successfully');
        } else {
            console.error('[LOG] Channel not found:', channelId);
        }
    } catch (err) {
        console.error('[LOG] Failed to send setoran log:', err.message);
    }
}
