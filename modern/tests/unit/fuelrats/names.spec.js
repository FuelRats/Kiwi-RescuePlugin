import {
    fallbackNick, MAX_NICK_LENGTH, sanitizeCMDRName, sanitizeIRCName
} from '@/plugins/fuelrats/lib/names';
import classicResults from './classic-names.fixture.json';

// classic-names.fixture.json holds the classic plugin's own output for each name, computed by
// running its script.js + diacritics.js (modern/tests/tools/classic-parity.js).
describe('CMDR name sanitization', () => {
    test.each(classicResults.map((r) => [r.input, r.cmdrName, r.ircNick]))(
        'matches the classic client for %j',
        (input, cmdrName, ircNick) => {
            expect(sanitizeCMDRName(input)).toBe(cmdrName);
            expect(sanitizeIRCName(input)).toBe(ircNick);
        }
    );

    it('never produces a nick longer than the cap', () => {
        expect(sanitizeIRCName('x'.repeat(80))).toHaveLength(MAX_NICK_LENGTH);
    });

    it('produces a nick-safe fallback', () => {
        expect(fallbackNick(() => 0.042)).toBe('Client_042');
        expect(fallbackNick(() => 0.999)).toBe('Client_999');
    });
});
