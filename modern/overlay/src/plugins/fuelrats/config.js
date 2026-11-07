// The `fuelrats` block of static/config.json. Defaults are the production values.
import getState from '@/libs/state';

export const CONFIG_DEFAULTS = {
    announcerUrl: 'https://announcer.fuelrats.com/client',
    apiUrl: 'https://api.fuelrats.com',
    getHelpUrl: 'https://fuelrats.com/get-help',
    networkName: 'Fuel Rats',
    statusFeed: {
        enabled: false,
        pollIntervalMs: 5000,
    },
};

export function setting(key) {
    return getState().setting('fuelrats.' + key);
}

/**
 * Leave the client for the get-help page (classic `top.location.href = get-help`).
 */
export function leaveToGetHelp() {
    window.onbeforeunload = null;
    window.top.location.href = setting('getHelpUrl');
}
