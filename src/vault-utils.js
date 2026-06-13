const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');

function formatNumber(n) {
    return n.toLocaleString('id-ID');
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

        const vault = db.getVault();
        const items = Object.entries(vault);

        const embed = new EmbedBuilder()
            .setTitle('📦 Brankas Inventory (Auto-Update)')
            .setColor(0x2b2d31)
            .setTimestamp()
            .setFooter({ text: 'Auto-updated after transaction' });

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
 * This function creates the select menu for a given page plus pagination buttons.
 * 
 * @param {string[]} allItems - All item names
 * @param {number} page - Current page (0-indexed)
 * @param {string} sessionId - Session ID prefix for custom IDs
 * @param {string} selectId - The select menu's action name (e.g., 'item')
 * @param {string|null} selectedItem - Currently selected item
 * @param {string} placeholder - Placeholder text
 * @param {function} labelFn - Optional function to generate label from item name
 * @returns {{ row: ActionRowBuilder, paginationRow: ActionRowBuilder|null, totalPages: number }}
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

module.exports = { sendVaultInfo, buildPaginatedItemSelect, formatNumber };
