// The page's one RatLogin, bound to the browser and to the fuelratsRat config block.
import Logger from '@/libs/Logger';
import RatLogin from './lib/ratLogin';
import { loginSettings } from './config';
import store from './store';

export default new RatLogin({
    settings: loginSettings,
    store,
    win: window,
    fetchFn: (url, init) => window.fetch(url, init),
    cryptoObj: window.crypto,
    log: Logger.namespace('fuelrats-rat'),
});
