// static/fuelrats-rat/callback.js, the script of the page the login popup lands on.
import { readCallbackMessage } from '@/plugins/fuelrats-rat/lib/popupLogin';

const CALLBACK_PATH = '/static/fuelrats-rat/callback.html';

// The script runs on load; a fresh module registry makes each import run it again.
async function runCallback() {
    jest.resetModules();
    await import('../../../static/fuelrats-rat/callback.js');
}

describe('login callback page', () => {
    let close;

    beforeEach(() => {
        close = jest.spyOn(window, 'close').mockImplementation(() => {});
        document.body.innerHTML = '<p id="kiwi-fuelrats-rat-callback-text"></p>';
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete window.opener;
        window.history.replaceState(null, '', '/');
    });

    it('posts the code and state to the opener on this origin, clears the query and closes', async() => {
        let opener = { postMessage: jest.fn() };
        Object.defineProperty(window, 'opener', { value: opener, configurable: true });
        window.history.replaceState(null, '', CALLBACK_PATH + '?code=c0de&state=st4te');

        await runCallback();

        expect(opener.postMessage).toHaveBeenCalledWith({
            type: 'fuelrats-rat-login',
            code: 'c0de',
            state: 'st4te',
            error: '',
        }, window.location.origin);
        expect(window.location.pathname).toBe(CALLBACK_PATH);
        expect(window.location.search).toBe('');
        expect(close).toHaveBeenCalled();
    });

    it('posts the error and the state of an error redirect, which the opener accepts', async() => {
        let opener = { postMessage: jest.fn() };
        Object.defineProperty(window, 'opener', { value: opener, configurable: true });
        window.history.replaceState(null, '', CALLBACK_PATH +
            '?error=access_denied&error_description=The+user+denied+access&state=st4te');

        await runCallback();

        expect(opener.postMessage).toHaveBeenCalledTimes(1);
        let [posted, targetOrigin] = opener.postMessage.mock.calls[0];
        expect(posted).toEqual({
            type: 'fuelrats-rat-login',
            code: '',
            state: 'st4te',
            error: 'access_denied',
        });
        expect(targetOrigin).toBe(window.location.origin);
        expect(window.location.search).toBe('');
        expect(close).toHaveBeenCalled();

        let popup = {};
        let event = { origin: window.location.origin, source: popup, data: posted };
        let expected = { origin: window.location.origin, popup, state: 'st4te' };
        expect(readCallbackMessage(event, expected)).toEqual({ error: 'access_denied' });
    });

    it('says so instead of throwing when there is no opener', async() => {
        Object.defineProperty(window, 'opener', { value: null, configurable: true });
        window.history.replaceState(null, '', CALLBACK_PATH + '?code=c0de&state=st4te');

        await runCallback();

        expect(window.location.search).toBe('');
        expect(close).not.toHaveBeenCalled();
        expect(document.getElementById('kiwi-fuelrats-rat-callback-text').textContent)
            .toContain('could not hand the login back');
    });
});
