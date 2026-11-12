import { clearLegacyState, LEGACY_STATE_KEY } from '@/plugins/fuelrats-rat/lib/legacyState';

function securityError() {
    return new DOMException('The operation is insecure.', 'SecurityError');
}

describe('legacy Kiwi state', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        window.localStorage.clear();
    });

    it('removes the kiwi-state key and keeps other keys', () => {
        window.localStorage.setItem(LEGACY_STATE_KEY, '{"networks":[]}');
        window.localStorage.setItem('kiwi-ipc', 'keep');

        expect(clearLegacyState()).toBe(true);
        expect(window.localStorage.getItem(LEGACY_STATE_KEY)).toBeNull();
        expect(window.localStorage.getItem('kiwi-ipc')).toBe('keep');
    });

    it('does nothing when the key is absent', () => {
        expect(clearLegacyState()).toBe(true);
        expect(window.localStorage.length).toBe(0);
    });

    it('tolerates a localStorage that throws', () => {
        let throwing = { removeItem: () => { throw securityError(); } };
        expect(clearLegacyState(throwing)).toBe(false);

        jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw securityError(); });
        expect(() => clearLegacyState()).not.toThrow();
        expect(clearLegacyState()).toBe(false);
    });
});
