// The rescue configs, modern/config/config.json and config.dev.json. The Dockerfile's overlay
// stage copies modern/config/ to /tmp/config/, outside the Kiwi tree these specs run in.
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const CONFIG_DIR = '/tmp/config';
const RESCUE_CONFIGS = ['config.json', 'config.dev.json'];
// See ratConfig.spec.js: browsers may hold the Kiwi 1.5.1 theme files, which mozzarella served for
// clients.fuelrats.com during failovers, under the plain urls.
const THEME_VERSION_QUERY = /\?v=2$/;

function readConfig(name) {
    return JSON.parse(readFileSync(path.join(CONFIG_DIR, name), 'utf8'));
}

describe('rescue configs', () => {
    // Specs run from the Kiwi tree root, where upstream and overlay themes live side by side.
    it.each(RESCUE_CONFIGS)('%s lists only themes that exist, with FuelRats as the default', (name) => {
        let config = readConfig(name);
        config.themes.forEach((theme) => {
            expect(existsSync(path.join(theme.url.split('?')[0], 'theme.css'))).toBe(true);
        });
        expect(config.theme).toBe('FuelRats');
        expect(config.themes.map((theme) => theme.name)).toContain(config.theme);
    });

    it.each(RESCUE_CONFIGS)('%s asks for every theme under a url the old client never served', (name) => {
        readConfig(name).themes.forEach((theme) => {
            expect(theme.url).toMatch(THEME_VERSION_QUERY);
        });
    });

    // Clients are mostly one-off visitors, often on shared machines: the rescue client keeps no
    // Kiwi state between visits.
    it.each(RESCUE_CONFIGS)('%s saves no session', (name) => {
        expect(readConfig(name).startupOptions.state_key).toBe('');
    });
});
