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
// with ERR_NETWORK.
import {
    ERR_FAILED, ERR_NETWORK, ERR_NO_ACCOUNT, ERR_UNAUTHORIZED, ERR_UNAVAILABLE, LoginError
} from './errors';

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

const MINT_STATUS_KINDS = {
    400: ERR_NO_ACCOUNT,
    401: ERR_UNAUTHORIZED,
    503: ERR_UNAVAILABLE,
};

function endpoint(apiUrl, path) {
    return apiUrl.replace(/\/+$/, '') + path;
}

async function post(fetchFn, url, headers, body) {
    try {
        return await fetchFn(url, {
            method: 'POST',
            credentials: 'omit',
            headers: { Accept: 'application/json', ...headers },
            body,
        });
    } catch (err) {
        throw new LoginError(ERR_NETWORK, 'POST ' + url + ' failed: ' + err.message);
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
    let response = await post(opts.fetchFn, url, FORM_HEADERS, body.toString());
    if (!response.ok) {
        throw new LoginError(ERR_FAILED, 'token exchange answered HTTP ' + response.status);
    }
    let token = await readJson(response, 'token exchange');
    if (!token || !isFilled(token.access_token)) {
        throw new LoginError(ERR_FAILED, 'token exchange returned no access_token');
    }
    return token.access_token;
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
    let response = await post(opts.fetchFn, url, headers, '{}');
    if (!response.ok) {
        let kind = MINT_STATUS_KINDS[response.status] || ERR_FAILED;
        throw new LoginError(kind, 'sasl-token answered HTTP ' + response.status);
    }
    let token = await readJson(response, 'sasl-token');
    if (!token || !isFilled(token.account) || !isFilled(token.password)) {
        throw new LoginError(ERR_FAILED, 'sasl-token returned no account or password');
    }
    return { account: token.account, password: token.password };
}

/**
 * Revoke an API bearer (public-client revoke: client_id and token, no secret).
 * @param {object} opts { apiUrl, clientId, bearer, fetchFn }
 * @returns {Promise<void>}
 */
export async function revokeToken(opts) {
    let body = new URLSearchParams({ client_id: opts.clientId, token: opts.bearer });
    let url = endpoint(opts.apiUrl, '/oauth2/revoke');
    let response = await post(opts.fetchFn, url, FORM_HEADERS, body.toString());
    if (!response.ok) {
        throw new LoginError(ERR_FAILED, 'revoke answered HTTP ' + response.status);
    }
}
