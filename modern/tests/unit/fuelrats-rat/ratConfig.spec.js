// The rat configs, modern/config/config.rat.json and config.rat-dev.json. The Dockerfile's overlay
// stage copies modern/config/ to /tmp/config/, outside the Kiwi tree these specs run in.
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { LEGACY_STATE_KEY } from '@/plugins/fuelrats-rat/lib/legacyState';

const CONFIG_DIR = '/tmp/config';
const RAT_CONFIGS = ['config.rat.json', 'config.rat-dev.json'];

function readConfig(name) {
    return JSON.parse(readFileSync(path.join(CONFIG_DIR, name), 'utf8'));
}

describe('rat configs', () => {
    // irc-framework's own reconnect skips the connect wrapper and would resend the used one-time
    // IRC token (lib/connectWrapper.js); a failed SASL login ends the connection instead of
    // registering without the account.
    it.each(RAT_CONFIGS)('%s never resends an IRC token by itself', (name) => {
        let config = readConfig(name);
        expect(config.autoReconnect).toBe(false);
        expect(config.disconnectOnSaslFail).toBe(true);
    });

    // Kiwi saves the session and settings under its own key, never the Kiwi 1.5.1 one that
    // lib/legacyState.js removes on every load (lib/savedSession.js).
    it.each(RAT_CONFIGS)('%s saves the session under its own key', (name) => {
        let options = readConfig(name).startupOptions;
        expect(options.state_key).toBe('fr-rat-state');
        expect(options.state_key).not.toBe(LEGACY_STATE_KEY);
        expect(options.remember_buffers).toBe(true);
    });

    // Specs run from the Kiwi tree root, where upstream and overlay themes live side by side.
    it.each(RAT_CONFIGS)('%s lists only themes that exist, the default among them', (name) => {
        let config = readConfig(name);
        config.themes.forEach((theme) => {
            expect(existsSync(path.join(theme.url, 'theme.css'))).toBe(true);
        });
        expect(config.themes.map((theme) => theme.name)).toContain(config.theme);
    });
});
