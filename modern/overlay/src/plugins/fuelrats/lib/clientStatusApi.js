// Poller for the client-scoped rescue status endpoint (plan section 3, Option B):
//   GET {apiUrl}/rescues/client-status   Authorization: Bearer <token>
//   200 { rescue: { client, system, codeRed, open, rats: [{ name, fr, wr, beacon }] },
//         token?: <pinned continuation token> }
//   404 no open case for this token (yet): keep polling
// The first token is the bootstrap token returned by the announcer; once the API answers with a
// pinned token the poller uses that one from then on.

export const DEFAULT_POLL_INTERVAL_MS = 5000;

export default class ClientStatusPoller {
    /**
     * @param {object} opts
     * @param {string} opts.apiUrl
     * @param {string} opts.token bootstrap token
     * @param {Function} opts.onSnapshot called with the rescue snapshot
     * @param {Function} [opts.onError]
     * @param {number} [opts.intervalMs]
     * @param {Function} [opts.fetchFn]
     */
    constructor(opts) {
        this.url = opts.apiUrl.replace(/\/+$/, '') + '/rescues/client-status';
        this.token = opts.token;
        this.onSnapshot = opts.onSnapshot;
        this.onError = opts.onError || (() => {});
        this.intervalMs = opts.intervalMs || DEFAULT_POLL_INTERVAL_MS;
        this.fetchFn = opts.fetchFn || window.fetch.bind(window);
        this.timer = null;
        this.stopped = true;
    }

    start() {
        this.stopped = false;
        this.schedule(0);
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        this.timer = null;
    }

    schedule(delayMs) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.poll(), delayMs);
    }

    async poll() {
        try {
            await this.tick();
        } catch (err) {
            this.onError(err);
        }
        if (!this.stopped) {
            this.schedule(this.intervalMs);
        }
    }

    /**
     * One request. Resolves to the snapshot, or null while there is no open case.
     */
    async tick() {
        let response = await this.fetchFn(this.url, {
            method: 'GET',
            credentials: 'omit',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + this.token,
            },
        });
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw new Error(`client-status answered HTTP ${response.status}`);
        }

        let body = await response.json();
        if (body.token) {
            this.token = body.token;
        }
        if (body.rescue) {
            this.onSnapshot(body.rescue);
            if (!body.rescue.open) {
                this.stop();
            }
        }
        return body.rescue || null;
    }
}
