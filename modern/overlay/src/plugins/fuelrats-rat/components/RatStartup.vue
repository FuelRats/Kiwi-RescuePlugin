<template>
    <startup-layout ref="layout" class="kiwi-welcome-simple kiwi-fuelrats-rat-startup">
        <template #connection>
            <form
                class="u-form u-form--big kiwi-welcome-simple-form"
                novalidate
                @submit.prevent="formSubmit"
            >
                <h2 v-html="greetingText" />

                <div
                    v-if="errorLines.length > 0"
                    class="kiwi-welcome-simple-error"
                    role="alert"
                >
                    <span v-for="(err, idx) in errorLines" :key="idx">{{ err }}</span>
                    <a
                        v-if="store.errorLink"
                        :href="store.errorLink"
                        class="u-link"
                        target="_blank"
                        rel="noopener"
                    >{{ profileLinkText }}</a>
                </div>

                <div v-if="loginAvailable" class="kiwi-fuelrats-rat-login">
                    <button
                        v-if="busy"
                        type="button"
                        class="u-button u-button-primary kiwi-fuelrats-rat-login-button"
                        disabled
                    >
                        <i class="fa fa-spin fa-spinner" aria-hidden="true" />
                    </button>
                    <button
                        v-else-if="loggedIn"
                        type="button"
                        class="u-button u-button-primary kiwi-fuelrats-rat-login-button"
                        @click="connectWithLogin"
                    >
                        Connect with Fuel Rats
                    </button>
                    <button
                        v-else
                        type="button"
                        class="u-button u-button-primary kiwi-fuelrats-rat-login-button"
                        @click="loginAndConnect"
                    >
                        Log in with Fuel Rats
                    </button>
                    <a
                        v-if="loggedIn && !busy"
                        class="u-link kiwi-fuelrats-rat-logout"
                        @click="logout"
                    >Log out of Fuel Rats</a>
                    <div class="kiwi-fuelrats-rat-login-or">or use a nick and password</div>
                </div>

                <input-text
                    v-model="nick"
                    v-focus="!loginAvailable && !nick"
                    :label="$t('nick')"
                    type="text"
                    :class="{ 'kiwi-welcome-invalid-nick': !isNickValid }"
                />

                <div class="kiwi-welcome-simple-input-container">
                    <label class="kiwi-welcome-simple-have-password">
                        <input v-model="showPassword" type="checkbox">
                        <span> {{ $t('password_have') }} </span>
                    </label>
                </div>

                <div v-if="showPassword" class="kiwi-welcome-simple-input-container">
                    <input-text
                        v-model="password"
                        v-focus="showPassword"
                        :show-plain-text="true"
                        :label="$t('password')"
                        type="password"
                    />
                </div>

                <div class="kiwi-welcome-simple-input-container">
                    <input-text v-model="channel" :label="$t('channel')" />
                </div>

                <button
                    v-if="!busy"
                    :disabled="!readyToStart"
                    class="u-button u-button-primary u-submit kiwi-welcome-simple-start"
                    type="submit"
                    v-html="buttonText"
                />
                <button
                    v-else
                    type="button"
                    class="u-button u-button-primary u-submit kiwi-welcome-simple-start"
                    disabled
                >
                    <i class="fa fa-spin fa-spinner" aria-hidden="true" />
                </button>
            </form>
        </template>
    </startup-layout>
</template>

<script>
// The rat startup screen: Kiwi's Welcome screen (nick, optional password, channel; kiwiirc
// src/components/startups/Welcome.vue) plus "Log in with Fuel Rats" when the fuelratsRat block
// has a client id. Without one it is the plain nick and password form. The login path connects
// through the connect wrapper (lib/connectWrapper.js), which replaces the nick and the password
// with a freshly minted IRC login.

import _ from 'lodash';
import * as Misc from '@/helpers/Misc';
import Logger from '@/libs/Logger';
import StartupLayout from '@/components/startups/CommonLayout';
import { PROFILE_LINK_TEXT } from '../lib/messages';
import { STATUS_LOGGED_IN, STATUS_LOGGING_IN } from '../lib/ratLogin';
import ratLogin from '../login';
import store from '../store';

const log = Logger.namespace('fuelrats-rat');

// Welcome.vue's default nick rule: nicks cannot start with [0-9- ]; `?` is replaced by digits.
const NICK_PATTERN = /^[a-z_\\[\]{}^`|][a-z0-9_\-\\[\]{}^`|]*$/i;
const RANDOM_NICK_DIGITS = 100;

function processNickRandomNumber(nick) {
    let randomDigits = () => Math.floor(Math.random() * RANDOM_NICK_DIGITS).toString();
    return _.trim(nick.replace(/\?/g, randomDigits));
}

export default {
    components: {
        StartupLayout,
    },
    data() {
        return {
            store,
            network: null,
            nick: '',
            password: '',
            showPassword: false,
            channel: '',
            connectErrors: [],
            profileLinkText: PROFILE_LINK_TEXT,
        };
    },
    computed: {
        startupOptions() {
            return this.$state.settings.startupOptions;
        },
        greetingText() {
            let greeting = this.startupOptions.greetingText;
            return typeof greeting === 'string' ? greeting : this.$t('start_greeting');
        },
        buttonText() {
            let text = this.startupOptions.buttonText;
            return typeof text === 'string' ? text : this.$t('start_button');
        },
        loginAvailable() {
            return ratLogin.available();
        },
        loggedIn() {
            return this.store.status === STATUS_LOGGED_IN;
        },
        busy() {
            let net = this.network;
            return this.store.status === STATUS_LOGGING_IN ||
                this.store.minting ||
                !!(net && net.state !== 'disconnected');
        },
        isNickValid() {
            return NICK_PATTERN.test(this.nick);
        },
        readyToStart() {
            if (!this.nick || !this.isNickValid) {
                return false;
            }
            let buffers = Misc.extractBuffers(this.channel);
            return buffers.length > 0 && buffers.every((b) => '#&'.indexOf(b.name[0]) > -1);
        },
        errorLines() {
            let lines = [];
            if (this.loginAvailable && this.store.error) {
                lines.push(this.store.error);
            }
            if (this.connectErrors.length > 0) {
                lines.push(...this.connectErrors);
            } else if (this.network && this.network.state_error) {
                lines.push(this.$t('network_noconnect'));
                lines.push(Misc.networkErrorMessage(this.network.state_error));
            }
            return lines;
        },
    },
    watch: {
        showPassword(show) {
            if (!show) {
                this.password = '';
            }
        },
    },
    created() {
        let options = this.startupOptions;
        this.nick = processNickRandomNumber(Misc.queryStringVal('nick') || options.nick || '');
        this.channel = decodeURIComponent(window.location.hash) || options.channel || '';
    },
    methods: {
        formSubmit() {
            if (!this.readyToStart || this.busy) {
                return;
            }
            this.store.useLogin = false;
            this.connect(this.nick, this.password);
        },
        loginAndConnect() {
            // login() opens the popup synchronously, inside this click.
            ratLogin.login().then((loggedIn) => {
                if (loggedIn) {
                    this.connectWithLogin();
                }
            });
        },
        connectWithLogin() {
            this.store.useLogin = true;
            this.showPassword = false;
            this.password = '';
            this.connect(this.nick, '');
        },
        logout() {
            ratLogin.logout();
        },
        connectOptions() {
            let conn = Misc.connectionInfoFromConfig(this.startupOptions);
            conn.hostname = _.trim(conn.hostname) || 'default';
            conn.port = conn.port || (conn.tls ? 6697 : 6667);
            return conn;
        },
        connect(nick, password) {
            this.connectErrors = [];
            let options = this.startupOptions;
            let conn = this.connectOptions();

            let net = this.network || this.$state.addNetwork('Network', nick, {
                server: conn.hostname,
                port: conn.port,
                tls: conn.tls,
                direct: conn.direct,
                path: conn.direct_path || '',
                encoding: _.trim(options.encoding),
                gecos: options.gecos,
                username: options.username,
            });
            net.serverBuffer().clearMessages();
            net.connection.nick = nick;
            net.connection.password = '';
            net.password = password;
            this.network = net;

            let switched = false;
            Misc.extractBuffers(this.channel).forEach((bufferObj) => {
                let buffer = this.$state.addBuffer(net.id, bufferObj.name);
                buffer.enabled = true;
                if (bufferObj.key) {
                    buffer.key = bufferObj.key;
                }
                if (!switched) {
                    this.$state.setActiveBuffer(net.id, buffer.name);
                    switched = true;
                }
            });
            if (!switched) {
                this.$state.setActiveBuffer(net.id, net.serverBuffer().name);
            }

            let handlers = {};
            let cleanup = () => {
                net.ircClient.off('registered', handlers.registered);
                net.ircClient.off('close', handlers.close);
                net.ircClient.off('irc error', handlers.error);
            };
            handlers.registered = () => {
                cleanup();
                if (this.$refs.layout) {
                    this.$refs.layout.close();
                }
            };
            handlers.close = () => {
                cleanup();
                let lastError = net.last_error;
                if (lastError && !this.connectErrors.includes(lastError)) {
                    this.connectErrors.push(lastError);
                }
            };
            handlers.error = (event) => {
                if (event.reason && !this.connectErrors.includes(event.reason)) {
                    this.connectErrors.push(event.reason);
                }
            };
            net.ircClient.once('registered', handlers.registered);
            net.ircClient.once('close', handlers.close);
            net.ircClient.on('irc error', handlers.error);

            // The connect wrapper resolves false when it did not connect (no IRC login minted);
            // its error is in the store.
            Promise.resolve(net.ircClient.connect()).then((connected) => {
                if (connected === false) {
                    cleanup();
                }
            }, (err) => {
                cleanup();
                log.error('connect failed:', err && err.message);
            });
        },
    },
};
</script>

<style>
.kiwi-fuelrats-rat-login {
    margin: 0 0 20px;
    text-align: center;
}

.kiwi-welcome-simple-form .kiwi-fuelrats-rat-login-button {
    width: 100%;
    height: 50px;
    font-size: 1.3em;
}

.kiwi-fuelrats-rat-logout {
    display: inline-block;
    margin-top: 10px;
}

.kiwi-fuelrats-rat-login-or {
    margin-top: 16px;
    opacity: 0.8;
}
</style>
