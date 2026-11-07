// `!kiwi-force <nick>`: an op sends this to eject a client from the web client back to the
// get-help page. Only honoured from the vhosts below (FuelRats staff cloaks).
export const FORCE_COMMAND = '!kiwi-force';

export const ALLOWED_VHOST_SUFFIXES = [
    'admin.fuelrats.com',
    '.op.fuelrats.com',
    'netadmin.fuelrats.com',
    '.overseer.fuelrats.com',
    '.techrat.fuelrats.com',
    'i.see.all',
];

// Senders whose messages never drive the client (bots and the client itself).
export const IGNORED_NICKS = ['RatMama[BOT]', 'MechaSqueak[BOT]'];

/**
 * @param {object} event irc-framework message event ({ type, nick, hostname, message })
 * @param {string} ownNick the client's current IRC nick
 * @returns {boolean} true when the event is an authorised eject for this client
 */
export function isForceEject(event, ownNick) {
    if (!event || event.type !== 'privmsg' || !ownNick) {
        return false;
    }
    if (event.nick === ownNick || IGNORED_NICKS.includes(event.nick)) {
        return false;
    }
    if (event.message !== FORCE_COMMAND + ' ' + ownNick) {
        return false;
    }

    let hostname = event.hostname || '';
    return ALLOWED_VHOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}
