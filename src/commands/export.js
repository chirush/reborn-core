const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const ExcelJS = require('exceljs');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('Export transaksi ke file Excel'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const transactions = db.getTransactions();
        const vault = db.getVault();

        if (transactions.length === 0 && Object.keys(vault).length === 0) {
            return interaction.editReply({ content: 'Tidak ada data untuk di-export.' });
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Reborn Core Bot';
        workbook.created = new Date();

        // --- Sheet 1: Inventory ---
        const invSheet = workbook.addWorksheet('Inventory');
        invSheet.columns = [
            { header: 'Item', key: 'item', width: 25 },
            { header: 'Jumlah', key: 'amount', width: 15 }
        ];
        // Header style
        invSheet.getRow(1).font = { bold: true };
        invSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2D31' } };
        invSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        for (const [item, amount] of Object.entries(vault)) {
            invSheet.addRow({ item, amount });
        }

        // --- Sheet 2: Transactions ---
        const txSheet = workbook.addWorksheet('Transaksi');
        txSheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Tipe', key: 'type', width: 15 },
            { header: 'Item', key: 'item', width: 25 },
            { header: 'Jumlah', key: 'amount', width: 12 },
            { header: 'Member', key: 'member', width: 20 },
            { header: 'Penanggung Jawab', key: 'responsible', width: 20 },
            { header: 'Undone', key: 'undone', width: 10 },
            { header: 'Waktu', key: 'timestamp', width: 25 }
        ];
        txSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        txSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2D31' } };

        for (const tx of transactions) {
            const row = txSheet.addRow({
                id: tx.id,
                type: tx.type,
                item: tx.item,
                amount: tx.amount,
                member: tx.member,
                responsible: tx.responsible,
                undone: tx.undone ? 'Ya' : 'Tidak',
                timestamp: tx.timestamp
            });

            // Color rows by type
            let color;
            if (tx.type === 'deposit' || tx.type === 'setoran') color = 'FFE8F5E9';
            else if (tx.type === 'withdraw') color = 'FFFCE4EC';
            else if (tx.type.startsWith('undo_')) color = 'FFFFF3E0';
            if (color) {
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                });
            }
        }

        // --- Sheet 3: Members ---
        const memSheet = workbook.addWorksheet('Members');
        memSheet.columns = [
            { header: 'No', key: 'no', width: 8 },
            { header: 'Nama', key: 'name', width: 25 }
        ];
        memSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        memSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2D31' } };

        const members = db.getMembers();
        members.forEach((m, i) => memSheet.addRow({ no: i + 1, name: m }));

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const date = new Date().toISOString().slice(0, 10);
        const attachment = new AttachmentBuilder(buffer, { name: `brankas_export_${date}.xlsx` });

        await interaction.editReply({
            content: `Export selesai. ${transactions.length} transaksi, ${Object.keys(vault).length} item, ${members.length} member.`,
            files: [attachment]
        });
    }
};
