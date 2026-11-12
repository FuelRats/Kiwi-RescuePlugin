// The OAuth authorization-code popup of the rat login. The popup opens the website's /authorize
// page, which redirects it to static/fuelrats-rat/callback.html; that page posts
// { type, code, state } (or { type, error, state }) back to this window and closes.
import {
    ERR_DENIED, ERR_FAILED, ERR_POPUP_BLOCKED, ERR_POPUP_CLOSED, ERR_TIMEOUT, LoginError
} from './errors';

export const CALLBACK_MESSAGE_TYPE = 'fuelrats-rat-login';
export const LOGIN_SCOPE = 'irc.login';
export const POPUP_NAME = 'fuelrats-rat-login';
export const POPUP_FEATURES = 'width=520,height=720';
export const CLOSED_POLL_MS = 500;
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

// The authorize error of a user who chose Deny (RFC 6749 4.1.2.1). Any other error code means the
// request or the website is misconfigured, so the login failed rather than being cancelled.
export const ERROR_ACCESS_DENIED = 'access_denied';

/**
 * The website's authorize URL for one login attempt.
 *
 * The website redirects the popup to redirectUri?code=...&state=..., so the code and the state
 * land in the host nginx access log (and the web container's). That is accepted, so keep the flow
 * as it is: the code is single-use, expires after 10 minutes and is bound to this attempt's PKCE
 * verifier, which never leaves this page's memory (api src/routes/OAuth2.mjs:504, 519).
 * @param {object} cfg { websiteUrl, clientId, redirectUri }
 * @param {string} state
 * @param {string} challenge S256 code_challenge
 * @returns {string}
 */
export function authorizeUrl(cfg, state, challenge) {
    let params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        scope: LOGIN_SCOPE,
        state: state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    });
    return cfg.websiteUrl.replace(/\/+$/, '') + '/authorize?' + params.toString();
}

/**
 * Check a message event against the attempt it should answer: same origin as this page, sent by
 * the popup this attempt opened, and echoing its state.
 * @param {MessageEvent} event
 * @param {object} expected { origin, popup, state }
 * @returns {{code: string}|{error: string}|null} null for anything that is not the answer
 */
export function readCallbackMessage(event, expected) {
    if (!event || event.origin !== expected.origin) {
        return null;
    }
    if (!expected.popup || event.source !== expected.popup) {
        return null;
    }
    let data = event.data;
    if (!data || typeof data !== 'object' || data.type !== CALLBACK_MESSAGE_TYPE) {
        return null;
    }
    if (!expected.state || typeof data.state !== 'string' || data.state !== expected.state) {
        return null;
    }
    if (typeof data.error === 'string' && data.error) {
        return { error: data.error };
    }
    if (typeof data.code !== 'string' || !data.code) {
        return null;
    }
    return { code: data.code };
}

/**
 * Open the login popup and wait for its authorization code. Call it synchronously from a click
 * handler: browsers (Safari in particular) allow window.open only inside the user's gesture, and
 * the S256 challenge is computed asynchronously. So the popup opens blank at once and is sent to
 * the authorize page when `urlPromise` resolves; the window keeps its identity across that
 * navigation, so the event.source check still holds.
 * @param {Window} win
 * @param {Promise<string>} urlPromise the authorize URL
 * @param {string} state
 * @returns {Promise<string>} the authorization code; rejects with a LoginError
 */
export function runLoginPopup(win, urlPromise, state) {
    let popup = win.open('', POPUP_NAME, POPUP_FEATURES);
    if (!popup) {
        return Promise.reject(new LoginError(ERR_POPUP_BLOCKED));
    }

    return new Promise((resolve, reject) => {
        let done = false;
        let seenClosed = false;
        let poll = null;
        let timer = null;
        let onMessage = null;

        let finish = (settle, value) => {
            if (done) {
                return;
            }
            done = true;
            win.removeEventListener('message', onMessage);
            win.clearInterval(poll);
            win.clearTimeout(timer);
            settle(value);
        };

        onMessage = (event) => {
            let answer = readCallbackMessage(event, { origin: win.location.origin, popup, state });
            if (!answer) {
                return;
            }
            popup.close();
            if (answer.error) {
                let kind = answer.error === ERROR_ACCESS_DENIED ? ERR_DENIED : ERR_FAILED;
                finish(reject, new LoginError(kind, answer.error));
            } else {
                finish(resolve, answer.code);
            }
        };

        // A closed popup counts only on the second poll that sees it, so the message of a callback
        // page that posted and then closed itself is still taken.
        poll = win.setInterval(() => {
            if (!popup.closed) {
                return;
            }
            if (seenClosed) {
                finish(reject, new LoginError(ERR_POPUP_CLOSED));
            }
            seenClosed = true;
        }, CLOSED_POLL_MS);

        timer = win.setTimeout(() => {
            popup.close();
            finish(reject, new LoginError(ERR_TIMEOUT));
        }, LOGIN_TIMEOUT_MS);

        win.addEventListener('message', onMessage);

        urlPromise.then((url) => {
            if (!done && !popup.closed) {
                popup.location.replace(url);
            }
        }).catch((err) => {
            popup.close();
            finish(reject, err);
        });
    });
}
