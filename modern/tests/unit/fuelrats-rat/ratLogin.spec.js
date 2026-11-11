import { webcrypto } from 'crypto';
import {
    ERR_LOGGED_OUT, ERR_NETWORK, ERR_NO_ACCOUNT, ERR_UNAUTHORIZED, ERR_UNAVAILABLE
} from '@/plugins/fuelrats-rat/lib/errors';
import { MESSAGES } from '@/plugins/fuelrats-rat/lib/messages';
import { s256Challenge } from '@/plugins/fuelrats-rat/lib/pkce';
import { CALLBACK_MESSAGE_TYPE } from '@/plugins/fuelrats-rat/lib/popupLogin';
import RatLogin, {
    emptyLoginState, loginConfigured, STATUS_LOGGED_IN, STATUS_LOGGED_OUT
} from '@/plugins/fuelrats-rat/lib/ratLogin';

const ORIGIN = 'https://kiwi.fuelrats.com';
const CONFIG = {
    websiteUrl: 'https://fuelrats.com',
    apiUrl: 'https://api.fuelrats.com',
    clientId: 'b4d3c0e5-7f1a-4c2e-9d8b-61a2f0e3c9d7',
    redirectUri: ORIGIN + '/static/fuelrats-rat/callback.html',
};
const BEARER = 'Xq7Lm2Rt9Vb4Nc8Kp3Wd6Hf1Js5Gz0Ay';
const IRC_TOKEN = 'frk1:1782893400:' + '3f'.repeat(32);

function response(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    };
}

function fakeWindow() {
    let listeners = new Set();
    let popup = {
        closed: false,
        location: { replace: jest.fn() },
        close: jest.fn(() => {
            popup.closed = true;
        }),
    };
    return {
        popup,
        location: { origin: ORIGIN, hostname: 'kiwi.fuelrats.com' },
        open: jest.fn(() => popup),
        addEventListener: (type, fn) => listeners.add(fn),
        removeEventListener: (type, fn) => listeners.delete(fn),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        dispatch: (event) => listeners.forEach((fn) => fn(event)),
    };
}

function setup(config = CONFIG) {
    let win = fakeWindow();
    let store = emptyLoginState();
    let fetchFn = jest.fn();
    let log = { info: jest.fn(), error: jest.fn() };
    let ratLogin = new RatLogin({
        settings: () => config,
        store,
        win,
        fetchFn,
        cryptoObj: webcrypto,
        log,
    });
    return { win, store, fetchFn, log, ratLogin };
}

function nextTurn() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

// Web Crypto resolves on a later turn of the event loop; wait for the popup to be navigated.
async function authorizeUrlOf(win, turns = 50) {
    let calls = win.popup.location.replace.mock.calls;
    if (calls.length > 0) {
        return new URL(calls[0][0]);
    }
    if (turns === 0) {
        throw new Error('the popup was never sent to the authorize page');
    }
    await nextTurn();
    return authorizeUrlOf(win, turns - 1);
}

async function logIn(ctx) {
    ctx.fetchFn.mockResolvedValueOnce(response(200, { access_token: BEARER, token_type: 'bearer' }));
    let pending = ctx.ratLogin.login();
    let url = await authorizeUrlOf(ctx.win);
    ctx.win.dispatch({
        origin: ORIGIN,
        source: ctx.win.popup,
        data: { type: CALLBACK_MESSAGE_TYPE, code: 'c0de', state: url.searchParams.get('state') },
    });
    await expect(pending).resolves.toBe(true);
    return url;
}

describe('rat login', () => {
    it('is not offered without a client id', async() => {
        let ctx = setup({ ...CONFIG, clientId: '' });
        expect(ctx.ratLogin.available()).toBe(false);
        await expect(ctx.ratLogin.login()).resolves.toBe(false);
        expect(ctx.win.open).not.toHaveBeenCalled();
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
    });

    it('is offered only for a callback on this origin and with Web Crypto', () => {
        expect(loginConfigured(CONFIG, ORIGIN)).toBe(true);
        expect(loginConfigured(CONFIG, 'http://localhost:8099')).toBe(false);
        expect(loginConfigured({ ...CONFIG, redirectUri: 'not a url' }, ORIGIN)).toBe(false);

        let ctx = setup();
        expect(ctx.ratLogin.available()).toBe(true);
        ctx.ratLogin.cryptoObj = { getRandomValues: webcrypto.getRandomValues };
        expect(ctx.ratLogin.available()).toBe(false);
    });

    it('logs in with PKCE and keeps the bearer out of the shared state', async() => {
        let ctx = setup();
        let url = await logIn(ctx);

        expect(ctx.fetchFn).toHaveBeenCalledTimes(1);
        let [tokenUrl, init] = ctx.fetchFn.mock.calls[0];
        let form = new URLSearchParams(init.body);
        expect(tokenUrl).toBe('https://api.fuelrats.com/oauth2/token');
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('omit');
        expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        expect(Object.fromEntries(form)).toEqual({
            grant_type: 'authorization_code',
            client_id: CONFIG.clientId,
            code: 'c0de',
            redirect_uri: CONFIG.redirectUri,
            code_verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        });
        let challenge = await s256Challenge(form.get('code_verifier'), webcrypto.subtle);
        expect(url.searchParams.get('code_challenge')).toBe(challenge);
        expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);

        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.status).toBe(STATUS_LOGGED_IN);
        expect(JSON.stringify(ctx.store)).not.toContain(BEARER);
    });

    it('asks to allow pop-ups when the popup is blocked', async() => {
        let ctx = setup();
        ctx.win.open.mockReturnValue(null);
        await expect(ctx.ratLogin.login()).resolves.toBe(false);
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
        expect(ctx.store.error).toBe('Allow pop-ups for kiwi.fuelrats.com, then try again.');
    });

    it('mints an IRC login with the bearer', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockResolvedValueOnce(response(200, {
            account: 'Jameson', password: IRC_TOKEN, expiresIn: 60,
        }));

        await expect(ctx.ratLogin.mint()).resolves.toEqual({ account: 'Jameson', password: IRC_TOKEN });
        let [mintUrl, init] = ctx.fetchFn.mock.calls[1];
        expect(mintUrl).toBe('https://api.fuelrats.com/irc/sasl-token');
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('omit');
        expect(init.headers.Authorization).toBe('Bearer ' + BEARER);
        expect(ctx.store.account).toBe('Jameson');
        expect(ctx.store.minting).toBe(false);
        expect(JSON.stringify(ctx.store)).not.toContain(IRC_TOKEN);
    });

    it('resets to logged-out on 401', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockResolvedValueOnce(response(401, { errors: [] }));

        await expect(ctx.ratLogin.mint()).rejects.toMatchObject({ kind: ERR_UNAUTHORIZED });
        expect(ctx.ratLogin.loggedIn).toBe(false);
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
        expect(ctx.store.error).toBe(MESSAGES[ERR_UNAUTHORIZED]);

        let calls = ctx.fetchFn.mock.calls.length;
        await expect(ctx.ratLogin.mint()).rejects.toMatchObject({ kind: ERR_LOGGED_OUT });
        expect(ctx.fetchFn.mock.calls.length).toBe(calls);
    });

    it('links the profile when the account has no Anope account (400)', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockResolvedValueOnce(response(400, { errors: [] }));

        await expect(ctx.ratLogin.mint()).rejects.toMatchObject({ kind: ERR_NO_ACCOUNT });
        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.error).toBe(MESSAGES[ERR_NO_ACCOUNT]);
        expect(ctx.store.errorLink).toBe('https://fuelrats.com/profile/overview');
    });

    it('reports a temporarily unavailable login (503) and keeps the bearer', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockResolvedValueOnce(response(503, { errors: [] }));

        await expect(ctx.ratLogin.mint()).rejects.toMatchObject({ kind: ERR_UNAVAILABLE });
        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.error).toBe(MESSAGES[ERR_UNAVAILABLE]);
        expect(ctx.store.errorLink).toBe('');
    });

    it('keeps the bearer when the API cannot be reached', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        await expect(ctx.ratLogin.mint()).rejects.toMatchObject({ kind: ERR_NETWORK });
        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.error).toBe(MESSAGES[ERR_NETWORK]);
    });

    it('revokes the bearer on log out', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockResolvedValueOnce(response(200, {}));

        await ctx.ratLogin.logout();
        let [revokeUrl, init] = ctx.fetchFn.mock.calls[1];
        expect(revokeUrl).toBe('https://api.fuelrats.com/oauth2/revoke');
        expect(init.credentials).toBe('omit');
        expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
            client_id: CONFIG.clientId,
            token: BEARER,
        });
        expect(ctx.ratLogin.loggedIn).toBe(false);
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
    });

    it('drops the bearer on log out even when the revoke fails', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        await ctx.ratLogin.logout();
        expect(ctx.ratLogin.loggedIn).toBe(false);
        expect(ctx.log.error).toHaveBeenCalled();
    });
});
