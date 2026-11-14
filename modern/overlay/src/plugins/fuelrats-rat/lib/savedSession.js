// The rat config has Kiwi save its state in localStorage (startupOptions.state_key and
// remember_buffers): the network with its nick, NickServ password and channels, plus the user's
// settings. The startup screen picks that network up again, so a returning rat finds the form
// filled in and rejoins the same channels. A one-time IRC token from "Log in with Fuel Rats" is
// never saved: the connect wrapper blanks network.password straight after connecting.

/**
 * The saved network for the configured server, with the nick and password it last used.
 * @param {object} state Kiwi state (getNetworkFromAddress)
 * @param {string} hostname the server from startupOptions
 * @returns {{network: object, nick: string, password: string}|null} null when nothing is saved
 */
export function savedSession(state, hostname) {
    let host = (hostname || '').trim();
    if (!host) {
        return null;
    }
    let network = state.getNetworkFromAddress(host);
    if (!network) {
        return null;
    }
    return {
        network,
        nick: (network.connection && network.connection.nick) || '',
        password: network.password || '',
    };
}
