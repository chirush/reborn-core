const path = require('path');
const fs = require('fs');

// When compiled with pkg, __dirname points to the read-only snapshot filesystem.
// We need to resolve writable paths relative to the exe's location instead.
const BASE_DIR = process.pkg
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..');

const CONFIG_PATH = path.join(BASE_DIR, 'config.json');
const DATA_DIR = path.join(BASE_DIR, 'data');

/**
 * Get the base directory (where exe lives, or project root in dev)
 */
function getBaseDir() {
    return BASE_DIR;
}

/**
 * Get the path to config.json
 */
function getConfigPath() {
    return CONFIG_PATH;
}

/**
 * Load and return config.json contents
 * @returns {object} Parsed config object
 */
function getConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

/**
 * Check if config.json exists
 */
function configExists() {
    return fs.existsSync(CONFIG_PATH);
}

/**
 * Get the data directory path
 */
function getDataDir() {
    return DATA_DIR;
}

module.exports = {
    BASE_DIR,
    CONFIG_PATH,
    DATA_DIR,
    getBaseDir,
    getConfigPath,
    getConfig,
    configExists,
    getDataDir
};
