// Live rescue status for the client: rat assigned -> FR -> WR -> beacon -> rescue -> closed.
// The API snapshot (GET /rescues/client-status) is authoritative and replaces the state on every
// poll; rat messages on IRC (fr+/wr+/bc+) are a low-latency overlay until the next snapshot.

export const STEP_WAITING = 'waiting';
export const STEP_WAIT_FOR_RATS = 'wait-for-rats';
export const STEP_SEND_FR = 'send-fr';
export const STEP_SEND_WR = 'send-wr';
export const STEP_BEACON = 'beacon';
export const STEP_WAIT_FOR_RESCUE = 'wait-for-rescue';
export const STEP_CLOSED = 'closed';

export const STEP_TEXT = {
    [STEP_WAITING]: 'Waiting for your case to be opened',
    [STEP_WAIT_FOR_RATS]: 'Wait for rat assignment',
    [STEP_SEND_FR]: 'Please send FR to rats',
    [STEP_SEND_WR]: 'Please send WR to rats',
    [STEP_BEACON]: 'Please activate beacon',
    [STEP_WAIT_FOR_RESCUE]: 'Wait for rescue!',
    [STEP_CLOSED]: 'Thanks for fueling with the Rats. Make sure to stay for a moment longer as ' +
        'your rat will give you some invaluable information',
};

export function emptyStatus() {
    return {
        known: false,
        open: true,
        client: '',
        system: '',
        codeRed: false,
        rats: [],
        fr: false,
        wr: false,
        beacon: false,
    };
}

/**
 * Replace the status with an API snapshot ({ client, system, codeRed, open, rats: [{ name, fr,
 * wr, beacon }] }). Never merges with the previous state, so a rat unassigned by dispatch
 * disappears on the next poll.
 */
export function applySnapshot(snapshot) {
    let rats = (snapshot.rats || []).map((rat) => ({
        name: String(rat.name || ''),
        fr: !!rat.fr,
        wr: !!rat.wr,
        beacon: !!rat.beacon,
    }));
    return {
        known: true,
        open: !!snapshot.open,
        client: String(snapshot.client || ''),
        system: String(snapshot.system || ''),
        codeRed: !!snapshot.codeRed,
        rats,
        fr: rats.some((rat) => rat.fr),
        wr: rats.some((rat) => rat.wr),
        beacon: rats.some((rat) => rat.beacon),
    };
}

function nickBase(nick) {
    // Rat nicks carry a platform/status suffix: CMDR_Name[PC], CMDR_Name|afk
    return nick.toLowerCase().replace(/[[|].*$/, '');
}

export function isAssignedRat(status, nick) {
    let base = nickBase(nick || '');
    return !!base && status.rats.some((rat) => rat.name.toLowerCase().replace(/\s+/g, '_') === base);
}

/**
 * Apply a rat's IRC message (classic HandleRatMessage): fr+/fr- always, wr only after FR, bc only
 * after FR and WR. Messages from anyone but an assigned rat are ignored.
 */
export function applyRatMessage(status, senderNick, message) {
    if (!status.known || !isAssignedRat(status, senderNick)) {
        return status;
    }

    let msg = String(message || '').toLowerCase();
    let next = { ...status };
    if (/fr\+/.test(msg)) {
        next.fr = true;
    } else if (/fr-/.test(msg)) {
        next.fr = false;
    }
    if (next.fr && /wr\+/.test(msg)) {
        next.wr = true;
    } else if (next.fr && /wr-/.test(msg)) {
        next.wr = false;
    }
    if (next.fr && next.wr && /bc\+/.test(msg)) {
        next.beacon = true;
    } else if (next.fr && next.wr && /bc-/.test(msg)) {
        next.beacon = false;
    }
    return next;
}

export function stepFor(status) {
    if (!status.known) {
        return STEP_WAITING;
    }
    if (!status.open) {
        return STEP_CLOSED;
    }
    if (status.rats.length === 0) {
        return STEP_WAIT_FOR_RATS;
    }
    if (!status.fr) {
        return STEP_SEND_FR;
    }
    if (!status.wr) {
        return STEP_SEND_WR;
    }
    if (!status.beacon) {
        return STEP_BEACON;
    }
    return STEP_WAIT_FOR_RESCUE;
}
