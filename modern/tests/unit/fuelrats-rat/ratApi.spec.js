import { ERR_FAILED, ERR_NETWORK, ERR_NO_ACCOUNT, ERR_UNVERIFIED } from '@/plugins/fuelrats-rat/lib/errors';
import { exchangeCode, mintSaslToken, REQUEST_TIMEOUT_MS } from '@/plugins/fuelrats-rat/lib/ratApi';

const API_URL = 'https://api.fuelrats.com';
const BEARER = 'Xq7Lm2Rt9Vb4Nc8Kp3Wd6Hf1Js5Gz0Ay';
const IRC_TOKEN = 'frk1:1782893400:' + '3f'.repeat(32);

// A 400 of POST /irc/sasl-token as the API sends it (JSON:API error document).
function refusal(source, detail) {
    return {
        errors: [{
            id: '7d4c2a91-5e3b-4f60-8a1d-2c9e6b0f4a37',
            links: { about: 'https://fuelrats.com/profile/overview' },
            status: 'bad_request',
            code: 400,
            title: 'Bad Request',
            detail,
            source,
        }],
    };
}

const UNVERIFIED_BODY = refusal(
    { pointer: '/email' },
    'Verify the email address of your Fuel Rats account before logging in to IRC with it'
);

function response(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    };
}

// What response.json() does with an HTML error page from a proxy.
function htmlResponse(status) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
    };
}

// Like a stalled browser request: settles only when it is aborted.
function untilAborted(signal) {
    return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
            reject(new Error('The user aborted a request.'));
        });
    });
}

function answering(res) {
    return jest.fn(() => Promise.resolve(res));
}

function exchange(fetchFn) {
    return exchangeCode({
        apiUrl: API_URL,
        clientId: 'b4d3c0e5-7f1a-4c2e-9d8b-61a2f0e3c9d7',
        redirectUri: 'https://kiwi.fuelrats.com/static/fuelrats-rat/callback.html',
        code: 'c0de',
        verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        fetchFn,
    });
}

function mint(fetchFn) {
    return mintSaslToken({ apiUrl: API_URL, bearer: BEARER, fetchFn });
}

// Wait, without timers, until the mock was called (it is called after a few promise turns).
async function calledSoon(fn, turns = 20) {
    if (fn.mock.calls.length > 0 || turns === 0) {
        return;
    }
    await Promise.resolve();
    await calledSoon(fn, turns - 1);
}

describe('token exchange', () => {
    it('returns the access token', async() => {
        let fetchFn = answering(response(200, { access_token: BEARER, token_type: 'bearer' }));
        await expect(exchange(fetchFn)).resolves.toBe(BEARER);
    });

    it('fails on an error status', async() => {
        let fetchFn = answering(response(400, {
            error: 'invalid_grant',
            error_description: 'The authorization code is invalid or has expired',
        }));
        await expect(exchange(fetchFn)).rejects.toMatchObject({
            kind: ERR_FAILED,
            message: 'failed: token exchange answered HTTP 400',
        });
    });

    it('fails on a body that is not JSON', async() => {
        await expect(exchange(answering(htmlResponse(200)))).rejects.toMatchObject({
            kind: ERR_FAILED,
            message: 'failed: token exchange answered with invalid JSON',
        });
    });

    it('fails without an access token', async() => {
        let noToken = { kind: ERR_FAILED, message: 'failed: token exchange returned no access_token' };
        await expect(exchange(answering(response(200, { token_type: 'bearer' }))))
            .rejects.toMatchObject(noToken);
        await expect(exchange(answering(response(200, { access_token: '' }))))
            .rejects.toMatchObject(noToken);
        await expect(exchange(answering(response(200, null)))).rejects.toMatchObject(noToken);
    });
});

describe('IRC token mint', () => {
    it('returns the account and the password', async() => {
        let body = { account: 'Jameson', password: IRC_TOKEN, expiresIn: 60 };
        await expect(mint(answering(response(200, body))))
            .resolves.toEqual({ account: 'Jameson', password: IRC_TOKEN });
    });

    it('fails on a status it does not expect', async() => {
        await expect(mint(answering(response(403, { errors: [] })))).rejects.toMatchObject({
            kind: ERR_FAILED,
            message: 'failed: sasl-token answered HTTP 403',
        });
        await expect(mint(answering(htmlResponse(500)))).rejects.toMatchObject({
            kind: ERR_FAILED,
            message: 'failed: sasl-token answered HTTP 500',
        });
    });

    it('fails on a body that is not JSON', async() => {
        await expect(mint(answering(htmlResponse(200)))).rejects.toMatchObject({
            kind: ERR_FAILED,
            message: 'failed: sasl-token answered with invalid JSON',
        });
    });

    it('tells an unverified website email by the /email pointer of its 400', async() => {
        await expect(mint(answering(response(400, UNVERIFIED_BODY)))).rejects.toMatchObject({
            kind: ERR_UNVERIFIED,
            message: 'unverified: sasl-token answered HTTP 400',
        });
    });

    it.each([
        ['an empty source', response(400, refusal({}, 'Bad Request'))],
        ['another pointer', response(400, refusal({ pointer: '/nick' }, 'Bad Request'))],
        ['a parameter source', response(400, refusal({ parameter: 'email' }, 'Bad Request'))],
        ['no errors', response(400, { errors: [] })],
        ['errors that are not a list', response(400, { errors: { source: { pointer: '/email' } } })],
        ['an error without a source', response(400, { errors: [{ status: 'bad_request' }] })],
        ['a null error', response(400, { errors: [null] })],
        ['a null body', response(400, null)],
        ['a body that is not JSON', htmlResponse(400)],
    ])('takes any other 400 for a missing Anope account: %s', async(what, res) => {
        await expect(mint(answering(res))).rejects.toMatchObject({
            kind: ERR_NO_ACCOUNT,
            message: 'no-account: sasl-token answered HTTP 400',
        });
    });
});

describe('request timeout', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('aborts a request that gets no answer and fails like an unreachable API', async() => {
        let signal = null;
        let fetchFn = jest.fn((url, init) => {
            signal = init.signal;
            return untilAborted(init.signal);
        });
        let pending = mint(fetchFn);

        jest.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1);
        expect(signal.aborted).toBe(false);
        jest.advanceTimersByTime(1);
        expect(signal.aborted).toBe(true);
        await expect(pending).rejects.toMatchObject({
            kind: ERR_NETWORK,
            message: 'network: POST https://api.fuelrats.com/irc/sasl-token timed out after 15 s',
        });
        expect(jest.getTimerCount()).toBe(0);
    });

    it('also gives up on a response whose body never arrives', async() => {
        let json = jest.fn();
        let fetchFn = jest.fn((url, init) => {
            json.mockImplementation(() => untilAborted(init.signal));
            return Promise.resolve({ ok: true, status: 200, json });
        });
        let pending = exchange(fetchFn);
        await calledSoon(json);
        expect(json).toHaveBeenCalled();

        jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
        await expect(pending).rejects.toMatchObject({
            kind: ERR_NETWORK,
            message: 'network: POST https://api.fuelrats.com/oauth2/token timed out after 15 s',
        });
    });

    it('also gives up on a mint 400 whose error body never arrives', async() => {
        let json = jest.fn();
        let fetchFn = jest.fn((url, init) => {
            json.mockImplementation(() => untilAborted(init.signal));
            return Promise.resolve({ ok: false, status: 400, json });
        });
        let pending = mint(fetchFn);
        let settled = jest.fn();
        pending.then(settled, settled);
        await calledSoon(json);
        expect(json).toHaveBeenCalled();
        expect(settled).not.toHaveBeenCalled();

        jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
        await expect(pending).rejects.toMatchObject({
            kind: ERR_NETWORK,
            message: 'network: POST https://api.fuelrats.com/irc/sasl-token timed out after 15 s',
        });
        expect(jest.getTimerCount()).toBe(0);
    });

    it('clears its deadline once the request is answered', async() => {
        await mint(answering(response(200, { account: 'Jameson', password: IRC_TOKEN })));
        expect(jest.getTimerCount()).toBe(0);
        await expect(mint(answering(response(401, { errors: [] })))).rejects.toThrow('HTTP 401');
        expect(jest.getTimerCount()).toBe(0);
        await expect(mint(jest.fn(() => Promise.reject(new TypeError('Failed to fetch')))))
            .rejects.toMatchObject({ kind: ERR_NETWORK });
        expect(jest.getTimerCount()).toBe(0);
    });
});
