// FuelRats rescue-client module: the intake startup screen, the announce, the `!kiwi-force` ops
// hook and (behind fuelrats.statusFeed.enabled) the live rescue status panel. Registered through
// the plugin API so it only touches Kiwi through its public surface.
import GlobalApi from '@/libs/GlobalApi';
import FuelRatsStartup from './components/FuelRatsStartup';
import RescueStatus from './components/RescueStatus';
import { CONFIG_DEFAULTS, leaveToGetHelp, setting } from './config';
import { isForceEject } from './lib/opsHook';
import { applyRatMessage } from './lib/rescueStatus';
import store from './store';

GlobalApi.singleton().plugin('fuelrats', (kiwi, log) => {
    kiwi.setConfigDefaults('fuelrats', CONFIG_DEFAULTS);
    kiwi.addStartup('fuelrats', FuelRatsStartup);

    if (setting('statusFeed.enabled')) {
        kiwi.addUi('browser', RescueStatus);
    }

    kiwi.on('irc.message', (event, network) => {
        if (isForceEject(event, network.nick)) {
            log.info('Ejected by ' + event.nick);
            leaveToGetHelp();
            return;
        }
        if (event.type === 'privmsg') {
            store.status = applyRatMessage(store.status, event.nick, event.message);
        }
    });
});
