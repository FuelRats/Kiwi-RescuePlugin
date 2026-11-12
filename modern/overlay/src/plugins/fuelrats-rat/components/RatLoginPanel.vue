<template>
    <div v-if="visible" class="kiwi-fuelrats-rat-panel">
        <div v-if="store.error" class="kiwi-fuelrats-rat-panel-error" role="alert">
            {{ store.error }}
            <a
                v-if="store.errorLink"
                :href="store.errorLink"
                class="u-link"
                target="_blank"
                rel="noopener"
            >{{ profileLinkText }}</a>
        </div>
        <template v-if="loggedIn">
            <div class="kiwi-fuelrats-rat-panel-account">
                Logged in with Fuel Rats
                <template v-if="store.account">as <strong>{{ store.account }}</strong></template>
            </div>
            <a class="u-link kiwi-fuelrats-rat-panel-logout" @click="logout">Log out</a>
        </template>
        <i v-else-if="busy" class="fa fa-spin fa-spinner" aria-hidden="true" />
        <a
            v-else
            class="u-link kiwi-fuelrats-rat-panel-login"
            @click="loginAndReconnect"
        >Log in with Fuel Rats</a>
    </div>
</template>

<script>
// State-browser panel of the rat login, shown once the client is in the chat: who is logged in
// and the explicit "Log out" (which revokes the API bearer), or, after a log out or an expired
// login, the login button again. Logging in here reconnects a disconnected network, minting a new
// IRC login on the way (lib/connectWrapper.js).

import { PROFILE_LINK_TEXT } from '../lib/messages';
import { STATUS_LOGGED_IN, STATUS_LOGGING_IN } from '../lib/ratLogin';
import ratLogin from '../login';
import store from '../store';

export default {
    data() {
        return {
            store,
            profileLinkText: PROFILE_LINK_TEXT,
        };
    },
    computed: {
        loggedIn() {
            return this.store.status === STATUS_LOGGED_IN;
        },
        busy() {
            return this.store.status === STATUS_LOGGING_IN || this.store.minting;
        },
        visible() {
            return ratLogin.available() && (this.loggedIn || this.store.useLogin);
        },
    },
    methods: {
        logout() {
            ratLogin.logout();
        },
        loginAndReconnect() {
            // login() opens the popup synchronously, inside this click.
            ratLogin.login().then((loggedIn) => {
                let net = this.$state.getActiveNetwork();
                if (loggedIn && net && net.state === 'disconnected') {
                    net.ircClient.connect();
                }
            });
        },
    },
};
</script>

<style>
.kiwi-fuelrats-rat-panel {
    padding: 8px;
    border-top: 1px solid var(--comp-border);
}

.kiwi-fuelrats-rat-panel-error {
    margin-bottom: 6px;
}

.kiwi-fuelrats-rat-panel-error .u-link {
    display: block;
}
</style>
