// Kiwi 1.5.1 on kiwi.fuelrats.com saved its state under this localStorage key (its default
// startupOptions.state_key), and that state can hold the NickServ password. The rat config sets
// state_key to "", so Kiwi saves nothing; this removes what earlier visits left behind.
export const LEGACY_STATE_KEY = 'kiwi-state';

/**
 * Remove the legacy Kiwi state blob. Never throws: reading window.localStorage itself throws when
 * the browser blocks storage, and the client must load regardless.
 * @param {Storage} [storage] defaults to window.localStorage
 * @returns {boolean} true when the removal ran, false when storage was unavailable
 */
export function clearLegacyState(storage) {
    try {
        (storage || window.localStorage).removeItem(LEGACY_STATE_KEY);
        return true;
    } catch (err) {
        return false;
    }
}
