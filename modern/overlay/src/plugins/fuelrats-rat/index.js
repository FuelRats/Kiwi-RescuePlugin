// FuelRats rat-client module (kiwi.fuelrats.com): on load, clears the state that Kiwi 1.5.1 left
// in localStorage. Registered through the plugin API so it only touches Kiwi through its public
// surface.
import GlobalApi from '@/libs/GlobalApi';
import { clearLegacyState, LEGACY_STATE_KEY } from './lib/legacyState';

GlobalApi.singleton().plugin('fuelrats-rat', (kiwi, log) => {
    if (!clearLegacyState()) {
        log.info('localStorage unavailable; ' + LEGACY_STATE_KEY + ' not cleared');
    }
});
