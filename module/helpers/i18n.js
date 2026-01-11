/**
 * Internationalization (i18n) Helper Utility
 * Provides easy access to translations throughout the system
 * 
 * Usage:
 *   import { i18n } from './helpers/i18n.js';
 *   i18n('WODSYSTEM.Common.Save')
 *   i18n('WODSYSTEM.CharacterSheet.PersonalInformation')
 *   i18n('WODSYSTEM.Notifications.ParadoxCancelledQuintessence', {count: 2})
 */

/**
 * Translate a key with optional data replacement
 * @param {string} key - Translation key (e.g., 'WODSYSTEM.Common.Save')
 * @param {Object} data - Optional data for string replacement (e.g., {count: 2})
 * @returns {string} Translated string
 */
export function i18n(key, data = {}) {
    // Check if game.i18n is available
    if (!game?.i18n) {
        console.warn(`WoD System: game.i18n not available yet, returning key: ${key}`);
        return key;
    }
    
    let translation = game.i18n.localize(key);
    
    // If translation equals the key, it wasn't found - return key as fallback
    if (translation === key) {
        console.warn(`WoD System: Translation key not found: ${key}`);
        return key;
    }
    
    // Replace placeholders like {count}, {name}, etc.
    if (Object.keys(data).length > 0) {
        for (const [placeholder, value] of Object.entries(data)) {
            translation = translation.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
        }
    }
    
    return translation;
}

/**
 * Format a translation key - helper to ensure consistent key structure
 * @param {...string} parts - Key parts (e.g., 'Common', 'Save')
 * @returns {string} Full translation key
 */
export function i18nKey(...parts) {
    return `WODSYSTEM.${parts.join('.')}`;
}

/**
 * Check if a translation exists
 * @param {string} key - Translation key
 * @returns {boolean} True if translation exists
 */
export function hasTranslation(key) {
    const translation = game.i18n.localize(key);
    return translation !== key;
}
