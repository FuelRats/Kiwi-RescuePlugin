import RescueSession, {
    ANNOUNCE_WINDOW_MS,
    RESULT_ALREADY_ANNOUNCED,
    RESULT_ANNOUNCED,
    RESULT_EXPIRED,
    RESULT_NOT_STARTED
} from '@/plugins/fuelrats/lib/rescueSession';

const INFO = {
    cmdrName: 'Jameson',
    ircNick: 'Jameson',
    system: 'Lave',
    platform: 'XB',
    eo2: false,
    expansion: 'Horizons 3.8',
};

function makeSession(startAt = 1000) {
    let clock = { t: startAt };
    let deps = {
        announce: jest.fn().mockResolvedValue(null),
        redirect: jest.fn(),
        now: () => clock.t,
        browserLanguage: 'en-US',
    };
    return { session: new RescueSession(deps), deps, clock };
}

describe('RescueSession', () => {
    it('does nothing before the form is submitted', () => {
        let { session, deps } = makeSession();
        expect(session.handleRegistered('Jameson')).toBe(RESULT_NOT_STARTED);
        expect(deps.announce).not.toHaveBeenCalled();
    });

    it('announces once, with the nick the server accepted', async() => {
        let { session, deps } = makeSession();
        session.begin(INFO);
        expect(session.handleRegistered('Jameson_')).toBe(RESULT_ANNOUNCED);
        await session.announcePromise;
        expect(deps.announce).toHaveBeenCalledTimes(1);
        expect(deps.announce.mock.calls[0][0]).toMatchObject({
            cmdrname: 'Jameson',
            platform: 'XB',
            extradata: 'Language: English (en-US) - IRC Nickname: Jameson_',
        });

        // Kiwi's auto-reconnect registers again: no second r@tsignal.
        expect(session.handleRegistered('Jameson_')).toBe(RESULT_ALREADY_ANNOUNCED);
        expect(deps.announce).toHaveBeenCalledTimes(1);
        expect(deps.redirect).not.toHaveBeenCalled();
    });

    it('sends a client that registers too late back to get-help', () => {
        let { session, deps, clock } = makeSession();
        session.begin(INFO);
        clock.t += ANNOUNCE_WINDOW_MS + 1;
        expect(session.handleRegistered('Jameson')).toBe(RESULT_EXPIRED);
        expect(deps.redirect).toHaveBeenCalledWith('announce-window-expired');
        expect(deps.announce).not.toHaveBeenCalled();
    });

    it('a new submit opens a new announce window', async() => {
        let { session, deps, clock } = makeSession();
        session.begin(INFO);
        session.handleRegistered('Jameson');
        await session.announcePromise;
        clock.t += ANNOUNCE_WINDOW_MS * 10;
        session.begin({ ...INFO, system: 'Diso' });
        expect(session.handleRegistered('Jameson')).toBe(RESULT_ANNOUNCED);
        await session.announcePromise;
        expect(deps.announce).toHaveBeenCalledTimes(2);
        expect(deps.announce.mock.calls[1][0].system).toBe('Diso');
    });
});
