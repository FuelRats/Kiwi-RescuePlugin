// Wires a submitted intake form to the IRC network: announce on registration, then (when the
// status feed is enabled) poll the client-status endpoint. Lives outside the startup component,
// which is destroyed once the client enters the chat.
import Logger from '@/libs/Logger';
import { sendAnnounce } from './lib/announce';
import ClientStatusPoller from './lib/clientStatusApi';
import RescueSession, { RESULT_ANNOUNCED } from './lib/rescueSession';
import { applySnapshot } from './lib/rescueStatus';
import { leaveToGetHelp, setting } from './config';
import store from './store';

const log = Logger.namespace('fuelrats');

export const ANNOUNCE_FAILED_TEXT = 'We could not tell the rats that you have arrived. Please type ' +
    'your CMDR name, star system and platform in this channel so a rat can help you.';

let poller = null;
// The 'registered' listener of the current form submit; a resubmit replaces it.
let detachRegistered = null;

function startStatusFeed(token) {
    if (poller) {
        poller.stop();
    }
    poller = new ClientStatusPoller({
        apiUrl: setting('apiUrl'),
        token,
        intervalMs: setting('statusFeed.pollIntervalMs'),
        onSnapshot: (snapshot) => {
            store.status = applySnapshot(snapshot);
        },
        onError: (err) => log.error('client-status poll failed:', err.message),
    });
    poller.start();
}

function reportAnnounceFailure(state, network, err) {
    log.error('Announce failed:', err && err.message);
    store.announceFailed = true;
    let buffer = state.getActiveBuffer() || network.serverBuffer();
    state.addMessage(buffer, {
        time: Date.now(),
        nick: '',
        message: ANNOUNCE_FAILED_TEXT,
        type: 'error',
    });
}

/**
 * @param {object} state Kiwi state
 * @param {object} network the NetworkState the client connects with
 * @param {object} info { cmdrName, ircNick, system, platform, eo2, expansion }
 * @returns {RescueSession}
 */
export function startRescue(state, network, info) {
    let feedEnabled = !!setting('statusFeed.enabled');
    let session = new RescueSession({
        announce: (payload) => sendAnnounce(setting('announcerUrl'), payload, {
            readResponse: feedEnabled,
        }),
        redirect: (reason) => {
            log.info('Leaving to get-help:', reason);
            leaveToGetHelp();
        },
        browserLanguage: window.navigator.language,
    });
    session.begin(info);

    if (detachRegistered) {
        detachRegistered();
    }
    let onRegistered = (event) => {
        let result = session.handleRegistered((event && event.nick) || network.nick);
        if (result !== RESULT_ANNOUNCED) {
            return;
        }
        session.announcePromise.then((response) => {
            let token = response && response.client_status_token;
            if (feedEnabled && token) {
                startStatusFeed(token);
            }
        }).catch((err) => reportAnnounceFailure(state, network, err));
    };
    network.ircClient.on('registered', onRegistered);
    detachRegistered = () => network.ircClient.off('registered', onRegistered);

    return session;
}
