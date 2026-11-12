// Redirect target of the "Log in with Fuel Rats" popup, loaded by
// /static/fuelrats-rat/callback.html. It hands the authorization code (or the error) and the state
// to the Kiwi window that opened the popup, on this origin only, clears them from the address bar
// and closes. The query string also reaches the web server access logs; why that is accepted is in
// src/plugins/fuelrats-rat/lib/popupLogin.js (authorizeUrl). Served as is, not bundled.
(function fuelratsRatCallback() {
    let params = new URLSearchParams(window.location.search);
    let message = {
        type: 'fuelrats-rat-login',
        code: params.get('code') || '',
        state: params.get('state') || '',
        error: params.get('error') || '',
    };
    let opener = window.opener;
    if (opener) {
        opener.postMessage(message, window.location.origin);
    }
    window.history.replaceState(null, '', window.location.pathname);
    if (opener) {
        window.close();
        return;
    }
    document.getElementById('kiwi-fuelrats-rat-callback-text').textContent =
        'This window could not hand the login back to Kiwi IRC. Close it and try again.';
}());
