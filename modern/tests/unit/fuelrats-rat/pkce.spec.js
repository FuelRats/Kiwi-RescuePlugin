import { webcrypto } from 'crypto';
import {
    base64url, RANDOM_BYTES, randomToken, s256Challenge
} from '@/plugins/fuelrats-rat/lib/pkce';

// RFC 7636 appendix B: the 32 random octets, the code_verifier they encode to, and its S256
// code_challenge.
const RFC_OCTETS = [
    116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186,
    22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
];
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

// jsdom has no Web Crypto; Node's built-in implementation stands in for window.crypto.
function rfcCrypto() {
    return {
        getRandomValues: (bytes) => {
            bytes.set(RFC_OCTETS);
            return bytes;
        },
    };
}

describe('PKCE', () => {
    it('encodes the RFC 7636 appendix B octets to its code_verifier', () => {
        expect(base64url(Uint8Array.from(RFC_OCTETS))).toBe(RFC_VERIFIER);
        expect(randomToken(rfcCrypto())).toBe(RFC_VERIFIER);
    });

    it('computes the RFC 7636 appendix B S256 challenge', async() => {
        expect(await s256Challenge(RFC_VERIFIER, webcrypto.subtle)).toBe(RFC_CHALLENGE);
    });

    it('makes 43-character base64url tokens from 32 random bytes', () => {
        let first = randomToken(webcrypto);
        let second = randomToken(webcrypto);
        expect(RANDOM_BYTES).toBe(32);
        expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(first).not.toBe(second);
    });
});
