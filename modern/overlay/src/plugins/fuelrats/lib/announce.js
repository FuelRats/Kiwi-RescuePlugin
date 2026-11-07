// Client announce: POST {announcerUrl} (JIRAAnnouncer jiraannouncer/views/client.py), which posts
// the r@tsignal to #fuelrats. Same form-encoded fields as the classic plugin.
import { getLanguageName } from './langNames';

// The announcer accepts the call when its Referer is one of the client origins. The page itself is
// served with `Referrer-Policy: no-referrer`, so this request sets its own policy, which sends
// only the origin (https://clients.fuelrats.com/) cross-origin.
export const ANNOUNCE_REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * The classic "extradata" string: browser language, plus the IRC nick when it differs from the
 * CMDR name (so dispatch can match the nick to the case).
 * @param {string} cmdrName
 * @param {string} ircNick
 * @param {string} browserLanguage navigator.language
 */
export function buildExtraData(cmdrName, ircNick, browserLanguage) {
    let extra = browserLanguage ?
        'Language: ' + getLanguageName(browserLanguage) + ' (' + browserLanguage + ')' :
        'x';
    if (cmdrName !== ircNick) {
        extra += ' - IRC Nickname: ' + ircNick;
    }
    return extra;
}

/**
 * @param {object} info
 * @param {string} info.cmdrName
 * @param {string} info.ircNick
 * @param {string} info.system
 * @param {string} info.platform
 * @param {boolean} info.eo2 true when the client is on emergency O2
 * @param {string} info.expansion
 * @param {string} browserLanguage
 */
export function buildAnnouncePayload(info, browserLanguage) {
    return {
        cmdrname: info.cmdrName,
        EO2: info.eo2 ? 'NOT OK' : 'OK',
        system: info.system,
        platform: info.platform,
        extradata: buildExtraData(info.cmdrName, info.ircNick, browserLanguage),
        odyssey: info.expansion,
    };
}

/**
 * Send the announce. With readResponse=false this is a no-cors "simple" request, exactly like the
 * classic jQuery call: the announcer needs no CORS headers and the response is opaque.
 * @param {string} url
 * @param {object} payload from buildAnnouncePayload()
 * @param {object} [opts]
 * @param {boolean} [opts.readResponse] parse the JSON response (needs CORS on the announcer)
 * @param {Function} [opts.fetchFn]
 * @returns {Promise<object|null>} the JSON response when readResponse is set, otherwise null
 */
export async function sendAnnounce(url, payload, opts = {}) {
    let fetchFn = opts.fetchFn || window.fetch.bind(window);
    let response = await fetchFn(url, {
        method: 'POST',
        mode: opts.readResponse ? 'cors' : 'no-cors',
        credentials: 'omit',
        referrerPolicy: ANNOUNCE_REFERRER_POLICY,
        keepalive: true,
        body: new URLSearchParams(payload),
    });

    if (!opts.readResponse) {
        return null;
    }
    if (!response.ok) {
        throw new Error(`Announcer ${url} answered HTTP ${response.status}`);
    }
    return response.json();
}
