import { ERR_DENIED, ERR_FAILED, ERR_POPUP_BLOCKED, ERR_POPUP_CLOSED, ERR_TIMEOUT } from '@/plugins/fuelrats-rat/lib/errors';
import {
    authorizeUrl, CALLBACK_MESSAGE_TYPE, CLOSED_POLL_MS, LOGIN_TIMEOUT_MS, POPUP_NAME,
    readCallbackMessage, runLoginPopup
} from '@/plugins/fuelrats-rat/lib/popupLogin';

const ORIGIN = 'https://kiwi.fuelrats.com';
const STATE = 'Wn1TfOyKv3bqsH0ZgP8cDp2xLmR4uE6yA9sJt5kQhVo';

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

// Enough of window for runLoginPopup; timers go through jest's fake timers.
function fakeWindow(popup) {
    let listeners = new Set();
    return {
        location: { origin: ORIGIN, hostname: 'kiwi.fuelrats.com' },
        open: jest.fn(() => popup),
        addEventListener: (type, fn) => listeners.add(fn),
        removeEventListener: (type, fn) => listeners.delete(fn),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        listenerCount: () => listeners.size,
        dispatch: (event) => listeners.forEach((fn) => fn(event)),
    };
}

function answer(popup, data, origin = ORIGIN) {
    return { origin, source: popup, data: { type: CALLBACK_MESSAGE_TYPE, state: STATE, ...data } };
}

describe('readCallbackMessage', () => {
    let popup = fakePopup();
    let expected = { origin: ORIGIN, popup, state: STATE };

    it('accepts the code from our popup, on our origin, with our state', () => {
        expect(readCallbackMessage(answer(popup, { code: 'c0de' }), expected)).toEqual({ code: 'c0de' });
    });

    it('passes on an error answer with our state', () => {
        let event = answer(popup, { error: 'access_denied' });
        expect(readCallbackMessage(event, expected)).toEqual({ error: 'access_denied' });
    });

    it('rejects a wrong origin', () => {
        let event = answer(popup, { code: 'c0de' }, 'https://fuelrats.com');
        expect(readCallbackMessage(event, expected)).toBeNull();
        let lookalike = answer(popup, { code: 'c0de' }, 'https://kiwi.fuelrats.com.example');
        expect(readCallbackMessage(lookalike, expected)).toBeNull();
    });

    it('rejects a message from another window', () => {
        let event = answer(fakePopup(), { code: 'c0de' });
        expect(readCallbackMessage(event, expected)).toBeNull();
        expect(readCallbackMessage(answer(null, { code: 'c0de' }), expected)).toBeNull();
    });

    it('rejects a wrong or missing state', () => {
        expect(readCallbackMessage(answer(popup, { code: 'c0de', state: 'other' }), expected))
            .toBeNull();
        expect(readCallbackMessage(answer(popup, { code: 'c0de', state: undefined }), expected))
            .toBeNull();
        let noExpectedState = { origin: ORIGIN, popup, state: '' };
        expect(readCallbackMessage(answer(popup, { code: 'c0de', state: '' }), noExpectedState))
            .toBeNull();
    });

    it('ignores an error answer without our state', () => {
        expect(readCallbackMessage(answer(popup, { error: 'access_denied', state: '' }), expected))
            .toBeNull();
        expect(readCallbackMessage(answer(popup, { error: 'access_denied', state: 'other' }), expected))
            .toBeNull();
    });

    it('rejects a missing code', () => {
        expect(readCallbackMessage(answer(popup, {}), expected)).toBeNull();
        expect(readCallbackMessage(answer(popup, { code: '' }), expected)).toBeNull();
        expect(readCallbackMessage(answer(popup, { code: 42 }), expected)).toBeNull();
    });

    it('rejects other messages', () => {
        let wrongType = answer(popup, { code: 'c0de', type: 'kiwi-ipc' });
        expect(readCallbackMessage(wrongType, expected)).toBeNull();
        expect(readCallbackMessage({ origin: ORIGIN, source: popup, data: 'c0de' }, expected))
            .toBeNull();
        expect(readCallbackMessage({ origin: ORIGIN, source: popup, data: null }, expected))
            .toBeNull();
    });
});

describe('authorizeUrl', () => {
    it('asks the website for an S256 code with the irc.login scope', () => {
        let url = new URL(authorizeUrl({
            websiteUrl: 'https://fuelrats.com/',
            clientId: 'kiwi-client-id',
            redirectUri: 'https://kiwi.fuelrats.com/static/fuelrats-rat/callback.html',
        }, STATE, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'));

        expect(url.origin + url.pathname).toBe('https://fuelrats.com/authorize');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            response_type: 'code',
            client_id: 'kiwi-client-id',
            redirect_uri: 'https://kiwi.fuelrats.com/static/fuelrats-rat/callback.html',
            scope: 'irc.login',
            state: STATE,
            code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            code_challenge_method: 'S256',
        });
    });
});

describe('runLoginPopup', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('rejects at once when the popup is blocked', async() => {
        let win = fakeWindow(null);
        await expect(runLoginPopup(win, Promise.resolve('https://fuelrats.com/authorize'), STATE))
            .rejects.toMatchObject({ kind: ERR_POPUP_BLOCKED });
        expect(win.listenerCount()).toBe(0);
    });

    it('opens the popup synchronously, then sends it to the authorize URL', async() => {
        let popup = fakePopup();
        let win = fakeWindow(popup);
        let pending = runLoginPopup(win, Promise.resolve('https://fuelrats.com/authorize?x=1'), STATE);
        expect(win.open).toHaveBeenCalledWith('', POPUP_NAME, expect.any(String));
        await Promise.resolve();
        expect(popup.location.replace).toHaveBeenCalledWith('https://fuelrats.com/authorize?x=1');

        win.dispatch(answer(popup, { code: 'c0de', state: 'other' }));
        win.dispatch(answer(popup, { code: 'c0de' }, 'https://fuelrats.com'));
        win.dispatch(answer(popup, { code: 'c0de' }));

        await expect(pending).resolves.toBe('c0de');
        expect(popup.close).toHaveBeenCalled();
        expect(win.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('rejects with the error the website sent back', async() => {
        let popup = fakePopup();
        let win = fakeWindow(popup);
        let pending = runLoginPopup(win, Promise.resolve('https://fuelrats.com/authorize'), STATE);
        win.dispatch(answer(popup, { error: 'access_denied' }));
        await expect(pending).rejects.toMatchObject({ kind: ERR_DENIED });
    });

    it.each([
        'invalid_request', 'invalid_scope', 'unauthorised_client', 'unsupported_response_type',
        'server_error',
    ])('fails rather than cancels on any other error the website sent back (%s)', async(code) => {
        let popup = fakePopup();
        let win = fakeWindow(popup);
        let pending = runLoginPopup(win, Promise.resolve('https://fuelrats.com/authorize'), STATE);
        win.dispatch(answer(popup, { error: code }));
        await expect(pending).rejects.toMatchObject({ kind: ERR_FAILED, message: 'failed: ' + code });
        expect(popup.close).toHaveBeenCalled();
        expect(win.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('resets when the user closes the popup', async() => {
        let popup = fakePopup();
        let win = fakeWindow(popup);
        let pending = runLoginPopup(win, Promise.resolve('https://fuelrats.com/authorize'), STATE);
        popup.closed = true;
        jest.advanceTimersByTime(CLOSED_POLL_MS * 2);
        await expect(pending).rejects.toMatchObject({ kind: ERR_POPUP_CLOSED });
        expect(win.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('still takes the answer of a callback page that closed itself right after posting', async() => {
        let popup = fakePopup();
        let win = fakeWindow(popup);
        let pending = runLoginPopup(win, Promise.resolve('https://fuelrats.com/authorize'), STATE);
        popup.closed = true;
        jest.advanceTimersByTime(CLOSED_POLL_MS);
        win.dispatch(answer(popup, { code: 'c0de' }));
        await expect(pending).resolves.toBe('c0de');
        expect(win.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('closes the popup and rejects when the authorize URL cannot be built', async() => {
        let popup = fakePopup();
        let win = fakeWindow(popup);
        let err = new Error('SubtleCrypto digest failed');
        let pending = runLoginPopup(win, Promise.reject(err), STATE);
        await expect(pending).rejects.toBe(err);
        expect(popup.close).toHaveBeenCalled();
        expect(popup.location.replace).not.toHaveBeenCalled();
        expect(win.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('closes the popup and resets after the timeout', async() => {
        let popup = fakePopup();
        let win = fakeWindow(popup);
        let pending = runLoginPopup(win, Promise.resolve('https://fuelrats.com/authorize'), STATE);
        jest.advanceTimersByTime(LOGIN_TIMEOUT_MS - 1);
        expect(popup.close).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        await expect(pending).rejects.toMatchObject({ kind: ERR_TIMEOUT });
        expect(popup.close).toHaveBeenCalled();
        expect(win.listenerCount()).toBe(0);
    });
});
