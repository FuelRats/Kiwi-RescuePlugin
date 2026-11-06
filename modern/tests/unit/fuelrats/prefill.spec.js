import {
    AUTO_SUBMIT_MAX_AGE_MS, DEFAULT_EXPANSION, formFromPrefill, parsePrefilledData, shouldAutoSubmit
} from '@/plugins/fuelrats/lib/prefill';

function search(data) {
    return '?prefilledData=' + encodeURIComponent(JSON.stringify(data));
}

// The exact shape QMS sends (qms/frontend/src/helpers/PushClientToKiwi.ts).
const QMS_PAYLOAD = {
    system: 'Col 285 Sector KS-T d3-43',
    platform: 'PC',
    cmdr: 'Ratty McRatface',
    timer: true,
    odyssey: 'odyssey',
    submit: true,
    time: 1_800_000_000_000,
};

describe('prefilledData', () => {
    it('parses the QMS payload', () => {
        expect(parsePrefilledData(search(QMS_PAYLOAD))).toEqual(QMS_PAYLOAD);
    });

    it('ignores a missing or malformed parameter', () => {
        expect(parsePrefilledData('')).toBeNull();
        expect(parsePrefilledData('?prefilledData=%7Bnot-json')).toBeNull();
        expect(parsePrefilledData('?prefilledData=42')).toBeNull();
    });

    it('maps onto the form', () => {
        expect(formFromPrefill(QMS_PAYLOAD)).toEqual({
            cmdr: 'Ratty McRatface',
            system: 'Col 285 Sector KS-T d3-43',
            platform: 'PC',
            eo2: true,
            expansion: 'Odyssey',
        });
        expect(formFromPrefill({ odyssey: 'horizons4', platform: 'PS4' })).toMatchObject({
            expansion: 'Horizons 4.0', platform: 'PS4', cmdr: '', eo2: false,
        });
        expect(formFromPrefill({ odyssey: 'nonsense', platform: 'Switch' })).toMatchObject({
            expansion: DEFAULT_EXPANSION, platform: '',
        });
    });

    it('auto-submits only fresh links that ask for it', () => {
        let now = QMS_PAYLOAD.time + 1000;
        expect(shouldAutoSubmit(QMS_PAYLOAD, now)).toBe(true);
        expect(shouldAutoSubmit({ ...QMS_PAYLOAD, submit: false }, now)).toBe(false);
        let stale = QMS_PAYLOAD.time + AUTO_SUBMIT_MAX_AGE_MS;
        expect(shouldAutoSubmit(QMS_PAYLOAD, stale)).toBe(false);
        expect(shouldAutoSubmit(null, now)).toBe(false);
    });
});
