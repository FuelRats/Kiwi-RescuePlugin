import { webcrypto } from 'crypto';
import { wrapConnect } from '@/plugins/fuelrats-rat/lib/connectWrapper';
import {
    ERR_DENIED, ERR_FAILED, ERR_LOGGED_OUT, ERR_NETWORK, ERR_NO_ACCOUNT, ERR_UNAUTHORIZED,
    ERR_UNAVAILABLE, ERR_UNVERIFIED
} from '@/plugins/fuelrats-rat/lib/errors';
import { MESSAGES } from '@/plugins/fuelrats-rat/lib/messages';
import { s256Challenge } from '@/plugins/fuelrats-rat/lib/pkce';
import { CALLBACK_MESSAGE_TYPE } from '@/plugins/fuelrats-rat/lib/popupLogin';
import { REQUEST_TIMEOUT_MS } from '@/plugins/fuelrats-rat/lib/ratApi';
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
const NEXT_BEARER = 'Tg5Ub8Ye1Rc3Wm6Qn9Lz2Fk4Hs7Dv0Px';
const IRC_TOKEN = 'frk1:1782893400:' + '3f'.repeat(32);

function response(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    };
}

function fakePopup() {
    let popup = {
        closed: false,
        location: { replace: jest.fn() },
        close: jest.fn(() => {
            popup.closed = true;
        }),
    };
    return popup;
}

// win.popup is the popup of the latest login attempt.
function fakeWindow() {
    let listeners = new Set();
    let win = {
        popup: null,
        location: { origin: ORIGIN, hostname: 'kiwi.fuelrats.com' },
        open: jest.fn(() => {
            win.popup = fakePopup();
            return win.popup;
        }),
        addEventListener: (type, fn) => listeners.add(fn),
        removeEventListener: (type, fn) => listeners.delete(fn),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        dispatch: (event) => listeners.forEach((fn) => fn(event)),
    };
    return win;
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

async function logIn(ctx, bearer = BEARER) {
    ctx.fetchFn.mockResolvedValueOnce(response(200, { access_token: bearer, token_type: 'bearer' }));
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

// A mint request the test answers later: returns the function that answers it.
function pendingMint(ctx) {
    let answerMint = null;
    ctx.fetchFn.mockReturnValueOnce(new Promise((resolve) => {
        answerMint = resolve;
    }));
    return (res) => answerMint(res);
}

// A mint request that never gets an answer: it fails when the test calls the returned function,
// or, like a stalled browser request, when it is aborted.
function failingMint(ctx) {
    let failMint = null;
    ctx.fetchFn.mockImplementationOnce((url, init) => new Promise((resolve, reject) => {
        failMint = reject;
        init.signal.addEventListener('abort', () => {
            reject(new Error('The user aborted a request.'));
        });
    }));
    return (err) => failMint(err);
}

// A network wrapped like the plugin wraps it, whose Kiwi connect only records the call.
function wrappedNetwork(ctx) {
    let kiwiConnect = jest.fn();
    let network = { connection: { nick: 'Guest42' }, password: '', ircClient: { connect: kiwiConnect } };
    let onMintError = jest.fn();
    wrapConnect(network, {
        useLogin: () => ctx.store.useLogin,
        mint: () => ctx.ratLogin.mint(),
        onMintError,
    });
    return { network, kiwiConnect, onMintError };
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

    it('says the login was cancelled when the website answers with an error and our state', async() => {
        let ctx = setup();
        let pending = ctx.ratLogin.login();
        let url = await authorizeUrlOf(ctx.win);
        ctx.win.dispatch({
            origin: ORIGIN,
            source: ctx.win.popup,
            data: {
                type: CALLBACK_MESSAGE_TYPE,
                code: '',
                state: url.searchParams.get('state'),
                error: 'access_denied',
            },
        });

        await expect(pending).resolves.toBe(false);
        expect(ctx.win.popup.close).toHaveBeenCalled();
        expect(ctx.fetchFn).not.toHaveBeenCalled();
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
        expect(ctx.store.error).toBe(MESSAGES[ERR_DENIED]);
    });

    it('says the login failed when the website answers with another error and our state', async() => {
        let ctx = setup();
        let pending = ctx.ratLogin.login();
        let url = await authorizeUrlOf(ctx.win);
        ctx.win.dispatch({
            origin: ORIGIN,
            source: ctx.win.popup,
            data: {
                type: CALLBACK_MESSAGE_TYPE,
                code: '',
                state: url.searchParams.get('state'),
                error: 'invalid_scope',
            },
        });

        await expect(pending).resolves.toBe(false);
        expect(ctx.win.popup.close).toHaveBeenCalled();
        expect(ctx.fetchFn).not.toHaveBeenCalled();
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
        expect(ctx.store.error).toBe(MESSAGES[ERR_FAILED]);
        expect(ctx.log.info).toHaveBeenCalledWith('Fuel Rats login failed: failed: invalid_scope');
    });

    it('fails the login when the code exchange fails', async() => {
        let ctx = setup();
        ctx.fetchFn.mockResolvedValueOnce(response(400, { error: 'invalid_grant' }));
        let pending = ctx.ratLogin.login();
        let url = await authorizeUrlOf(ctx.win);
        ctx.win.dispatch({
            origin: ORIGIN,
            source: ctx.win.popup,
            data: { type: CALLBACK_MESSAGE_TYPE, code: 'c0de', state: url.searchParams.get('state') },
        });

        await expect(pending).resolves.toBe(false);
        expect(ctx.ratLogin.loggedIn).toBe(false);
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
        expect(ctx.store.error).toBe(MESSAGES[ERR_FAILED]);
    });

    it('opens one popup when the login is started twice', async() => {
        let ctx = setup();
        let first = ctx.ratLogin.login();
        let second = ctx.ratLogin.login();
        expect(ctx.win.open).toHaveBeenCalledTimes(1);
        await expect(second).resolves.toBe(false);

        ctx.fetchFn.mockResolvedValueOnce(response(200, { access_token: BEARER, token_type: 'bearer' }));
        let url = await authorizeUrlOf(ctx.win);
        ctx.win.dispatch({
            origin: ORIGIN,
            source: ctx.win.popup,
            data: { type: CALLBACK_MESSAGE_TYPE, code: 'c0de', state: url.searchParams.get('state') },
        });
        await expect(first).resolves.toBe(true);
        expect(ctx.store.status).toBe(STATUS_LOGGED_IN);
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

    it('asks to verify the email and links the profile when it is unverified (400 /email)', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockResolvedValueOnce(response(400, {
            errors: [{ status: 'bad_request', source: { pointer: '/email' } }],
        }));

        await expect(ctx.ratLogin.mint()).rejects.toMatchObject({ kind: ERR_UNVERIFIED });
        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.status).toBe(STATUS_LOGGED_IN);
        expect(ctx.store.error)
            .toBe('Verify the email address of your Fuel Rats account, then try again.');
        expect(ctx.store.error).toBe(MESSAGES[ERR_UNVERIFIED]);
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

    it.each([403, 500])('keeps the bearer on a mint status it does not expect (%i)', async(status) => {
        let ctx = setup();
        await logIn(ctx);
        ctx.fetchFn.mockResolvedValueOnce(response(status, { errors: [] }));

        await expect(ctx.ratLogin.mint()).rejects.toMatchObject({ kind: ERR_FAILED });
        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.status).toBe(STATUS_LOGGED_IN);
        expect(ctx.store.error).toBe(MESSAGES[ERR_FAILED]);
    });

    it('leaves a new login alone when the mint of the previous one answers 401', async() => {
        let ctx = setup();
        await logIn(ctx);
        let answerMint = pendingMint(ctx);
        let minting = ctx.ratLogin.mint();

        ctx.fetchFn.mockResolvedValueOnce(response(200, {}));
        await ctx.ratLogin.logout();
        await logIn(ctx, NEXT_BEARER);
        ctx.fetchFn.mockResolvedValueOnce(response(200, {
            account: 'Jameson', password: IRC_TOKEN, expiresIn: 60,
        }));
        await ctx.ratLogin.mint();
        answerMint(response(401, { errors: [] }));

        await expect(minting).rejects.toMatchObject({ kind: ERR_UNAUTHORIZED });
        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.status).toBe(STATUS_LOGGED_IN);
        expect(ctx.store.account).toBe('Jameson');
        expect(ctx.store.error).toBe('');
        expect(ctx.store.errorLink).toBe('');

        ctx.fetchFn.mockResolvedValueOnce(response(200, {
            account: 'Jameson', password: IRC_TOKEN, expiresIn: 60,
        }));
        await ctx.ratLogin.mint();
        let [, init] = ctx.fetchFn.mock.calls[ctx.fetchFn.mock.calls.length - 1];
        expect(init.headers.Authorization).toBe('Bearer ' + NEXT_BEARER);
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

    it('discards a token minted across a log out and does not connect', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.store.useLogin = true;
        let { network, kiwiConnect, onMintError } = wrappedNetwork(ctx);
        let answerMint = pendingMint(ctx);
        let connecting = network.ircClient.connect();
        expect(ctx.store.minting).toBe(true);

        ctx.fetchFn.mockResolvedValueOnce(response(200, {}));
        await ctx.ratLogin.logout();
        answerMint(response(200, { account: 'Jameson', password: IRC_TOKEN, expiresIn: 60 }));

        await expect(connecting).resolves.toBe(false);
        expect(kiwiConnect).not.toHaveBeenCalled();
        expect(network.password).toBe('');
        expect(network.connection.nick).toBe('Guest42');
        expect(onMintError).toHaveBeenCalledWith(network, expect.objectContaining({
            kind: ERR_LOGGED_OUT,
        }));
        expect(ctx.ratLogin.loggedIn).toBe(false);
        expect(ctx.store.minting).toBe(false);
        expect(ctx.store.account).toBe('');
        expect(ctx.store.error).toBe('');
    });

    it('says nothing about an expired login when a mint across a log out answers 401', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.store.useLogin = true;
        let { network, kiwiConnect, onMintError } = wrappedNetwork(ctx);
        let answerMint = pendingMint(ctx);
        let connecting = network.ircClient.connect();

        ctx.fetchFn.mockResolvedValueOnce(response(200, {}));
        await ctx.ratLogin.logout();
        answerMint(response(401, { errors: [] }));

        await expect(connecting).resolves.toBe(false);
        expect(kiwiConnect).not.toHaveBeenCalled();
        expect(network.password).toBe('');
        expect(onMintError).toHaveBeenCalledWith(network, expect.objectContaining({
            kind: ERR_UNAUTHORIZED,
        }));
        expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
        expect(ctx.store.minting).toBe(false);
        expect(ctx.store.error).toBe('');
        expect(ctx.store.errorLink).toBe('');
    });

    describe('a mint across a log out that cannot reach the API', () => {
        // The login itself needs real timers (Web Crypto, nextTurn); each test fakes them after it.
        afterEach(() => {
            jest.useRealTimers();
        });

        it.each([
            [
                'fails like an unreachable API',
                (failMint) => failMint(new TypeError('Failed to fetch')),
                'network: POST https://api.fuelrats.com/irc/sasl-token failed: Failed to fetch',
            ],
            [
                'times out',
                () => jest.advanceTimersByTime(REQUEST_TIMEOUT_MS),
                'network: POST https://api.fuelrats.com/irc/sasl-token timed out after 15 s',
            ],
        ])('says nothing and does not connect when it %s', async(how, endMint, message) => {
            let ctx = setup();
            await logIn(ctx);
            ctx.store.useLogin = true;
            let { network, kiwiConnect, onMintError } = wrappedNetwork(ctx);
            jest.useFakeTimers();
            let failMint = failingMint(ctx);
            let connecting = network.ircClient.connect();
            expect(ctx.store.minting).toBe(true);

            ctx.fetchFn.mockResolvedValueOnce(response(200, {}));
            await ctx.ratLogin.logout();
            endMint(failMint);

            await expect(connecting).resolves.toBe(false);
            expect(kiwiConnect).not.toHaveBeenCalled();
            expect(network.password).toBe('');
            expect(network.connection.nick).toBe('Guest42');
            expect(onMintError).toHaveBeenCalledWith(network, expect.objectContaining({
                kind: ERR_NETWORK,
                message,
            }));
            expect(ctx.store.status).toBe(STATUS_LOGGED_OUT);
            expect(ctx.store.minting).toBe(false);
            expect(ctx.store.error).toBe('');
            expect(ctx.store.errorLink).toBe('');
        });
    });

    it('discards a token minted for the previous login after a new one', async() => {
        let ctx = setup();
        await logIn(ctx);
        ctx.store.useLogin = true;
        let { network, kiwiConnect } = wrappedNetwork(ctx);
        let answerMint = pendingMint(ctx);
        let connecting = network.ircClient.connect();

        ctx.fetchFn.mockResolvedValueOnce(response(200, {}));
        await ctx.ratLogin.logout();
        await logIn(ctx, NEXT_BEARER);
        answerMint(response(200, { account: 'Jameson', password: IRC_TOKEN, expiresIn: 60 }));

        await expect(connecting).resolves.toBe(false);
        expect(kiwiConnect).not.toHaveBeenCalled();
        expect(network.password).toBe('');
        expect(ctx.ratLogin.loggedIn).toBe(true);
        expect(ctx.store.account).toBe('');
        expect(ctx.store.error).toBe('');
    });
});
