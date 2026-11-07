// `?prefilledData=` deep link, as sent by QMS (qms/frontend/src/helpers/PushClientToKiwi.ts):
// { cmdr, system, platform: 'PC'|'XB'|'PS4', timer, odyssey: 'horizons3'|'horizons4'|'odyssey',
//   submit, time }

export const EXPANSIONS = [
    { value: 'Horizons 3.8', label: 'Horizons (3.8)' },
    { value: 'Horizons 4.0', label: 'Horizons (4.0)' },
    { value: 'Odyssey', label: 'Odyssey (4.0)' },
];
export const DEFAULT_EXPANSION = 'Horizons 3.8';

export const PLATFORMS = ['PC', 'XB', 'PS4'];

const EXPANSION_MAP = {
    horizons3: 'Horizons 3.8',
    horizons4: 'Horizons 4.0',
    odyssey: 'Odyssey',
};

// A prefilled form is only auto-submitted when the link is younger than this.
export const AUTO_SUBMIT_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * @param {string} search window.location.search
 * @returns {object|null} the parsed prefilledData object, or null when absent or malformed
 */
export function parsePrefilledData(search) {
    let raw = new URLSearchParams(search || '').get('prefilledData');
    if (!raw) {
        return null;
    }

    try {
        let data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : null;
    } catch (err) {
        return null;
    }
}

/**
 * Map prefilledData onto the intake form's fields.
 * @param {object} data parsed prefilledData
 */
export function formFromPrefill(data) {
    return {
        cmdr: typeof data.cmdr === 'string' ? data.cmdr : '',
        system: typeof data.system === 'string' ? data.system : '',
        platform: PLATFORMS.includes(data.platform) ? data.platform : '',
        eo2: !!data.timer,
        expansion: EXPANSION_MAP[data.odyssey] || DEFAULT_EXPANSION,
    };
}

/**
 * @param {object} data parsed prefilledData
 * @param {number} now epoch ms
 */
export function shouldAutoSubmit(data, now) {
    return !!(data && data.submit && now - data.time < AUTO_SUBMIT_MAX_AGE_MS);
}
