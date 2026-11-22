#!/usr/bin/env node
// Checks a pixel reel and makes it into one web page: node make-page.mjs reel.json [page.html]
// Made by npm run skill in the pixelreel project from the player's own checks: do not edit.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __m = {};

__m['icons.js'] = (() => {
// Everyday icons for the ready-made pictures: 16 x 16 pixel art in palette letters (see
// PALETTE in palette.js; '.' is see-through). Data only, so a reel.json can name them.
// Each is outlined in black where it has a body, so it reads on the pictures' dark blue and
// on a compare card's cream alike; thin shapes with no body (rain, wifi, a chart's axis)
// are drawn in a colour that shows on both. A new icon goes in ICON_GROUPS too.

const ICON_SIZE = 16;

const ICONS = {
  letter: [
    '................',
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kkwwwwwwwwwwwwkk',
    'kwkwwwwwwwwwwkwk',
    'kwwkwwwwwwwwkwwk',
    'kwwwkwwwwwwkwwwk',
    'kwwwwkwwwwkwwwwk',
    'kwwwwwkrrkwwwwwk',
    'kwwwwkwrrwkwwwwk',
    'kwwwkwwwwwwkwwwk',
    'kwwkwwwwwwwwkwwk',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................'
  ],
  document: [
    '..kkkkkkkkk.....',
    '..kwwwwwwwkk....',
    '..kwwwwwwwkwk...',
    '..kweeeeewkkkk..',
    '..kwwwwwwwwwwk..',
    '..kweeeeeeeewk..',
    '..kwwwwwwwwwwk..',
    '..kweeeeeeeewk..',
    '..kwwwwwwwwwwk..',
    '..kweeeeeeeewk..',
    '..kwwwwwwwwwwk..',
    '..kweeeewwwwwk..',
    '..kwwwwwwwrrwk..',
    '..kwwwwwwrwwrk..',
    '..kkkkkkkkkkkk..',
    '................'
  ],
  phone: [
    '....kkkkkkkk....',
    '....kkkkkkkk....',
    '....kbbbbbbk....',
    '....kbttttbk....',
    '....kbttttbk....',
    '....kbbbbbbk....',
    '....kbyybbbk....',
    '....kbyybbbk....',
    '....kbbbbbbk....',
    '....kbbbttbk....',
    '....kbbbttbk....',
    '....kbbbbbbk....',
    '....kkkkkkkk....',
    '....kkkwwkkk....',
    '....kkkkkkkk....',
    '................'
  ],
  money: [
    '.....kkkkkk.....',
    '...kkyyyyyykk...',
    '..kyyyyyyyyyyk..',
    '.kyyyynnnyyyyyk.',
    '.kyyynyyynyyyyk.',
    'kyyyynyyyyyyyyyk',
    'kyyyynyyyyyyyyyk',
    'kyyynnnnnyyyyyyk',
    'kyyyynyyyyyyyyyk',
    'kyyyynyyyyyyyyyk',
    'kyyynnnnnnnyyyyk',
    '.kyyyyyyyyyyyyk.',
    '.koyyyyyyyyyyok.',
    '..kooyyyyyyook..',
    '...kkooooookk...',
    '.....kkkkkk.....'
  ],
  house: [
    '.......kk.......',
    '......krrk.kkk..',
    '.....krrrrkkek..',
    '....krrrrrrkek..',
    '...krrrrrrrrkk..',
    '..krrrrrrrrrrk..',
    '.krrrrrrrrrrrrk.',
    'kkkkkkkkkkkkkkkk',
    '.kcccccccccccck.',
    '.kcbbbcccnnnnck.',
    '.kcbtbcccnnnnck.',
    '.kcbbbcccnnnnck.',
    '.kcccccccnnynck.',
    '.kcccccccnnnnck.',
    '.kcccccccnnnnck.',
    '.kkkkkkkkkkkkkk.'
  ],
  calendar: [
    '...k......k.....',
    '..kkk....kkk....',
    'kkkkkkkkkkkkkkkk',
    'krrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    'kkkkkkkkkkkkkkkk',
    'kwwwwwwwwwwwwwwk',
    'kweewweewweewwwk',
    'kweewweewweewwwk',
    'kwwwwwwwwwwwwwwk',
    'kweewweewrrrwwwk',
    'kweewweewrrrwwwk',
    'kwwwwwwwwwwwwwwk',
    'kweewweewweewwwk',
    'kwwwwwwwwwwwwwwk',
    'kkkkkkkkkkkkkkkk'
  ],
  clock: [
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwwkwwwwwk..',
    '.kwwwwwkwwwwwwk.',
    '.kwwwwwkwwwwwwk.',
    'kwwwwwwkwwwwwwwk',
    'kwwwwwwkwwwwwwwk',
    'kkwwwwwkkkkkwwkk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kwwwwwkwwwwk..',
    '...kkwwwwwwkk...',
    '.....kkkkkk.....'
  ],
  person: [
    '................',
    '.....nnnnnn.....',
    '....nnnnnnnn....',
    '....nssssssn....',
    '....skssssks....',
    '....ssssssss....',
    '....sssrrsss....',
    '.....ssssss.....',
    '......ssss......',
    '...tttttttttt...',
    '..tttttttttttt..',
    '..tttttttttttt..',
    '..sstttttttss...',
    '....tttttttt....',
    '....bbbbbbbb....',
    '....bbbb.bbb....'
  ],
  people: [
    '................',
    '..nnnn....yyyy..',
    '.nnnnnn..yyyyyy.',
    '.nssssn..yssssy.',
    '.skssks..skssks.',
    '.ssssss..ssssss.',
    '.ssrrss..ssrrss.',
    '..ssss....ssss..',
    '.tttttt..pppppp.',
    '.tttttt..pppppp.',
    'sttttttsspppppps',
    '.tttttt..pppppp.',
    '.bbbbbb..pppppp.',
    '.bb..bb..pppppp.',
    '.bb..bb...s..s..',
    '.kk..kk...k..k..'
  ],
  heart: [
    '................',
    '..kkkk....kkkk..',
    '.krrrrk..krrrrk.',
    'krrwwrrkkrrrrrrk',
    'krwwrrrrrrrrrrrk',
    'krwrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    '.krrrrrrrrrrrrk.',
    '..krrrrrrrrrrk..',
    '...krrrrrrrrk...',
    '....krrrrrrk....',
    '.....krrrrk.....',
    '......krrk......',
    '.......kk.......',
    '................'
  ],
  tick: [
    '................',
    '..............gg',
    '.............ggg',
    '............ggg.',
    '...........ggg..',
    '..........ggg...',
    '.........ggg....',
    'gg......ggg.....',
    'ggg....ggg......',
    '.ggg..ggg.......',
    '..ggggggg.......',
    '...ggggg........',
    '....ggg.........',
    '................',
    '................',
    '................'
  ],
  cross: [
    '................',
    '.rr..........rr.',
    '.rrr........rrr.',
    '..rrr......rrr..',
    '...rrr....rrr...',
    '....rrr..rrr....',
    '.....rrrrrr.....',
    '......rrrr......',
    '......rrrr......',
    '.....rrrrrr.....',
    '....rrr..rrr....',
    '...rrr....rrr...',
    '..rrr......rrr..',
    '.rrr........rrr.',
    '.rr..........rr.',
    '................'
  ],
  warning: [
    '.......kk.......',
    '......kyyk......',
    '......kyyk......',
    '.....kyyyyk.....',
    '.....kykkyk.....',
    '....kyykkyyk....',
    '....kyykkyyk....',
    '...kyyykkyyyk...',
    '...kyyykkyyyk...',
    '..kyyyykkyyyyk..',
    '..kyyyyyyyyyyk..',
    '.kyyyyykkyyyyyk.',
    '.kyyyyykkyyyyyk.',
    'kyyyyyyyyyyyyyyk',
    'kkkkkkkkkkkkkkkk',
    '................'
  ],
  lock: [
    '.....kkkkkk.....',
    '....kkeeeekk....',
    '...kke....ekk...',
    '...ke......ek...',
    '...ke......ek...',
    '...ke......ek...',
    '.kkkkkkkkkkkkkk.',
    '.kyyyyyyyyyyyyk.',
    '.kyyyyykkyyyyyk.',
    '.kyyyykkkkyyyyk.',
    '.kyyyykkkkyyyyk.',
    '.kyyyyykkyyyyyk.',
    '.kyyyyykkyyyyyk.',
    '.koyyyyyyyyyyok.',
    '.kkkkkkkkkkkkkk.',
    '................'
  ],
  computer: [
    '................',
    'kkkkkkkkkkkkkkkk',
    'keeeeeeeeeeeeeek',
    'kebbbbbbbbbbbbek',
    'kebttbbbbbbbbbek',
    'kebbbbbbbbbbbbek',
    'kebttttbbbbbbbek',
    'kebbbbbbbbbbbbek',
    'kebttbbbbbbbbbek',
    'kebbbbbbbbbbbbek',
    'keeeeeeeeeeeeeek',
    'kkkkkkkkkkkkkkkk',
    '......keek......',
    '......keek......',
    '...kkkkkkkkkk...',
    '...kkkkkkkkkk...'
  ],
  lightbulb: [
    '.....kkkkkk.....',
    '...kkyyyyyykk...',
    '..kyyywwyyyyyk..',
    '..kyywwyyyyyyk..',
    '.kyywyyyyyyyyyk.',
    '.kyyyyyyyyyyyyk.',
    '.kyyyyyyyyyyyyk.',
    '..kyyyyyyyyyyk..',
    '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...',
    '....kyyyyyyk....',
    '....keeeeeek....',
    '....kkkkkkkk....',
    '....keeeeeek....',
    '.....kkkkkk.....',
    '................'
  ],
  cup: [
    '....w..w..w.....',
    '.....w..w..w....',
    '....w..w..w.....',
    '................',
    '.kkkkkkkkkkkk...',
    '.kwwwwwwwwwwkkk.',
    '.kwnnnnnnnnwk.k.',
    '.kwwwwwwwwwwk.k.',
    '.kwwwwwwwwwwk.k.',
    '.kwwwwwwwwwwkkk.',
    '.kwwwwwwwwwwk...',
    '..kwwwwwwwwk....',
    '...kkkkkkkk.....',
    'kkkkkkkkkkkkkkk.',
    '.keeeeeeeeeeek..',
    '..kkkkkkkkkkk...'
  ],
  car: [
    '................',
    '................',
    '................',
    '.....kkkkkkk....',
    '....krrrrrrrk...',
    '...krtttkttttk..',
    '...krtttkttttk..',
    '.kkkrrrrrrrrrrkk',
    'krrrrrrrrrrrrrrk',
    'kyrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrryk',
    'krrkkkrrrrkkkrrk',
    'kkkkekkkkkkekkkk',
    '...kkk....kkk...',
    '................',
    '................'
  ],
  question: [
    '.....kkkkkk.....',
    '...kkttttttkk...',
    '..kttttttttttk..',
    '.kttttwwwwttttk.',
    '.ktttwwttwwtttk.',
    'kttttttttwwttttk',
    'ktttttttwwtttttk',
    'kttttttwwttttttk',
    'kttttttwwttttttk',
    'kttttttttttttttk',
    'kttttttwwttttttk',
    '.ktttttwwtttttk.',
    '.kttttttttttttk.',
    '..kttttttttttk..',
    '...kkttttttkk...',
    '.....kkkkkk.....'
  ],
  star: [
    '.......kk.......',
    '.......kk.......',
    '......kyyk......',
    '......kyyk......',
    '.....kyyyyk.....',
    'kkkkkkyyyykkkkkk',
    'kyyyyyyyyyyyyyyk',
    '.kyyyyyyyyyyyyk.',
    '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...',
    '...kyyyyyyyyk...',
    '..kyyyyyyyyyyk..',
    '..kyyyykkyyyyk..',
    '.kyyykk..kkyyyk.',
    '.kykk......kkyk.',
    '.kk..........kk.'
  ],
  sun: [
    '.......oo.......',
    '.......oo.......',
    '..oo........oo..',
    '..ooo.kkkk.ooo..',
    '....kkyyyykk....',
    '...kyyyyyyyyk...',
    '...kyywyyyyyk...',
    'oo.kywyyyyyyk.oo',
    'oo.kyyyyyyyyk.oo',
    '...kyyyyyyyok...',
    '...kyyyyyyook...',
    '....kkyyookk....',
    '..ooo.kkkk.ooo..',
    '..oo........oo..',
    '.......oo.......',
    '.......oo.......'
  ],
  cloud: [
    '................',
    '................',
    '......kkkk......',
    '.....kwwwwk.....',
    '....kwwwwwwkkk..',
    '..kkkwwwwwwwwwk.',
    '.kwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwek',
    '.kwwwwwwwwwwweek',
    '..keeeeeeeeeeek.',
    '...kkkkkkkkkkk..',
    '................',
    '................',
    '................'
  ],
  rain: [
    '................',
    '.....kkkk.......',
    '....kwwwwkkk....',
    '..kkkwwwwwwwk...',
    '.kwwwwwwwwwwwk..',
    'kwwwwwwwwwwwwwk.',
    'kwwwwwwwwwwwwek.',
    '.keeeeeeeeeeek..',
    '..kkkkkkkkkkk...',
    '................',
    '..t...t...t.....',
    '..t...t...t.....',
    '....t...t...t...',
    '....t...t...t...',
    '..t...t...t.....',
    '................'
  ],
  water: [
    '.......kk.......',
    '.......kk.......',
    '......kttk......',
    '......kttk......',
    '.....kttttk.....',
    '.....kttttk.....',
    '....kttttttk....',
    '...kttttttttk...',
    '...ktwttttttk...',
    '..kttwttttttbk..',
    '..ktwtttttttbk..',
    '..kttttttttbbk..',
    '..kttttttttbbk..',
    '...kttttttbbk...',
    '....kkttbbkk....',
    '......kkkk......'
  ],
  fire: [
    '.......kk.......',
    '......krrk......',
    '......krrk......',
    '.....krrrrk.....',
    '.....krorrk.....',
    '....krroorrk....',
    '....kroooork....',
    '...krrooyoork...',
    '...kroyyyyork...',
    '..kroyyywyyork..',
    '..kroyywwyyork..',
    '..kroyywwyyork..',
    '..krooyyyyoork..',
    '...kroooooork...',
    '....kkrrrrkk....',
    '......kkkk......'
  ],
  bolt: [
    '.........kkkk...',
    '........kyyyk...',
    '.......kyyyk....',
    '......kyyyk.....',
    '.....kyyyk......',
    '....kyyyykkkk...',
    '...kyyyyyyyyk...',
    '...kkkkkyyyk....',
    '.......kyyyk....',
    '......kyyok.....',
    '.....kyyok......',
    '....kyyok.......',
    '....kyok........',
    '...kyok.........',
    '...kkk..........',
    '................'
  ],
  tree: [
    '......kkkk......',
    '....kkggggkk....',
    '...kggggggggk...',
    '..kgggGggggggk..',
    '..kggggggGgggk..',
    '.kgggggggggggGk.',
    '.kgGgggggggggGk.',
    '.kggggggggggGGk.',
    '..kggggggggGGk..',
    '...kkgggGGGkk...',
    '.....kknnkk.....',
    '......knnk......',
    '......knNk......',
    '......knNk......',
    '.....kknNkk.....',
    '....kkkkkkkk....'
  ],
  world: [
    '.....kkkkkk.....',
    '...kkbbggbbkk...',
    '..kbbgggggbbbk..',
    '.kbbggggggbbbbk.',
    '.kbbbggggbbbgbk.',
    'kbbbbbggbbbggggk',
    'kbbbbbbbbbbgggbk',
    'kbgbbbbbbbbbgbbk',
    'kggggbbbbbbbbbbk',
    'kgggggbbbbbbbbbk',
    'kbggggbbbbbggbbk',
    '.kbgggbbbbgggbk.',
    '.kbbggbbbbggbbk.',
    '..kbbgbbbbbbbk..',
    '...kkbbbbbbkk...',
    '.....kkkkkk.....'
  ],
  book: [
    '................',
    '................',
    '................',
    '.kkkkkk..kkkkkk.',
    'kwwwwwwkkwwwwwwk',
    'kweeeewkkweeeewk',
    'kwwwwwwkkwwwwwwk',
    'kweeeewkkweeeewk',
    'kwwwwwwkkwwwwwwk',
    'kweeeewkkweeeewk',
    'kwwwwwwkkwwwwwwk',
    'kwwwwwwkkwwwwwwk',
    'kbbbbbbkkbbbbbbk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................'
  ],
  pencil: [
    '............kk..',
    '...........krrk.',
    '..........kyrrrk',
    '.........kyyyrk.',
    '........kyyyok..',
    '.......kyyyok...',
    '......kyyyok....',
    '.....kyyyok.....',
    '....kyyyok......',
    '...kyyyok.......',
    '..kcyyok........',
    '..kccok.........',
    '.kkcck..........',
    '.kkkk...........',
    '.kk.............',
    '................'
  ],
  key: [
    '................',
    '................',
    '................',
    '..kkkk..........',
    '.kyyyyk.........',
    'kyyyyyyk........',
    'kyykkyykkkkkkkkk',
    'kyk..kyyyyyyyyyk',
    'kyk..kyyyyyyyyyk',
    'kyykkyyk.kyk.kyk',
    'kyyyyyyk.kyk.kok',
    '.kyyyok..kkk.kkk',
    '..kkkk..........',
    '................',
    '................',
    '................'
  ],
  bin: [
    '................',
    '......kkkk......',
    '..kkkkkeekkkkk..',
    '.keeeeeeeeeeeek.',
    '.kkkkkkkkkkkkkk.',
    '..keeeeeeeeeek..',
    '..kekeekeekeek..',
    '..kekeekeekeek..',
    '..kekeekeekeek..',
    '..kekeekeekeek..',
    '..kekeekeekeek..',
    '..kekeekeekeek..',
    '..kekeekeekeek..',
    '..keeeeeeeeeek..',
    '...kkkkkkkkkk...',
    '................'
  ],
  bell: [
    '.......kk.......',
    '......kyyk......',
    '.....kkyykk.....',
    '....kyyyyyyk....',
    '...kyywyyyyyk...',
    '...kywyyyyyyk...',
    '...kyyyyyyyyk...',
    '...kyyyyyyyok...',
    '...kyyyyyyyok...',
    '..kyyyyyyyyook..',
    '..kyyyyyyyyook..',
    '.kyyyyyyyyyyook.',
    '.kkkkkkkkkkkkkk.',
    '......kyyk......',
    '......kkkk......',
    '................'
  ],
  search: [
    '....kkkkk.......',
    '..kkeeeeekk.....',
    '.keewwwwweek....',
    '.kewwwwwwwek....',
    'kewwtwwwwwwek...',
    'kewtwwwwwwwek...',
    'kewwwwwwwwwek...',
    'kewwwwwwwwwek...',
    'kewwwwwwwwwek...',
    '.kewwwwwwwek....',
    '.keewwwwweekk...',
    '..kkeeeeekknnk..',
    '....kkkkk.knnnk.',
    '...........knnnk',
    '............knnk',
    '.............kk.'
  ],
  speech: [
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    'kwwwwwwwwwwwwwwk',
    'kwweeeeeeeeewwwk',
    'kwwwwwwwwwwwwwwk',
    'kwweeeeeeeewwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwweeeeeewwwwwwk',
    'kwwwwwwwwwwwwwwk',
    '.kwwwwwwwwwwwwk.',
    '..kwwwkkkkkkkk..',
    '..kwwk..........',
    '..kwk...........',
    '..kk............',
    '................'
  ],
  pill: [
    '................',
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..krrrrrkwwwwk..',
    '.krrwrrrkwwwwwk.',
    '.krrrrrrkwwwwwk.',
    '.krrrrrrkwwwwwk.',
    '.kRrrrrrkwwwwek.',
    '..kRRRRRkeeeek..',
    '...kkkkkkkkkk...',
    '................',
    '................',
    '................',
    '................'
  ],
  basket: [
    '................',
    '................',
    '.....eeeeee.....',
    '....ee....ee....',
    '...ee......ee...',
    'kkkkkkkkkkkkkkkk',
    'krrrrrrrrrrrrrrk',
    'kkkkkkkkkkkkkkkk',
    '.krkrrkrrkrrkrk.',
    '.krkrrkrrkrrkrk.',
    '.krkrrkrrkrrkrk.',
    '..kRRRRRRRRRRk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................'
  ],
  bus: [
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    'krrrrrrrrrrrrrrk',
    'krttkttkttkttrrk',
    'krttkttkttkttrrk',
    'krttkttkttkttrrk',
    'krrrrrrrrrrrrrrk',
    'krrrrrrrrrrrryrk',
    'kRRRRRRRRRRRRRRk',
    'kkkkkkkkkkkkkkkk',
    '..kkkk....kkkk..',
    '..kwwk....kwwk..',
    '...kk......kk...',
    '................',
    '................'
  ],
  plane: [
    '.......kk.......',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
    '.....kkwwkk.....',
    '...kkwwwwwwkk...',
    '.kkwwwwwwwwwwkk.',
    'keewwwwwwwwwweek',
    'kkkkkkwwwwkkkkkk',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
    '....kkkwwkkk....',
    '...keewwwweek...',
    '...kkkkkkkkkk...',
    '................'
  ],
  pin: [
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krrrrrrrrrrk..',
    '.krrrrrwwrrrrrk.',
    '.krrrrwwwwrrrrk.',
    '.krrrrwwwwrrrrk.',
    '.krrrrrwwrrrrRk.',
    '.krrrrrrrrrrRRk.',
    '..krrrrrrrrRRk..',
    '..krrrrrrrrRRk..',
    '...krrrrrrRRk...',
    '....krrrrRRk....',
    '.....krrRRk.....',
    '......krRk......',
    '.......kk.......',
    '................'
  ],
  camera: [
    '................',
    '................',
    '.....kkkkk......',
    '.kkkkkeeekkkkkk.',
    'keeeeeeeeeeeeyek',
    'keeeekkkkkkeeeek',
    'keeekbbbbbbkeeek',
    'keekbbttbbbbkeek',
    'keekbtbbbbbbkeek',
    'keekbbbbbbbbkeek',
    'keekbbbbbbbbkeek',
    'keeekbbbbbbkeeek',
    'keeeekkkkkkeeeek',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................'
  ],
  cog: [
    '......kkkk......',
    '..kk..keek..kk..',
    '.keekkkeekkkeek.',
    '.keeeeeeeeeeeek.',
    '..keeeeeeeeeek..',
    '..keeekkkkeeek..',
    'kkkeek....keekkk',
    'keeeek....keeeek',
    'keeeek....keeeek',
    'kkkeek....keekkk',
    '..keeekkkkeeek..',
    '..keeeeeeeeeek..',
    '.keeeeeeeeeeeek.',
    '.keekkkeekkkeek.',
    '..kk..keek..kk..',
    '......kkkk......'
  ],
  chart: [
    'e...............',
    'e...............',
    'e...........kkkk',
    'e...........kggk',
    'e...........kggk',
    'e......kkkk.kggk',
    'e......kyyk.kggk',
    'e......kyyk.kggk',
    'e.kkkk.kyyk.kggk',
    'e.krrk.kyyk.kggk',
    'e.krrk.kyyk.kggk',
    'e.krrk.kyyk.kggk',
    'eeeeeeeeeeeeeeee',
    '................',
    '................',
    '................'
  ],
  bank: [
    '.......kk.......',
    '.....kkwwkk.....',
    '...kkwwwwwwkk...',
    '.kkwwwwwwwwwwkk.',
    'kwwwwwwwwwwwwwwk',
    'kkkkkkkkkkkkkkkk',
    '.kwwk.kwwk.kwwk.',
    '.kwwk.kwwk.kwwk.',
    '.kwwk.kwwk.kwwk.',
    '.kwwk.kwwk.kwwk.',
    '.kwwk.kwwk.kwwk.',
    '.kwek.kwek.kwek.',
    'kkkkkkkkkkkkkkkk',
    'kwwwwwwwwwwwwwek',
    'kkkkkkkkkkkkkkkk',
    '................'
  ],
  gift: [
    '................',
    '...kkk....kkk...',
    '..kyyyk..kyyyk..',
    '..kyykykkykyyk..',
    '...kkyyyyyykk...',
    '.kkkkkkyykkkkkk.',
    'krrrrrkyykrrrrrk',
    'krrrrrkyykrrrrrk',
    'kkkkkkkyykkkkkkk',
    '.krrrrkyykrrrrk.',
    '.krrrrkyykrrrrk.',
    '.krrrrkyykrrrrk.',
    '.krrrrkyykrrrRk.',
    '.kRRRRkyykRRRRk.',
    '.kkkkkkkkkkkkkk.',
    '................'
  ],
  trophy: [
    '................',
    '..kkkkkkkkkkkk..',
    'kkkyyyyyyyyyykkk',
    'kykywyyyyyyoykyk',
    'kykywyyyyyyoykyk',
    'kkkyyyyyyyyoykkk',
    '..kyyyyyyyyoyk..',
    '...kyyyyyyoyk...',
    '....kyyyyoyk....',
    '.....kkyykk.....',
    '......kyyk......',
    '......kyyk......',
    '....kkkyykkk....',
    '...kyyyyyyyyk...',
    '...kkkkkkkkkk...',
    '................'
  ],
  apple: [
    '........kk......',
    '.......knk.kkk..',
    '.......knkkggk..',
    '.......knkggk...',
    '.kkrrrrkkrrrrkk.',
    'krrwrrrrrrrrrrrk',
    'krwrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrRk',
    'krrrrrrrrrrrrrRk',
    'krrrrrrrrrrrrRRk',
    '.krrrrrrrrrrrRk.',
    '.krrrrrrrrrrRRk.',
    '..krrrrrrrrRRk..',
    '...kkrrkkRRkk...',
    '.....kk..kk.....'
  ],
  ball: [
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwwkkwwwwk..',
    '.kwwwwkkkkwwwwk.',
    '.kkwwwkkkkwwwkk.',
    'kkkwwwwkkwwwwkkk',
    'kkwwwwwwwwwwwwkk',
    'kwwwwwwwwwwwwwwk',
    'kwwwkkwwwwkkwwwk',
    'kwwkkkkwwkkkkwwk',
    'kwwkkkkwwkkkkwwk',
    '.kwwkkwwwwkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kwwwwkkwwwwk..',
    '...kkwwkkwwkk...',
    '.....kkkkkk.....'
  ],
  music: [
    '................',
    '.....kkkkkkkkkk.',
    '.....kppppppppk.',
    '.....kppppppppk.',
    '.....kpkkkkkkpk.',
    '.....kpk....kpk.',
    '.....kpk....kpk.',
    '.....kpk....kpk.',
    '.....kpk....kpk.',
    '.....kpk....kpk.',
    '..kkkkpk.kkkkpk.',
    '.kpppppk.kppppk.',
    '.kpppppk.kppppk.',
    '.kppppk..kpppk..',
    '..kkkk....kkk...',
    '................'
  ],
  wifi: [
    '................',
    '....tttttttt....',
    '..tttttttttttt..',
    '.ttt........ttt.',
    '.t............t.',
    '.....tttttt.....',
    '...tttttttttt...',
    '...tt......tt...',
    '................',
    '......tttt......',
    '.....tttttt.....',
    '.....t....t.....',
    '................',
    '.......tt.......',
    '.......tt.......',
    '................'
  ],
  rocket: [
    '.......kk.......',
    '......kwwk......',
    '.....kwwwwk.....',
    '.....kwwwwk.....',
    '....kwwttwwk....',
    '....kwtbbtwk....',
    '....kwtbbtwk....',
    '....kwwttwwk....',
    '....kwwwwwwk....',
    '...kkwwwwwwkk...',
    '..krkwwwwwwkrk..',
    '.krrkwwwwwwkrrk.',
    '.krkkkkkkkkkkrk.',
    '.kk..koyyok..kk.',
    '......kook......',
    '.......kk.......'
  ],
  hourglass: [
    '..kkkkkkkkkkkk..',
    '..knnnnnnnnnnk..',
    '..kkkkkkkkkkkk..',
    '...kwwwwwwwwk...',
    '...kwyyyyyywk...',
    '....kwyyyywk....',
    '.....kwyywk.....',
    '......kyyk......',
    '......kwyk......',
    '.....kwwywk.....',
    '....kwwwywwk....',
    '...kwwyyyywwk...',
    '...kwyyyyyywk...',
    '..kkkkkkkkkkkk..',
    '..knnnnnnnnnnk..',
    '..kkkkkkkkkkkk..'
  ],
  shield: [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kbbbbbbttttttk.',
    '.kbbbbbbttttttk.',
    '.kbbbbbbttttttk.',
    '.kbbbbbbttttttk.',
    '.kbbbbbbttttttk.',
    '.kbbbbbbttttttk.',
    '.kttttttbbbbbbk.',
    '..ktttttbbbbbk..',
    '..ktttttbbbbbk..',
    '...kttttbbbbk...',
    '....ktttbbbk....',
    '.....kttbbk.....',
    '......kkkk......',
    '................'
  ],
  battery: [
    '................',
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkk..',
    'kwwwwwwwwwwwwwk.',
    'kwggwggwggwwwwkk',
    'kwggwggwggwwwwek',
    'kwggwggwggwwwwek',
    'kwggwggwggwwwwkk',
    'kwwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkk..',
    '................',
    '................',
    '................',
    '................'
  ],
  thermometer: [
    '......kkkk......',
    '.....kwwwwk.....',
    '.....kwwwwk.ee..',
    '.....kwwwwk.....',
    '.....kwrrwk.ee..',
    '.....kwrrwk.....',
    '.....kwrrwk.ee..',
    '.....kwrrwk.....',
    '.....kwrrwk.ee..',
    '....kwwrrwwk....',
    '...kwwrrrrwwk...',
    '...kwrrrrrrwk...',
    '...kwrrrrrrwk...',
    '...kwwrrrrwwk...',
    '....kkwwwwkk....',
    '......kkkk......'
  ],
  eye: [
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwbbbbwwwk..',
    '.kwwwbbkkbbwwwk.',
    'kwwwwbkwkkbwwwwk',
    'kwwwwbkkkkbwwwwk',
    '.kwwwbbkkbbwwwk.',
    '..kwwwbbbbwwwk..',
    '...kkwwwwwwkk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................'
  ],
  bed: [
    '................',
    '................',
    '................',
    '................',
    '................',
    'nn..............',
    'nn.kkkk.........',
    'nnkwwwwkkkkkkkk.',
    'nnkwwwwktttttttk',
    'nnkkkkkttttttttk',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nn............nn',
    'nn............nn',
    '................',
    '................'
  ],
  flag: [
    '..kk............',
    '..kekkkkkkkkk...',
    '..kerrrrrrrrrkk.',
    '..kerrrrrrrrrrk.',
    '..kerrrrrrrrrrk.',
    '..kerrrrrrrrrrk.',
    '..kerrrrrrrrrkk.',
    '..kekkkkkkkkk...',
    '..kek...........',
    '..kek...........',
    '..kek...........',
    '..kek...........',
    '..kek...........',
    '..kek...........',
    '.kkekk..........',
    '.kkkkk..........'
  ],
  dog: [
    '................',
    '.kkk........kkk.',
    'kNNNkkkkkkkkNNNk',
    'kNNknnnnnnnnkNNk',
    'kNNknnnnnnnnkNNk',
    'kNNknknnnnknkNNk',
    'kNNknnnnnnnnkNNk',
    '.kkknnsssssnkkk.',
    '...knsskkssnk...',
    '...knsskkssnk...',
    '...knssrrssnk...',
    '....knssssnk....',
    '.....kkkkkk.....',
    '................',
    '................',
    '................'
  ],
  cat: [
    '................',
    '.kk..........kk.',
    '.kok........kok.',
    '.kook......kook.',
    '.koookkkkkkoook.',
    '.kooooooooooook.',
    '.koookooookoook.',
    '.koookooookoook.',
    '.koooossssooook.',
    '.koooosrrsooook.',
    '..kooossssoook..',
    '...kkooooookk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................'
  ],
  card: [
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    'kbbbbbbbbbbbbbbk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    'kbbbbbbbbbbbbbbk',
    'kbyyybbbbbbbbbbk',
    'kbyyybbbbbbbbbbk',
    'kbbbbbbwwbwwbwbk',
    'kbbbbbbbbbbbbbbk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................'
  ],
  bag: [
    '................',
    '................',
    '.....nnnnnn.....',
    '....nn....nn....',
    '.kkkkkkkkkkkkkk.',
    'knnnnnnnnnnnnnnk',
    'knnnnnnnnnnnnnnk',
    'knnnnnnnnnnnnnnk',
    'kkkkkkkyykkkkkkk',
    'kNNNNNkyykNNNNNk',
    'kNNNNNNkkNNNNNNk',
    'kNNNNNNNNNNNNNNk',
    'kNNNNNNNNNNNNNNk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................'
  ],
  train: [
    '....kkkkkkkk....',
    '...krrrrrrrrk...',
    '..krrrrrrrrrrk..',
    '..krttttttttrk..',
    '..krttttttttrk..',
    '..krttttttttrk..',
    '..krrrrrrrrrrk..',
    '..kryrrrrrryrk..',
    '..krrrrrrrrrrk..',
    '..krrrkkkkrrrk..',
    '..kkkkkkkkkkkk..',
    '...kkk....kkk...',
    '..ee........ee..',
    '.ee..........ee.',
    'ee............ee',
    '................'
  ],
  baby: [
    '......kk........',
    '.....knnk.......',
    '....kkkkkkkk....',
    '..kksssssssskk..',
    '.kssssssssssssk.',
    '.kssssssssssssk.',
    '.kssskssssksssk.',
    '.kssssssssssssk.',
    '.krrssssssssrrk.',
    '.kssssrrrrssssk.',
    '..kssssrrssssk..',
    '...kksssssskk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................'
  ],
  egg: [
    '................',
    '................',
    '....kkkkkk......',
    '..kkwwwwwwkkk...',
    '.kwwwwwwwwwwwk..',
    'kwwwwkkkkwwwwwk.',
    'kwwwkyyyykwwwwwk',
    'kwwkyywyyykwwwwk',
    'kwwkyyyyyykwwwwk',
    'kwwkyyyyyokwwwwk',
    '.kwwkyyyokwwwwk.',
    '.kwwwkkkkwwwwwk.',
    '..kwwwwwwwwwkk..',
    '...kkkwwwwkk....',
    '......kkkk......',
    '................'
  ],
  pan: [
    '................',
    '................',
    '................',
    'kkkkkkkkkkkk....',
    'kwweeeeeeeekkkkk',
    'keeeeeeeeeeknnnk',
    'keeeeeeeeeekkkkk',
    'keeeeeeeeeek....',
    'keeeeeeeeeek....',
    'keeeeeeeeeek....',
    'keeeeeeeeeek....',
    'kkeeeeeeeekk....',
    '.kkkkkkkkkk.....',
    '................',
    '................',
    '................'
  ],
  moon: [
    '....kkkkkk......',
    '..kkyyyykk......',
    '.kyyyykk........',
    '.kyyyk..........',
    'kyyyyk..........',
    'kyyyk...........',
    'kyyyk...........',
    'kyyyk...........',
    'kyyyyk..........',
    'kyyyyk........kk',
    '.kyyyykk....kkyk',
    '.kyyyyykkkkkyyyk',
    '..kkyyyyyyyyykk.',
    '....kkyyyykk....',
    '......kkkk......',
    '................'
  ],
  plug: [
    '................',
    '................',
    '................',
    '....kkkkkkk.....',
    '...kwwwwwwwk....',
    '...kwwwwwwwkkkkk',
    '...kwwwwwwwkeeek',
    'nnnkwwwwwwwkkkkk',
    'nnnkwwwwwwwkkkkk',
    '...kwwwwwwwkeeek',
    '...kwwwwwwwkkkkk',
    '...kwwwwwwek....',
    '....kkkkkkk.....',
    '................',
    '................',
    '................'
  ],
  tap: [
    '....kkkkkk......',
    '....keeeek......',
    '....kkeekk......',
    '......kek.......',
    '.kkkkkkekkkkkk..',
    'keeeeeeeeeeeeek.',
    'keeeeeeeeeeeeeek',
    'kkkkkkkkkkkeeeek',
    '..........keeeek',
    '..........kkkkkk',
    '................',
    '............tt..',
    '...........tttt.',
    '...........tttt.',
    '............tt..',
    '................'
  ],
  bowl: [
    '................',
    '....w....w......',
    '.....w....w.....',
    '....w....w......',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwek.',
    '..kwwwwwwwwwek..',
    '...kwwwwwwwek...',
    '....kkwwwwkk....',
    '.....kkkkkk.....',
    '....kkkkkkkk....',
    '................'
  ],
  bottle: [
    '......kkkk......',
    '......kbbk......',
    '......kkkk......',
    '......kttk......',
    '......kttk......',
    '.....kttttk.....',
    '....kttttttk....',
    '....ktwttttk....',
    '....ktwttttk....',
    '....kwwwwwwk....',
    '....kwwwwwwk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kkkkkkkk....',
    '................'
  ],
  bread: [
    '................',
    '...kkkkkkkkkk...',
    '..knnnnnnnnnnk..',
    '.knnccccccccnnk.',
    '.knccccccccccnk.',
    '.knccccccccccnk.',
    '..knccccccccnk..',
    '..knccccccccnk..',
    '..knccccccccnk..',
    '..knccccccccnk..',
    '..knccccccccnk..',
    '..knccccccccnk..',
    '..knccccccccnk..',
    '..knnnnnnnnnnk..',
    '..kkkkkkkkkkkk..',
    '................'
  ],
  shirt: [
    '................',
    '..kkkk....kkkk..',
    '.kttttkkkkttttk.',
    'kttttttttttttttk',
    'kttttttttttttttk',
    'kttkttttttttkttk',
    '.kk.kttttttk.kk.',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kkkkkkkk....',
    '................'
  ],
  tooth: [
    '................',
    '..kkkk....kkkk..',
    '.kwwwwkkkkwwwwk.',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwek',
    '.kwwwwwwwwwwwek.',
    '.kwwwwwwwwwwwek.',
    '..kwwwwkkwwwek..',
    '..kwwwk..kwwek..',
    '..kwwk....kwek..',
    '..kwwk....kwek..',
    '...kk......kk...',
    '................',
    '................'
  ]
};

/** The icons by what they are about, for the guides people and agents choose from. Every icon is in one group. */
const ICON_GROUPS = {
  'Paperwork and money': ['letter', 'document', 'money', 'card', 'bank', 'calendar', 'clock', 'hourglass', 'bag', 'basket', 'gift', 'chart'],
  'People and home': ['person', 'people', 'baby', 'heart', 'house', 'bed', 'key', 'lock', 'bin', 'cup', 'apple', 'egg', 'bread', 'bowl', 'bottle', 'pan', 'tap', 'shirt', 'tooth', 'pill', 'thermometer', 'dog', 'cat'],
  'Out and about': ['car', 'bus', 'train', 'plane', 'pin', 'world', 'flag', 'ball', 'trophy', 'music', 'book', 'pencil'],
  Technology: ['phone', 'computer', 'camera', 'wifi', 'battery', 'plug', 'cog', 'search', 'speech', 'bell', 'eye', 'shield', 'rocket'],
  'Weather and nature': ['sun', 'moon', 'cloud', 'rain', 'water', 'fire', 'bolt', 'tree'],
  Signs: ['tick', 'cross', 'warning', 'question', 'star', 'lightbulb']
};

return { ICON_SIZE, ICONS, ICON_GROUPS };
})();

__m['palette.js'] = (() => {
// The sprite palette: the letters px.sprite() and the ready-made pictures draw with.
// Its own module so the pictures can check sprite letters without importing the kit.

/** Palette letters for px.sprite(). Any other character is used as a CSS colour. */
const PALETTE = {
  k: '#1a1a1a', s: '#f2c194', b: '#1f4e9c', B: '#163a75', y: '#ffcc4d', w: '#fdf6e3', r: '#d63a3a', R: '#a52222',
  n: '#7a4a24', N: '#5a3418', g: '#3fa34d', G: '#2a7a35', e: '#9fb3c8', o: '#ff8c2a', p: '#8e5bd6', t: '#55d6be',
  c: '#ebeac5'
};

return { PALETTE };
})();

__m['pictures.js'] = (() => {
// Ready-made pictures: a scene can say picture: { type: 'list', items: [...] } instead of
// writing draw(t, px). Each one animates in time with the scene. Data only, so a script or
// an AI agent can write a whole reel without a line of drawing code.
const { ICON_SIZE, ICONS } = __m['icons.js'];
const { PALETTE } = __m['palette.js'];

const INK = '#1a1a1a', NIGHT = '#0b1220', NAVY = '#13203a', CREAM = '#ebeac5', LIGHT = '#fdf6e3', GOLD = '#ffcc4d';
const TEAL = '#55d6be', BLUE = '#24476b', GREY = '#9fb3c8', PINK = '#ff7eb6', MUTED = '#6f87a3';

/** Shrinks `size` (in steps of 2) until `str` fits in `maxW`. */
function fit(px, str, size, maxW, min = 10) {
  while (size > min && px.textW(str, size) > maxW) size -= 2;
  return size;
}

/** A panel with its corners knocked off, the way pixel art rounds things. */
function roundBox(px, x, y, w, h, fill, edge = INK) {
  px.rect(edge, x + 1, y, w - 2, h);
  px.rect(edge, x, y + 1, w, h - 2);
  px.rect(fill, x + 1, y + 1, w - 2, h - 2);
}

/** The three coloured dots on a window's title bar. */
function dots(px, x, y) {
  ['#d63a3a', GOLD, '#3fa34d'].forEach((c, i) => px.rect(c, x + i * 6, y, 4, 4));
}

/** A window with a title bar; returns the inside: { x, y, w, h }. */
function frame(px, x, y, w, h, title, body) {
  px.window(x, y, w, h, body);
  px.rect(BLUE, x + 1, y + 1, w - 2, 12);
  dots(px, x + 5, y + 5);
  if (title) px.text(title, x + w / 2, y + 1, 12, CREAM, 'center');
  return { x: x + 1, y: y + 13, w: w - 2, h: h - 14 };
}

/** Wrapped text, centred on cx, typed out line by line from `start`. */
function typedBlock(px, str, cx, y, t, start, size, col, maxW, cps = 28) {
  let budget = Math.floor((t - start) * cps);
  px.wrap(str, maxW, size).forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, budget));
    budget -= line.length;
    if (shown) px.text(shown, Math.round(cx - px.textW(line, size) / 2), y + i * (size + 3), size, col);
  });
}

const memos = new WeakMap();

/** Works something out once per picture (layouts need the font, so they wait for the first frame). */
function memo(p, key, fn) {
  if (!memos.has(p)) memos.set(p, {});
  const m = memos.get(p);
  if (!(key in m)) m[key] = fn();
  return m[key];
}

/** The biggest of `sizes` at which every line fits `maxW` and `rowsFor(size)` rows fit. */
function fitLines(px, lines, sizes, maxW, rowsFor, rowsNeeded) {
  return sizes.find((s) => rowsFor(s) >= rowsNeeded && lines.every((l) => px.textW(l, s) <= maxW)) ?? sizes.at(-1);
}

function title(t, px, p) {
  const { W } = px;
  px.sky(NIGHT, '#2f5d8a');
  px.stars(t);
  px.moon(278, 28);
  px.hills('#1f3b5e', 152, 26, t * 3, 2);
  px.hills('#142a45', 170, 14, t * 8, 5);
  const size = fit(px, p.text, 36, W - 36);
  const y = Math.round(px.tween(t, 0.15, 1, -50, p.sub ? 44 : 64, 'bounce'));
  px.text(p.text, W / 2, y + 2, size, INK, 'center');
  px.text(p.text, W / 2, y, size, GOLD, 'center', '#7a4a24');
  if (p.sub) typedBlock(px, p.sub, W / 2, y + size + 8, t, 1.3, 14, LIGHT, W - 60);
}

const TICK = ['.........g', '........gg', 'g......gg.', 'gg....gg..', '.gg..gg...', '..gggg....', '...gg.....'];

/** A navy backdrop with a faint grid of dots, for pictures that set things out on it. */
function dotted(px) {
  const { W, H } = px;
  px.rect(NAVY, 0, 0, W, H);
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) px.rect('#1a2b47', x, y, 1, 1);
}

function list(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 36 : 10, room = H - top - 8;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const n = p.items.length, rowH = Math.min(30, Math.floor(room / n));
  const size = Math.max(10, Math.min(20, rowH - 8) & ~1);
  const first = top + Math.floor((room - rowH * n) / 2);   // the list sits in the middle of the space left
  const every = p.every ?? 1.4, start = p.start ?? 0.6;
  const latest = Math.floor((t - start) / every);
  p.items.forEach((item, i) => {
    const at = start + i * every;
    if (t < at) return;
    const x = 26 + Math.round(px.tween(t, at, 0.35, -70, 0, 'out'));
    const y = first + i * rowH + Math.floor((rowH - 13) / 2);
    if (p.numbered) {
      px.circle(GOLD, x + 6, y + 6, 7);
      px.text(String(i + 1), x + 6, y, 12, INK, 'center');
    } else {
      px.window(x, y, 13, 13, LIGHT);
      if (t >= at + 0.3) px.sprite(TICK, x + 2, y + 3);
    }
    const s = fit(px, item, size, W - x - 30);
    px.text(item, x + 20, y + 7 - Math.round(s * 0.55), s, i === latest && t < at + every + 1 ? GOLD : CREAM, 'left', INK);
  });
}

const CMD_CPS = 16;

/** When each terminal line starts and finishes: commands (lines starting "$ ") type, output appears. */
function terminalPlan(lines) {
  let at = 0.6;
  return lines.map((line) => {
    const cmd = line.startsWith('$ ');
    const text = cmd ? line.slice(2) : line;
    const start = at, end = cmd ? start + text.length / CMD_CPS : start;
    at = cmd ? end + 0.45 : start + 0.18;
    return { text, cmd, start, end };
  });
}

function terminal(t, px, p) {
  const { W, H } = px;
  px.rect(NIGHT, 0, 0, W, H);
  const box = frame(px, 14, 10, W - 28, H - 20, p.title ?? 'terminal', '#0d1117');
  const plan = terminalPlan(p.lines);
  const size = memo(p, 'size', () => fitLines(px, p.lines.map((l) => '  ' + l), [16, 14, 12], box.w - 16, (s) => Math.floor((box.h - 8) / (s + 1)), p.lines.length + 1));
  const rowH = size + 1, rows = Math.floor((box.h - 8) / rowH), indent = Math.round(size * 0.75), caret = Math.round(size * 0.75);
  const done = plan.length && t >= plan.at(-1).end + 0.4;
  const shown = plan.filter((l) => t >= l.start);
  const visible = shown.slice(-(done ? rows - 1 : rows));
  visible.forEach((l, i) => {
    const y = box.y + 5 + i * rowH;
    if (!l.cmd) { px.text(l.text, box.x + 6, y, size, GREY); return; }
    px.text('$', box.x + 6, y, size, TEAL);
    const typing = t < l.end;
    const text = typing ? px.typed(l.text, t, l.start, CMD_CPS) : l.text;
    px.text(text, box.x + 6 + indent, y, size, LIGHT);
    if (typing) px.rect(LIGHT, box.x + 7 + indent + px.textW(text, size), y + 2, Math.round(size / 3), caret);
  });
  if (done) {
    const y = box.y + 5 + visible.length * rowH;
    px.text('$', box.x + 6, y, size, TEAL);
    if (px.blink(t, 1)) px.rect(LIGHT, box.x + 7 + indent, y + 2, Math.round(size / 3), caret);
  }
}

const KEYWORDS = new Set(['export', 'default', 'import', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else',
  'for', 'while', 'new', 'true', 'false', 'null', 'undefined', 'async', 'await', 'class', 'this', 'of', 'in']);

/** Splits a line of code into [text, colour] pieces, for simple highlighting. */
function highlight(line) {
  const out = [];
  const re = /(\/\/.*$|#.*$)|('(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([\s\S])/g;
  let m;
  while ((m = re.exec(line))) {
    let c = CREAM;
    if (m[1]) c = MUTED;
    else if (m[2]) c = GOLD;
    else if (m[3]) c = TEAL;
    else if (m[4]) c = KEYWORDS.has(m[4]) ? PINK : /^\s*:/.test(line.slice(re.lastIndex)) ? '#8fd3ff' : CREAM;
    else if (m[6]) c = GREY;
    out.push([m[0], c]);
  }
  return out;
}

const CODE_CPS = 40;

function code(t, px, p) {
  const { W, H } = px;
  px.rect(NIGHT, 0, 0, W, H);
  const box = frame(px, 14, 10, W - 28, H - 20, p.title ?? 'reel.js', '#101a2c');
  const gutter = 22;
  const size = memo(p, 'size', () => fitLines(px, p.lines, [14, 12, 10], box.w - gutter - 12, (s) => Math.floor((box.h - 6) / s), p.lines.length));
  const rowH = size, rows = Math.floor((box.h - 6) / rowH);
  px.rect('#0c1424', box.x, box.y, gutter, box.h);
  let budget = Math.floor((t - 0.5) * CODE_CPS), started = 0;
  const shown = p.lines.map((line) => {
    if (budget >= 0) started++;
    const part = line.slice(0, Math.max(0, budget));
    budget -= line.length + 4;   // a beat at the end of each line
    return part;
  });
  const first = Math.max(0, started - rows);
  for (let i = first; i < Math.min(started, first + rows); i++) {
    const y = box.y + 4 + (i - first) * rowH;
    px.text(String(i + 1), box.x + gutter - 4, y, Math.min(size, 12), MUTED, 'right');
    let x = box.x + gutter + 6;
    for (const [piece, c] of highlight(shown[i])) { px.text(piece, x, y, size, c); x += px.textW(piece, size); }
    if (shown[i].length < p.lines[i].length && i === started - 1) px.rect(LIGHT, x + 1, y + 2, Math.round(size / 3), Math.round(size * 0.75));
  }
}

/** Lays out a chat once: each message's side, lines and bubble size. */
function chatLayout(px, p) {
  const first = p.messages[0].from;
  let y = 0, last = null;
  return p.messages.map((m) => {
    const lines = px.wrap(m.text, 112, 12);
    const w = Math.max(...lines.map((l) => px.textW(l, 12))) + 10, h = lines.length * 12 + 5;
    const named = m.from !== last;
    if (named) y += last === null ? 0 : 4;
    const top = y + (named ? 11 : 0);
    y = top + h + 4;
    last = m.from;
    return { ...m, lines, w, h, named, top, bottom: y, mine: m.from !== first };
  });
}

const layouts = new WeakMap();

function chat(t, px, p) {
  const { H } = px;
  px.sky(NAVY, BLUE);
  const x = 66, y = 6, w = 188, h = H - 12;
  roundBox(px, x, y, w, h, '#f4f1de');
  px.rect(TEAL, x + 1, y + 1, w - 2, 15);
  px.rect(INK, x + 1, y + 16, w - 2, 1);
  px.text(p.title ?? p.messages[0].from, x + w / 2, y + 2, 14, INK, 'center');
  if (!layouts.has(p)) layouts.set(p, chatLayout(px, p));
  const msgs = layouts.get(p), every = p.every ?? 1.8, start = p.start ?? 0.8;
  const view = { x: x + 2, y: y + 19, w: w - 4, h: h - 22 };
  const shownCount = msgs.filter((_, i) => t >= start + i * every).length;
  const next = msgs[shownCount];
  const typing = next && t >= start + shownCount * every - 0.8;
  const bottom = (shownCount ? msgs[shownCount - 1].bottom : 0) + (typing ? 20 : 0);
  const scroll = Math.max(0, bottom - view.h + 4);
  px.clip([[view.x, view.y, view.w, view.h]], () => {
    msgs.slice(0, shownCount).forEach((m) => {
      const top = view.y + 2 + m.top - scroll;
      const bx = m.mine ? view.x + view.w - m.w - 6 : view.x + 6;
      if (m.named) px.text(m.from, m.mine ? bx + m.w : bx, top - 11, 10, MUTED, m.mine ? 'right' : 'left');
      roundBox(px, bx, top, m.w, m.h, m.mine ? TEAL : '#ffffff');
      m.lines.forEach((l, i) => px.text(l, bx + 5, top + 2 + i * 12, 12, INK));
    });
    if (typing) {
      const top = view.y + 2 + (shownCount ? msgs[shownCount - 1].bottom : 0) + 4 - scroll;
      const bx = next.mine ? view.x + view.w - 32 : view.x + 6;
      roundBox(px, bx, top, 26, 12, next.mine ? TEAL : '#ffffff');
      for (let k = 0; k < 3; k++) px.rect(MUTED, bx + 6 + k * 6, top + 5 - (Math.floor(t * 6) % 3 === k ? 1 : 0), 3, 3);
    }
  });
}

function big(t, px, p) {
  const { W, H } = px;
  px.rect('#1d1236', 0, 0, W, H);
  // squares rushing out from the middle
  for (let k = 0; k < 10; k++) {
    const r = ((k * 22 + t * 26) % 220) + 4, c = k % 2 ? '#2c1b52' : '#3a2470';
    px.rect(c, W / 2 - r, H / 2 - r, 2 * r, 6); px.rect(c, W / 2 - r, H / 2 + r - 6, 2 * r, 6);
    px.rect(c, W / 2 - r, H / 2 - r, 6, 2 * r); px.rect(c, W / 2 + r - 6, H / 2 - r, 6, 2 * r);
  }
  const size = fit(px, p.text, 48, W - 30);
  const cy = p.sub ? 58 : 72;
  const k = px.tween(t, 0.1, 0.6, 0, 1, 'back');
  if (k > 0.05) {
    px.zoom(k, W / 2, cy + size / 2, () => {
      px.text(p.text, W / 2, cy + 3, size, INK, 'center');
      px.text(p.text, W / 2, cy, size, GOLD, 'center', '#a52222');
    });
  }
  if (p.sub) typedBlock(px, p.sub, W / 2, cy + size + 10, t, 0.9, 16, LIGHT, W - 50);
}

function image(t, px, p) {
  const { W, H } = px;
  px.rect(NIGHT, 0, 0, W, H);
  const k = 1 + Math.min(t, 30) * 0.004;   // a slow push in
  px.zoom(k, W / 2, H / 2, () => px.image(p.name, 16, 12, W - 32, H - 24));
}

/** A chunky arrow pointing right, `len` pixels long, centred on `y`, with an ink shadow. */
function arrow(px, x, y, len, c = GOLD) {
  const head = Math.min(6, len);
  for (const [dx, col] of [[1, INK], [0, c]]) {
    if (len > head) px.rect(col, x + dx, y - 2 + dx, len - head, 4);
    for (let i = 0; i < head; i++) px.rect(col, x + len - head + i + dx, y - (head - i) + dx, 1, 2 * (head - i));
  }
}

/** Icons in a row, arriving one by one with their labels; `arrows` joins each to the next. */
function iconRow(t, px, p, arrows) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 34 : 8;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const n = p.items.length, slot = W / n;
  const sc = n <= 2 ? 5 : n === 3 ? 4 : 3, size = ICON_SIZE * sc;
  const labelled = p.items.some((it) => it.label);
  const labelSize = memo(p, 'labelSize', () => Math.min(16, ...p.items.map((it) => (it.label ? fit(px, it.label, 16, slot - 10) : 16))));
  const y0 = top + Math.round((H - top - 6 - size - (labelled ? 8 + labelSize : 0)) / 2);
  const every = p.every ?? 1.4, start = p.start ?? 0.6;
  const latest = Math.floor((t - start) / every);
  p.items.forEach((item, i) => {
    const at = start + i * every, cx = Math.round(slot * (i + 0.5));
    if (arrows && i > 0 && t >= at - 0.4) {
      const from = Math.round(cx - slot + size / 2 + 5), to = Math.round(cx - size / 2 - 5);
      const len = Math.round((to - from) * px.clamp((t - at + 0.4) / 0.3, 0, 1));
      if (len > 0) arrow(px, from, y0 + size / 2, len);
    }
    if (t < at) return;
    const drop = Math.round(px.tween(t, at, 0.6, -size - y0, 0, 'bounce'));
    px.sprite(ICONS[item.icon], cx - size / 2, y0 + drop + (t > at + 0.6 ? px.bob(t + i, 2, 1) : 0), sc);
    if (item.label) px.text(item.label, cx, y0 + size + 8, labelSize, i === latest && t < at + every + 1 ? GOLD : CREAM, 'center', INK);
  });
}

function icons(t, px, p) { iconRow(t, px, p, false); }
function flow(t, px, p) { iconRow(t, px, p, true); }

/** Two cards side by side: the one to avoid, with a cross, then the one to choose, with a tick. */
function compare(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 34 : 12;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const w = 128, h = H - top - 10, every = p.every ?? 2, start = p.start ?? 0.6;
  const labelSize = memo(p, 'labelSize', () => Math.min(fit(px, p.bad.label, 16, w - 12), fit(px, p.good.label, 16, w - 12)));
  [[p.bad, 'cross', '#d63a3a', 0], [p.good, 'tick', '#3fa34d', 1]].forEach(([side, mark, colour, i]) => {
    const at = start + i * every;
    if (t < at) return;
    const x = i ? W - 22 - w : 22, y = top + Math.round(px.tween(t, at, 0.5, H, 0, 'back'));
    px.rect('#0b1220', x + 3, y + 3, w, h);
    px.window(x, y, w, h, LIGHT);
    px.rect(colour, x + 1, y + 1, w - 2, 20);
    px.rect(INK, x + 1, y + 21, w - 2, 1);
    px.window(x + w / 2 - 10, y + 2, 20, 18, LIGHT);
    px.sprite(ICONS[mark], x + w / 2 - 8, y + 3, 1);
    const sc = 4, size = ICON_SIZE * sc, room = h - 22 - (side.label ? labelSize + 10 : 0);
    const iy = y + 22 + Math.max(2, Math.round((room - size) / 2));
    px.sprite(ICONS[side.icon], x + w / 2 - size / 2, iy + (t > at + 0.5 ? px.bob(t + i * 2, 2, 1) : 0), sc);
    if (side.label) px.text(side.label, x + w / 2, y + h - labelSize - 8, labelSize, INK, 'center');
  });
}

/** The most rows and columns a table picture can have, the fewest columns, and the most letters in a cell and across a row. */
const TABLE_MAX = { rows: 5, cols: 4, minCols: 2, cell: 24, across: 56 };

/**
 * A small table on a paper card: a row of headings if it has one, then rows that arrive
 * one by one, the newest lit. The first column is read from the left, as names are; the
 * rest sit in the middle of their columns, as times and amounts do.
 */
function table(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 34 : 10, room = H - top - 10, widest = W - 24;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const lines = [...(p.columns ? [p.columns] : []), ...p.rows], cols = p.rows[0].length, head = p.columns ? 1 : 0;
  const lay = memo(p, 'table', () => {
    const rowH = Math.min(26, Math.floor(room / lines.length));
    const widths = (size) => Array.from({ length: cols }, (_, c) => Math.max(...lines.map((line) => px.textW(line[c], size))) + 14);
    const total = (size) => widths(size).reduce((a, b) => a + b, 0);
    const size = [16, 14, 12, 10].find((sz) => sz + 6 <= rowH && total(sz) <= widest) ?? 10;
    const natural = widths(size), sum = total(size);
    // a table of little words is opened out, so it does not look lost; one too wide for the picture is squeezed to fit
    const want = sum > widest ? widest : Math.max(sum, Math.min(widest, 232));
    const colW = natural.map((w) => Math.floor(w * want / sum));
    return { rowH, size, colW, width: colW.reduce((a, b) => a + b, 0) };
  });
  const { rowH, size, colW, width } = lay, height = rowH * lines.length;
  const x0 = Math.round((W - width) / 2), y0 = top + Math.floor((room - height) / 2);
  const every = p.every ?? 1.4, start = p.start ?? 0.6, latest = Math.floor((t - start) / every);
  px.rect(NIGHT, x0 + 2, y0 + 2, width + 2, height + 2);
  px.window(x0 - 1, y0 - 1, width + 2, height + 2, LIGHT);
  lines.forEach((line, r) => {
    const y = y0 + r * rowH, i = r - head, at = start + i * every;
    const heading = r < head, here = heading || t >= at, lit = !heading && i === latest && t < at + every + 1;
    px.rect(heading ? BLUE : lit ? GOLD : i % 2 ? '#f1e7cb' : LIGHT, x0, y, width, rowH);
    if (r) px.rect(heading || r === head ? INK : '#cfc3a0', x0, y, width, 1);
    if (!here) return;
    const slide = heading ? 0 : Math.round(px.tween(t, at, 0.3, -8, 0, 'out'));
    let x = x0;
    line.forEach((cell, c) => {
      const s = fit(px, cell, size, colW[c] - 8, 8), ty = y + Math.round((rowH - s) / 2) - 1;
      if (c) px.text(cell, x + Math.round(colW[c] / 2) + slide, ty, s, heading ? CREAM : INK, 'center');
      else px.text(cell, x + 7 + slide, ty, s, heading ? CREAM : INK, 'left');
      x += colW[c];
    });
  });
  let x = x0;
  for (let c = 0; c < cols - 1; c++) { x += colW[c]; px.rect('#cfc3a0', x, y0 + head * rowH + 1, 1, height - head * rowH - 1); }
}

/** What is wrong with a table's rows and columns, beyond their being lists of text. */
function tableShape(p) {
  const cols = p.rows[0].length;
  if (p.rows.some((row) => row.length !== cols)) return ['picture.rows must all have the same number of cells'];
  if (p.columns && p.columns.length !== cols) return [`picture.columns has ${p.columns.length} headings for rows of ${cols} cells: give one for each column`];
  const lines = [...(p.columns ? [p.columns] : []), ...p.rows];
  const across = Array.from({ length: cols }, (_, c) => Math.max(...lines.map((line) => [...line[c]].length))).reduce((a, b) => a + b, 0);
  if (across > TABLE_MAX.across) return [`picture: this table is too wide to read: the longest cell of each column comes to ${across} letters, and ${TABLE_MAX.across} fit. Shorten the cells, or use fewer columns`];
  return [];
}

/** Pixel art of the reel's own, from rows of palette letters, scaled to fill the picture. */
function sprite(t, px, p) {
  const { W, H } = px;
  px.sky(NAVY, BLUE);
  px.stars(t);
  const cols = Math.max(...p.rows.map((r) => r.length)), rows = p.rows.length;
  const room = H - (p.label ? 44 : 20);
  const sc = Math.max(1, Math.min(12, Math.floor((W - 32) / cols), Math.floor(room / rows)));
  const x = Math.round((W - cols * sc) / 2), y = Math.round(10 + (room - rows * sc) / 2);
  const drop = Math.round(px.tween(t, 0.2, 0.7, -y - rows * sc, 0, 'bounce'));
  px.sprite(p.rows, x, y + drop + (t > 0.9 ? px.bob(t, 2, 2) : 0), sc, false, p.colours ?? null);
  if (p.label && t >= 0.9) px.sign(p.label, W / 2, H - 30, fit(px, p.label, 16, W - 40), GOLD);
}

/**
 * Every ready-made picture: its fields (a trailing ? marks optional ones), how it draws, and
 * any check beyond its fields. Kinds: text, list (of text), messages ([{ from, text }]), number,
 * flag (true or false), image (a name from images), items (1 to 4 { icon, label? }), item
 * ({ icon, label }), rows (sprite rows of palette letters) and colours ({ letter: '#rrggbb' }).
 */
const PICTURES = {
  title: { fields: { text: 'text', sub: 'text?' }, draw: title },
  list: { fields: { items: 'list', heading: 'text?', numbered: 'flag?', every: 'number?', start: 'number?' }, draw: list },
  terminal: { fields: { lines: 'list', title: 'text?' }, draw: terminal },
  code: { fields: { lines: 'list', title: 'text?' }, draw: code },
  chat: { fields: { messages: 'messages', title: 'text?', every: 'number?', start: 'number?' }, draw: chat },
  big: { fields: { text: 'text', sub: 'text?' }, draw: big },
  image: { fields: { name: 'image' }, draw: image },
  icons: { fields: { items: 'items', heading: 'text?', every: 'number?', start: 'number?' }, draw: icons },
  flow: { fields: { items: 'items', heading: 'text?', every: 'number?', start: 'number?' }, draw: flow },
  compare: { fields: { bad: 'item', good: 'item', heading: 'text?', every: 'number?', start: 'number?' }, draw: compare },
  table: { fields: { rows: 'cells', columns: 'heads?', heading: 'text?', every: 'number?', start: 'number?' }, draw: table, check: tableShape },
  sprite: { fields: { rows: 'rows', colours: 'colours?', label: 'text?' }, draw: sprite, check: spriteLetters }
};

/** The names a picture can use for an icon. */
const ICON_NAMES = Object.keys(ICONS);

/** The most rows, and letters in a row, a sprite picture can have. */
const SPRITE_MAX = { rows: 40, cols: 64 };

/** Any letter in a sprite's rows that is neither see-through, a palette letter, nor one of its colours. */
function spriteLetters(p) {
  const own = p.colours && typeof p.colours === 'object' ? Object.keys(p.colours) : [];
  for (const [i, row] of (Array.isArray(p.rows) ? p.rows : []).entries()) {
    const odd = typeof row === 'string' && [...row].find((ch) => ch !== '.' && ch !== ' ' && !(ch in PALETTE) && !own.includes(ch));
    if (odd) return [`picture.rows[${i}] uses "${odd}", which is not a palette letter: add it to colours, such as { "${odd}": "#336699" }`];
  }
  return [];
}

const isIconItem = (v, labelled) => v !== null && typeof v === 'object' && !Array.isArray(v) && ICON_NAMES.includes(v.icon) &&
  (labelled ? isText(v.label) : v.label === undefined || isText(v.label)) && Object.keys(v).every((k) => k === 'icon' || k === 'label');
const iconHelp = `icons: ${Object.keys(ICONS).join(', ')}`;

const isText = (v) => typeof v === 'string' && v.trim() !== '';
/** One row of a table: a few short cells of text. */
const isCells = (v) => Array.isArray(v) && v.length >= TABLE_MAX.minCols && v.length <= TABLE_MAX.cols && v.every((cell) => isText(cell) && [...cell].length <= TABLE_MAX.cell);
const KINDS = {
  text: [isText, 'must be text'],
  list: [(v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string'), 'must be a list of text, for example ["One", "Two"]'],
  messages: [(v) => Array.isArray(v) && v.length > 0 && v.every((m) => m && isText(m.from) && isText(m.text)), 'must be a list of { from: "Name", text: "Hello" }'],
  number: [(v) => typeof v === 'number' && Number.isFinite(v) && v >= 0, 'must be a number of seconds'],
  flag: [(v) => typeof v === 'boolean', 'must be true or false'],
  items: [(v) => Array.isArray(v) && v.length >= 1 && v.length <= 4 && v.every((it) => isIconItem(it, false)),
    `must be a list of 1 to 4 { icon, label }, such as [{ "icon": "house", "label": "Home" }], with ${iconHelp}`],
  item: [(v) => isIconItem(v, true), `must be { icon, label }, such as { "icon": "phone", "label": "Ring us" }, with ${iconHelp}`],
  rows: [(v) => Array.isArray(v) && v.length >= 1 && v.length <= SPRITE_MAX.rows && v.every((r) => typeof r === 'string' && r.length <= SPRITE_MAX.cols) && v.some((r) => r.length),
    `must be a list of rows of palette letters, such as ["..yy..", ".yyyy."], up to ${SPRITE_MAX.rows} rows of up to ${SPRITE_MAX.cols} letters`],
  cells: [(v) => Array.isArray(v) && v.length >= 1 && v.length <= TABLE_MAX.rows && v.every((row) => isCells(row)),
    `must be 1 to ${TABLE_MAX.rows} rows, each a list of ${TABLE_MAX.minCols} to ${TABLE_MAX.cols} short cells of text, such as [["High Street", "9:05"], ["Station", "9:20"]]`],
  heads: [(v) => isCells(v), `must be a list of ${TABLE_MAX.minCols} to ${TABLE_MAX.cols} short headings, one for each column, such as ["Stop", "Time"]`],
  colours: [(v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.entries(v).every(([k, c]) => [...k].length === 1 && k !== '.' && k !== ' ' && typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)),
    'must be letters and the colours they stand for, such as { "h": "#6b3e2e" }']
};

/** Everything wrong with a scene's `picture`, as a list of messages (empty when it is fine). */
function pictureProblems(picture, imageNames = []) {
  const types = Object.keys(PICTURES);
  if (!picture || typeof picture !== 'object' || Array.isArray(picture)) return [`picture must be an object such as { type: 'title', text: 'Hello' }`];
  const spec = PICTURES[picture.type];
  if (!spec) return [`picture.type must be one of: ${types.join(', ')}`];
  const problems = [];
  const fields = Object.keys(spec.fields);
  for (const key of Object.keys(picture)) {
    if (key !== 'type' && !fields.includes(key)) problems.push(`picture: a ${picture.type} picture takes ${fields.join(', ')}, not ${key}`);
  }
  for (const [key, want] of Object.entries(spec.fields)) {
    const optional = want.endsWith('?'), kind = want.replace('?', ''), value = picture[key];
    if (value === undefined) { if (!optional) problems.push(`picture.${key} is needed for a ${picture.type} picture`); continue; }
    if (kind === 'image') {
      if (!imageNames.includes(value)) problems.push(`picture.${key} must name one of the reel's images${imageNames.length ? ` (${imageNames.join(', ')})` : ', and this reel has none'}`);
      continue;
    }
    const [ok, says] = KINDS[kind];
    if (!ok(value)) problems.push(`picture.${key} ${says}`);
  }
  if (spec.check && !problems.length) problems.push(...spec.check(picture));
  return problems;
}

/** Draws ready-made picture `spec` at time `t` with pixel kit `px`. */
function drawPicture(spec, t, px) {
  const kind = PICTURES[spec?.type];
  if (!kind) throw new Error(`there is no ready-made picture called "${spec?.type}"`);
  kind.draw(t, px, spec);
}

const BARS = [CREAM, GOLD, TEAL, '#3fa34d', '#8e5bd6', '#d63a3a', BLUE];

/** The player's test card, shown when a reel will not load: colour bars, a rolling band of static and NO SIGNAL. */
function noSignal(t, px) {
  const { W, H } = px, bw = W / BARS.length, frame = Math.floor(t * 12);
  BARS.forEach((c, i) => {
    const x = Math.round(i * bw), w = Math.round((i + 1) * bw) - x;
    px.rect(c, x, 0, w, 122);
    px.rect(i % 2 ? NIGHT : BARS[BARS.length - 1 - i], x, 122, w, 14);
  });
  px.rect(NIGHT, 0, 136, W, H - 136);
  for (let i = 0; i < 4; i++) px.rect(['#05080f', NAVY, '#1a2b47', MUTED][i], 24 + i * 22, 146, 22, 24);
  const band = Math.round((t * 40) % (H + 16)) - 16;
  px.dither(LIGHT, 0, band, W, 16, 0.25);
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(px.rand(frame * 997 + i) * W), y = Math.floor(px.rand(frame * 991 + i + 0.5) * H);
    px.rect(i % 3 ? LIGHT : INK, x, y, 1 + (i % 2), 1);
  }
  px.sign('NO SIGNAL', W / 2, 44, 24, NIGHT, GOLD);
  px.sign('Have you tried turning it off and on again?', W / 2, 82, 12, NIGHT, CREAM);
}

return { highlight, TABLE_MAX, PICTURES, ICON_NAMES, SPRITE_MAX, pictureProblems, drawPicture, noSignal };
})();

__m['transitions.js'] = (() => {
// Transitions: how one picture gives way to the next. Pure geometry on the grid of
// logical pixels, so the tests can check any frame without a canvas. px.transition() in
// kit.js does the drawing, both for the player between scenes and for a scene that wants
// one inside its own picture.

/** Every transition, by name. 'cut', the default, switches at once. */
const TRANSITIONS = ['cut', 'fade', 'dissolve', 'wipe', 'slide', 'blinds', 'iris', 'flash', 'star'];

const LENGTH_MS = { cut: 0, fade: 900, dissolve: 800, wipe: 700, slide: 700, blinds: 700, iris: 1100, flash: 500, star: 1000 };

/** How long a transition takes, in ms. */
function transitionMs(kind) {
  return LENGTH_MS[kind] ?? 0;
}

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const easeIn = (k) => k * k * k;
const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
// a fixed scatter in [0, 1) for each block, the same on every frame
const scatter = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * Frame `p` (0 to 1) of a transition inside `box` ({ x, y, w, h }). Returns:
 *   newAt  [dx, dy]  where to draw the incoming picture (clipped to the box)
 *   oldAt  [dx, dy]  where to draw the outgoing picture
 *   old    [[x, y, w, h], ...]  where the outgoing picture shows, over the incoming one
 *   cover  null, { colour, rects } painted solid, or { colour, level }: an ordered dither
 *          over the whole box, from 0 (none) to 1 (solid)
 */
function transitionFrame(kind, p, box) {
  p = clamp01(p);
  const { x, y, w, h } = box;
  const frame = { newAt: [0, 0], oldAt: [0, 0], old: [], cover: null };
  const whole = [[x, y, w, h]];
  switch (kind) {
    case 'fade':     // dithers down to black, then back up into the new picture
    case 'flash': {  // the same, through a white flash
      if (p < 0.5) frame.old = whole;
      frame.cover = { colour: kind === 'fade' ? '#000000' : '#fdf6e3', level: p < 0.5 ? p * 2 : (1 - p) * 2 };
      break;
    }
    case 'dissolve': {   // the old picture crumbles away in blocks
      const s = Math.max(4, Math.round(w / 40));
      for (let j = 0; j * s < h; j++) {
        for (let i = 0; i * s < w; i++) {
          if (scatter(i, j) >= p) frame.old.push([x + i * s, y + j * s, Math.min(s, w - i * s), Math.min(s, h - j * s)]);
        }
      }
      break;
    }
    case 'wipe': {   // left to right, behind a zigzag edge
      const band = Math.max(3, Math.round(h / 30));
      const edge = x - 2 * band + easeInOut(p) * (w + 2 * band);
      for (let j = 0; j * band < h; j++) {
        const tooth = j % 4 < 2 ? j % 4 : 4 - (j % 4);   // 0, 1, 2, 1, 0, ...
        const from = Math.max(x, Math.round(edge + tooth * band));
        if (from < x + w) frame.old.push([from, y + j * band, x + w - from, Math.min(band, h - j * band)]);
      }
      break;
    }
    case 'slide': {   // the new picture pushes the old one off to the left
      const shift = Math.round(easeInOut(p) * w);
      frame.newAt = [w - shift, 0];
      frame.oldAt = [-shift, 0];
      if (shift < w) frame.old = [[x, y, w - shift, h]];
      break;
    }
    case 'blinds': {   // slats close over the old picture
      const s = Math.max(4, Math.round(h / 12));
      const left = Math.round(s * (1 - easeInOut(p)));
      if (left > 0) for (let j = 0; j * s < h; j++) frame.old.push([x, y + j * s, w, Math.min(left, h - j * s)]);
      break;
    }
    case 'iris': {   // a closing circle, like the end of an old cartoon, then opening on the new picture
      const R = Math.hypot(w, h) / 2 + 1;
      let r = 0;
      if (p < 0.45) { frame.old = whole; r = R * (1 - easeIn(p / 0.45)); }
      else if (p > 0.55) r = R * easeOut((p - 0.55) / 0.45);
      frame.cover = { colour: '#000000', rects: outside(box, (row) => circleSpan(x + w / 2, y + h / 2, r, row)) };
      break;
    }
    case 'star': {   // the new picture bursts out of a spinning star. You know what you did.
      const outer = (Math.hypot(w, h) / 2) * 2.5 * easeIn(p), turn = p * 2.4;
      const points = [];
      for (let k = 0; k < 10; k++) {
        const a = turn - Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? outer * 0.45 : outer;
        points.push([x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r]);
      }
      frame.old = outside(box, (row) => polygonSpans(points, row));
      break;
    }
    default:   // 'cut'
      break;
  }
  return frame;
}

/** Where the horizontal line through the middle of pixel row `row` crosses a circle: [[from, to]] or []. */
function circleSpan(cx, cy, r, row) {
  const dy = row + 0.5 - cy;
  if (Math.abs(dy) >= r) return [];
  const half = Math.sqrt(r * r - dy * dy);
  return [[cx - half, cx + half]];
}

/** The parts of pixel row `row` inside a polygon, as [[from, to], ...] (even-odd rule). */
function polygonSpans(points, row) {
  const yy = row + 0.5, xs = [];
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    if ((y1 <= yy) !== (y2 <= yy)) xs.push(x1 + ((yy - y1) / (y2 - y1)) * (x2 - x1));
  }
  xs.sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i], xs[i + 1]]);
  return spans;
}

/** One-pixel-high rects covering each row of `box` outside the spans `inside(row)` returns. */
function outside(box, inside) {
  const rects = [];
  const right = box.x + box.w;
  for (let row = box.y; row < box.y + box.h; row++) {
    let at = box.x;
    for (const [from, to] of inside(row)) {
      const a = Math.max(box.x, Math.min(right, Math.round(from))), b = Math.max(box.x, Math.min(right, Math.round(to)));
      if (a > at) rects.push([at, row, a - at, 1]);
      at = Math.max(at, b);
    }
    if (at < right) rects.push([at, row, right - at, 1]);
  }
  return rects;
}

return { TRANSITIONS, transitionMs, transitionFrame };
})();

__m['words.js'] = (() => {
// The player's own words, in each language a reel can be in: what its buttons say and what
// it says before Play is pressed, and (APP_WORDS) what the player in a chat says while a reel
// is being recorded. A reel's own words are written in its language by whoever made it; these
// are the few around it. Data only. English is what everything falls back to. The other
// languages were written without anyone who speaks them reading them over.

/** The words of the player itself. */
const WORDS = {
  english: {
    play: 'Play', pause: 'Pause', replay: 'Replay', again: 'Play again', back: 'Back', next: 'Next',
    soundOn: 'Sound: on', soundOff: 'Sound: off', press: 'Press Play', scene: 'Scene {n} of {of}',
    pictures: 'Pictures for: {title}', dot: 'Scene {n}: {title}', position: 'Position in the reel', where: '{at} of {total}, scene {n}: {title}',
    intro: 'Sound will start. Use Next and Back any time.',
    quiet: 'The sound is off. Press Sound to have it read aloud. Use Next and Back any time.',
    still: 'This line is still being recorded. It plays in a moment.'
  },
  french: {
    play: 'Lire', pause: 'Pause', replay: 'Revoir', again: 'Revoir', back: 'Retour', next: 'Suivant',
    soundOn: 'Son : oui', soundOff: 'Son : non', press: 'Appuyez sur Lire', scene: 'Scène {n} sur {of}',
    pictures: 'Images pour : {title}', dot: 'Scène {n} : {title}', position: 'Position dans le reel', where: '{at} sur {total}, scène {n} : {title}',
    intro: 'Le son va démarrer. Utilisez Suivant et Retour à tout moment.',
    quiet: "Le son est coupé. Appuyez sur Son pour l'entendre à voix haute. Utilisez Suivant et Retour à tout moment.",
    still: "Cette phrase est encore en cours d'enregistrement. Elle arrive dans un instant."
  },
  german: {
    play: 'Start', pause: 'Pause', replay: 'Nochmal', again: 'Nochmal', back: 'Zurück', next: 'Weiter',
    soundOn: 'Ton: an', soundOff: 'Ton: aus', press: 'Start drücken', scene: 'Szene {n} von {of}',
    pictures: 'Bilder zu: {title}', dot: 'Szene {n}: {title}', position: 'Position im Reel', where: '{at} von {total}, Szene {n}: {title}',
    intro: 'Der Ton startet gleich. Weiter und Zurück gehen jederzeit.',
    quiet: 'Der Ton ist aus. Drücken Sie Ton, dann wird vorgelesen. Weiter und Zurück gehen jederzeit.',
    still: 'Dieser Satz wird noch aufgenommen. Er kommt gleich.'
  },
  spanish: {
    play: 'Reproducir', pause: 'Pausa', replay: 'Repetir', again: 'Repetir', back: 'Atrás', next: 'Siguiente',
    soundOn: 'Sonido: sí', soundOff: 'Sonido: no', press: 'Pulsa Reproducir', scene: 'Escena {n} de {of}',
    pictures: 'Imágenes de: {title}', dot: 'Escena {n}: {title}', position: 'Posición en el reel', where: '{at} de {total}, escena {n}: {title}',
    intro: 'El sonido va a empezar. Usa Siguiente y Atrás cuando quieras.',
    quiet: 'El sonido está apagado. Pulsa Sonido para oírlo en voz alta. Usa Siguiente y Atrás cuando quieras.',
    still: 'Esta frase todavía se está grabando. Llega en un momento.'
  },
  italian: {
    play: 'Riproduci', pause: 'Pausa', replay: 'Rivedi', again: 'Rivedi', back: 'Indietro', next: 'Avanti',
    soundOn: 'Audio: sì', soundOff: 'Audio: no', press: 'Premi Riproduci', scene: 'Scena {n} di {of}',
    pictures: 'Immagini per: {title}', dot: 'Scena {n}: {title}', position: 'Posizione nel reel', where: '{at} di {total}, scena {n}: {title}',
    intro: "L'audio sta per partire. Usa Avanti e Indietro quando vuoi.",
    quiet: "L'audio è spento. Premi Audio per sentirlo ad alta voce. Usa Avanti e Indietro quando vuoi.",
    still: 'Questa frase è ancora in registrazione. Arriva tra un attimo.'
  },
  portuguese: {
    play: 'Iniciar', pause: 'Pausa', replay: 'Rever', again: 'Rever', back: 'Voltar', next: 'Seguinte',
    soundOn: 'Som: sim', soundOff: 'Som: não', press: 'Toque em Iniciar', scene: 'Cena {n} de {of}',
    pictures: 'Imagens de: {title}', dot: 'Cena {n}: {title}', position: 'Posição no reel', where: '{at} de {total}, cena {n}: {title}',
    intro: 'O som vai começar. Use Seguinte e Voltar quando quiser.',
    quiet: 'O som está desligado. Toque em Som para ouvir em voz alta. Use Seguinte e Voltar quando quiser.',
    still: 'Esta frase ainda não foi gravada. Chega num instante.'
  },
  dutch: {
    play: 'Afspelen', pause: 'Pauze', replay: 'Opnieuw', again: 'Opnieuw', back: 'Terug', next: 'Volgende',
    soundOn: 'Geluid: aan', soundOff: 'Geluid: uit', press: 'Druk op Afspelen', scene: 'Scène {n} van {of}',
    pictures: 'Beelden bij: {title}', dot: 'Scène {n}: {title}', position: 'Positie in de reel', where: '{at} van {total}, scène {n}: {title}',
    intro: 'Het geluid gaat beginnen. Gebruik Volgende en Terug wanneer je wilt.',
    quiet: 'Het geluid staat uit. Druk op Geluid om het te laten voorlezen. Gebruik Volgende en Terug wanneer je wilt.',
    still: 'Deze zin wordt nog opgenomen. Hij komt zo.'
  }
};

/** What the player in a chat says while a reel is being recorded, or cannot be shown. */
const APP_WORDS = {
  english: {
    recording: 'Recording the voice', soon: 'The reel plays here as soon as it is ready.',
    read: '{who} has read {done} of {of} lines. The reel plays here in a moment.',
    turn: 'Waiting its turn', turnWords: 'Another reel is being recorded first. Yours plays here as soon as it is ready.',
    open: 'Open it in its own page', failed: 'This reel could not be made',
    gone: 'No reel here', goneWords: 'It has been deleted, or kept past its 30 days.'
  },
  french: {
    recording: 'Enregistrement de la voix', soon: "Le reel se lance ici dès qu'il est prêt.",
    read: '{who} lit le texte : {done} sur {of}. Le reel se lance ici dans un instant.',
    turn: 'En attente', turnWords: "Un autre reel est enregistré d'abord. Le vôtre se lance ici dès qu'il est prêt.",
    open: "L'ouvrir dans sa propre page", failed: "Ce reel n'a pas pu être créé",
    gone: 'Pas de reel ici', goneWords: 'Il a été supprimé, ou conservé plus de 30 jours.'
  },
  german: {
    recording: 'Die Stimme wird aufgenommen', soon: 'Das Reel spielt hier, sobald es fertig ist.',
    read: '{who} liest vor: {done} von {of}. Das Reel spielt hier gleich.',
    turn: 'Wartet, bis es an der Reihe ist', turnWords: 'Zuerst wird ein anderes Reel aufgenommen. Ihres spielt hier, sobald es fertig ist.',
    open: 'Auf eigener Seite öffnen', failed: 'Dieses Reel konnte nicht erstellt werden',
    gone: 'Hier ist kein Reel', goneWords: 'Es wurde gelöscht oder länger als 30 Tage aufbewahrt.'
  },
  spanish: {
    recording: 'Grabando la voz', soon: 'El reel se reproduce aquí en cuanto esté listo.',
    read: '{who} está leyendo: {done} de {of}. El reel se reproduce aquí en un momento.',
    turn: 'Esperando su turno', turnWords: 'Primero se está grabando otro reel. El tuyo se reproduce aquí en cuanto esté listo.',
    open: 'Abrirlo en su propia página', failed: 'No se pudo crear este reel',
    gone: 'Aquí no hay ningún reel', goneWords: 'Se ha borrado, o se guardó más de 30 días.'
  },
  italian: {
    recording: 'Registrazione della voce', soon: 'Il reel parte qui appena è pronto.',
    read: '{who} sta leggendo: {done} di {of}. Il reel parte qui tra un attimo.',
    turn: 'In attesa del suo turno', turnWords: 'Prima viene registrato un altro reel. Il tuo parte qui appena è pronto.',
    open: 'Aprilo nella sua pagina', failed: 'Non è stato possibile creare questo reel',
    gone: "Qui non c'è nessun reel", goneWords: 'È stato eliminato, o conservato per più di 30 giorni.'
  },
  portuguese: {
    recording: 'Gravação da voz', soon: 'O reel começa aqui assim que estiver pronto.',
    read: 'Leitura de {who}: {done} de {of}. O reel começa aqui num instante.',
    turn: 'À espera da sua vez', turnWords: 'Outro reel é gravado primeiro. O seu começa aqui assim que estiver pronto.',
    open: 'Abrir na sua própria página', failed: 'Não foi possível criar este reel',
    gone: 'Não há nenhum reel aqui', goneWords: 'Foi apagado, ou guardado mais de 30 dias.'
  },
  dutch: {
    recording: 'De stem wordt opgenomen', soon: 'De reel speelt hier af zodra hij klaar is.',
    read: '{who} leest voor: {done} van {of}. De reel speelt hier zo af.',
    turn: 'Wacht op zijn beurt', turnWords: 'Eerst wordt een andere reel opgenomen. De jouwe speelt hier af zodra hij klaar is.',
    open: 'Openen op een eigen pagina', failed: 'Deze reel kon niet worden gemaakt',
    gone: 'Hier is geen reel', goneWords: 'Hij is verwijderd, of langer dan 30 dagen bewaard.'
  }
};

/** Each language's code, as a page's lang attribute and a browser's voices name it. */
const LANG_CODES = { english: 'en', french: 'fr', german: 'de', spanish: 'es', italian: 'it', portuguese: 'pt', dutch: 'nl' };

/** The player's words in `language` (as a reel names it: french), or in English for one it has none for. */
function wordsFor(language) {
  return WORDS[language] ?? WORDS.english;
}

/** `words` with each {name} in it replaced by that name's value. */
function filled(words, values) {
  return words.replace(/\{(\w+)\}/g, (all, name) => (name in values ? String(values[name]) : all));
}

return { WORDS, APP_WORDS, LANG_CODES, wordsFor, filled };
})();

__m['reel.js'] = (() => {
// Checks a reel (the object a reel.js file exports) and fills in its defaults.
// Pure: no DOM, so the same checks run in the browser, in the tools and in the tests.
const { drawPicture, pictureProblems } = __m['pictures.js'];
const { TRANSITIONS } = __m['transitions.js'];
const { LANG_CODES } = __m['words.js'];

/** A reel name doubles as its folder name under reels/, so keep it URL- and file-safe. */
const REEL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

class ReelError extends Error {
  constructor(problems) {
    super('This reel has problems:\n- ' + problems.join('\n- '));
    this.name = 'ReelError';
    this.problems = problems;
  }
}

/** How captions appear: all at once, or typed out as the narrator speaks. */
const CAPTION_STYLES = ['plain', 'typewriter'];

/** The languages a reel can say it is written in: the ones the player has its own words for (words.js). */
const LANGUAGES = Object.keys(LANG_CODES);

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const oneOf = (list) => list.map((v) => `'${v}'`).join(', ');

/**
 * Returns a clean copy of `raw`:
 *   { title, intro, note, transition, captions, language, images: { name: url },
 *     scenes: [{ title, caption, say, draw, transition, captions }] }
 * `base` is put in front of relative image paths (the reel's folder, for example
 * "reels/my-reel/"). Throws a ReelError listing every problem found, not just the first.
 */
function normalizeReel(raw, { base = '' } = {}) {
  const problems = [];
  if (!raw || typeof raw !== 'object') throw new ReelError(['the reel file must export an object (export default { ... })']);

  if (!isText(raw.title)) problems.push('title: give the reel a title');
  for (const key of ['intro', 'note']) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') problems.push(`${key}: must be text`);
  }
  const transition = raw.transition ?? 'cut', captions = raw.captions ?? 'plain';
  if (!TRANSITIONS.includes(transition)) problems.push(`transition: must be one of ${oneOf(TRANSITIONS)}`);
  if (!CAPTION_STYLES.includes(captions)) problems.push(`captions: must be one of ${oneOf(CAPTION_STYLES)}`);
  if (raw.language !== undefined && !LANGUAGES.includes(raw.language)) problems.push(`language: must be one of ${oneOf(LANGUAGES)}; leave it out for any other language`);

  const images = {};
  if (raw.images !== undefined) {
    if (!raw.images || typeof raw.images !== 'object' || Array.isArray(raw.images)) {
      problems.push('images: must be an object of { name: "path/to/picture.png" }');
    } else {
      for (const [name, src] of Object.entries(raw.images)) {
        if (!isText(src)) { problems.push(`images.${name}: must be a path to a picture`); continue; }
        images[name] = /^([a-z][a-z0-9+.-]*:|\/)/i.test(src) ? src : base + src;
      }
    }
  }

  const scenes = [];
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    problems.push('scenes: give the reel at least one scene');
  } else {
    raw.scenes.forEach((s, i) => {
      const where = `scene ${i + 1}`;
      if (!s || typeof s !== 'object') { problems.push(`${where}: must be an object`); return; }
      if (!isText(s.title)) problems.push(`${where}: needs a title`);
      if (!isText(s.caption)) problems.push(`${where}: needs a caption`);
      if (s.say !== undefined && !isText(s.say)) problems.push(`${where}: say must be text (or leave it out to read the caption)`);
      if (s.draw !== undefined && typeof s.draw !== 'function') problems.push(`${where}: draw must be a function draw(t, px)`);
      if (s.transition !== undefined && !TRANSITIONS.includes(s.transition)) problems.push(`${where}: transition must be one of ${oneOf(TRANSITIONS)}`);
      if (s.captions !== undefined && !CAPTION_STYLES.includes(s.captions)) problems.push(`${where}: captions must be one of ${oneOf(CAPTION_STYLES)}`);
      let draw = typeof s.draw === 'function' ? s.draw : defaultDraw;
      if (s.picture !== undefined) {
        const wrong = s.draw !== undefined ? ['give it draw or picture, not both'] : pictureProblems(s.picture, Object.keys(images));
        for (const p of wrong) problems.push(`${where}: ${p}`);
        if (!wrong.length) draw = (t, px) => drawPicture(s.picture, t, px);
      }
      scenes.push({
        title: s.title,
        caption: s.caption,
        say: isText(s.say) ? s.say.trim() : String(s.caption ?? '').trim(),
        draw,
        transition: s.transition ?? transition,
        captions: s.captions ?? captions
      });
    });
  }

  if (problems.length) throw new ReelError(problems);
  return {
    title: raw.title.trim(),
    intro: raw.intro ?? INTRO,
    note: raw.note ?? '',
    transition,
    captions,
    images,
    scenes,
    ...(raw.language ? { language: raw.language } : {}),   // only a reel that says: the player then speaks it too
    // the kind of picture it opens on, so the big Play button can keep off a title's words
    opens: raw.scenes[0].picture?.type ?? (typeof raw.scenes[0].draw === 'function' ? 'drawing' : 'card')
  };
}

/** What a reel says before Play is pressed, unless it says its own. */
const INTRO = 'Sound will start. Use Next and Back any time.';

/** What the player says instead while the sound is off, as on a page with no recordings: it must not promise sound. */
const QUIET_INTRO = 'The sound is off. Press Sound to have it read aloud. Use Next and Back any time.';

/** A plain title card, for scenes that do not draw their own picture. */
function defaultDraw(t, px, scene) {
  px.rect('#13203a', 0, 0, px.W, px.H);
  px.sign(scene ? scene.title.toUpperCase() : '', px.W / 2, px.H / 2 - 10, 16);
}

/**
 * Turns an audio manifest (written by npm run voices) into a lookup from a
 * scene's narration text to its clip. Clips are matched by their words, not their
 * position, so reordering scenes keeps their recordings, and a scene whose words have
 * changed since the last render has no clip (the browser's own voice reads it instead).
 */
function clipLookup(manifest, base = '') {
  const byText = new Map();
  for (const c of manifest?.clips ?? []) {
    if (c && isText(c.text) && isText(c.file)) byText.set(c.text.trim(), { url: base + c.file, seconds: Number(c.seconds) || 0 });
  }
  return (scene) => byText.get(scene.say) ?? null;
}

return { REEL_NAME, ReelError, CAPTION_STYLES, LANGUAGES, normalizeReel, INTRO, QUIET_INTRO, defaultDraw, clipLookup };
})();

__m['format.js'] = (() => {
// A reel as plain data: the reel.json format. It is the reel.js format without the code, so
// a reel can be written by a tool, an AI agent or a web service and played safely, since
// nothing in it ever runs. Every picture comes from the ready-made ones (pictures.js).
// Pure: no DOM, so the same checks run in the browser, in the tools and in the tests.
const { ICON_NAMES, PICTURES, SPRITE_MAX, TABLE_MAX } = __m['pictures.js'];
const { PALETTE } = __m['palette.js'];
const { CAPTION_STYLES, LANGUAGES, normalizeReel, ReelError } = __m['reel.js'];
const { TRANSITIONS } = __m['transitions.js'];

/** The format a reel.json names in its "format" field. A new number means a change old readers cannot play. */
const REEL_FORMAT = 'pixelreel/1';

const REEL_KEYS = ['format', 'title', 'intro', 'note', 'transition', 'captions', 'language', 'images', 'scenes'];
const SCENE_KEYS = ['title', 'caption', 'say', 'picture', 'transition', 'captions'];

/** What each ready-made picture shows, for people and agents choosing one. */
const PICTURE_NOTES = {
  title: 'A big title dropping in over a night sky, with a line typed underneath.',
  list: 'Items arriving one by one with a tick, or a number, every few seconds.',
  terminal: 'A terminal window. Lines starting with "$ " type out; the rest is output.',
  code: 'An editor that types out the code, with simple highlighting.',
  chat: 'Messages arriving with a typing indicator. The first sender sits on the left.',
  big: 'One huge word or number, punched in, with a line underneath.',
  image: "One of the reel's own images, named in images, slowly pushing in.",
  icons: 'One to four everyday icons dropping in one by one, each with a label underneath.',
  flow: 'One to four icons joined by arrows, arriving in turn: how one thing leads to the next.',
  compare: 'Two cards side by side: the one to avoid, with a cross, then the one to choose, with a tick.',
  table: 'A small table for things set out in rows and columns (a timetable, a bill, prices, dates): rows arrive one by one, the newest lit.',
  sprite: 'Pixel art of your own from rows of palette letters, scaled up to fill the picture, with an optional label.'
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every place in `value` that holds code (a function), as paths such as "scenes[2].draw". */
function codePaths(value, path = '', found = []) {
  if (typeof value === 'function') found.push(path);
  else if (Array.isArray(value)) value.forEach((v, i) => codePaths(v, `${path}[${i}]`, found));
  else if (isPlainObject(value)) for (const [key, v] of Object.entries(value)) codePaths(v, path ? `${path}.${key}` : key, found);
  return found;
}

/**
 * Everything that makes `raw` not a reel.json in its own right, beyond the checks every reel
 * gets: the format it names, fields it does not know, and code. Empty when it is fine.
 */
function dataProblems(raw) {
  const problems = [];
  if (raw.format === undefined) problems.push(`format: say which format this is, "format": "${REEL_FORMAT}"`);
  else if (raw.format !== REEL_FORMAT) problems.push(`format: this player reads "${REEL_FORMAT}", not ${JSON.stringify(raw.format)}`);
  for (const key of Object.keys(raw)) {
    if (!REEL_KEYS.includes(key)) problems.push(`${key}: a reel has ${REEL_KEYS.join(', ')}, not ${key}`);
  }
  if (Array.isArray(raw.scenes)) {
    raw.scenes.forEach((s, i) => {
      if (!isPlainObject(s)) return;
      for (const key of Object.keys(s)) {
        if (key === 'draw') problems.push(`scene ${i + 1}: draw is code, which a reel.json cannot hold; give the scene a picture instead`);
        else if (!SCENE_KEYS.includes(key)) problems.push(`scene ${i + 1}: a scene has ${SCENE_KEYS.join(', ')}, not ${key}`);
      }
    });
  }
  for (const path of codePaths(raw)) {
    if (!/^scenes\[\d+\]\.draw$/.test(path)) problems.push(`${path}: a reel.json holds data only, not code`);
  }
  return problems;
}

/**
 * Checks a reel.json (already parsed) and returns it ready to play, exactly as normalizeReel
 * does for a reel.js. Throws a ReelError listing every problem found, not just the first.
 */
function reelFromData(raw, { base = '' } = {}) {
  if (!isPlainObject(raw)) {
    throw new ReelError([`a reel.json must be one object, such as { "format": "${REEL_FORMAT}", "title": "Tea", "scenes": [ ... ] }`]);
  }
  const problems = dataProblems(raw);
  // Only the fields a reel.json may have go on to the usual checks, so nothing is said twice.
  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.map((s) => (isPlainObject(s) ? Object.fromEntries(SCENE_KEYS.filter((k) => k in s).map((k) => [k, s[k]])) : s))
    : raw.scenes;
  try {
    const reel = normalizeReel({ ...raw, scenes }, { base });
    if (!problems.length) return reel;
  } catch (err) {
    if (!(err instanceof ReelError)) throw err;
    problems.push(...err.problems);
  }
  throw new ReelError(problems);
}

/** Reads the text of a reel.json and checks it. Throws a ReelError if it is not JSON or not a reel. */
function parseReelJson(text, options) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ReelError([`this is not valid JSON: ${err.message}`]);
  }
  return reelFromData(raw, options);
}

const TEXT = { type: 'string', pattern: '\\S' };
const KIND_SCHEMAS = {
  text: TEXT,
  list: { type: 'array', minItems: 1, items: { type: 'string' } },
  messages: {
    type: 'array',
    minItems: 1,
    items: { type: 'object', additionalProperties: false, required: ['from', 'text'], properties: { from: TEXT, text: TEXT } }
  },
  number: { type: 'number', minimum: 0, description: 'Seconds.' },
  flag: { type: 'boolean' },
  image: { type: 'string', description: "The name of one of the reel's images." },
  item: {
    type: 'object',
    additionalProperties: false,
    required: ['icon', 'label'],
    properties: { icon: { enum: ICON_NAMES }, label: TEXT }
  },
  items: {
    type: 'array',
    minItems: 1,
    maxItems: 4,
    items: { type: 'object', additionalProperties: false, required: ['icon'], properties: { icon: { enum: ICON_NAMES }, label: TEXT } }
  },
  cells: {
    type: 'array',
    minItems: 1,
    maxItems: TABLE_MAX.rows,
    items: { type: 'array', minItems: TABLE_MAX.minCols, maxItems: TABLE_MAX.cols, items: { ...TEXT, maxLength: TABLE_MAX.cell } },
    description: 'The rows of the table, each a list of short cells, every row with the same number: a word or two, a time, an amount. Such as [["High Street", "9:05"], ["Station", "9:20"]].'
  },
  heads: {
    type: 'array',
    minItems: TABLE_MAX.minCols,
    maxItems: TABLE_MAX.cols,
    items: { ...TEXT, maxLength: TABLE_MAX.cell },
    description: 'A heading for each column, such as ["Stop", "Time"].'
  },
  rows: {
    type: 'array',
    minItems: 1,
    maxItems: SPRITE_MAX.rows,
    items: { type: 'string', maxLength: SPRITE_MAX.cols },
    description: `Rows of pixels, one letter each: ${Object.keys(PALETTE).join(' ')} from the palette, a letter of your own from colours, or "." for see-through.`
  },
  colours: {
    type: 'object',
    propertyNames: { pattern: '^[^. ]$' },
    additionalProperties: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' },
    description: 'Letters of your own for the rows, and the colours they stand for, such as { "h": "#6b3e2e" }.'
  }
};

/**
 * The reel.json format as a JSON Schema (draft 2020-12), built from the ready-made pictures,
 * so it can never drift from what the player draws. Tools can hand it to an AI agent as the
 * shape to write. A few rules are beyond a schema (an image picture must name one of the
 * reel's images, a sprite's letters must be in the palette or its colours, and a table's
 * rows must be as long as each other and not too wide to read), so reelFromData stays the
 * final word.
 */
function reelSchema() {
  const pictures = Object.entries(PICTURES).map(([type, { fields }]) => {
    const properties = { type: { const: type } }, required = ['type'];
    for (const [key, want] of Object.entries(fields)) {
      properties[key] = KIND_SCHEMAS[want.replace('?', '')];
      if (!want.endsWith('?')) required.push(key);
    }
    return { title: type, description: PICTURE_NOTES[type], type: 'object', additionalProperties: false, required, properties };
  });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'pixelreel reel',
    description: 'A narrated pixel-art explainer: a list of scenes, each with a title, a caption, words to say and a ready-made picture.',
    type: 'object',
    additionalProperties: false,
    required: ['format', 'title', 'scenes'],
    properties: {
      format: { const: REEL_FORMAT },
      title: { ...TEXT, description: "The reel's name, shown above the player." },
      intro: { type: 'string', description: 'Shown before anyone presses Play.' },
      note: { type: 'string', description: 'Small print under the player.' },
      transition: { enum: TRANSITIONS, default: 'cut', description: 'How every scene enters, unless it says otherwise.' },
      captions: { enum: CAPTION_STYLES, default: 'plain', description: 'Captions all at once, or typed out as the narrator speaks.' },
      language: { enum: LANGUAGES, default: 'english', description: "The language the reel's words are written in. The player's own buttons and words are then in it too, and a browser reads it aloud in a voice of that language." },
      images: {
        type: 'object',
        description: 'Pictures the scenes can show, as name: path or URL.',
        additionalProperties: { type: 'string', minLength: 1 }
      },
      scenes: { type: 'array', minItems: 1, items: { $ref: '#/$defs/scene' } }
    },
    $defs: {
      scene: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'caption'],
        properties: {
          title: { ...TEXT, description: 'The heading over the caption.' },
          caption: { ...TEXT, description: 'The words on screen. Short sentences read best.' },
          say: { ...TEXT, description: 'What the narrator says. Leave it out to read the caption aloud.' },
          picture: { $ref: '#/$defs/picture' },
          transition: { enum: TRANSITIONS, description: "How this scene enters, overriding the reel's." },
          captions: { enum: CAPTION_STYLES, description: "Overrides the reel's caption style." }
        }
      },
      picture: { description: 'A ready-made picture. Leave it out for a plain title card.', oneOf: pictures }
    }
  };
}

return { REEL_FORMAT, PICTURE_NOTES, reelFromData, parseReelJson, reelSchema };
})();

__m['timing.js'] = (() => {
// How long things take. Pure functions, shared by the player and the tests.

/** Pause after a scene's narration ends, before the next scene starts. */
const GAP_MS = 1200;

/** Speaking rate used to guess how long a line takes when no recording exists. */
const WORDS_PER_SECOND = 2.5;

/** No scene is shorter than this, even one with very few words. */
const MIN_SCENE_MS = 4000;

/** Counts the words in a line of narration. */
function countWords(text) {
  const trimmed = String(text ?? '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** A guess at how long `text` takes to say aloud, in milliseconds. */
function estimateSpeechMs(text) {
  return Math.max(MIN_SCENE_MS, Math.round((countWords(text) / WORDS_PER_SECOND) * 1000));
}

/**
 * How long a scene's narration lasts: the recorded clip's length when there is one,
 * otherwise a guess from the number of words. Never shorter than MIN_SCENE_MS.
 */
function narrationMs(scene, clip) {
  if (clip && Number.isFinite(clip.seconds) && clip.seconds > 0) {
    return Math.max(MIN_SCENE_MS, Math.round(clip.seconds * 1000));
  }
  return estimateSpeechMs(scene.say);
}

/**
 * The longest we wait for the browser's own voice to say it has finished. Some browsers
 * never fire the end event, so the player moves on after this rather than stalling.
 */
function speechWatchdogMs(text) {
  return estimateSpeechMs(text) * 2 + 5000;
}

/**
 * Lays the scenes end to end: where each one starts on the reel's clock and how long it
 * lasts, its narration plus the pause after it. `durations` are narration lengths in ms.
 * Returns { starts, spans, total }, all in milliseconds.
 */
function timeline(durations, gapMs = GAP_MS) {
  const starts = [], spans = [];
  let at = 0;
  for (const d of durations) {
    starts.push(at);
    const span = Math.max(0, Number(d) || 0) + gapMs;
    spans.push(span);
    at += span;
  }
  return { starts, spans, total: at };
}

/** Which scene is playing `ms` into the reel, and how far into it: { index, offset }. */
function locate(line, ms) {
  const { starts, total } = line;
  if (!starts.length) return { index: 0, offset: 0 };
  const at = Math.max(0, Math.min(total, Number(ms) || 0));
  let index = starts.length - 1;
  while (index > 0 && starts[index] > at) index--;
  return { index, offset: at - starts[index] };
}

/** A time for people: 83000 becomes "1:23". */
function clockTime(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Typewriter captions finish typing at this share of the narration, so the words lead the voice. */
const TYPE_SHARE = 0.7;

/** ...but never type slower than this many characters a second. */
const TYPE_MIN_CPS = 12;

/** How many characters of `text` a typewriter caption shows `elapsedMs` into narration lasting `narrationMs`. */
function typedLength(text, elapsedMs, narrationMs) {
  const len = String(text ?? '').length;
  if (!len) return 0;
  const typingMs = Math.min(narrationMs * TYPE_SHARE, (len / TYPE_MIN_CPS) * 1000);
  if (!(typingMs > 0)) return len;
  return Math.max(0, Math.min(len, Math.ceil((len * elapsedMs) / typingMs)));
}

return { GAP_MS, WORDS_PER_SECOND, MIN_SCENE_MS, countWords, estimateSpeechMs, narrationMs, speechWatchdogMs, timeline, locate, clockTime, TYPE_SHARE, TYPE_MIN_CPS, typedLength };
})();

const { parseReelJson } = __m['format.js'];
const { clockTime, narrationMs, timeline } = __m['timing.js'];
const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node make-page.mjs reel.json [page.html]');
  process.exit(2);
}
const text = readFileSync(input, 'utf8');
let reel;
try {
  reel = parseReelJson(text);
} catch (err) {
  if (!err.problems) throw err;
  console.error('This reel has problems. Fix them all, then run this again:\n- ' + err.problems.join('\n- '));
  process.exit(1);
}
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reelJson = JSON.stringify(JSON.parse(text)).replace(/</g, '\\u003c');
const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'template.html'), 'utf8');
const page = template
  .replace(/<title>[^<]*<\/title>/, () => '<title>' + escapeHtml(reel.title) + ' - pixelreel</title>')
  .replace('PIXELREEL_REEL_HERE', () => reelJson);
const out = output || basename(input).replace(/\.json$/i, '') + '.html';
writeFileSync(out, page);
const length = timeline(reel.scenes.map((s) => narrationMs(s, null))).total;
console.log('Wrote ' + out + ': "' + reel.title + '", ' + reel.scenes.length + ' scenes, about ' + clockTime(length) + '.');

