// One rescue request per page load: the intake form starts it, the first IRC registration sends
// the announce. Mirrors the classic plugin's SendAnnounceToIRC() rules:
//   - the announce is only sent if the IRC connection registers within ANNOUNCE_WINDOW_MS of the
//     form submit; otherwise the client is sent back to the get-help page (a stale tab must not
//     raise a new r@tsignal);
//   - it is sent once. Later re-registrations (Kiwi's auto-reconnect) do not announce again.
import { buildAnnouncePayload } from './announce';

export const ANNOUNCE_WINDOW_MS = 30 * 1000;

export const RESULT_ANNOUNCED = 'announced';
export const RESULT_ALREADY_ANNOUNCED = 'already-announced';
export const RESULT_EXPIRED = 'expired';
export const RESULT_NOT_STARTED = 'not-started';

export default class RescueSession {
    /**
     * @param {object} deps
     * @param {Function} deps.announce (payload) => Promise<object|null>
     * @param {Function} deps.redirect (reason) => void, leaves the client
     * @param {Function} [deps.now]
     * @param {string} [deps.browserLanguage]
     */
    constructor(deps) {
        this.deps = deps;
        this.now = deps.now || Date.now;
        this.info = null;
        this.submittedAt = 0;
        this.announced = false;
        this.announcePromise = null;
    }

    /**
     * @param {object} info { cmdrName, ircNick, system, platform, eo2, expansion }
     */
    begin(info) {
        this.info = { ...info };
        this.submittedAt = this.now();
        this.announced = false;
        this.announcePromise = null;
    }

    /**
     * Call on every IRC 'registered' event.
     * @param {string} currentNick the nick the server accepted (may differ after a collision)
     * @returns {string} one of the RESULT_* values
     */
    handleRegistered(currentNick) {
        if (!this.info) {
            return RESULT_NOT_STARTED;
        }
        if (this.announced) {
            return RESULT_ALREADY_ANNOUNCED;
        }
        if (this.now() - this.submittedAt > ANNOUNCE_WINDOW_MS) {
            this.deps.redirect('announce-window-expired');
            return RESULT_EXPIRED;
        }

        this.announced = true;
        this.info.ircNick = currentNick || this.info.ircNick;
        let payload = buildAnnouncePayload(this.info, this.deps.browserLanguage);
        this.announcePromise = Promise.resolve().then(() => this.deps.announce(payload));
        return RESULT_ANNOUNCED;
    }
}
