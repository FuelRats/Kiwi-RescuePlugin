// FuelRats rat-client module (kiwi.fuelrats.com): clears the state that Kiwi 1.5.1 left in
// localStorage, and adds "Log in with Fuel Rats": the fuelratsRat startup screen, a state-browser
// panel with "Log out", and a connect wrapper on every network that mints a one-time IRC login
// before each connect. Registered through the plugin API so it only touches Kiwi through its
// public surface.
import GlobalApi from '@/libs/GlobalApi';
import RatLoginPanel from './components/RatLoginPanel';
import RatStartup from './components/RatStartup';
import { CONFIG_DEFAULTS } from './config';
import { wrapConnect, wrapNetworks } from './lib/connectWrapper';
import { clearLegacyState, LEGACY_STATE_KEY } from './lib/legacyState';
import ratLogin from './login';
import store from './store';

function reportMintError(state, network) {
    if (!store.error) {
        return;
    }
    let buffer = state.getActiveBuffer() || network.serverBuffer();
    state.addMessage(buffer, {
        time: Date.now(),
        nick: '',
        message: store.error,
        type: 'error',
    });
}

GlobalApi.singleton().plugin('fuelrats-rat', (kiwi, log) => {
    if (!clearLegacyState()) {
        log.info('localStorage unavailable; ' + LEGACY_STATE_KEY + ' not cleared');
    }

    kiwi.setConfigDefaults('fuelratsRat', CONFIG_DEFAULTS);
    // Registered even without a client id (config.json names it as startupScreen); the screen then
    // offers only the nick and password path.
    kiwi.addStartup('fuelratsRat', RatStartup);
    if (ratLogin.available()) {
        kiwi.addUi('browser', RatLoginPanel);
    }

    // Every network is wrapped before its first connect: the ones restored from a saved session
    // exist already, and addNetwork emits network.new before it returns a new one.
    let hooks = {
        useLogin: () => store.useLogin,
        mint: () => ratLogin.mint(),
        onMintError: (network) => reportMintError(kiwi.state, network),
    };
    wrapNetworks(kiwi.state.networks, hooks);
    kiwi.on('network.new', (event) => {
        wrapConnect(event.network, hooks);
    });
});
