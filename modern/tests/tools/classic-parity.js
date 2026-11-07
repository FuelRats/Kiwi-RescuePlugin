// Computes the classic plugin's CMDR-name / IRC-nick sanitization for a battery of names.
// usage (repo root): node modern/tests/tools/classic-parity.js . > modern/tests/unit/fuelrats/classic-names.fixture.json
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = process.argv[2];
const script = fs.readFileSync(path.join(dir, 'script.js'), 'utf8');
const start = script.indexOf('    function sanitizeCMDRName');
const end = script.indexOf('    var cmdrName = document.getElementById');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'diacritics.js'), 'utf8'), ctx);
vm.runInContext(script.slice(start, end), ctx);

const names = [
    'Jameson', 'CMDR Jameson', 'cmdr   Jameson', 'CMDRJameson', '@Jameson', '#Jameson', 'CMDR @Jameson',
    'Commander Shepard', 'Mr. Smith', 'J.R.R. Tolkien', 'Ünïcödé Ràt', 'Ølstrøm Bjørnsen', 'Æsir',
    'Владимир Путешественник', 'Ёжик в тумане', 'Щука', 'Žluťoučký kůň', 'François Lefèvre',
    '1234', '42 Ratsalot', '007 Bond', 'Rat[PC]', 'Rat{XB}', 'Rat^Caret', 'Rat|afk', 'Rat-Dash',
    'Rat`Back', 'Rat\\Slash', 'Rat´Acute', 'tabs\there', '  padded  ', 'emoji 🚀 rat', '日本語の名前',
    'ThisIsAVeryLongCommanderNameThatGoesOnAndOn', 'Exactly_Thirty_Characters_Long', 'a',
    'Ελληνικά', 'İstanbul Işık', 'Straße', 'CMDR', 'cmdr cmdr', 'O\'Brien', 'Rat & Mouse', 'x_X',
];
const out = names.map((name) => ({
    input: name,
    cmdrName: ctx.sanitizeCMDRName(name),
    ircNick: ctx.sanitizeIRCName(name),
}));
process.stdout.write(JSON.stringify(out, null, 4) + '\n');
