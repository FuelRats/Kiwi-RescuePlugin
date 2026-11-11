// What the startup screen and the state-browser panel show for each login failure. An empty text
// means the screen just returns to the login button (the user closed the popup).
import {
    ERR_DENIED, ERR_FAILED, ERR_LOGGED_OUT, ERR_NETWORK, ERR_NO_ACCOUNT, ERR_POPUP_CLOSED,
    ERR_TIMEOUT, ERR_UNAUTHORIZED, ERR_UNAVAILABLE
} from './errors';

export const MESSAGES = {
    [ERR_POPUP_CLOSED]: '',
    [ERR_TIMEOUT]: 'The Fuel Rats login window timed out. Please try again.',
    [ERR_DENIED]: 'The Fuel Rats login was cancelled.',
    [ERR_NO_ACCOUNT]: 'Your Fuel Rats account has no IRC nickname yet. Register one on your ' +
        'profile, then try again.',
    [ERR_UNAUTHORIZED]: 'Your Fuel Rats login has expired. Please log in again.',
    [ERR_UNAVAILABLE]: 'Logging in with Fuel Rats is unavailable right now. Please use your ' +
        'nick and password instead.',
    [ERR_LOGGED_OUT]: 'Log in with Fuel Rats to connect.',
    [ERR_NETWORK]: 'Could not reach Fuel Rats. Try again, or use your nick and password.',
    [ERR_FAILED]: 'Logging in with Fuel Rats failed. Try again, or use your nick and password.',
};

export const PROFILE_LINK_TEXT = 'Open your Fuel Rats profile';
