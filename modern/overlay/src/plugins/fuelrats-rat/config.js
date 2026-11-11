// The `fuelratsRat` block of static/config.json. Defaults are the production values, except
// clientId: without one the startup screen offers only the nick and password path.
import getState from '@/libs/state';

export const CONFIG_DEFAULTS = {
    websiteUrl: 'https://fuelrats.com',
    apiUrl: 'https://api.fuelrats.com',
    clientId: '',
    redirectUri: 'https://kiwi.fuelrats.com/static/fuelrats-rat/callback.html',
};

export function setting(key) {
    return getState().setting('fuelratsRat.' + key);
}

export function loginSettings() {
    return {
        websiteUrl: setting('websiteUrl') || '',
        apiUrl: setting('apiUrl') || '',
        clientId: setting('clientId') || '',
        redirectUri: setting('redirectUri') || '',
    };
}
