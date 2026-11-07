import {
    ANNOUNCE_REFERRER_POLICY, buildAnnouncePayload, buildExtraData, sendAnnounce
} from '@/plugins/fuelrats/lib/announce';

const INFO = {
    cmdrName: 'Ølstrøm Bjørnsen',
    ircNick: 'Olstrom_Bjornsen',
    system: 'Sol',
    platform: 'PC',
    eo2: true,
    expansion: 'Odyssey',
};

describe('announce payload', () => {
    it('matches the classic form fields', () => {
        expect(buildAnnouncePayload(INFO, 'nb-NO')).toEqual({
            cmdrname: 'Ølstrøm Bjørnsen',
            EO2: 'NOT OK',
            system: 'Sol',
            platform: 'PC',
            extradata: 'Language: Norwegian Bokmål (nb-NO) - IRC Nickname: Olstrom_Bjornsen',
            odyssey: 'Odyssey',
        });
        expect(buildAnnouncePayload({ ...INFO, eo2: false }, 'en').EO2).toBe('OK');
    });

    it('omits the nick when it equals the CMDR name', () => {
        expect(buildExtraData('Jameson', 'Jameson', 'en-GB')).toBe('Language: English (en-GB)');
        expect(buildExtraData('Jameson', 'Jameson', '')).toBe('x');
    });
});

describe('sendAnnounce', () => {
    it('sends a no-cors form POST with an origin-only referrer', async() => {
        let fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 0 });
        let result = await sendAnnounce('https://announcer.example/client', { cmdrname: 'A B' }, { fetchFn });

        expect(result).toBeNull();
        let [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('https://announcer.example/client');
        expect(init).toMatchObject({
            method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: ANNOUNCE_REFERRER_POLICY,
        });
        expect(init.body.toString()).toBe('cmdrname=A+B');
    });

    it('reads the JSON response in cors mode', async() => {
        let fetchFn = jest.fn().mockResolvedValue({
            ok: true, status: 200, json: () => Promise.resolve({ client_status_token: 't' }),
        });
        let result = await sendAnnounce('u', {}, { fetchFn, readResponse: true });
        expect(fetchFn.mock.calls[0][1].mode).toBe('cors');
        expect(result).toEqual({ client_status_token: 't' });
    });

    it('rejects on an HTTP error in cors mode', async() => {
        let fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 502 });
        await expect(sendAnnounce('u', {}, { fetchFn, readResponse: true })).rejects.toThrow('HTTP 502');
    });
});
