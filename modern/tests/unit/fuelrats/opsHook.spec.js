import { isForceEject } from '@/plugins/fuelrats/lib/opsHook';

function msg(overrides) {
    return {
        type: 'privmsg',
        nick: 'SomeOp',
        hostname: 'someop.op.fuelrats.com',
        message: '!kiwi-force Jameson',
        ...overrides,
    };
}

describe('!kiwi-force', () => {
    it('ejects on the exact command from a staff vhost', () => {
        expect(isForceEject(msg(), 'Jameson')).toBe(true);
        expect(isForceEject(msg({ hostname: 'netadmin.fuelrats.com' }), 'Jameson')).toBe(true);
        expect(isForceEject(msg({ hostname: 'x.techrat.fuelrats.com' }), 'Jameson')).toBe(true);
    });

    it('ignores non-staff hosts, other nicks, other message types and bots', () => {
        expect(isForceEject(msg({ hostname: 'rat.fuelrats.com' }), 'Jameson')).toBe(false);
        expect(isForceEject(msg({ hostname: 'evil.op.fuelrats.com.example' }), 'Jameson')).toBe(false);
        expect(isForceEject(msg({ message: '!kiwi-force Someone' }), 'Jameson')).toBe(false);
        expect(isForceEject(msg({ message: '!kiwi-force Jameson please' }), 'Jameson')).toBe(false);
        expect(isForceEject(msg({ type: 'notice' }), 'Jameson')).toBe(false);
        expect(isForceEject(msg({ nick: 'MechaSqueak[BOT]' }), 'Jameson')).toBe(false);
        expect(isForceEject(msg({ nick: 'Jameson' }), 'Jameson')).toBe(false);
        expect(isForceEject(null, 'Jameson')).toBe(false);
    });
});
