// The rat configs, modern/config/config.rat.json and config.rat-dev.json. The Dockerfile's overlay
// stage copies modern/config/ to /tmp/config/, outside the Kiwi tree these specs run in.
import { readFileSync } from 'fs';
import path from 'path';

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

    // Kiwi saves no state in localStorage (lib/legacyState.js).
    it.each(RAT_CONFIGS)('%s keeps no Kiwi state in the browser', (name) => {
        expect(readConfig(name).startupOptions.state_key).toBe('');
    });
});
