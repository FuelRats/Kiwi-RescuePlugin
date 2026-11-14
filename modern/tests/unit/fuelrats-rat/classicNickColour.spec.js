import { classicNickColour } from '@/plugins/fuelrats-rat/lib/classicNickColour';

// Expected colours come from Kiwi 1.5.1's own createNickColour (src/helpers/TextFormatting.js at
// v1.5.1, the build kiwi.fuelrats.com ran), with --kiwi-nick-brightness set to each lightness.
const OLD_COLOURS = {
    70: {
        'Jameson': '#b4df86',
        'Halsey': '#91d4c1',
        'Ozymandias': '#bed293',
        'Kerrigan[PC]': '#cf87de',
        'delta_rat': '#99cc9c',
    },
    28: {
        'Jameson': '#49711e',
        'Halsey': '#286655',
        'Ozymandias': '#52652a',
        'Kerrigan[PC]': '#621f70',
        'delta_rat': '#305f32',
    },
};

describe('classic nick colour', () => {
    Object.keys(OLD_COLOURS).forEach((lightness) => {
        it(`gives each nick its Kiwi 1.5.1 colour at lightness ${lightness}`, () => {
            Object.keys(OLD_COLOURS[lightness]).forEach((nick) => {
                expect(classicNickColour(nick, lightness)).toBe(OLD_COLOURS[lightness][nick]);
            });
        });
    });

    it('reads the lightness as the theme variable gives it', () => {
        expect(classicNickColour('Jameson', ' 80')).toBe('#cdeaae');
    });

    it('keeps the base lightness without a theme lightness, as 1.5.1 did', () => {
        expect(classicNickColour('Jameson', '')).toBe('#6ba52c');
        expect(classicNickColour('Jameson', undefined)).toBe('#6ba52c');
    });

    it('ignores the case of the nick', () => {
        expect(classicNickColour('JAMESON', 70)).toBe(classicNickColour('jameson', 70));
    });

    it('colours an empty nick without throwing', () => {
        expect(classicNickColour('', 70)).toMatch(/^#[0-9a-f]{6}$/);
        expect(classicNickColour(undefined, 70)).toMatch(/^#[0-9a-f]{6}$/);
    });
});
