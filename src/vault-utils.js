const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');

function formatNumber(n) {
    return n.toLocaleString('id-ID');
}

/**
 * Build a nicely formatted vault inventory embed with categorized items
 */
function buildVaultEmbed(title = '📦 Brankas Inventory') {
    const vault = db.getVault();
    const items = Object.entries(vault);

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x2b2d31)
        .setTimestamp()
        .setFooter({ text: 'Brankas System' });

    if (items.length === 0) {
        embed.setDescription('> Vault kosong.');
        return embed;
    }

    // Split items into columns (2 columns for better readability)
    const half = Math.ceil(items.length / 2);
    const col1 = items.slice(0, half);
    const col2 = items.slice(half);

    const formatColumn = (entries) => {
        return entries.map(([name, qty]) => {
            const icon = qty === 0 ? '🔴' : '🟢';
            return `${icon} **${name}**\n┗ \`${formatNumber(qty)}\``;
        }).join('\n');
    };

    embed.addFields(
        { name: '━━━━━━━━━━━━━━━', value: formatColumn(col1), inline: true },
        { name: '━━━━━━━━━━━━━━━', value: col2.length > 0 ? formatColumn(col2) : '\u200b', inline: true }
    );

    // Summary bar
    const totalUnits = items.reduce((sum, [, q]) => sum + q, 0);
    const emptyCount = items.filter(([, q]) => q === 0).length;
    embed.addFields({
        name: '📊 Ringkasan',
        value: `\`\`\`\nJenis Barang : ${items.length}\nTotal Unit   : ${formatNumber(totalUnits)}\nStok Kosong  : ${emptyCount}\n\`\`\``,
        inline: false
    });

    return embed;
}

/**
 * Send vault info embed to the configured vaultInfoChannelId
 */
async function sendVaultInfo(client) {
    try {
        const { getConfig } = require('./paths');
        const config = getConfig();
        const channelId = config.vaultInfoChannelId;
        if (!channelId) return;

        const embed = buildVaultEmbed('📦 Brankas Inventory (Auto-Update)');

        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
            console.log('[LOG] Vault info sent to channel', channelId);
        }
    } catch (err) {
        console.error('[LOG] Failed to send vault info:', err.message);
    }
}

/**
 * Build a paginated item select menu.
 * Discord StringSelectMenu supports max 25 options.
 */
function buildPaginatedItemSelect(allItems, page, sessionId, selectId, selectedItem, placeholder, labelFn) {
    const PAGE_SIZE = 25;
    const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages - 1);
    const start = currentPage * PAGE_SIZE;
    const pageItems = allItems.slice(start, start + PAGE_SIZE);

    const options = pageItems.map(name => ({
        label: labelFn ? labelFn(name) : name,
        value: name,
        default: selectedItem === name
    }));

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`${sessionId}_${selectId}`)
            .setPlaceholder(totalPages > 1 ? `${placeholder} (Hal. ${currentPage + 1}/${totalPages})` : placeholder)
            .addOptions(options)
    );

    let paginationRow = null;
    if (totalPages > 1) {
        paginationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${sessionId}_${selectId}_prev`)
                .setLabel('◀ Sebelumnya')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`${sessionId}_${selectId}_next`)
                .setLabel('Selanjutnya ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages - 1)
        );
    }

    return { row, paginationRow, totalPages, currentPage };
}

module.exports = { sendVaultInfo, buildVaultEmbed, buildPaginatedItemSelect, formatNumber };
