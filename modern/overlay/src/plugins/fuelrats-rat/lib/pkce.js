// PKCE (RFC 7636) for the rat login, with Web Crypto only: the code_verifier and the OAuth state
// are 32 random bytes each, base64url-encoded (43 characters), and the challenge is S256.

export const RANDOM_BYTES = 32;

/**
 * Base64url without padding (RFC 7636 appendix A).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function base64url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * @param {Crypto} cryptoObj window.crypto
 * @returns {string} 32 random bytes, base64url
 */
export function randomToken(cryptoObj) {
    let bytes = new Uint8Array(RANDOM_BYTES);
    cryptoObj.getRandomValues(bytes);
    return base64url(bytes);
}

/**
 * code_challenge = BASE64URL(SHA256(ASCII(code_verifier))) (RFC 7636 section 4.2). A verifier only
 * holds unreserved ASCII characters, so each character is one byte.
 * @param {string} verifier
 * @param {SubtleCrypto} subtle window.crypto.subtle
 * @returns {Promise<string>}
 */
export async function s256Challenge(verifier, subtle) {
    let ascii = Uint8Array.from(verifier, (c) => c.charCodeAt(0));
    let digest = await subtle.digest('SHA-256', ascii);
    return base64url(new Uint8Array(digest));
}
