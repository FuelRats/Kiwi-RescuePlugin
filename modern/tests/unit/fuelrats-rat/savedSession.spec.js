import { savedSession } from '@/plugins/fuelrats-rat/lib/savedSession';

function stateWith(networks) {
    return {
        getNetworkFromAddress: jest.fn((host) => networks[host] || null),
    };
}

describe('saved session', () => {
    it('returns the saved network with its nick and password', () => {
        let network = { connection: { nick: 'Halsey' }, password: 'correct horse battery' };
        let state = stateWith({ 'irc.fuelrats.com': network });

        expect(savedSession(state, ' irc.fuelrats.com ')).toEqual({
            network,
            nick: 'Halsey',
            password: 'correct horse battery',
        });
        expect(state.getNetworkFromAddress).toHaveBeenCalledWith('irc.fuelrats.com');
    });

    it('returns an empty password for a network that logged in with Fuel Rats', () => {
        let network = { connection: { nick: 'Halsey' }, password: '' };
        let saved = savedSession(stateWith({ 'irc.fuelrats.com': network }), 'irc.fuelrats.com');

        expect(saved.nick).toBe('Halsey');
        expect(saved.password).toBe('');
    });

    it('returns null when nothing is saved for the server', () => {
        expect(savedSession(stateWith({}), 'irc.fuelrats.com')).toBeNull();
    });

    it('returns null without a server name', () => {
        let state = stateWith({});
        expect(savedSession(state, '  ')).toBeNull();
        expect(savedSession(state, undefined)).toBeNull();
        expect(state.getNetworkFromAddress).not.toHaveBeenCalled();
    });

    it('tolerates a saved network without connection details', () => {
        let network = {};
        expect(savedSession(stateWith({ 'irc.fuelrats.com': network }), 'irc.fuelrats.com'))
            .toEqual({ network, nick: '', password: '' });
    });
});
