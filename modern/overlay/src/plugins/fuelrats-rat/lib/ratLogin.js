// "Log in with Fuel Rats": the popup and code exchange, the API bearer, and minting the one-time
// IRC token before each connect.
//
// The bearer lives only in this object: never in Kiwi state, storage, a cookie or a URL. Only an
// explicit log out revokes it, never a page unload: revoking deletes the API token row, which is
// also the website's consent memory, so revoking on unload would ask for consent on every visit.
// Tokens of public clients expire after 12 hours anyway.
import {
    ERR_FAILED, ERR_LOGGED_OUT, ERR_NO_ACCOUNT, ERR_POPUP_BLOCKED, ERR_UNAUTHORIZED, LoginError
} from './errors';
import { MESSAGES } from './messages';
import { randomToken, s256Challenge } from './pkce';
import { authorizeUrl, runLoginPopup } from './popupLogin';
import { exchangeCode, mintSaslToken, revokeToken } from './ratApi';

export const STATUS_LOGGED_OUT = 'logged-out';
export const STATUS_LOGGING_IN = 'logging-in';
export const STATUS_LOGGED_IN = 'logged-in';

// The website page whose nicknames panel registers an IRC nick (and so the Anope account).
export const PROFILE_PATH = '/profile/overview';

/**
 * The reactive part of the login state (see ../store.js). It never holds the bearer.
 * useLogin: the next connect goes through the rat login (set by the login path of the startup
 * screen, cleared by its nick and password path).
 */
export function emptyLoginState() {
    return {
        status: STATUS_LOGGED_OUT,
        minting: false,
        useLogin: false,
        account: '',
        error: '',
        errorLink: '',
    };
}

/**
 * The login is offered only with a client id and a callback on this page's own origin: the
 * callback page posts its message to its own origin, so any other origin never reaches this window.
 * @param {object} cfg { websiteUrl, apiUrl, clientId, redirectUri }
 * @param {string} pageOrigin window.location.origin
 * @returns {boolean}
 */
export function loginConfigured(cfg, pageOrigin) {
    if (!cfg || !cfg.clientId || !cfg.websiteUrl || !cfg.apiUrl || !cfg.redirectUri) {
        return false;
    }
    try {
        return new URL(cfg.redirectUri).origin === pageOrigin;
    } catch (err) {
        return false;
    }
}

export default class RatLogin {
    /**
     * @param {object} opts
     * @param {Function} opts.settings () => { websiteUrl, apiUrl, clientId, redirectUri }
     * @param {object} opts.store reactive state from emptyLoginState()
     * @param {Window} opts.win
     * @param {Function} opts.fetchFn
     * @param {Crypto} opts.cryptoObj
     * @param {object} opts.log Kiwi logger
     */
    constructor(opts) {
        this.settings = opts.settings;
        this.store = opts.store;
        this.win = opts.win;
        this.fetchFn = opts.fetchFn;
        this.cryptoObj = opts.cryptoObj;
        this.log = opts.log;
        this.bearer = '';
    }

    available() {
        // crypto.subtle exists only in secure contexts (https, or localhost in dev).
        let canHash = !!(this.cryptoObj && this.cryptoObj.subtle);
        return canHash && loginConfigured(this.settings(), this.win.location.origin);
    }

    get loggedIn() {
        return !!this.bearer;
    }

    /**
     * Log in through the website popup. Call it synchronously from a click handler: it opens the
     * popup before its first await (see runLoginPopup).
     * @returns {Promise<boolean>} true once a bearer is held
     */
    login() {
        if (this.loggedIn) {
            return Promise.resolve(true);
        }
        if (!this.available() || this.store.status === STATUS_LOGGING_IN) {
            return Promise.resolve(false);
        }

        let cfg = this.settings();
        let state = randomToken(this.cryptoObj);
        let verifier = randomToken(this.cryptoObj);
        let url = s256Challenge(verifier, this.cryptoObj.subtle)
            .then((challenge) => authorizeUrl(cfg, state, challenge));

        this.setError(null);
        this.store.status = STATUS_LOGGING_IN;
        return runLoginPopup(this.win, url, state)
            .then((code) => exchangeCode({
                apiUrl: cfg.apiUrl,
                clientId: cfg.clientId,
                redirectUri: cfg.redirectUri,
                code,
                verifier,
                fetchFn: this.fetchFn,
            }))
            .then((bearer) => {
                this.bearer = bearer;
                this.store.status = STATUS_LOGGED_IN;
                return true;
            }, (err) => {
                this.log.info('Fuel Rats login failed: ' + err.message);
                this.drop();
                this.setError(err);
                return false;
            });
    }

    /**
     * Mint a one-time IRC token for the next connect. A 401 drops the bearer, so the login button
     * shows again. A mint for a bearer this page no longer holds (a Log out, maybe followed by a
     * new login, while it was minted) leaves the account, the error text and the current bearer as
     * the log out or the new login left them: its token is discarded (the promise rejects with
     * ERR_LOGGED_OUT), and its failure, a 401 included, only rejects.
     * @returns {Promise<{account: string, password: string}>} rejects with a LoginError
     */
    mint() {
        let bearer = this.bearer;
        if (!bearer) {
            let err = new LoginError(ERR_LOGGED_OUT);
            this.setError(err);
            return Promise.reject(err);
        }

        this.store.minting = true;
        return mintSaslToken({ apiUrl: this.settings().apiUrl, bearer, fetchFn: this.fetchFn })
            .then((token) => {
                this.store.minting = false;
                if (this.bearer !== bearer) {
                    let detail = 'the login changed while the IRC token was minted';
                    this.log.info('IRC login token discarded: ' + detail);
                    throw new LoginError(ERR_LOGGED_OUT, detail);
                }
                this.store.account = token.account;
                this.setError(null);
                return token;
            }, (err) => {
                this.store.minting = false;
                this.log.info('IRC login token not minted: ' + err.message);
                if (this.bearer !== bearer) {
                    throw err;
                }
                if (err.kind === ERR_UNAUTHORIZED) {
                    this.drop();
                }
                this.setError(err);
                throw err;
            });
    }

    /**
     * The explicit "Log out": drop the bearer and revoke it. A failed revoke is only logged; the
     * bearer is gone from this page either way.
     * @returns {Promise<void>}
     */
    logout() {
        let bearer = this.bearer;
        this.drop();
        this.setError(null);
        if (!bearer) {
            return Promise.resolve();
        }
        let cfg = this.settings();
        return revokeToken({
            apiUrl: cfg.apiUrl,
            clientId: cfg.clientId,
            bearer,
            fetchFn: this.fetchFn,
        }).catch((err) => {
            this.log.error('Fuel Rats logout: revoke failed: ' + err.message);
        });
    }

    drop() {
        this.bearer = '';
        this.store.status = STATUS_LOGGED_OUT;
        this.store.account = '';
    }

    setError(err) {
        if (!err) {
            this.store.error = '';
            this.store.errorLink = '';
            return;
        }
        if (err.kind === ERR_POPUP_BLOCKED) {
            this.store.error = 'Allow pop-ups for ' + this.win.location.hostname + ', then try again.';
        } else if (Object.prototype.hasOwnProperty.call(MESSAGES, err.kind)) {
            this.store.error = MESSAGES[err.kind];
        } else {
            this.store.error = MESSAGES[ERR_FAILED];
        }
        this.store.errorLink = err.kind === ERR_NO_ACCOUNT ?
            this.settings().websiteUrl.replace(/\/+$/, '') + PROFILE_PATH :
            '';
    }
}
