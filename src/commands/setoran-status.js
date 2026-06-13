const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database');

function formatNumber(n) {
    return n.toLocaleString('id-ID');
}

// Get Monday 00:00 of current week (local time, UTC+7)
function getWeekStart() {
    const now = new Date();
    // Adjust to UTC+7
    const utc7 = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const day = utc7.getUTCDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? 6 : day - 1; // days since Monday
    const monday = new Date(utc7);
    monday.setUTCDate(monday.getUTCDate() - diff);
    monday.setUTCHours(0, 0, 0, 0);
    // Convert back: monday is in UTC+7 representation, convert to actual UTC
    return new Date(monday.getTime() - (7 * 60 * 60 * 1000));
}

// Get previous week Monday
function getPrevWeekStart() {
    const thisWeek = getWeekStart();
    return new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setoran-status')
        .setDescription('Lihat status setoran minggu ini'),

    async execute(interaction) {
        const members = db.getMembers();
        const transactions = db.getTransactions();

        if (members.length === 0) {
            return interaction.reply({ content: 'Belum ada member.', flags: MessageFlags.Ephemeral });
        }

        const weekStart = getWeekStart();
        const prevWeekStart = getPrevWeekStart();

        // Current week setoran (exclude undone)
        const thisWeekSetoran = transactions.filter(tx =>
            tx.type === 'setoran' &&
            !tx.undone &&
            new Date(tx.timestamp) >= weekStart
        );

        // Previous week setoran (exclude undone)
        const prevWeekSetoran = transactions.filter(tx =>
            tx.type === 'setoran' &&
            !tx.undone &&
            new Date(tx.timestamp) >= prevWeekStart &&
            new Date(tx.timestamp) < weekStart
        );

        // Build per-member summary for this week
        const memberStatus = {};
        for (const m of members) {
            memberStatus[m] = { days: 0, amount: 0 };
        }

        for (const tx of thisWeekSetoran) {
            if (memberStatus[tx.member]) {
                // amount = days * 25, so days = amount / 25
                const days = tx.amount / 25;
                memberStatus[tx.member].days += days;
                memberStatus[tx.member].amount += tx.amount;
            }
        }

        // Build embed
        const embed = new EmbedBuilder()
            .setTitle('Status Setoran Minggu Ini')
            .setColor(0xfee75c)
            .setTimestamp();

        // Week range display
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        embed.setDescription(`Periode: <t:${Math.floor(weekStart.getTime() / 1000)}:D> — <t:${Math.floor(weekEnd.getTime() / 1000)}:D>`);

        // Current week status
        let statusLines = [];
        let sudahCount = 0;
        let belumCount = 0;

        for (const m of members) {
            const s = memberStatus[m];
            if (s.days > 0) {
                statusLines.push(`**${m}** — ${s.days} hari (${formatNumber(s.amount)} Labu)`);
                sudahCount++;
            } else {
                statusLines.push(`**${m}** — Belum setor`);
                belumCount++;
            }
        }

        embed.addFields({
            name: `Minggu Ini (${sudahCount} sudah / ${belumCount} belum)`,
            value: statusLines.join('\n') || '_Tidak ada data_',
            inline: false
        });

        // Previous week summary
        if (prevWeekSetoran.length > 0) {
            const prevMemberStatus = {};
            for (const m of members) {
                prevMemberStatus[m] = { days: 0, amount: 0 };
            }
            for (const tx of prevWeekSetoran) {
                if (prevMemberStatus[tx.member]) {
                    prevMemberStatus[tx.member].days += tx.amount / 25;
                    prevMemberStatus[tx.member].amount += tx.amount;
                }
            }

            let prevLines = [];
            for (const m of members) {
                const s = prevMemberStatus[m];
                if (s.days > 0) {
                    prevLines.push(`**${m}** — ${s.days} hari (${formatNumber(s.amount)} Labu)`);
                } else {
                    prevLines.push(`**${m}** — Tidak setor`);
                }
            }

            const prevWeekEnd = new Date(prevWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
            embed.addFields({
                name: `Minggu Lalu (<t:${Math.floor(prevWeekStart.getTime() / 1000)}:D> — <t:${Math.floor(prevWeekEnd.getTime() / 1000)}:D>)`,
                value: prevLines.join('\n'),
                inline: false
            });
        }

        embed.setFooter({ text: 'Reset setiap hari Senin' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
