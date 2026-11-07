// Remembered CMDR name. Uses the classic plugin's cookie (`FuelRats_cmdrName`, one year) so a
// returning client keeps their name across the switch from the classic client.
const COOKIE_PREFIX = 'FuelRats';
const CMDR_NAME_COOKIE = '_cmdrName';
const CMDR_NAME_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function cookieName(name) {
    return COOKIE_PREFIX + name;
}

function decode(value) {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        // The classic plugin wrote values with escape(); non-ASCII escapes are not URI-decodable.
        return value;
    }
}

export function getCookie(name, doc = document) {
    let wanted = cookieName(name) + '=';
    let found = doc.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(wanted));
    return found ? decode(found.substring(wanted.length)) : null;
}

export function setCookie(name, value, ttlMs, doc = document, now = Date.now()) {
    let expires = new Date(now + ttlMs).toUTCString();
    doc.cookie = `${cookieName(name)}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

export function rememberedCmdrName(doc = document) {
    return getCookie(CMDR_NAME_COOKIE, doc) || '';
}

export function rememberCmdrName(name, doc = document) {
    setCookie(CMDR_NAME_COOKIE, name, CMDR_NAME_TTL_MS, doc);
}
