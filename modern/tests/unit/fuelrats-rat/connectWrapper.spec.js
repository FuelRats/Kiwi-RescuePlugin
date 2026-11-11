import { ERR_UNAUTHORIZED, LoginError } from '@/plugins/fuelrats-rat/lib/errors';
import { wrapConnect } from '@/plugins/fuelrats-rat/lib/connectWrapper';

// A NetworkState stand-in whose ircClient.connect plays Kiwi's overload: it records the nick and
// password at call time, which is when Kiwi copies them into the SASL options.
function fakeNetwork() {
    let network = {
        connection: { nick: 'Jameson' },
        password: '',
        sent: [],
    };
    network.ircClient = {
        connect: jest.fn(() => {
            network.sent.push({ nick: network.connection.nick, password: network.password });
        }),
    };
    return network;
}

function tokenMinter() {
    let n = 0;
    return jest.fn(() => {
        n++;
        return Promise.resolve({ account: 'Jameson', password: 'frk1:178289' + n + ':' + 'ab'.repeat(32) });
    });
}

describe('connect wrapper', () => {
    it('mints once per connect and never reuses a password', async() => {
        let network = fakeNetwork();
        let mint = tokenMinter();
        let onMintError = jest.fn();
        wrapConnect(network, { useLogin: () => true, mint, onMintError });

        await expect(network.ircClient.connect()).resolves.toBe(true);
        expect(network.password).toBe('');
        await expect(network.ircClient.connect()).resolves.toBe(true);
        expect(network.password).toBe('');

        expect(mint).toHaveBeenCalledTimes(2);
        expect(network.sent).toHaveLength(2);
        expect(network.sent[0].nick).toBe('Jameson');
        expect(network.sent[0].password).toMatch(/^frk1:/);
        expect(network.sent[1].password).toMatch(/^frk1:/);
        expect(network.sent[1].password).not.toBe(network.sent[0].password);
        expect(onMintError).not.toHaveBeenCalled();
    });

    it('uses the minted account as the nick', async() => {
        let network = fakeNetwork();
        network.connection.nick = 'Guest42';
        let mint = jest.fn(() => Promise.resolve({ account: 'Jameson[PC]', password: 'frk1:1:00' }));
        wrapConnect(network, { useLogin: () => true, mint, onMintError: jest.fn() });

        await network.ircClient.connect();
        expect(network.sent).toEqual([{ nick: 'Jameson[PC]', password: 'frk1:1:00' }]);
        expect(network.connection.nick).toBe('Jameson[PC]');
    });

    it('joins a pending mint instead of minting twice for one connect', async() => {
        let network = fakeNetwork();
        let mint = tokenMinter();
        wrapConnect(network, { useLogin: () => true, mint, onMintError: jest.fn() });

        let first = network.ircClient.connect();
        let second = network.ircClient.connect();
        expect(second).toBe(first);
        await first;
        expect(mint).toHaveBeenCalledTimes(1);
        expect(network.sent).toHaveLength(1);
    });

    it('does not connect when minting fails', async() => {
        let network = fakeNetwork();
        let err = new LoginError(ERR_UNAUTHORIZED, 'sasl-token answered HTTP 401');
        let mint = jest.fn(() => Promise.reject(err));
        let onMintError = jest.fn();
        wrapConnect(network, { useLogin: () => true, mint, onMintError });

        await expect(network.ircClient.connect()).resolves.toBe(false);
        expect(network.sent).toHaveLength(0);
        expect(network.password).toBe('');
        expect(onMintError).toHaveBeenCalledWith(network, err);
    });

    it('blanks the password even when Kiwi\'s connect throws', async() => {
        let network = fakeNetwork();
        network.ircClient.connect = jest.fn(() => {
            throw new Error('transport failed');
        });
        wrapConnect(network, { useLogin: () => true, mint: tokenMinter(), onMintError: jest.fn() });

        await expect(network.ircClient.connect()).rejects.toThrow('transport failed');
        expect(network.password).toBe('');
    });

    it('leaves the nick and password path alone', async() => {
        let network = fakeNetwork();
        let mint = tokenMinter();
        wrapConnect(network, { useLogin: () => false, mint, onMintError: jest.fn() });

        network.password = 'typed password';
        await expect(network.ircClient.connect()).resolves.toBe(true);
        expect(mint).not.toHaveBeenCalled();
        expect(network.sent).toEqual([{ nick: 'Jameson', password: 'typed password' }]);
    });

    it('wraps a network only once', async() => {
        let network = fakeNetwork();
        let mint = tokenMinter();
        let hooks = { useLogin: () => true, mint, onMintError: jest.fn() };
        wrapConnect(network, hooks);
        wrapConnect(network, hooks);

        await network.ircClient.connect();
        expect(mint).toHaveBeenCalledTimes(1);
        expect(network.sent).toHaveLength(1);
    });
});
