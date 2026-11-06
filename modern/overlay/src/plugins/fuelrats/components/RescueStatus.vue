<template>
    <div v-if="visible" class="kiwi-fuelrats-status">
        <template v-if="step === closedStep">
            <div class="kiwi-fuelrats-status-closed">{{ text }}</div>
        </template>
        <template v-else>
            <div class="kiwi-fuelrats-status-cmdr">CMDR {{ status.client }}</div>
            <div class="kiwi-fuelrats-status-system">{{ status.system }}</div>
            <div class="kiwi-fuelrats-status-rats">
                <b>Rats on mission:</b>
                <div v-for="rat in status.rats" :key="rat.name">{{ rat.name }}</div>
            </div>
            <div class="kiwi-fuelrats-status-step">{{ text }}</div>
        </template>
    </div>
</template>

<script>
'kiwi public';

import { STEP_CLOSED, STEP_TEXT, stepFor } from '../lib/rescueStatus';
import store from '../store';

export default {
    data() {
        return {
            store,
            closedStep: STEP_CLOSED,
        };
    },
    computed: {
        status() {
            return this.store.status;
        },
        visible() {
            return this.status.known;
        },
        step() {
            return stepFor(this.status);
        },
        text() {
            return STEP_TEXT[this.step];
        },
    },
};
</script>

<style>
.kiwi-fuelrats-status {
    padding: 8px;
    border-top: 1px solid var(--comp-border);
}

.kiwi-fuelrats-status-cmdr {
    font-weight: bold;
}

.kiwi-fuelrats-status-system {
    font-style: italic;
}

.kiwi-fuelrats-status-rats {
    margin-top: 5px;
}

.kiwi-fuelrats-status-step {
    margin-top: 8px;
    padding: 4px;
    background-color: #88c56a;
    color: #000;
    font-weight: bold;
    text-align: center;
}
</style>
