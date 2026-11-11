// Per-network wrapper of ircClient.connect for the rat login.
//
// Kiwi overloads connect() itself (kiwiirc src/libs/IrcClient.js:26-85) and builds the SASL PLAIN
// options from network.connection.nick and network.password synchronously (:40-44); irc-framework
// reads them later, at AUTHENTICATE time, from its own options object. This wrapper sits in front
// of that overload, the same way, so every connect (the startup screen, the reconnect buttons,
// NetworkState.connect) goes through it:
//   - while the rat login is in use, it mints a fresh one-time IRC token, sets the nick and the
//     password, calls Kiwi's connect and blanks network.password straight after, so no UI path can
//     show or resend a used token. If minting fails it does not connect at all;
//   - otherwise it calls Kiwi's connect unchanged (the nick and password path).
// irc-framework's own auto-reconnect bypasses both overloads; the rat config keeps autoReconnect
// off, so a used token is never sent twice.

const wrapped = new WeakSet();

/**
 * @param {object} network Kiwi NetworkState
 * @param {object} hooks
 * @param {Function} hooks.useLogin () => boolean, read at every connect
 * @param {Function} hooks.mint () => Promise<{account, password}>
 * @param {Function} hooks.onMintError (network, err) => void
 */
export function wrapConnect(network, hooks) {
    let ircClient = network.ircClient;
    if (wrapped.has(ircClient)) {
        return;
    }
    wrapped.add(ircClient);

    let kiwiConnect = ircClient.connect;
    let minting = null;

    /**
     * @returns {Promise<boolean>} whether Kiwi's connect ran; existing callers ignore it
     */
    ircClient.connect = function connect(...args) {
        if (!hooks.useLogin()) {
            kiwiConnect.apply(ircClient, args);
            return Promise.resolve(true);
        }
        // A second click while a token is being minted joins that attempt.
        if (minting) {
            return minting;
        }

        minting = hooks.mint().then((token) => {
            minting = null;
            if (!hooks.useLogin()) {
                return false;
            }
            network.connection.nick = token.account;
            network.password = token.password;
            try {
                kiwiConnect.apply(ircClient, args);
            } finally {
                network.password = '';
            }
            return true;
        }, (err) => {
            minting = null;
            hooks.onMintError(network, err);
            return false;
        });
        return minting;
    };
}
