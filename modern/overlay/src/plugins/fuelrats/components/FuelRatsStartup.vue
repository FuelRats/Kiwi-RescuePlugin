<template>
    <startup-layout ref="layout" class="kiwi-fuelrats-startup">
        <template #connection>
            <form
                class="u-form u-form--big kiwi-fuelrats-startup-form"
                novalidate
                @submit.prevent="formSubmit"
            >
                <img
                    :src="logoUrl"
                    class="kiwi-fuelrats-startup-logo"
                    alt="Fuel Rats"
                    title="Fuel Rats"
                >
                <h2 class="kiwi-fuelrats-startup-title">Please enter your details below...</h2>

                <div
                    v-if="errors.length > 0 || connectionError"
                    class="kiwi-fuelrats-startup-error"
                    role="alert"
                >
                    <span v-for="err in errors" :key="err">{{ err }}</span>
                    <span v-if="connectionError">{{ connectionError }}</span>
                </div>

                <div class="kiwi-fuelrats-startup-field kiwi-fuelrats-field-cmdr">
                    <input-text v-model="form.cmdr" label="CMDR Name" type="text" />
                </div>
                <div class="kiwi-fuelrats-startup-field kiwi-fuelrats-field-system">
                    <input-text v-model="form.system" label="System name" type="text" />
                </div>

                <div class="kiwi-fuelrats-startup-field kiwi-fuelrats-field-platform">
                    <label for="kiwi-fuelrats-platform">Platform</label>
                    <select
                        id="kiwi-fuelrats-platform"
                        v-model="form.platform"
                        class="u-input kiwi-fuelrats-startup-select"
                    >
                        <option v-for="p in platforms" :key="p" :value="p">{{ p }}</option>
                    </select>
                </div>

                <div class="kiwi-fuelrats-startup-field kiwi-fuelrats-field-expansion">
                    <label for="kiwi-fuelrats-expansion">Expansion</label>
                    <select
                        id="kiwi-fuelrats-expansion"
                        v-model="form.expansion"
                        class="u-input kiwi-fuelrats-startup-select"
                    >
                        <option v-for="e in expansions" :key="e.value" :value="e.value">
                            {{ e.label }}
                        </option>
                    </select>
                </div>

                <div class="kiwi-fuelrats-startup-field kiwi-fuelrats-field-eo2">
                    <label class="kiwi-fuelrats-startup-eo2">
                        <input v-model="form.eo2" type="checkbox">
                        <span>
                            Are you on emergency O2?
                            <strong>YES!</strong> I have a timer in the upper right corner.
                        </span>
                    </label>
                    <div
                        v-if="form.eo2"
                        class="kiwi-fuelrats-startup-eo2-warning"
                        role="alert"
                    >{{ eo2Warning }}</div>
                </div>

                <button
                    v-if="!connecting"
                    class="u-button u-button-primary u-submit kiwi-fuelrats-startup-start"
                    type="submit"
                >
                    Start
                </button>
                <button
                    v-else
                    class="u-button u-button-primary u-submit kiwi-fuelrats-startup-start"
                    type="button"
                    disabled
                >
                    <i class="fa fa-spin fa-spinner" aria-hidden="true" />
                </button>
            </form>
        </template>
    </startup-layout>
</template>

<script>
'kiwi public';

import _ from 'lodash';
import * as Misc from '@/helpers/Misc';
import StartupLayout from '@/components/startups/CommonLayout';
import { fallbackNick, sanitizeCMDRName, sanitizeIRCName } from '../lib/names';
import {
    DEFAULT_EXPANSION, EXPANSIONS, PLATFORMS, formFromPrefill, parsePrefilledData, shouldAutoSubmit
} from '../lib/prefill';
import { rememberCmdrName, rememberedCmdrName } from '../lib/session';
import { setting } from '../config';
import { startRescue } from '../rescue';

export const MSG_NEED_CMDR = 'Please enter your CMDR Name so we can help you faster!';
export const MSG_NEED_SYSTEM = 'Please enter which system you are located in. ' +
    'You can find this in your left panel.';
export const MSG_NEED_PLATFORM = 'You must select what platform you are using.';
// The classic client showed this in an alert() on submit; it is shown as soon as the box is ticked.
export const MSG_EO2 = 'Please log out to the main menu immediately! ' +
    'Do not forget to write down your current position!';

export default {
    components: {
        StartupLayout,
    },
    data() {
        return {
            form: {
                cmdr: '',
                system: '',
                platform: 'PC',
                expansion: DEFAULT_EXPANSION,
                eo2: false,
            },
            errors: [],
            network: null,
            connecting: false,
            autoSubmitted: false,
            platforms: PLATFORMS,
            expansions: EXPANSIONS,
            eo2Warning: MSG_EO2,
        };
    },
    computed: {
        logoUrl() {
            return 'static/fuelrats/fuelrats.png';
        },
        connectionError() {
            let net = this.network;
            if (!net || this.connecting) {
                return '';
            }
            if (net.state_error) {
                return Misc.networkErrorMessage(net.state_error);
            }
            return net.last_error || '';
        },
    },
    created() {
        let prefill = parsePrefilledData(window.location.search);
        if (prefill) {
            this.form = formFromPrefill(prefill);
            this.autoSubmitted = shouldAutoSubmit(prefill, Date.now());
        } else {
            this.form.cmdr = rememberedCmdrName();
        }
    },
    mounted() {
        if (this.autoSubmitted) {
            this.formSubmit();
        }
    },
    methods: {
        validate() {
            let errors = [];
            let cmdrName = sanitizeCMDRName(this.form.cmdr);
            let ircNick = sanitizeIRCName(this.form.cmdr);
            if (!cmdrName) {
                errors.push(MSG_NEED_CMDR);
            } else if (!ircNick) {
                ircNick = fallbackNick();
            }
            if (!this.form.system.trim()) {
                errors.push(MSG_NEED_SYSTEM);
            }
            if (!PLATFORMS.includes(this.form.platform)) {
                errors.push(MSG_NEED_PLATFORM);
            }
            return { errors, cmdrName, ircNick };
        },
        formSubmit() {
            let { errors, cmdrName, ircNick } = this.validate();
            this.errors = errors;
            if (errors.length > 0) {
                return;
            }

            rememberCmdrName(cmdrName);
            this.connect({
                cmdrName,
                ircNick,
                system: this.form.system.trim(),
                platform: this.form.platform,
                eo2: this.form.eo2,
                expansion: this.form.expansion,
            });
        },
        connect(info) {
            let options = this.$state.settings.startupOptions;
            let conn = Misc.connectionInfoFromConfig(options);
            let hostname = _.trim(conn.hostname) || 'default';
            let port = conn.port || (conn.tls ? 6697 : 6667);

            let net = this.network || this.$state.addNetwork(setting('networkName'), info.ircNick, {
                server: hostname,
                port,
                tls: conn.tls,
                direct: conn.direct,
                path: conn.direct_path || '',
                encoding: _.trim(options.encoding),
                gecos: options.gecos,
                username: options.username,
            });
            net.serverBuffer().clearMessages();
            net.connection.nick = info.ircNick;
            this.network = net;

            let switched = false;
            Misc.extractBuffers(options.channel || '').forEach((bufferObj) => {
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

            startRescue(this.$state, net, info);

            this.connecting = true;
            let handlers = {};
            let cleanup = () => {
                net.ircClient.off('registered', handlers.registered);
                net.ircClient.off('close', handlers.close);
            };
            handlers.registered = () => {
                cleanup();
                this.$refs.layout.close();
            };
            handlers.close = () => {
                cleanup();
                this.connecting = false;
            };
            net.ircClient.once('registered', handlers.registered);
            net.ircClient.once('close', handlers.close);
            net.ircClient.connect();
        },
    },
};
</script>

<style>
.kiwi-fuelrats-startup .kiwi-startup-common-section-info {
    border-left-color: var(--brand-primary);
}

/* Auto margins centre the form vertically without clipping its top when it is taller than the
   window (flex centring would). */
.kiwi-fuelrats-startup .kiwi-startup-common-section-connection {
    align-items: flex-start;
}

form.kiwi-fuelrats-startup-form {
    width: 100%;
    max-width: 420px;
    margin: auto 0;
    padding: 20px;
    text-align: left;
}

.kiwi-fuelrats-startup-logo {
    display: block;
    width: 110px;
    margin: 0 auto 10px;
}

.kiwi-fuelrats-startup-title {
    margin: 0 0 20px;
    font-size: 1.3em;
    font-weight: 600;
    text-align: center;
}

.kiwi-fuelrats-startup-error {
    margin: 0 0 1em;
    padding: 0.8em;
    border: 1px solid var(--brand-error);
    border-radius: 4px;
}

.kiwi-fuelrats-startup-error span {
    display: block;
}

.kiwi-fuelrats-startup-field {
    margin: 0 0 16px;
}

.kiwi-fuelrats-startup-field > label {
    display: block;
    margin-bottom: 4px;
}

form.kiwi-fuelrats-startup-form .kiwi-fuelrats-startup-select {
    width: 100%;
    padding: 10px 8px;
}

form.kiwi-fuelrats-startup-form .kiwi-fuelrats-startup-eo2 {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
}

form.kiwi-fuelrats-startup-form .kiwi-fuelrats-startup-eo2 input {
    flex: 0 0 20px;
    float: none;
    margin: 2px 0 0;
}

form.kiwi-fuelrats-startup-form .kiwi-fuelrats-startup-eo2 span {
    margin: 0;
    line-height: 1.4;
}

.kiwi-fuelrats-startup-eo2-warning {
    margin-top: 8px;
    padding: 8px;
    border-radius: 4px;
    background: var(--brand-error);
    color: #fff;
    font-weight: bold;
}

.kiwi-fuelrats-startup-start {
    width: 100%;
    margin-top: 10px;
}
</style>
