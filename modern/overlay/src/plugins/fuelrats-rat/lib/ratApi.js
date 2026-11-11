// Fuel Rats API calls of the rat login. Kiwi is a public OAuth client (no secret), and every call
// omits cookies: the bearer is the only credential.
//   POST {apiUrl}/oauth2/token     form: grant_type=authorization_code, client_id, code,
//                                  redirect_uri, code_verifier
//                                  200 { access_token, token_type }
//   POST {apiUrl}/irc/sasl-token   Authorization: Bearer <access token>
//                                  200 { account, password: "frk1:<ts>:<hex>", expiresIn: 60 }
//                                  400 no Anope account, 401 bearer invalid or expired,
//                                  503 IRC token minting not configured
//   POST {apiUrl}/oauth2/revoke    form: client_id, token
// A request that never gets a readable response (offline, DNS, or a CORS-blocked answer) rejects
// with ERR_NETWORK, and so does one that is not answered, body included, within
// REQUEST_TIMEOUT_MS: it is aborted, so a stalled connection never leaves a login or a mint
// pending.
import {
    ERR_FAILED, ERR_NETWORK, ERR_NO_ACCOUNT, ERR_UNAUTHORIZED, ERR_UNAVAILABLE, LoginError
} from './errors';

export const REQUEST_TIMEOUT_MS = 15 * 1000;

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

const MINT_STATUS_KINDS = {
    400: ERR_NO_ACCOUNT,
    401: ERR_UNAUTHORIZED,
    503: ERR_UNAVAILABLE,
};

function endpoint(apiUrl, path) {
    return apiUrl.replace(/\/+$/, '') + path;
}

/**
 * POST, then hand the response to `read`; both share one REQUEST_TIMEOUT_MS deadline.
 * @param {Function} read async (response) => result
 * @returns {Promise<*>} what `read` returns; rejects with a LoginError
 */
async function post(fetchFn, url, headers, body, read) {
    let controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        let response;
        try {
            response = await fetchFn(url, {
                method: 'POST',
                credentials: 'omit',
                headers: { Accept: 'application/json', ...headers },
                body,
                signal: controller.signal,
            });
        } catch (err) {
            throw new LoginError(ERR_NETWORK, 'POST ' + url + ' failed: ' + err.message);
        }
        return await read(response);
    } catch (err) {
        if (controller.signal.aborted) {
            throw new LoginError(
                ERR_NETWORK,
                'POST ' + url + ' timed out after ' + (REQUEST_TIMEOUT_MS / 1000) + ' s'
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

async function readJson(response, what) {
    try {
        return await response.json();
    } catch (err) {
        throw new LoginError(ERR_FAILED, what + ' answered with invalid JSON');
    }
}

function isFilled(value) {
    return typeof value === 'string' && value.length > 0;
}

/**
 * Exchange an authorization code for an API bearer.
 * @param {object} opts { apiUrl, clientId, redirectUri, code, verifier, fetchFn }
 * @returns {Promise<string>} the access token
 */
export async function exchangeCode(opts) {
    let body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: opts.clientId,
        code: opts.code,
        redirect_uri: opts.redirectUri,
        code_verifier: opts.verifier,
    });
    let url = endpoint(opts.apiUrl, '/oauth2/token');
    return post(opts.fetchFn, url, FORM_HEADERS, body.toString(), async(response) => {
        if (!response.ok) {
            throw new LoginError(ERR_FAILED, 'token exchange answered HTTP ' + response.status);
        }
        let token = await readJson(response, 'token exchange');
        if (!token || !isFilled(token.access_token)) {
            throw new LoginError(ERR_FAILED, 'token exchange returned no access_token');
        }
        return token.access_token;
    });
}

/**
 * Mint a one-time IRC token (SASL PLAIN account and password, valid for 60 s).
 * @param {object} opts { apiUrl, bearer, fetchFn }
 * @returns {Promise<{account: string, password: string}>}
 */
export async function mintSaslToken(opts) {
    let headers = {
        'Authorization': 'Bearer ' + opts.bearer,
        'Content-Type': 'application/json',
    };
    let url = endpoint(opts.apiUrl, '/irc/sasl-token');
    return post(opts.fetchFn, url, headers, '{}', async(response) => {
        if (!response.ok) {
            let kind = MINT_STATUS_KINDS[response.status] || ERR_FAILED;
            throw new LoginError(kind, 'sasl-token answered HTTP ' + response.status);
        }
        let token = await readJson(response, 'sasl-token');
        if (!token || !isFilled(token.account) || !isFilled(token.password)) {
            throw new LoginError(ERR_FAILED, 'sasl-token returned no account or password');
        }
        return { account: token.account, password: token.password };
    });
}

/**
 * Revoke an API bearer (public-client revoke: client_id and token, no secret).
 * @param {object} opts { apiUrl, clientId, bearer, fetchFn }
 * @returns {Promise<void>}
 */
export async function revokeToken(opts) {
    let body = new URLSearchParams({ client_id: opts.clientId, token: opts.bearer });
    let url = endpoint(opts.apiUrl, '/oauth2/revoke');
    return post(opts.fetchFn, url, FORM_HEADERS, body.toString(), (response) => {
        if (!response.ok) {
            throw new LoginError(ERR_FAILED, 'revoke answered HTTP ' + response.status);
        }
    });
}
