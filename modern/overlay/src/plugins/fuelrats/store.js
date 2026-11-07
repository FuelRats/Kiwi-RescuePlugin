// Reactive state shared by the startup screen, the status panel and the IRC hooks.
import Vue from 'vue';
import { emptyStatus } from './lib/rescueStatus';

export default Vue.observable({
    status: emptyStatus(),
    announceFailed: false,
});
