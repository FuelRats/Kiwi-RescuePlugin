import {
    applyRatMessage, applySnapshot, emptyStatus, stepFor, STEP_BEACON, STEP_CLOSED, STEP_SEND_FR,
    STEP_SEND_WR, STEP_WAIT_FOR_RATS, STEP_WAIT_FOR_RESCUE, STEP_WAITING
} from '@/plugins/fuelrats/lib/rescueStatus';

const SNAPSHOT = {
    client: 'Jameson',
    system: 'Lave',
    codeRed: false,
    open: true,
    rats: [{ name: 'Rat One', fr: false, wr: false, beacon: false }],
};

describe('rescue status', () => {
    it('walks the classic steps', () => {
        expect(stepFor(emptyStatus())).toBe(STEP_WAITING);
        expect(stepFor(applySnapshot({ ...SNAPSHOT, rats: [] }))).toBe(STEP_WAIT_FOR_RATS);

        let s = applySnapshot(SNAPSHOT);
        expect(stepFor(s)).toBe(STEP_SEND_FR);
        s = applyRatMessage(s, 'Rat_One[PC]', 'Jameson fr+');
        expect(stepFor(s)).toBe(STEP_SEND_WR);
        s = applyRatMessage(s, 'Rat_One[PC]', 'wr+');
        expect(stepFor(s)).toBe(STEP_BEACON);
        s = applyRatMessage(s, 'Rat_One[PC]', 'BC+');
        expect(stepFor(s)).toBe(STEP_WAIT_FOR_RESCUE);
        expect(stepFor(applySnapshot({ ...SNAPSHOT, open: false }))).toBe(STEP_CLOSED);
    });

    it('only listens to assigned rats and respects the FR -> WR -> BC order', () => {
        let s = applySnapshot(SNAPSHOT);
        expect(applyRatMessage(s, 'Random_Rat', 'fr+').fr).toBe(false);
        expect(applyRatMessage(s, 'Rat_One', 'wr+').wr).toBe(false);
        let fr = applyRatMessage(s, 'Rat_One', 'fr+');
        expect(applyRatMessage(fr, 'Rat_One', 'fr-').fr).toBe(false);
        expect(applyRatMessage(fr, 'Rat_One', 'bc+').beacon).toBe(false);
        expect(applyRatMessage(emptyStatus(), 'Rat_One', 'fr+')).toEqual(emptyStatus());
    });

    it('lets the API snapshot overwrite the IRC overlay', () => {
        let s = applyRatMessage(applySnapshot(SNAPSHOT), 'Rat_One', 'fr+');
        expect(s.fr).toBe(true);
        let next = applySnapshot({ ...SNAPSHOT, rats: [{ name: 'Rat Two' }] });
        expect(next.fr).toBe(false);
        expect(next.rats).toEqual([{ name: 'Rat Two', fr: false, wr: false, beacon: false }]);
    });
});
