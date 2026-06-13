const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./paths');

const DATA_DIR = getDataDir();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const VAULT_PATH = path.join(DATA_DIR, 'vault.json');
const MEMBERS_PATH = path.join(DATA_DIR, 'members.json');
const TRANSACTIONS_PATH = path.join(DATA_DIR, 'transactions.json');

// --- Helpers ---
function readJSON(filePath, defaultValue) {
    try {
        if (!fs.existsSync(filePath)) {
            writeJSON(filePath, defaultValue);
            return defaultValue;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        writeJSON(filePath, defaultValue);
        return defaultValue;
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Vault ---
function getVault() {
    return readJSON(VAULT_PATH, { 'Labu Kemasan': 0 });
}

function saveVault(vault) {
    writeJSON(VAULT_PATH, vault);
}

function addItem(itemName, amount) {
    const vault = getVault();
    vault[itemName] = (vault[itemName] || 0) + amount;
    saveVault(vault);
    return vault;
}

function removeItem(itemName, amount) {
    const vault = getVault();
    const current = vault[itemName] || 0;
    if (current < amount) {
        return null; // insufficient
    }
    vault[itemName] = current - amount;
    saveVault(vault);
    return vault;
}

function deleteVaultItem(itemName) {
    const vault = getVault();
    if (!(itemName in vault)) return false;
    delete vault[itemName];
    saveVault(vault);
    return true;
}

function getItemNames() {
    return Object.keys(getVault());
}

// --- Members ---
function getMembers() {
    return readJSON(MEMBERS_PATH, []);
}

function saveMembers(members) {
    writeJSON(MEMBERS_PATH, members);
}

function addMember(name) {
    const members = getMembers();
    const normalized = name.trim();
    if (members.find(m => m.toLowerCase() === normalized.toLowerCase())) {
        return false; // already exists
    }
    members.push(normalized);
    saveMembers(members);
    return true;
}

function removeMember(name) {
    const members = getMembers();
    const idx = members.findIndex(m => m.toLowerCase() === name.trim().toLowerCase());
    if (idx === -1) return false;
    members.splice(idx, 1);
    saveMembers(members);
    return true;
}

// --- Transactions ---
function getTransactions() {
    return readJSON(TRANSACTIONS_PATH, []);
}

function logTransaction({ type, item, amount, member, responsible, timestamp }) {
    const transactions = getTransactions();
    transactions.push({
        id: transactions.length + 1,
        type,       // 'deposit' | 'withdraw' | 'setoran'
        item,
        amount,
        member,
        responsible,
        undone: false,
        timestamp: timestamp || new Date().toISOString()
    });
    writeJSON(TRANSACTIONS_PATH, transactions);
    return transactions[transactions.length - 1];
}

function getTransactionById(id) {
    const transactions = getTransactions();
    return transactions.find(t => t.id === id) || null;
}

function markTransactionUndone(id) {
    const transactions = getTransactions();
    const tx = transactions.find(t => t.id === id);
    if (!tx) return null;
    tx.undone = true;
    writeJSON(TRANSACTIONS_PATH, transactions);
    return tx;
}

module.exports = {
    getVault,
    saveVault,
    addItem,
    removeItem,
    deleteVaultItem,
    getItemNames,
    getMembers,
    saveMembers,
    addMember,
    removeMember,
    getTransactions,
    logTransaction,
    getTransactionById,
    markTransactionUndone
};
