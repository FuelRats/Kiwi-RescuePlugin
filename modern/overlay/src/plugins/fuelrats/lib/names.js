// CMDR name handling, ported verbatim from the classic plugin's SetCommanderInfo().
import { removeDiacritics, transliterate } from './diacritics';

export const MAX_NICK_LENGTH = 30;

/**
 * The CMDR name as the rescue (and the r@tsignal) should show it.
 * @param {string} cmdrName raw form input
 * @returns {string}
 */
export function sanitizeCMDRName(cmdrName) {
    let name = cmdrName.replace(/^cmdr/i, '').trim();
    name = name.replace(/^[@#]/i, '').trim();
    return name;
}

/**
 * A valid IRC nick derived from the CMDR name.
 * @param {string} cmdrName raw form input
 * @returns {string}
 */
export function sanitizeIRCName(cmdrName) {
    let name = cmdrName.trim().replace(/^cmdr/i, '').trim();
    name = name.replace(/\s+/g, '_');
    name = name.split(' ').join('_');
    name = name.replace(/\./g, '');
    name = transliterate(name);
    name = removeDiacritics(name);
    name = name.replace(/([^A-Za-z0-9[\]{}^_])/g, '');
    name = name.replace(/([^A-Za-z0-9[\]{}^´`_\\|-]+)/g, '');
    if (name.match(/^\d+/)) {
        name = 'c_' + name;
    }

    if (name.length > MAX_NICK_LENGTH) {
        name = name.substring(0, MAX_NICK_LENGTH);
    }
    return name;
}

/**
 * Nick for a CMDR name with no characters left after sanitization (e.g. Greek or Japanese script).
 * The real CMDR name still reaches the r@tsignal; the announce adds "IRC Nickname: <nick>".
 * @param {Function} [random]
 */
export function fallbackNick(random = Math.random) {
    return 'Client_' + String(Math.floor(random() * 1000)).padStart(3, '0');
}
