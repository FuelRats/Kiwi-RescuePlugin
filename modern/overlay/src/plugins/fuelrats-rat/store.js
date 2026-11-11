// Reactive login state shared by the startup screen, the state-browser panel and the connect
// wrapper. It holds no secret: the API bearer stays inside RatLogin (login.js), and an IRC token is
// on the network only for the duration of one connect() call.
import Vue from 'vue';
import { emptyLoginState } from './lib/ratLogin';

export default Vue.observable(emptyLoginState());
