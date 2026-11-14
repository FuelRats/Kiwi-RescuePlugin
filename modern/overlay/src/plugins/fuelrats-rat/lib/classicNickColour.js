import * as Colours from '@/helpers/Colours';
import { md5 } from '@/helpers/Md5';

// Kiwi 1.5.1, which ran kiwi.fuelrats.com before the modern client, turned the hue of this colour
// and nudged its saturation by amounts read from the md5 of the lower-cased nick. Rats know each
// other by those colours, so the rat client keeps them.
const BASE_COLOUR = '#36809B';
// Hash digits 14 to 16 (0 to 0xfff) pick the hue turn, 0 to 359 degrees.
const HUE_DIGITS_START = 14;
const HUE_DIGITS_LENGTH = 3;
const HUE_DIGITS_MAX = 0xfff;
const HUE_TURN_MAX = 359;
// Hash digit 17 (0 to 15) is the saturation change in percent: added when even, taken when odd.
const SATURATION_DIGIT = 17;

/**
 * The colour Kiwi 1.5.1 gave a nick. The hue and saturation follow from the nick alone, and the
 * lightness from the theme (--kiwi-nickcolour-lightness, in percent), so a theme at 70, as the
 * old Dark theme was, shows exactly the old colours.
 * @param {string} nick
 * @param {string|number} [lightness] - Percent; without one the base colour's lightness is kept.
 * @returns {string} The colour as #rrggbb.
 */
export function classicNickColour(nick, lightness) {
    let hash = md5((nick || '').toLowerCase());
    let hueDigits = parseInt(hash.substr(HUE_DIGITS_START, HUE_DIGITS_LENGTH), 16);
    let saturationChange = parseInt(hash.substr(SATURATION_DIGIT, 1), 16);
    let hsl = Colours.rgb2hsl(Colours.hex2rgb(BASE_COLOUR));

    let hueTurn = hueDigits * HUE_TURN_MAX / HUE_DIGITS_MAX;
    hsl.h = (((hsl.h * 360 - hueTurn) + 360) % 360) / 360;

    if (saturationChange % 2 === 0) {
        hsl.s = Math.min(1, ((hsl.s * 100) + saturationChange) / 100);
    } else {
        hsl.s = Math.max(0, ((hsl.s * 100) - saturationChange) / 100);
    }

    let lightnessPercent = parseInt(lightness, 10);
    if (lightnessPercent) {
        hsl.l = lightnessPercent / 100;
    }

    return Colours.rgb2hex(Colours.hsl2rgb(hsl));
}
