// Failure kinds of the rat login (popup, code exchange) and of minting an IRC token. RatLogin turns
// a kind into the text the startup screen and the state-browser panel show.
export const ERR_POPUP_BLOCKED = 'popup-blocked';
export const ERR_POPUP_CLOSED = 'popup-closed';
export const ERR_TIMEOUT = 'timeout';
export const ERR_DENIED = 'denied';
export const ERR_NO_ACCOUNT = 'no-account';
export const ERR_UNVERIFIED = 'unverified';
export const ERR_UNAUTHORIZED = 'unauthorized';
export const ERR_UNAVAILABLE = 'unavailable';
export const ERR_LOGGED_OUT = 'logged-out';
export const ERR_NETWORK = 'network';
export const ERR_FAILED = 'failed';

export class LoginError extends Error {
    /**
     * @param {string} kind one of the ERR_* constants
     * @param {string} [detail] for the log; never contains a bearer or an IRC token
     */
    constructor(kind, detail) {
        super(detail ? kind + ': ' + detail : kind);
        this.name = 'LoginError';
        this.kind = kind;
    }
}
