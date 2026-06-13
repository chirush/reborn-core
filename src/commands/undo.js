const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database');
const { sendAutoBackup } = require('../auto-backup');

function formatNumber(n) {
    return n.toLocaleString('id-ID');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('undo')
        .setDescription('Batalkan transaksi berdasarkan ID')
        .addIntegerOption(opt =>
            opt.setName('id')
                .setDescription('ID transaksi yang mau dibatalkan')
                .setRequired(true)
        ),

    async execute(interaction) {
        const id = interaction.options.getInteger('id');
        const tx = db.getTransactionById(id);

        if (!tx) {
            return interaction.reply({ content: `Transaksi #${id} tidak ditemukan.`, flags: MessageFlags.Ephemeral });
        }

        if (tx.undone) {
            return interaction.reply({ content: `Transaksi #${id} sudah pernah di-undo.`, flags: MessageFlags.Ephemeral });
        }

        if (tx.type.startsWith('undo_')) {
            return interaction.reply({ content: `Transaksi #${id} adalah undo, tidak bisa di-undo lagi.`, flags: MessageFlags.Ephemeral });
        }

        // Reverse the transaction
        let vault;
        if (tx.type === 'deposit' || tx.type === 'setoran') {
            // Was adding items, so remove them
            vault = db.removeItem(tx.item, tx.amount);
            if (!vault) {
                return interaction.reply({
                    content: `Undo gagal — stok **${tx.item}** sekarang tidak cukup untuk dikurangi ${formatNumber(tx.amount)}.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } else if (tx.type === 'withdraw') {
            // Was removing items, so add them back
            vault = db.addItem(tx.item, tx.amount);
        } else {
            return interaction.reply({ content: `Tipe transaksi "${tx.type}" tidak bisa di-undo.`, flags: MessageFlags.Ephemeral });
        }

        // Mark as undone
        db.markTransactionUndone(id);

        // Log the undo
        const undoTx = db.logTransaction({
            type: `undo_${tx.type}`,
            item: tx.item,
            amount: tx.type === 'withdraw' ? tx.amount : -tx.amount,
            member: tx.member,
            responsible: tx.responsible
        });

        const embed = new EmbedBuilder()
            .setTitle(`Undo Transaksi #${id}`)
            .setColor(0xed4245)
            .addFields(
                { name: 'Tipe Asal', value: tx.type, inline: true },
                { name: 'Item', value: tx.item, inline: true },
                { name: 'Jumlah Dikembalikan', value: formatNumber(tx.amount), inline: true },
                { name: 'Stok Sekarang', value: formatNumber(vault[tx.item]), inline: true },
                { name: 'Member', value: tx.member, inline: true },
                { name: 'Penanggung Jawab', value: tx.responsible, inline: true },
                { name: 'Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Undo TX #${id} → New TX #${undoTx.id}` });

        await interaction.reply({ embeds: [embed] });

        // Send to appropriate log channel
        await sendLog(interaction.client, embed, tx.type);
        await sendAutoBackup(interaction.client);
    }
};

async function sendLog(client, embed, originalType) {
    try {
        const { getConfig } = require('../paths');
        const config = getConfig();
        let channelId;
        if (originalType === 'deposit') channelId = config.logChannels.deposit;
        else if (originalType === 'withdraw') channelId = config.logChannels.withdraw;
        else if (originalType === 'setoran') channelId = config.logChannels.setoran;
        else return;

        const channel = await client.channels.fetch(channelId);
        if (channel) await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[LOG] Failed to send undo log:', err.message);
    }
}
