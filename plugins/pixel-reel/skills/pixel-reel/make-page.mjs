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
    '......kkkk......',
    '.....kttttk.....',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '....kttttttk....',
    '.....kttttk.....',
    '......kkkk......',
    '................',
    '....kkkkkkkk....',
    '...kttttttttk...',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kttttttttttk..',
    '..kkkkkkkkkkkk..'
  ],
  people: [
    '................',
    '..kkkk....nnnn..',
    '.kkkkkk..nnnnnn.',
    'kkddddkk.nssssn.',
    'kdkddkdk.skssks.',
    'kddddddk.ssssss.',
    'kddrrddk.ssrrss.',
    'kkddddkk..ssss..',
    'kkppppkk.tttttt.',
    '.pppppp..tttttt.',
    'dppppppdstttttts',
    '.pppppp..tttttt.',
    'pppppppp.bbbbbb.',
    'pppppppp.bb..bb.',
    '..d..d...bb..bb.',
    '..k..k...kk..kk.'
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
  ],
  woman: [
    '................',
    '.....nnnnnn.....',
    '....nnnnnnnn....',
    '...nnssssssnn...',
    '...nskssssksn...',
    '...nssssssssn...',
    '...nsssrrsssn...',
    '...nnssssssnn...',
    '...nnnssssnnn...',
    '...nnppppppnn...',
    '...pppppppppp...',
    '..spppppppppps..',
    '....pppppppp....',
    '...pppppppppp...',
    '..pppppppppppp..',
    '.....kk..kk.....'
  ],
  man: [
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
    '..s.tttttttt.s..',
    '....bbbbbbbb....',
    '....bbb..bbb....',
    '....kkk..kkk....'
  ],
  girl: [
    '................',
    '................',
    '.....nnnnnn.....',
    '....nnnnnnnn....',
    '..nnskssssksnn..',
    '..nnssssssssnn..',
    '..n.sssrrsss.n..',
    '..n..ssssss..n..',
    '.....oooooo.....',
    '....oooooooo....',
    '...soooooooos...',
    '....oooooooo....',
    '...oooooooooo...',
    '.....s....s.....',
    '.....s....s.....',
    '....kk....kk....'
  ],
  boy: [
    '................',
    '................',
    '.....nnnnnn.....',
    '....nnnnnnnn....',
    '....skssssks....',
    '....ssssssss....',
    '....sssrrsss....',
    '.....ssssss.....',
    '.....gggggg.....',
    '....gggggggg....',
    '...sggggggggs...',
    '....gggggggg....',
    '....bbbbbbbb....',
    '....bbb..bbb....',
    '.....s....s.....',
    '....kk....kk....'
  ],
  children: [
    '................',
    '................',
    '..kkkk....yyyy..',
    '.kkkkkk..yyyyyy.',
    'kSkSSkSk.skssks.',
    'kSSSSSSk.ssssss.',
    '.SSrrSS..ssrrss.',
    '..SSSS....ssss..',
    '.oooooo..gggggg.',
    'SooooooSsggggggs',
    '.oooooo..gggggg.',
    'oooooooo.bbbbbb.',
    '..S..S...bb..bb.',
    '..S..S....s..s..',
    '..k..k....s..s..',
    '..........k..k..'
  ]
};

/** The icons by what they are about, for the guides people and agents choose from. Every icon is in one group. */
const ICON_GROUPS = {
  'Paperwork and money': ['letter', 'document', 'money', 'card', 'bank', 'calendar', 'clock', 'hourglass', 'bag', 'basket', 'gift', 'chart'],
  'People and home': ['person', 'people', 'woman', 'man', 'girl', 'boy', 'children', 'baby', 'heart', 'house', 'bed', 'key', 'lock', 'bin', 'cup', 'apple', 'egg', 'bread', 'bowl', 'bottle', 'pan', 'tap', 'shirt', 'tooth', 'pill', 'thermometer', 'dog', 'cat'],
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
  c: '#ebeac5', S: '#c68642', d: '#8d5524'
};


return { PALETTE };
})();

__m['library.js'] = (() => {
// The stage's library: the people, things and places a stage is built from, drawn once and
// used by every reel after. Each drawing is rows of palette letters (palette.js), drawn two
// picture pixels to one of its own, so the stage has one size of pixel throughout. A new
// drawing comes in through the weekly sheet (docs/library.md): what reels wished for, drawn,
// and said yes to before it goes in.
//
// People are drawn as who they are (Olly, 26 Nov 2026): a woman, a man, a girl, a boy, a baby,
// an older woman and an older man, each taking any skin and hair, and a person, an outline that
// is anyone at all. What they wear says what they do: a doctor's coat, scrubs, a hi-vis vest, a
// suit. Pure data: no DOM.

/**
 * The people, in rows where S is skin, H hair, C their top, T their trousers or skirt and U
 * their shoes, so one drawing is anyone. `older` people are given grey or white hair when the
 * reel does not say.
 */
const PEOPLE = {
  woman: {
    rows: [
      '.....HHHH....',
      '...HHHHHHH...',
      '..HHHHHHHHH..',
      '..HHSSSSSHH..',
      '..HSSkSkSSH..',
      '..HSSSSSSSH..',
      '..HHSSRSSHH..',
      '..HHHSSSHHH..',
      '..HHH.S.HHH..',
      '...HCCCCCH...',
      '..CCCCCCCCC..',
      '.SCCCCCCCCCS.',
      '.SCCCCCCCCCS.',
      '.S.CCCCCCC.S.',
      '.S.CCCCCCC.S.',
      '...TTTTTTT...',
      '..TTTTTTTTT..',
      '..TTTTTTTTT..',
      '.TTTTTTTTTTT.',
      '....SS.SS....',
      '....SS.SS....',
      '....SS.SS....',
      '...UUU.UUU...'
    ]
  },
  man: {
    rows: [
      '.............',
      '....HHHHH....',
      '...HHHHHHH...',
      '...HSSSSSH...',
      '...SSkSkSS...',
      '...SSSSSSS...',
      '...SSSRSSS...',
      '....SSSSS....',
      '.....SSS.....',
      '...CCCCCCC...',
      '..CCCCCCCCC..',
      '.CCCCCCCCCCC.',
      '.CCCCCCCCCCC.',
      '.SCCCCCCCCCS.',
      '.S.CCCCCCC.S.',
      '...CCCCCCC...',
      '...TTTTTTT...',
      '...TTTTTTT...',
      '...TTT.TTT...',
      '...TTT.TTT...',
      '...TTT.TTT...',
      '...TTT.TTT...',
      '..UUUU.UUUU..'
    ]
  },
  girl: {
    rows: [
      '...HHHHH...',
      '.HHHHHHHHH.',
      'HHHSSSSSHHH',
      'HHSkSSSkSHH',
      'H.SSSSSSS.H',
      '..SSSRSSS..',
      '...SSSSS...',
      '..CCCCCCC..',
      '.CCCCCCCCC.',
      'SCCCCCCCCCS',
      'S.TTTTTTT.S',
      '.TTTTTTTTT.',
      'TTTTTTTTTTT',
      '...SS.SS...',
      '...SS.SS...',
      '..UUU.UUU..'
    ]
  },
  boy: {
    rows: [
      '...HHHHH...',
      '..HHHHHHH..',
      '..HSSSSSH..',
      '..SkSSSkS..',
      '..SSSSSSS..',
      '..SSSRSSS..',
      '...SSSSS...',
      '..CCCCCCC..',
      '.CCCCCCCCC.',
      'SCCCCCCCCCS',
      'S.CCCCCCC.S',
      '..TTTTTTT..',
      '..TTT.TTT..',
      '..SSS.SSS..',
      '..SSS.SSS..',
      '.UUUU.UUUU.'
    ]
  },
  baby: {
    rows: [
      '...HHH...',
      '..SSSSS..',
      '.SkSSSkS.',
      '.SSSRSSS.',
      '..SSSSS..',
      '.CCCCCCC.',
      'SCCCCCCCS',
      '.CCCCCCC.',
      'SSCCCCCSS',
      '.SS...SS.'
    ]
  },
  'older-woman': {
    older: true,
    rows: [
      '.....HHH.....',
      '....HHHHH....',
      '...HHHHHHH...',
      '..HHSSSSSHH..',
      '..HkkSSkkSH..',
      '..HSSSSSSSH..',
      '...SSSRSSS...',
      '....SSSSS....',
      '.....SSS.....',
      '...CCCCCCC...',
      '..CCCCCCCCC..',
      '.SCCCCCCCCCS.',
      '.SCCCCCCCCCS.',
      '.S.CCCCCCC.S.',
      '...CCCCCCC...',
      '..TTTTTTTTT..',
      '..TTTTTTTTT..',
      '..TTTTTTTTT..',
      '..TTTTTTTTT..',
      '....SS.SS....',
      '....SS.SS....',
      '....SS.SS....',
      '...UUU.UUU...'
    ]
  },
  'older-man': {
    older: true,
    rows: [
      '.............',
      '.............',
      '....SSSSS....',
      '..HSSSSSSSH..',
      '..HkkSSkkSH..',
      '...SSSSSSS...',
      '...SHHHHHS...',
      '....SSSSS....',
      '.....SSS.....',
      '...CCCCCCC...',
      '..CCCCCCCCC..',
      '.CCCCCCCCCCC.',
      '.CCCCCCCCCCC.',
      '.SCCCCCCCCCS.',
      '.S.CCCCCCC.S.',
      '...CCCCCCC...',
      '...TTTTTTT...',
      '...TTTTTTT...',
      '...TTT.TTT...',
      '...TTT.TTT...',
      '...TTT.TTT...',
      '...TTT.TTT...',
      '..UUUU.UUUU..'
    ]
  },
  person: {
    outline: true,
    rows: [
      '.....kkk.....',
      '....kCCCk....',
      '...kCCCCCk...',
      '...kCCCCCk...',
      '...kCCCCCk...',
      '....kCCCk....',
      '.....kkk.....',
      '...kkkkkkk...',
      '..kCCCCCCCk..',
      '.kCCCCCCCCCk.',
      '.kCCCCCCCCCk.',
      '.kCkCCCCCkCk.',
      '.kCkCCCCCkCk.',
      '.kCkCCCCCkCk.',
      '..kkCCCCCkk..',
      '...kCCCCCk...',
      '...kCCkCCk...',
      '...kCCkCCk...',
      '...kCCkCCk...',
      '...kCCkCCk...',
      '...kCCkCCk...',
      '...kCCkCCk...',
      '...kkk.kkk...'
    ]
  }
};

/** Hats, as rows drawn over the top of a person's head: A and Z are the hat's own colours. */
const HATS = {
  chef: ['.kkkkk.', 'kwwwwwk', 'kwwwwwk', 'kwwwwwk', '.kwwwk.', 'kkkkkkk'],
  'hard-hat': ['..kkkkk..', '.kyyyyyk.', 'kyyyyyyyk', 'kkkkkkkkk'],
  helmet: ['..kkkkk...', '.kyyyyyk..', 'kyyykyyyk.', 'kkkkkkkkkk'],
  peaked: ['.kkkkkkk.', 'kBBBBBBBk', 'kwkwkwkwk', 'kkkkkkkkk'],
  woolly: ['...kk...', '..kwwk..', '.kkggkk.', 'kgggGggk', 'kGGGGGGk'],
  cap: ['..kkkk...', '.kAAAAk..', 'kAAAAAAkk', 'kkkkkkkkk'],
  'sun-hat': ['...kkkkk...', '..kyyyyyk..', '.kkrrrrrkk.', 'kyyyyyyyyyk', '.kkkkkkkkk.']
};

/**
 * What a person can wear, which says what they do: the colours of their top (C) and trousers or
 * skirt (T), an accent (A) where the clothes have one, what is added (a long coat, an apron, a
 * stripe, a tie, a collar, straps), and a hat. A person with no `wears` is in everyday clothes.
 */
const WEARS = {
  everyday: null,
  'doctor-coat': { C: '#f4f4ee', T: '#2b3a52', add: ['coat'], says: 'a doctor' },
  nurse: { C: '#2b5fa8', T: '#2b3a52', A: '#f4f4ee', add: ['collar'], says: 'a nurse' },
  scrubs: { C: '#3aa6a0', T: '#3aa6a0', says: 'anyone working at a hospital, a dentist or a vet' },
  'hi-vis': { C: '#f2e12b', T: '#2b3a52', A: '#8a96a8', add: ['stripe'], says: 'someone working by a road or a railway, a steward' },
  builder: { C: '#ff8c2a', T: '#4a4f5a', A: '#c9ced6', add: ['stripe'], hat: 'hard-hat', says: 'a builder or an engineer on a site' },
  suit: { C: '#24476b', T: '#1c2f4a', A: '#d63a3a', add: ['tie'], says: 'someone at work in an office, a bank or a council' },
  chef: { C: '#f4f4ee', T: '#3a3a44', hat: 'chef', says: 'a chef or a cook' },
  apron: { A: '#2f7d5a', add: ['apron'], says: 'someone serving in a shop, a cafe or a kitchen' },
  overalls: { T: '#3b6fb6', add: ['straps'], says: 'a mechanic, a farmer, a plumber, someone doing a job with their hands' },
  police: { C: '#1f2d4a', T: '#1f2d4a', A: '#f4f4ee', add: ['collar'], hat: 'peaked', says: 'a police officer' },
  firefighter: { C: '#2b2b33', T: '#2b2b33', A: '#f2e12b', add: ['stripe'], hat: 'helmet', says: 'a firefighter' },
  postie: { C: '#d63a3a', T: '#1f2d4a', says: 'someone delivering the post or parcels' },
  'school-uniform': { C: '#24476b', T: '#5a5f6a', A: '#d63a3a', add: ['tie'], says: 'a pupil at school' },
  'winter-coat': { C: '#7a4a24', add: ['coat'], hat: 'woolly', says: 'someone out in the cold' },
  'sports-kit': { C: '#d63a3a', T: '#f4f4ee', says: 'someone playing sport' },
  cap: { A: '#1f4e9c', hat: 'cap', says: 'everyday clothes and a cap' },
  'sun-hat': { hat: 'sun-hat', says: 'everyday clothes and a sun hat: summer, a festival, the beach' }
};

/** The columns of `row` holding any of `letters`: [first, last], or null. */
function span(row, letters) {
  let first = -1, last = -1;
  [...row].forEach((ch, i) => { if (letters.includes(ch)) { if (first < 0) first = i; last = i; } });
  return first < 0 ? null : [first, last];
}

const dressedRows = new Map();

/** A person's rows as they look in what they wear: the clothes added, and their hat on. Kept once made. */
function personRows(name, wears = null) {
  const key = `${name} ${wears}`;
  if (dressedRows.has(key)) return dressedRows.get(key);
  const outfit = WEARS[wears] ?? null;
  let rows = PEOPLE[name].rows.map((r) => [...r]);
  const torso = rows.map((r, i) => (r.includes('C') ? i : -1)).filter((i) => i >= 0);
  const legs = rows.map((r, i) => (r.includes('T') ? i : -1)).filter((i) => i >= 0);
  const set = (i, j, ch) => { if (rows[i]?.[j] !== undefined) rows[i][j] = ch; };
  for (const add of outfit?.add ?? []) {
    const chest = torso[0], mid = Math.round(rows[chest].reduce((sum, ch, j) => sum + (ch === 'C' ? j : 0), 0) / rows[chest].filter((ch) => ch === 'C').length);
    if (add === 'coat') for (const i of legs.slice(0, 3)) rows[i] = rows[i].map((ch) => (ch === 'T' ? 'C' : ch));
    // a band across the middle of the top: low on a grown-up, on the last row of a child's short top
    if (add === 'stripe') for (const i of torso.slice(Math.min(3, torso.length - 1), Math.min(3, torso.length - 1) + 2)) rows[i] = rows[i].map((ch) => (ch === 'C' ? 'A' : ch));
    if (add === 'collar') { set(chest, mid - 1, 'A'); set(chest, mid, 'A'); set(chest, mid + 1, 'A'); }
    if (add === 'tie') { set(chest, mid - 1, 'w'); set(chest, mid + 1, 'w'); for (const i of torso.slice(0, 4)) set(i, mid, 'A'); }
    if (add === 'apron' || add === 'straps') {
      for (const [n, i] of [...torso, ...legs].entries()) {
        const [l, r] = span(rows[i].join(''), 'CT') ?? [0, -1];
        for (let j = l + 2; j <= r - 2; j++) {
          if (add === 'apron' && n >= 1) set(i, j, rows[i][j] === 'C' || rows[i][j] === 'T' ? 'A' : rows[i][j]);
          if (add === 'straps' && torso.includes(i)) {
            const k = torso.indexOf(i);
            if (k >= 3 || j === l + 2 || j === r - 2) set(i, j, rows[i][j] === 'C' ? 'T' : rows[i][j]);
          }
        }
      }
    }
  }
  const hat = HATS[outfit?.hat];
  if (hat) {
    const top = rows.findIndex((r) => r.some((ch) => ch !== '.'));
    const cols = rows.slice(top, top + 3).flatMap((r) => r.map((ch, j) => (ch === '.' ? -1 : j)).filter((j) => j >= 0));
    const cx = (Math.min(...cols) + Math.max(...cols)) / 2, hw = hat[0].length;
    let left = Math.round(cx - (hw - 1) / 2), hatTop = top + 1 - (hat.length - 1);
    const padL = Math.max(0, -left), padR = Math.max(0, left + hw - rows[0].length), padT = Math.max(0, -hatTop);
    rows = [...Array.from({ length: padT }, () => Array(rows[0].length).fill('.')), ...rows].map((r) => [...Array(padL).fill('.'), ...r, ...Array(padR).fill('.')]);
    left += padL; hatTop += padT;
    hat.forEach((line, i) => [...line].forEach((ch, j) => { if (ch !== '.') rows[hatTop + i][left + j] = ch; }));
  }
  const done = rows.map((r) => r.join(''));
  dressedRows.set(key, done);
  return done;
}

/** Everyday tops, one chosen for each person by their name so they look the same in every scene. */
const TOPS = ['#55d6be', '#8e5bd6', '#d63a3a', '#1f4e9c', '#ff8c2a', '#3fa34d', '#ffcc4d', '#ff7eb6'];
const LEGS = ['#2b3a52', '#24476b', '#5a3418', '#3a2f4a'];

/**
 * The things, by name: each drawing's rows, any colours of its own, its group, and what it is.
 * A thing whose name is also an icon's is drawn from here on a stage: a bigger, finer house.
 */
const THINGS = {
  // ----- post and paperwork
  letter: {
    group: 'Post and paperwork', says: 'a letter in its envelope',
    rows: [
      'kkkkkkkkkkkkkk',
      'kwkwwwwwwwwkwk',
      'kwwkwwwwwwkwwk',
      'kwwwkwwwwkwwwk',
      'kwwwwkrrkwwwwk',
      'kwwwwwrrwwwwwk',
      'kwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwk',
      'kkkkkkkkkkkkkk'
    ]
  },
  document: {
    group: 'Post and paperwork', says: 'a letter or a page, opened and read',
    rows: [
      'kkkkkkkkk...',
      'kwwwwwwwkk..',
      'kwbbbbwwkwk.',
      'kwwwwwwwkkkk',
      'kwwwwwwwwwwk',
      'kweeeeeeeewk',
      'kwwwwwwwwwwk',
      'kweeeeeeewwk',
      'kwwwwwwwwwwk',
      'kweeeeeeeewk',
      'kwwwwwwwwwwk',
      'kweeeeewwwwk',
      'kwwwwwwwwwwk',
      'kwwwwwwkbkwk',
      'kkkkkkkkkkkk'
    ]
  },
  bill: {
    group: 'Post and paperwork', says: 'a bill: a page with a total to pay',
    rows: [
      'kkkkkkkkkkkk',
      'kwwwwwwwwwwk',
      'kwrrrrrwwwwk',
      'kwwwwwwwwwwk',
      'kweeeewwweek',
      'kweeewwwweek',
      'kweeeewwweek',
      'kwwwwwwwwwwk',
      'kwkkkkkkkkwk',
      'kwwwwwwwwwwk',
      'kwwwwwwrrrwk',
      'kwwwwwwrrrwk',
      'kwwwwwwwwwwk',
      'kkkkkkkkkkkk'
    ]
  },
  parcel: {
    group: 'Post and paperwork', says: 'a parcel',
    rows: [
      '..kkkkkkkkkkkk',
      '.knnnnnyynnnnk',
      'knnnnnnyynnnkk',
      'kkkkkkkkkkkknk',
      'knnnnnyynnnknk',
      'knnnnnyynnnknk',
      'knwwwnyynnnknk',
      'knwwwnyynnnknk',
      'knnnnnyynnnknk',
      'knnnnnyynnnkk.',
      'kkkkkkkkkkkkk.'
    ],
    colours: { n: '#c8925a' }
  },
  postbox: {
    group: 'Post and paperwork', says: 'a red postbox',
    rows: [
      '...kkkkkk...',
      '..krrrrrrk..',
      '.krrrrrrrrk.',
      '.kRRRRRRRRk.',
      '.krkkkkkkrk.',
      '.krrrrrrrrk.',
      '.krryyyyrrk.',
      '.krrrrrrrrk.',
      '.krrrrrrrrk.',
      '.krrrrrrrrk.',
      '.krrrrrrrrk.',
      '.krrrrrrrrk.',
      '.krrrrrrrrk.',
      '.kRRRRRRRRk.',
      'kkkkkkkkkkkk',
      'kRRRRRRRRRRk',
      'kkkkkkkkkkkk'
    ]
  },
  form: {
    group: 'Post and paperwork', says: 'a form on a clipboard, to fill in',
    rows: [
      '....kkkk....',
      'kkkkeeeekkkk',
      'knwwkkkkwwnk',
      'knwwwwwwwwnk',
      'knwkwweeewnk',
      'knwwwwwwwwnk',
      'knwkwweeewnk',
      'knwwwwwwwwnk',
      'knwkwweeewnk',
      'knwwwwwwwwnk',
      'knwwwwwbbwnk',
      'knwwwwbwwwnk',
      'knnnnnnnnnnk',
      'kkkkkkkkkkkk'
    ],
    colours: { n: '#b07a45' }
  },
  passport: {
    group: 'Post and paperwork', says: 'a passport',
    rows: [
      'kkkkkkkkkk',
      'kmmmmmmmmk',
      'kmmmmmmmmk',
      'kmmmyymmmk',
      'kmmyyyymmk',
      'kmmmyymmmk',
      'kmmmmmmmmk',
      'kmyyyyyymk',
      'kmmmmmmmmk',
      'kmmmmmmmmk',
      'kkkkkkkkkk'
    ],
    colours: { m: '#7a1f3d' }
  },
  // ----- money
  banknote: {
    group: 'Money', says: 'a banknote: cash',
    rows: [
      'kkkkkkkkkkkkkkkk',
      'kGggggggggggggGk',
      'kgggGGggggyyyygk',
      'kggGggGgggyyyygk',
      'kggGggGgggyyyygk',
      'kgggGGggggggggGk',
      'kGggggggggggggGk',
      'kkkkkkkkkkkkkkkk'
    ]
  },
  wallet: {
    group: 'Money', says: 'a wallet or a purse',
    rows: [
      '..kkkkkkkkkkk.',
      '.kGGGGGGGGGGGk',
      'knnnnnnnnnnnnk',
      'knnnnnnnnnnnnk',
      'knnnnnnnnkkkkk',
      'knnnnnnnkyyyyk',
      'knnnnnnnkyyyyk',
      'knnnnnnnnkkkkk',
      'knnnnnnnnnnnnk',
      'kNNNNNNNNNNNNk',
      'kkkkkkkkkkkkkk'
    ],
    colours: { G: '#3fa34d' }
  },
  card: {
    group: 'Money', says: 'a bank card',
    rows: [
      'kkkkkkkkkkkkkk',
      'kbbbbbbbbbbbbk',
      'kkkkkkkkkkkkkk',
      'kbbbbbbbbbbbbk',
      'kbyybbbbbbbbbk',
      'kbyybbbbbbbbbk',
      'kbbbbbbbbbbbbk',
      'kbwwbwwbwwbbbk',
      'kkkkkkkkkkkkkk'
    ]
  },
  'piggy-bank': {
    group: 'Money', says: 'a piggy bank: savings',
    rows: [
      '......kkk.......',
      '....kkkkkkk.....',
      '..kkpppkkpppk...',
      '.kpppppppppppk..',
      'kpppkppppppppkk.',
      'kpppppppppppppkk',
      'kppppppppppppkpk',
      'kppppppppppppkpk',
      '.kppppppppppppk.',
      '..kpkkkkkkkkpk..',
      '..kpk......kpk..',
      '..kkk......kkk..'
    ],
    colours: { p: '#ff9fc4' }
  },
  cashpoint: {
    group: 'Money', says: 'a cash machine in a wall',
    rows: [
      'kkkkkkkkkkkkkkkk',
      'keeeeeeeeeeeeeek',
      'kekkkkkkkkkkkkek',
      'kektttttttttttek',
      'kektkkkktkkkttek',
      'kektttttttttttek',
      'kekkkkkkkkkkkkek',
      'keeeeeeeeeeeeeek',
      'keekwkwkwkeeeeek',
      'keekwkwkwkeeeeek',
      'keekwkwkwkeeeeek',
      'keeeeeeeeeeeeeek',
      'keeekkkkkkkkeeek',
      'keeekGGGGGGkeeek',
      'keeeeeeeeeeeeeek',
      'kkkkkkkkkkkkkkkk',
      'kEEEEEEEEEEEEEEk',
      'kkkkkkkkkkkkkkkk'
    ],
    colours: { E: '#6f87a3', G: '#3fa34d' }
  },
  receipt: {
    group: 'Money', says: 'a receipt from a till',
    rows: [
      'kkkkkkkkkk',
      'kwwwwwwwwk',
      'kwkkkkkkwk',
      'kwwwwwwwwk',
      'kweeeweewk',
      'kwwwwwwwwk',
      'kweeewweek',
      'kwwwwwwwwk',
      'kweeeweewk',
      'kwwwwwwwwk',
      'kwkkkwkkwk',
      'kwwwwwwwwk',
      'kwkwkwkwkk',
      'k.k.k.k.k.'
    ]
  },
  // ----- energy and the home
  'gas-meter': {
    group: 'Energy and the home', says: 'a gas meter, with its numbers',
    rows: [
      'kkkkkkkkkkkkkk',
      'keeeeeeeeeeeek',
      'kekkkkkkkkkkek',
      'kekwkwkwkwkkek',
      'kekwkwkwkwkkek',
      'kekkkkkkkkkkek',
      'keeeeeeeeeeeek',
      'keeyyyyyyyyeek',
      'keeyyyyyyyyeek',
      'keeyyyyyyyyeek',
      'keeeeeeeeeeeek',
      'kkkkkkkkkkkkkk',
      '...kOOk..kOOk.',
      '...kOOk..kOOk.',
      '...kOOk..kOOk.'
    ],
    colours: { e: '#c9ced6', y: '#e8c64a', O: '#c98a12' }
  },
  'electric-meter': {
    group: 'Energy and the home', says: 'an electricity meter, with its numbers',
    rows: [
      'kkkkkkkkkkkk',
      'keeeeeeeeeek',
      'kekkkkkkkkek',
      'kekwkwkwkkek',
      'kekwkwkwkkek',
      'kekkkkkkkkek',
      'keeeeeeeeeek',
      'keeeyyyeeeek',
      'keeeeyyeeeek',
      'keeeyyeeeeek',
      'keeeeeeeeeek',
      'kkkkkkkkkkkk'
    ]
  },
  boiler: {
    group: 'Energy and the home', says: 'a boiler: heating and hot water',
    rows: [
      'kkkkkkkkkkkkkk',
      'kwwwwwwwwwwwwk',
      'kwkkkkkkwwwwwk',
      'kwkttttkwgwrwk',
      'kwkkkkkkwwwwwk',
      'kwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwk',
      'kwwwwkkkkwwwwk',
      'kwwwwkookwwwwk',
      'kwwwwkoykwwwwk',
      'kwwwwkkkkwwwwk',
      'kkkkkkkkkkkkkk',
      '...kek..kek...',
      '...kek..kek...'
    ]
  },
  radiator: {
    group: 'Energy and the home', says: 'a radiator, warm',
    rows: [
      '.kkkkkkkkkkkkkkk.',
      'kwkwkwkwkwkwkwkwk',
      'kwkwkwkwkwkwkwkwk',
      'kwkwkwkwkwkwkwkwk',
      'kwkwkwkwkwkwkwkwk',
      'kwkwkwkwkwkwkwkwk',
      'kwkwkwkwkwkwkwkwk',
      'kwkwkwkwkwkwkwkwk',
      '.kkkkkkkkkkkkkkk.',
      '..kk.........kk..'
    ]
  },
  socket: {
    group: 'Energy and the home', says: 'a plug socket in the wall',
    rows: [
      'kkkkkkkkkk',
      'kwwwwwwwwk',
      'kwwwkkwwwk',
      'kwwwkkwwwk',
      'kwwwwwwwwk',
      'kwkkwwkkwk',
      'kwkkwwkkwk',
      'kwwwwwwwwk',
      'kkkkkkkkkk'
    ]
  },
  // ----- at home
  house: {
    group: 'At home', says: 'a house: home',
    rows: [
      '.......kkkkkkkkkkkk..kkk...',
      '......krrrrrrrrrrrrk.kek...',
      '.....krrrrrrrrrrrrrrkkek...',
      '....krrrrrrrrrrrrrrrrkek...',
      '...krrrrrrrrrrrrrrrrrrkk...',
      '..krrrrrrrrrrrrrrrrrrrrk...',
      '.kRRRRRRRRRRRRRRRRRRRRRRk..',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk.',
      '.kccccccccccccccccccccccck.',
      '.kckkkkkkcccccccckkkkkkkck.',
      '.kckbbwbkcccccccckbbwbkckk.',
      '.kckbwbbkcccccccckbwbbkcck.',
      '.kckkkkkkcccccccckkkkkkcck.',
      '.kcccccccckkkkkcccccccccck.',
      '.kcccccccckrrrkcccccccccck.',
      '.kcccccccckrrrkcccccccccck.',
      '.kcccccccckrrykcccccccccck.',
      '.kcccccccckrrrkcccccccccck.',
      '.kcccccccckrrrkcccccccccck.',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkk'
    ]
  },
  flats: {
    group: 'At home', says: 'a block of flats',
    rows: [
      'kkkkkkkkkkkkkkkkkkkk',
      'keeeeeeeeeeeeeeeeeek',
      'kekkkekkkekkkekkkeek',
      'kekbkekbkekbkekbkeek',
      'kekkkekkkekkkekkkeek',
      'keeeeeeeeeeeeeeeeeek',
      'kekkkekkkekkkekkkeek',
      'kekbkekykekbkekbkeek',
      'kekkkekkkekkkekkkeek',
      'keeeeeeeeeeeeeeeeeek',
      'kekkkekkkekkkekkkeek',
      'kekbkekbkekbkekykeek',
      'kekkkekkkekkkekkkeek',
      'keeeeeeeeeeeeeeeeeek',
      'kekkkekkkekkkekkkeek',
      'kekbkekbkekbkekbkeek',
      'kekkkekkkekkkekkkeek',
      'keeeeeeekkkkeeeeeeek',
      'keeeeeeekbbkeeeeeeek',
      'keeeeeeekbbkeeeeeeek',
      'kkkkkkkkkkkkkkkkkkkk'
    ],
    colours: { e: '#b8a890' }
  },
  door: {
    group: 'At home', says: 'a front door',
    rows: [
      'kkkkkkkkkkkk',
      'kbbbbbbbbbbk',
      'kbkkkkkkkkbk',
      'kbkbbbbbbkbk',
      'kbkbbbbbbkbk',
      'kbkkkkkkkkbk',
      'kbbbbbbbbbbk',
      'kbbbkkkkbbbk',
      'kbbbbbbbbbbk',
      'kbbbbbbbbyyk',
      'kbbbbbbbbyyk',
      'kbkkkkkkkkbk',
      'kbkbbbbbbkbk',
      'kbkbbbbbbkbk',
      'kbkkkkkkkkbk',
      'kbbbbbbbbbbk',
      'kkkkkkkkkkkk'
    ],
    colours: { b: '#2f7d5a' }
  },
  sofa: {
    group: 'At home', says: 'a sofa',
    rows: [
      '...kkkkkkkkkkkkkkkk...',
      '..kppppppppppppppppk..',
      '..kppppppppppppppppk..',
      '..kppppppppppppppppk..',
      'kkkppppppppppppppppkkk',
      'kppkkkkkkkkkkkkkkkkppk',
      'kppkppppppppkpppppkppk',
      'kppkppppppppkpppppkppk',
      'kpppppppppppppppppppPk',
      'kPPPPPPPPPPPPPPPPPPPPk',
      'kkkkkkkkkkkkkkkkkkkkkk',
      '.kk................kk.'
    ],
    colours: { p: '#c0504d', P: '#923a37' }
  },
  kettle: {
    group: 'At home', says: 'a kettle: a cup of tea',
    rows: [
      '.e...e............',
      'e...e.............',
      '.e...e............',
      '........kkk.......',
      '......kkkkkkk.....',
      '.....krrrrrrrkkkk.',
      'k...krrrrrrrrrk..k',
      'kk..krrrrwrrrrk..k',
      'krk.krrrwwrrrrk..k',
      '.krkkrrrrrrrrrk..k',
      '..krrrrrrrrrrrkkkk',
      '...krrrrrrrrrrk...',
      '...kRRRRRRRRRRk...',
      '...kkkkkkkkkkkk...'
    ]
  },
  tv: {
    group: 'At home', says: 'a television',
    rows: [
      'kkkkkkkkkkkkkkkkkk',
      'kbbbbbbbbbbbbbbbbk',
      'kbBBBBBBBBBBBBBBbk',
      'kbBBtBBBBBBBBBBBbk',
      'kbBttBBBBBBBBBBBbk',
      'kbBBBBBBBBBBBBBBbk',
      'kbBBBBBBBBBBBBBBbk',
      'kbBBBBBBBBBBBBBBbk',
      'kbBBBBBBBBBBBBBBbk',
      'kbbbbbbbbbbbbbbbbk',
      'kkkkkkkkkkkkkkkkkk',
      '.......kkkk.......',
      '.....kkkkkkkk.....'
    ],
    colours: { b: '#2b2b33', B: '#3a5f8a' }
  },
  desk: {
    group: 'At home', says: 'a desk or a table',
    rows: [
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnnnnnnnnnk',
      'kNNNNNNNNNNNNNNNNNNNNNNk',
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      '.kNk................kNk.',
      '.kNk................kNk.',
      '.kNk................kNk.',
      '.kNk................kNk.',
      '.kNk................kNk.',
      '.kkk................kkk.'
    ]
  },
  // ----- computers and phones
  laptop: {
    group: 'Computers and phones', says: 'a laptop',
    rows: [
      '...kkkkkkkkkkkkkk...',
      '...keeeeeeeeeeeek...',
      '...kebbbbbbbbbbek...',
      '...kebwwwwbbbbbek...',
      '...kebbbbbbbbbbek...',
      '...kebwwwbbbbbbek...',
      '...kebbbbbbbbbbek...',
      '...kebbbbbbbbbbek...',
      '...keeeeeeeeeeeek...',
      'kkkkkkkkkkkkkkkkkkkk',
      'keeeeeeeeeeeeeeeeeek',
      'keeeeeeekkkkeeeeeeek',
      '.kkkkkkkkkkkkkkkkkk.'
    ]
  },
  phone: {
    group: 'Computers and phones', says: 'a mobile phone',
    rows: [
      'kkkkkkkkk',
      'kkkkekkkk',
      'kbbbbbbbk',
      'kbwwwwbbk',
      'kbbbbbbbk',
      'kbttttbbk',
      'kbbbbbbbk',
      'kbwwwbbbk',
      'kbbbbbbbk',
      'kbbbbbbbk',
      'kkkkkkkkk',
      'kkkwwwkkk',
      'kkkkkkkkk'
    ]
  },
  computer: {
    group: 'Computers and phones', says: 'a computer on a desk',
    rows: [
      'kkkkkkkkkkkkkkkkkk',
      'keeeeeeeeeeeeeeeek',
      'kebbbbbbbbbbbbbbek',
      'kebwwwwwwbbbbbbbek',
      'kebbbbbbbbbbbbbbek',
      'kebwwwwbbbbbbbbbek',
      'kebbbbbbbbbbbbbbek',
      'kebbbbbbbbbbbbbbek',
      'kebbbbbbbbbbbbbbek',
      'keeeeeeeeeeeeeeeek',
      'kkkkkkkkkkkkkkkkkk',
      '.......keek.......',
      '.......keek.......',
      '.....kkkkkkkk.....',
      '.....keeeeeek.....',
      '.....kkkkkkkk.....'
    ]
  },
  router: {
    group: 'Computers and phones', says: 'a broadband hub or router, its lights on',
    rows: [
      '..k..........k..',
      '..k..........k..',
      '..k..........k..',
      'kkkkkkkkkkkkkkkk',
      'kwwwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwwwk',
      'kwbwgwgwgwwwwwwk',
      'kwwwwwwwwwwwwwwk',
      'kkkkkkkkkkkkkkkk',
      '.kk..........kk.'
    ]
  },
  server: {
    group: 'Computers and phones', says: 'a server: a computer somewhere else, such as the cloud',
    rows: [
      'kkkkkkkkkkkk',
      'kBBBBBBBBBBk',
      'kBggBeeeeeBk',
      'kBBBBBBBBBBk',
      'kkkkkkkkkkkk',
      'kBBBBBBBBBBk',
      'kBgyBeeeeeBk',
      'kBBBBBBBBBBk',
      'kkkkkkkkkkkk',
      'kBBBBBBBBBBk',
      'kBggBeeeeeBk',
      'kBBBBBBBBBBk',
      'kkkkkkkkkkkk',
      'kBBBBBBBBBBk',
      'kBgBBeeeeeBk',
      'kBBBBBBBBBBk',
      'kkkkkkkkkkkk',
      '.kk......kk.'
    ],
    colours: { B: '#2b3a52' }
  },
  printer: {
    group: 'Computers and phones', says: 'a printer',
    rows: [
      '....kkkkkkkk....',
      '....kwwwwwwk....',
      '....kwwwwwwk....',
      'kkkkkkkkkkkkkkkk',
      'keeeeeeeeeeeeeek',
      'keeeeeeeeeeegeek',
      'keeeeeeeeeeeeeek',
      'kkkkkkkkkkkkkkkk',
      'keeekwwwwwwkeeek',
      'keeekweeeewkeeek',
      'kkkkkwwwwwwkkkkk'
    ]
  },
  padlock: {
    group: 'Computers and phones', says: 'a padlock: locked, kept safe, a password',
    rows: [
      '...kkkkkk...',
      '..kkeeeekk..',
      '..kek..kek..',
      '..kek..kek..',
      'kkkkkkkkkkkk',
      'kyyyyyyyyyyk',
      'kyyyykkyyyyk',
      'kyyyykkyyyyk',
      'kyyyyykyyyyk',
      'kyyyyyyyyyyk',
      'kOOOOOOOOOOk',
      'kkkkkkkkkkkk'
    ],
    colours: { O: '#c98a12' }
  },
  mast: {
    group: 'Computers and phones', says: 'a phone mast: the mobile signal',
    rows: [
      '.....kk.....',
      '....kwwk....',
      '.....kk.....',
      '.....kk.....',
      '...kkkkkk...',
      '....kkkk....',
      '....k..k....',
      '...kk..kk...',
      '...k.kk.k...',
      '...k.kk.k...',
      '..kk....kk..',
      '..k.kkkk.k..',
      '..k.k..k.k..',
      '.kk......kk.',
      '.k.kkkkkk.k.',
      '.k.k....k.k.',
      'kk........kk',
      'k..........k'
    ]
  },
  // ----- health
  pills: {
    group: 'Health', says: 'medicine in a bottle',
    rows: [
      '.kkkkkkkk.',
      '.kwwwwwwk.',
      '.kkkkkkkk.',
      'kooooooook',
      'kowwwwwwok',
      'kowrrrrwok',
      'kowwwwwwok',
      'kowrrrrwok',
      'kowwwwwwok',
      'kooooooook',
      'kooooooook',
      '.kkkkkkkk.'
    ]
  },
  ambulance: {
    group: 'Health', says: 'an ambulance',
    rows: [
      '...........kk..............',
      '.kkkkkkkkkkbbkkkkk.........',
      '.kwwwwwwwwwwwwwwwwkk.......',
      '.kwwwwwwwwwwwwwwwwkbk......',
      '.kwwwwwwrrwwwwwwwwkbbk.....',
      '.kwwwwwrrrrwwwwwwwkbbbk....',
      '.kwwwwwwrrwwwwwwwwkkkkkkk..',
      '.kwwwwwwwwwwwwwwwwwwwwwwk..',
      '.kyyyyyyyyyyyyyyyyyyyyyyyk.',
      '.kgggyyygggyyygggyyygggyyk.',
      '.kwwwwwwwwwwwwwwwwwwwwwwwk.',
      '.kwwkkkwwwwwwwwwwwkkkwwwwk.',
      '.kkkkekkkkkkkkkkkkkekkkkkk.',
      '...kkkkk.........kkkkk.....',
      '....kkk...........kkk......'
    ]
  },
  hospital: {
    group: 'Health', says: 'a hospital or a doctors’ surgery',
    rows: [
      '..........kkkkkk..........',
      '..........kwrrwk..........',
      '..........krrrrk..........',
      '..........kwrrwk..........',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kwwwwwwwwwwwwwwwwwwwwwwwwk',
      'kwkkkwkkkwkkkwkkkwkkkwwwwk',
      'kwkbkwkbkwkbkwkbkwkbkwwwwk',
      'kwkkkwkkkwkkkwkkkwkkkwwwwk',
      'kwwwwwwwwwwwwwwwwwwwwwwwwk',
      'kwkkkwkkkwkkkwkkkwkkkwwwwk',
      'kwkbkwkbkwkbkwkbkwkbkwwwwk',
      'kwkkkwkkkwkkkwkkkwkkkwwwwk',
      'kwwwwwwwwwwwwwwwwwwwwwwwwk',
      'kwwwwwwwwwkkkkkkwwwwwwwwwk',
      'kwwwwwwwwwkttttkwwwwwwwwwk',
      'kwwwwwwwwwkttttkwwwwwwwwwk',
      'kwwwwwwwwwkttttkwwwwwwwwwk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk'
    ]
  },
  bed: {
    group: 'Health', says: 'a bed',
    rows: [
      'kk......................',
      'knk.....................',
      'knkkkkkkkkkkkkkkkkkkkkk.',
      'knkwwwkbbbbbbbbbbbbbbbbk',
      'knkwwwkbbbbbbbbbbbbbbbbk',
      'knkkkkkkkkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnnnnnnnnnk',
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      'knk..................knk',
      'kkk..................kkk'
    ]
  },
  // ----- out and about
  bank: {
    group: 'Out and about', says: 'a bank',
    rows: [
      '...........kkkk...........',
      '.........kkcccckk.........',
      '.......kkcccccccckk.......',
      '.....kkcccccccccccckk.....',
      '...kkcccccccyycccccccckk..',
      '.kkcccccccccyycccccccccckk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '.kccck.kccck..kccck.kccck.',
      '..kck...kck....kck...kck..',
      '..kck...kck....kck...kck..',
      '..kck...kck....kck...kck..',
      '..kck...kck....kck...kck..',
      '..kck...kck....kck...kck..',
      '..kck...kck....kck...kck..',
      '.kccck.kccck..kccck.kccck.',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kcccccccccccccccccccccccck',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk'
    ]
  },
  shop: {
    group: 'Out and about', says: 'a shop',
    rows: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kcccccccccccccccccccccccck',
      'kcckkkkkkkkkkkkkkkkkkkkcck',
      'kckbbbbbbbbbbbbbbbbbbbbkck',
      'kcckkkkkkkkkkkkkkkkkkkkcck',
      'krwrwrwrwrwrwrwrwrwrwrwrwk',
      'krwrwrwrwrwrwrwrwrwrwrwrwk',
      '.krwrwrwrwrwrwrwrwrwrwrwk.',
      'kcccccccccccccccccccccccck',
      'kckkkkkkkkkkcckkkkkkkkkcck',
      'kck88888888kcckttttttkccck',
      'kck8yy8rr88kcckttttttkccck',
      'kck8yy8rr88kcckttttttkccck',
      'kck88888888kcckttttytkccck',
      'kckkkkkkkkkkcckttttttkccck',
      'kccccccccccccckttttttkccck',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk'
    ],
    colours: { 8: '#8fd3ff' }
  },
  school: {
    group: 'Out and about', says: 'a school',
    rows: [
      '............kk............',
      '............krrk..........',
      '............krrrk.........',
      '............kk............',
      '..........kkkkkk..........',
      '........kkRRRRRRkk........',
      '......kkRRRkkkkRRRkk......',
      '....kkRRRRkwkwkRRRRRkk....',
      '..kkRRRRRRkkkkkRRRRRRRkk..',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk',
      'krrrrrrrrrrrrrrrrrrrrrrrrk',
      'krkkkkrrkkkkrrkkkkrrkkkkrk',
      'krk88krrk88krrk88krrk88krk',
      'krkkkkrrkkkkrrkkkkrrkkkkrk',
      'krrrrrrrrrrkkkkrrrrrrrrrrk',
      'krkkkkrrrrrknnkrrrrrkkkkrk',
      'krk88krrrrrknnkrrrrrk88krk',
      'krkkkkrrrrrknnkrrrrrkkkkrk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk'
    ],
    colours: { r: '#b5654a', R: '#7a3b2e', 8: '#8fd3ff' }
  },
  'town-hall': {
    group: 'Out and about', says: 'the council: a town hall',
    rows: [
      '............kk............',
      '...........kwwk...........',
      '..........kwkwwk..........',
      '..........kwwkwk..........',
      '...........kwwk...........',
      '.........kkkkkkkk.........',
      '.........keeeeeeek........',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk',
      'keeeeeeeeeeeeeeeeeeeeeeeek',
      'kekkkekkkekkkkkkekkkekkkek',
      'kek8kek8keeeeeeek8kek8keek',
      'kek8kek8keeeeeeek8kek8keek',
      'kekkkekkkekkkkkkekkkekkkek',
      'keeeeeeeeeknnnnkeeeeeeeeek',
      'kekkkekkkeknnnnkekkkekkkek',
      'kek8kek8keknnnnkek8kek8kek',
      'kekkkekkkeknnnnkekkkekkkek',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk'
    ],
    colours: { e: '#d8cfb8', 8: '#8fd3ff' }
  },
  van: {
    group: 'Out and about', says: 'a van: a delivery, or an engineer coming round',
    rows: [
      '.kkkkkkkkkkkkkkkkkk.......',
      '.kwwwwwwwwwwwwwwwwkkk.....',
      '.kwwwwwwwwwwwwwwwwk88k....',
      '.kwwwwwwwwwwwwwwwwk888k...',
      '.kwwwwwwwwwwwwwwwwk8888k..',
      '.kwwwwwwwwwwwwwwwwkkkkkkk.',
      '.kwwwwwwwwwwwwwwwwwwwwwwk.',
      '.kttttttttttttttttttttttyk',
      '.kwwwwwwwwwwwwwwwwwwwwwwwk',
      '.kkkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkk..........kkkkk...',
      '...kkekk..........kkekk...',
      '....kkk............kkk....'
    ],
    colours: { 8: '#8fd3ff' }
  },
  // ----- time
  clock: {
    group: 'Time', says: 'a clock: a time, or waiting',
    rows: [
      '....kkkkkk....',
      '..kkwwwwwwkk..',
      '.kwwwwkwwwwwk.',
      '.kwwwwkwwwwwk.',
      'kwwwwwkwwwwwwk',
      'kwwwwwkwwwwwwk',
      'kwwwwwkkkkkwwk',
      'kwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwk',
      '.kwwwwwwwwwwk.',
      '.kwwwwwwwwwwk.',
      '..kkwwwwwwkk..',
      '....kkkkkk....'
    ]
  },
  calendar: {
    group: 'Time', says: 'a calendar: a date',
    rows: [
      '..kk.....kk...',
      'kkkkkkkkkkkkkk',
      'krrrrrrrrrrrrk',
      'krrrrrrrrrrrrk',
      'kkkkkkkkkkkkkk',
      'kwwwwwwwwwwwwk',
      'kwekwekwekwekk',
      'kwwwwwwwwwwwwk',
      'kwekwekwrkwekk',
      'kwwwwwwwwwwwwk',
      'kwekwekwekwwwk',
      'kwwwwwwwwwwwwk',
      'kkkkkkkkkkkkkk'
    ]
  },
  // ----- drawn after the first sheet, 26 Nov 2026
  car: {
    group: 'Out and about', says: 'a car',
    rows: [
      '........kkkkkkkkk.........',
      '.......k88888k8888k.......',
      '......k888888k88888k......',
      '.....k8888888k888888kk....',
      '.kkkkkkkkkkkkkkkkkkkkkkkk.',
      'kbbbbbbbbbbbkbbbbbbbbbbbbk',
      'kRbbbbbbbbbbkbbbbbbbbbbbyk',
      'kRbbbbbbbbbbkbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbbbbk',
      'kkbkkkkkbbbbbbbbbbbkkkkkkk',
      '..kkeeekk.........kkeeekk.',
      '..kkeeekk.........kkeeekk.',
      '...kkkkk...........kkkkk..'
    ],
    colours: { '8': '#8fd3ff' }
  },
  bus: {
    group: 'Out and about', says: 'a bus',
    rows: [
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
      'krrrrrrrrrrrrrrrrrrrrrrkkkkkkk',
      'krrrrrrrrrrrrrrrrrrrrrrkyyyyyk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kr888kk888kk888kk888kk8888888k',
      'kr888kk888kk888kk888kk8888888k',
      'kr888kk888kk888kk888kk8888888k',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'krrrrrrrrrrrrrrrrrk88krrrrrrrk',
      'kwwwwwwwwwwwwwwwwwk88kwwwwwwwk',
      'krrrrrrrrrrrrrrrrrk88krrrrrryk',
      'kRRRRRRRRRRRRRRRRRk88kRRRRRRRk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkeeekk..........kkeeekk...',
      '...kkeeekk..........kkeeekk...',
      '....kkkkk............kkkkk....'
    ],
    colours: { '8': '#8fd3ff' }
  },
  guitar: {
    group: 'Music and festivals', says: 'a guitar',
    rows: [
      '....kkkk....',
      '....kNNk....',
      '....kNNk....',
      '....kkkk....',
      '.....kk.....',
      '.....kk.....',
      '.....kk.....',
      '.....kk.....',
      '.....kk.....',
      '...kkkkkk...',
      '..koookook..',
      '..kookkook..',
      '..kookkook..',
      '...koookk...',
      '..koooooook.',
      '.kooookooooo',
      '.kooookkoook',
      '.koooooooooo',
      '.koookkkoook',
      '..kooooooook',
      '...kkkkkkkk.'
    ],
    colours: { o: '#d98a3a' }
  },
  drums: {
    group: 'Music and festivals', says: 'a drum kit',
    rows: [
      '....kkkk..........kkkk...',
      '...kyyyyk........kyyyyk..',
      '....kkkk..........kkkk...',
      '.....kk............kk....',
      '.....kk..kkkkkkk...kk....',
      '..kkkkkkkwwwwwwwkkkkkkk..',
      '..kwwwwwkwwwwwwwkwwwwwk..',
      '..krrrrrkwwwwwwwkrrrrrk..',
      '..krrrrrkrrrrrrrkrrrrrk..',
      '..kkkkkkkrrwwwrrkkkkkkk..',
      '...k...krrwwwwwrrk...k...',
      '...k...krrwwwwwrrk...k...',
      '...k...krrrwwwrrrk...k...',
      '..kkk..kkrrrrrrrkk..kkk..',
      '.........kkkkkkk.........'
    ]
  },
  keyboard: {
    group: 'Music and festivals', says: 'a keyboard: a piano you plug in',
    rows: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kBBBBBBBBBBBBBBBBBBBBBBBBBk',
      'kBgBrByBBBBBBBBBBBBBBkkkkBk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kwkwkkwkwkwkkwkwkkwkwkwkkwk',
      'kwkwkkwkwkwkkwkwkkwkwkwkkwk',
      'kwwwwwwwwwwwwwwwwwwwwwwwwwk',
      'kwkwkwkwkwkwkwkwkwkwkwkwkwk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..k....................k...',
      '..k....................k...',
      '.kkk..................kkk..'
    ],
    colours: { B: '#2b2b33' }
  },
  microphone: {
    group: 'Music and festivals', says: 'a microphone on a stand: singing, speaking',
    rows: [
      '...kkkk...',
      '..keeeek..',
      '..kekeek..',
      '..keekek..',
      '..keeeek..',
      '...kkkk...',
      '....kk....',
      '....kk....',
      '....kk....',
      '....kk....',
      '....kk....',
      '....kk....',
      '....kk....',
      '....kk....',
      '....kk....',
      '....kk....',
      '...kkkk...',
      '.kkk..kkk.',
      'kk......kk'
    ]
  },
  speaker: {
    group: 'Music and festivals', says: 'a loudspeaker: music, loud sound',
    rows: [
      'kkkkkkkkkkkk',
      'kBBBBBBBBBBk',
      'kBBBkkkkBBBk',
      'kBBkeeeekBBk',
      'kBBkekkekBBk',
      'kBBkeeeekBBk',
      'kBBBkkkkBBBk',
      'kBBBBBBBBBBk',
      'kBBkkkkkkBBk',
      'kBkeeeeeekBk',
      'kBkekkkkekBk',
      'kBkekeekekBk',
      'kBkekkkkekBk',
      'kBkeeeeeekBk',
      'kBBkkkkkkBBk',
      'kBBBBBBBBBBk',
      'kkkkkkkkkkkk'
    ],
    colours: { B: '#2b2b33' }
  },
  headphones: {
    group: 'Music and festivals', says: 'headphones: listening',
    rows: [
      '...kkkkkkkk...',
      '..kBBBBBBBBk..',
      '.kBkkkkkkkkBk.',
      '.kBk......kBk.',
      'kBk........kBk',
      'kBk........kBk',
      'kkkk......kkkk',
      'krrk......krrk',
      'krrk......krrk',
      'krrk......krrk',
      'kkkk......kkkk'
    ],
    colours: { B: '#2b2b33' }
  },
  tent: {
    group: 'Music and festivals', says: 'a tent: camping, a festival',
    rows: [
      '.........kk.........',
      '.........kk.........',
      '........kggk........',
      '.......kgggGk.......',
      '......kggggGGk......',
      '.....kgggggGGGk.....',
      '....kggggkkGGGGk....',
      '...kgggggkkGGGGGk...',
      '..kgggggkNNkGGGGGk..',
      '.kgggggkNNNNkGGGGGk.',
      'kgggggkNNNNNNkGGGGGk',
      'kkkkkkkkkkkkkkkkkkkk'
    ],
    colours: { N: '#3a2a1a' }
  },
  'festival-stage': {
    group: 'Music and festivals', says: 'a festival stage, with its lights',
    rows: [
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kBBBBBBBBBBBBBBBBBBBBBBBBBBk',
      'kBkyykkkkkrrkkkkkkttkkkkyykB',
      'kBk..y....r........t...y..Bk',
      'kBk...y...r.......t...y...Bk',
      'kBk....y..r......t...y....Bk',
      'kBk.....y.r.....t...y.....Bk',
      'kBk......yr....t...y......Bk',
      'kBk.......................Bk',
      'kBk.......................Bk',
      'kBk.......................Bk',
      'kBk.......................Bk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      'kNNNNNNNNNNNNNNNNNNNNNNNNNNk',
      'kNNNNNNNNNNNNNNNNNNNNNNNNNNk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkk'
    ],
    colours: { B: '#2b2b33', N: '#5a3418' }
  },
  wristband: {
    group: 'Music and festivals', says: 'a festival wristband: a ticket you wear',
    rows: [
      '...kkkkkkkk...',
      '..kppppppppk..',
      '.kpk......kpk.',
      'kpk........kpk',
      'kpk........kkk',
      'kpk........kwy',
      'kpk........kkk',
      '.kpk......kpk.',
      '..kppppppppk..',
      '...kkkkkkkk...'
    ]
  },
  bunting: {
    group: 'Music and festivals', says: 'bunting: flags for a party or a festival',
    rows: [
      'kk......................kk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkk',
      'k.krrk.kyyk.kbbk.kggk.kppk',
      '..krrk.kyyk.kbbk.kggk.kppk',
      '...kk...kk...kk...kk...kk.',
      '...k....k....k....k....k..'
    ]
  },
  ticket: {
    group: 'Music and festivals', says: 'a ticket: for a gig, a show, a match or a train',
    rows: [
      'kkkkkkkkkkkkkkkkk',
      'kyyyyyyyyyykyyyyk',
      'yykkkkkkkyyyyyyyy',
      'kyyyyyyyyyykyyyyk',
      'kykkkkkyyyyyyyyyk',
      'kyyyyyyyyyykyyyyk',
      'kkkkkkkkkkkkkkkkk'
    ]
  },
  plate: {
    group: 'Food and drink', says: 'a plate of food: a meal',
    rows: [
      '....kkkkkkkkk....',
      '..kkwwwwwwwwwkk..',
      '.kwwGGgwwnnnwwwk.',
      'kwwGgggwnnnnnyywk',
      'kwwwGgwwwnnnyyywk',
      '.kwwwwwwwwwwwwwk.',
      '..kkwwwwwwwwwkk..',
      '....kkkkkkkkk....'
    ]
  },
  mug: {
    group: 'Food and drink', says: 'a mug of tea or coffee',
    rows: [
      '...e..e.....',
      '..e..e......',
      '...e..e.....',
      'kkkkkkkkk...',
      'kwwwwwwwkkk.',
      'kwrrwwwwk.k.',
      'kwrrwwwwk.k.',
      'kwwwwwwwkkk.',
      'kwwwwwwwk...',
      '.kkkkkkk....'
    ]
  },
  pizza: {
    group: 'Food and drink', says: 'a pizza',
    rows: [
      '....kkkkkkkk....',
      '..kkyyyyyyyykk..',
      '.kyyrryyyyrryyk.',
      'kyyyrryyggyrryyk',
      'kyggyyyyggyyyyyk',
      'kyggyyrryyyyggyk',
      'kyyyyyrryyyyggyk',
      '.kyrryyyyyrryyk.',
      '..kkyyyyyyyykk..',
      '....kkkkkkkk....'
    ],
    colours: { y: '#f0c060' }
  },
  burger: {
    group: 'Food and drink', says: 'a burger',
    rows: [
      '...kkkkkkkk...',
      '.kkooooooookk.',
      'koowoooowooooo',
      'kkkkkkkkkkkkkk',
      'kggggggggggggk',
      'kyyyyyyyyyyyyk',
      'kNNNNNNNNNNNNk',
      'kkkkkkkkkkkkkk',
      'kooooooooooooo',
      '.kkkkkkkkkkkk.'
    ],
    colours: { o: '#d99a4a', N: '#6a3a1a' }
  },
  cake: {
    group: 'Food and drink', says: 'a birthday cake',
    rows: [
      '...y...y...y...',
      '...r...r...r...',
      '...k...k...k...',
      '.kkkkkkkkkkkkk.',
      'kwwwwwwwwwwwwwk',
      'kwpwwpwwwpwwpwk',
      'kpppppppppppppp',
      'kppppppppppppkk',
      'kwwwwwwwwwwwwwk',
      'kppppppppppppkk',
      'kkkkkkkkkkkkkkk',
      'eeeeeeeeeeeeeee'
    ],
    colours: { p: '#ff9fc4' }
  },
  'ice-cream': {
    group: 'Food and drink', says: 'an ice cream',
    rows: [
      '...kkkk...',
      '..kppppk..',
      '.kppppppk.',
      '.kwwwwwwk.',
      'kwwwwwwwwk',
      'kkkkkkkkkk',
      '.kyoyoyok.',
      '.koyoyoyk.',
      '..kyoyok..',
      '..koyoyk..',
      '...kyok...',
      '...kkkk...'
    ],
    colours: { p: '#ff9fc4', y: '#f0c060', o: '#c98a3a' }
  },
  fridge: {
    group: 'In the kitchen', says: 'a fridge',
    rows: [
      'kkkkkkkkkkkk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwkwk',
      'kwwwwwwwwkwk',
      'kwwwwwwwwwwk',
      'kkkkkkkkkkkk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwkwk',
      'kwwwwwwwwkwk',
      'kwwwwwwwwkwk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwwwk',
      'kkkkkkkkkkkk',
      '.kk......kk.'
    ]
  },
  cooker: {
    group: 'In the kitchen', says: 'a cooker: an oven and hob',
    rows: [
      '.kk..kk..kk..kk.',
      'kkkkkkkkkkkkkkkk',
      'keeeeeeeeeeeeeek',
      'kekkekkekkekkeek',
      'kkkkkkkkkkkkkkkk',
      'kwwwwwwwwwwwwwwk',
      'kwkkkkkkkkkkkkwk',
      'kwkBBBBBBBBBBkwk',
      'kwkBBooBBBBBBkwk',
      'kwkBBBBBBBBBBkwk',
      'kwkkkkkkkkkkkkwk',
      'kwwwwwwwwwwwwwwk',
      'kkkkkkkkkkkkkkkk'
    ],
    colours: { B: '#2b2b33' }
  },
  'washing-machine': {
    group: 'In the kitchen', says: 'a washing machine',
    rows: [
      'kkkkkkkkkkkkkk',
      'kwwwwwwwwwkgwk',
      'kwekeeewwwwwwk',
      'kkkkkkkkkkkkkk',
      'kwwwwkkkkwwwwk',
      'kwwwkbbbbkwwwk',
      'kwwkbtbbbbkwwk',
      'kwwkbbtbbbkwwk',
      'kwwkbbbbbbkwwk',
      'kwwwkbbbbkwwwk',
      'kwwwwkkkkwwwwk',
      'kwwwwwwwwwwwwk',
      'kkkkkkkkkkkkkk'
    ]
  },
  briefcase: {
    group: 'Work and tools', says: 'a briefcase: work, an office job',
    rows: [
      '.....kkkkkk.....',
      '.....kk..kk.....',
      'kkkkkkkkkkkkkkkk',
      'knnnnnnnnnnnnnnk',
      'knnnnnnyynnnnnnk',
      'kNNNNNNyyNNNNNNk',
      'knnnnnnnnnnnnnnk',
      'knnnnnnnnnnnnnnk',
      'knnnnnnnnnnnnnnk',
      'kkkkkkkkkkkkkkkk'
    ]
  },
  toolbox: {
    group: 'Work and tools', says: 'a toolbox: repairs, a trade',
    rows: [
      '.....kkkkkk.....',
      '.....k....k.....',
      '..kkkkkkkkkkkk..',
      '.krrrrrrrrrrrrk.',
      'kkkkkkkkkkkkkkkk',
      'krrrrrrrrrrrrrrk',
      'krrrrrrkkrrrrrrk',
      'krrrrrrkkrrrrrrk',
      'kRRRRRRRRRRRRRRk',
      'kkkkkkkkkkkkkkkk'
    ]
  },
  spanner: {
    group: 'Work and tools', says: 'a spanner: fixing something',
    rows: [
      'kk....kk',
      'kek..kek',
      'keekkeek',
      '.keeeek.',
      '..keek..',
      '..keek..',
      '..keek..',
      '..keek..',
      '..keek..',
      '..keek..',
      '.keeeek.',
      'keekkeek',
      'kek..kek',
      'kk....kk'
    ]
  },
  ladder: {
    group: 'Work and tools', says: 'a ladder',
    rows: [
      'kk......kk',
      'kek....kek',
      'kekkkkkkek',
      'keeeeeeeek',
      'kekkkkkkek',
      'kek....kek',
      'kekkkkkkek',
      'keeeeeeeek',
      'kekkkkkkek',
      'kek....kek',
      'kekkkkkkek',
      'keeeeeeeek',
      'kekkkkkkek',
      'kek....kek',
      'kekkkkkkek',
      'keeeeeeeek',
      'kekkkkkkek',
      'kek....kek',
      'kek....kek',
      'kkk....kkk'
    ],
    colours: { e: '#c9ced6' }
  },
  suitcase: {
    group: 'Travel', says: 'a suitcase: a trip, a holiday',
    rows: [
      '.....kkkk.....',
      '.....k..k.....',
      '.kkkkkkkkkkkk.',
      'kbbbbbbbbbbbbk',
      'kbbkbbbbbbkbbk',
      'kbbkbbbbbbkbbk',
      'kbbkbbbbbbkbbk',
      'kbbkbbbbbbkbbk',
      'kbbkbbbbbbkbbk',
      'kbbbbbbbbbbbbk',
      '.kkkkkkkkkkkk.',
      '.kk........kk.'
    ],
    colours: { b: '#2f7d9a' }
  },
  bike: {
    group: 'Travel', says: 'a bike',
    rows: [
      '..........kkkk.......',
      '.....kkk....k........',
      '......k.....k........',
      '.....kkkkkkkk........',
      '....kkk.....kk.......',
      '..kkkkkkk..kkkkkk....',
      '.k..k..k.kk.k.k..k...',
      'k...k...kk.k...k...k.',
      'k..kkk..k..k..kkk..k.',
      'k...k...k..k...k...k.',
      '.k..k..k....k..k..k..',
      '..kkkkk......kkkkk...'
    ]
  },
  train: {
    group: 'Travel', says: 'a train',
    rows: [
      '..kkkkkkkkkkkkkkkkkkkkkkkk..',
      '.kggggggggggggggggggggggkk..',
      'kggk88kk88kk88kk88kk88gg8k..',
      'kggk88kk88kk88kk88kk88gg88k.',
      'kggkkkkkkkkkkkkkkkkkkkkgg8k.',
      'kyyyyyyyyyyyyyyyyyyyyyyyyyyk',
      'kggggggggggggggggggggggggggk',
      'kggggggggggggggggggggggggggk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kkkk..kkkk......kkkk..kkkk',
      '..keek..keek......keek..keek',
      '...kk....kk........kk....kk.'
    ],
    colours: { '8': '#8fd3ff' }
  },
  taxi: {
    group: 'Travel', says: 'a taxi',
    rows: [
      '...........kkkk...........',
      '...........kyyk...........',
      '........kkkkkkkkk.........',
      '.......k88888k8888k.......',
      '......k888888k88888k......',
      '.kkkkkkkkkkkkkkkkkkkkkkkk.',
      'kBBBBBBBBBBBkBBBBBBBBBBBBk',
      'kRBBBBBBBBBBkBBBBBBBBBBByk',
      'kBBBBBBBBBBBBBBBBBBBBBBBBk',
      'kkBkkkkkBBBBBBBBBBBkkkkkkk',
      '..kkeeekk.........kkeeekk.',
      '...kkkkk...........kkkkk..'
    ],
    colours: { '8': '#8fd3ff', B: '#2b2b33' }
  },
  plane: {
    group: 'Travel', says: 'an aeroplane: flying',
    rows: [
      '...kk.....................',
      '...kbk....................',
      '...kbbk...................',
      '...kbbbk..........kkk.....',
      '.kkkkkkkkkkkkkkkkkwwwkk...',
      'kwwwwwwwwwwwwwwwwwwwwwwkk.',
      'kwkbkbkbkbkbkbkbkbkbkk8wk.',
      'kwwwwwwwwwwwwwwwwwwwwwwwwk',
      '.kkkkkkkkkkkwwwwkkkkkkkkk.',
      '...........kwwwk..........',
      '..........kwwwk...........',
      '..........kkkk............'
    ],
    colours: { '8': '#8fd3ff' }
  },
  football: {
    group: 'Sport and play', says: 'a football',
    rows: [
      '...kkkkkk...',
      '..kwwkkwwk..',
      '.kwwkkkkwwk.',
      'kwwwwkkwwwwk',
      'kkwwwwwwwwkk',
      'kkkwwwwwwkkk',
      'kkwwwwwwwwkk',
      'kwwwwkkwwwwk',
      '.kwwkkkkwwk.',
      '..kwwkkwwk..',
      '...kkkkkk...'
    ]
  },
  'games-controller': {
    group: 'Sport and play', says: 'a games controller: video games',
    rows: [
      '..kkkkkkkkkkkkk..',
      '.kBBBBBBBBBBBBBk.',
      'kBBkBBBBBBBBrBBBk',
      'kBkkkBBBBBBgBbBBk',
      'kBBkBBBkBkBBBrBBk',
      'kBBBBBBBBBBBBBBBk',
      'kBBBBkkkkkkkBBBBk',
      '.kBBk.......kBBk.',
      '..kk.........kk..'
    ],
    colours: { B: '#4a4f5a' }
  },
  goal: {
    group: 'Sport and play', says: 'a football goal and its net',
    rows: [
      'kkkkkkkkkkkkkkkkkkkkkk',
      'kwwwwwwwwwwwwwwwwwwwwk',
      'kwekekekekekekekekekwk',
      'kwkekekekekekekekekewk',
      'kwekekekekekekekekekwk',
      'kwkekekekekekekekekewk',
      'kwekekekekekekekekekwk',
      'kwkekekekekekekekekewk',
      'kwekekekekekekekekekwk',
      'kwkekekekekekekekekewk',
      'kwk................kwk',
      'kkk................kkk'
    ]
  },
  tree: {
    group: 'Nature and the garden', says: 'a tree',
    rows: [
      '......kkkkkk......',
      '....kkggggggkk....',
      '...kggggggGgggk...',
      '..kgggGggggggggk..',
      '.kggggggggggGgggk.',
      '.kgggggGggggggggk.',
      'kgggGgggggggGggggk',
      'kggggggggGggggggGk',
      '.kgggGggggggggggk.',
      '..kkgggggggGggkk..',
      '....kkkknnkkkk....',
      '.......knnk.......',
      '.......knnk.......',
      '.......knnk.......',
      '......knnnnk......',
      '.....kkkkkkkk.....'
    ]
  },
  flowers: {
    group: 'Nature and the garden', says: 'flowers',
    rows: [
      '..kk.....kk.....kk..',
      '.kyyk...krrk...kppk.',
      'kyooyk.krrrrk.kpyypk',
      '.kyyk...krrk...kppk.',
      '..kk.....kk.....kk..',
      '..kg.....kg.....kg..',
      '.kgg....kgg.....kgk.',
      '..kg..kk.kg.kk..kg..',
      '..kgkkgk.kgkgk..kg..',
      '..kggg...kgg....kg..'
    ]
  },
  'plant-pot': {
    group: 'Nature and the garden', says: 'a plant in a pot',
    rows: [
      '...kk..kk...',
      '..kggkkggk..',
      '.kggggggggk.',
      '..kgggGggk..',
      '...kkggkk...',
      '....kggk....',
      'kkkkkkkkkkkk',
      'kooooooooook',
      '.koooooooook',
      '.kooooooook.',
      '..kooooook..',
      '..kkkkkkkk..'
    ],
    colours: { o: '#c8643a' }
  },
  umbrella: {
    group: 'Nature and the garden', says: 'an umbrella: rain',
    rows: [
      '.......kk.......',
      '....kkkkkkkk....',
      '..kkrrrrwwwwkk..',
      '.krrrrrwwwwwrrk.',
      'krrrrrwwwwwrrrrk',
      'kkkkkkkkkkkkkkkk',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '....kk.kk.......',
      '.....kkk........'
    ]
  },
  backpack: {
    group: 'School', says: 'a school bag',
    rows: [
      '....kkkkk....',
      '...kk...kk...',
      '..kkkkkkkkk..',
      '.kbbbbbbbbbk.',
      'kbbbbbbbbbbbk',
      'kbbkkkkkkkbbk',
      'kbkbbbbbbbkbk',
      'kbkbbyybbbkbk',
      'kbkkkkkkkkkbk',
      'kbbbbbbbbbbbk',
      'kBBBBBBBBBBBk',
      '.kkkkkkkkkkk.'
    ]
  },
  books: {
    group: 'School', says: 'a pile of books: reading, learning',
    rows: [
      '..kkkkkkkkkkkkk.',
      '..kbbbbbbbbbbbwk',
      '..kkkkkkkkkkkkkk',
      'kkkkkkkkkkkkkk..',
      'krrrrrrrrrrrrwk.',
      'kkkkkkkkkkkkkkk.',
      '.kkkkkkkkkkkkkkk',
      '.kgggggggggggggk',
      '.kggggggggggggwk',
      '.kkkkkkkkkkkkkkk'
    ]
  },
  balloons: {
    group: 'Celebrations', says: 'balloons: a party',
    rows: [
      '..kkk.....kkk...kkk.',
      '.krrrk...kyyyk.kbbbk',
      'krrwrrk.kyywyk.kbwbk',
      'krrrrrk.kyyyyk.kbbbk',
      'krrrrrk.kyyyyk..kbk.',
      '.krrrk...kyyyk...k..',
      '..kkk.....kkk....k..',
      '...k.......k....k...',
      '....k......k...k....',
      '.....k.....k..k.....',
      '......k....k.k......',
      '.......kk..kk.......',
      '.........kk.........'
    ]
  }
};

/** The things by what they are about, for the guides people and agents choose from. */
const THING_GROUPS = Object.entries(THINGS).reduce((groups, [name, thing]) => {
  (groups[thing.group] ??= []).push(name);
  return groups;
}, {});

return { PEOPLE, WEARS, personRows, TOPS, LEGS, THINGS, THING_GROUPS };
})();

__m['stage.js'] = (() => {
// The stage: a ready-made picture that shows something happening, not a sign for it. A place,
// a few things standing in it, and moves between them, each move landing on the words the
// narrator says: a letter flies from the bank to the house, a barrier rises, coins pile up.
// Plain data, like every other picture, so it is checked before it is played and nothing in
// it ever runs. Pure: no DOM. pictures.js draws it and checks it; pacing.mjs times its moves.
const { ICONS } = __m['icons.js'];
const { PEOPLE, personRows, THINGS, WEARS } = __m['library.js'];
const { PALETTE } = __m['palette.js'];

const INK = '#1a1a1a', CREAM = '#ebeac5', LIGHT = '#fdf6e3', GOLD = '#ffcc4d', TEAL = '#55d6be';
const RED = '#d63a3a', GREEN = '#3fa34d', NAVY = '#13203a';

/** Where the ground is, in picture pixels: things stand on it, and their labels sit under it. */
const GROUND = 146;
/** Where a thing in the air has its feet. */
const AIR = 62;

/** The places a stage can be, and what each is like, for whoever chooses one. */
const PLACES = {
  home: 'Indoors at home: a wall, a window and a wooden floor.',
  office: 'An office: a big window over the town, and a carpet.',
  surgery: 'A doctors\u2019 surgery or a hospital: a pale wall with a red cross, and a clean floor.',
  shop: 'Inside a shop: shelves of goods along the back.',
  school: 'A classroom: a blackboard and a wooden floor.',
  kitchen: 'A kitchen: tiles, cupboards and a worktop along the back.',
  bedroom: 'A bedroom at night: a window with the moon, and a rug.',
  cafe: 'A cafe: a counter, a menu board and a striped awning.',
  park: 'A park: trees, a path and a bench along the back.',
  festival: 'A festival field: tents, flags and a stage far off, at dusk.',
  station: 'A railway station: the platform edge, a clock and a train shelter.',
  outside: 'Outdoors by day: sky, sun and green hills.',
  street: 'A street by day: houses along the back and a pavement.',
  night: 'Outdoors at night: stars, a moon and dark hills.',
  sea: 'The seaside: sky, a strip of sand and the sea.',
  plain: 'A plain dark blue, for things that have no place.'
};

/** The spots a thing can stand in, left to right, and their middles. */
const SPOTS = { 'far-left': 36, left: 98, middle: 160, right: 222, 'far-right': 284 };
const SPOT_NAMES = Object.keys(SPOTS);
const SPOT_WIDTH = 62;
/** How far two things side by side may run into each other, in picture pixels, before it shows. */
const OVERLAP = 6;

/** How big a thing is drawn: picture pixels to one of its drawing's. One size of pixel throughout, and a big thing a little bigger. */
const SIZES = { medium: 3, big: 4 };

/** The cast who come back in every reel: Reelie, the film reel who presents. The people are in the library (woman, man, ...). */
const CAST = ['reelie'];

/** What each move shows, and what it takes, for whoever writes a stage (and for the checks). */
const MOVES = {
  arrive: { says: 'a thing drops in: it is not there until now', needs: ['who'] },
  send: { says: 'something small flies from one thing to another: a letter, money, a message (again: true sends it again and again)', needs: ['what', 'from', 'to'] },
  flow: { says: 'a steady stream of dots from one thing to another: power, data or money moving all the time', needs: ['from', 'to'] },
  wave: { says: 'a sound wave from one thing to another: a voice, a call', needs: ['from', 'to'] },
  block: { says: 'a red barrier rises between two things: nothing passes, and anything sent between them bounces back', needs: ['from', 'to'] },
  pile: { says: 'coins pile up beside a thing, as many as count (1 to 10): what it costs, small or tall', needs: ['on', 'count'] },
  meter: { says: 'a bar over a thing fills to `to` (0 to 1): waiting, progress, how full', needs: ['on'] },
  count: { says: 'a number over a thing counts up to `to`, with `before` (such as £) and `after` (such as " days")', needs: ['on', 'to'] },
  mark: { says: 'a badge pops up on a thing: tick, cross, question, warning, lock, clock, heart or star', needs: ['on', 'with'] },
  pulse: { says: 'rings spread out from a thing: it is ringing, working, switched on', needs: ['on'] },
  say: { says: 'a speech bubble over a thing, four words at most', needs: ['who', 'text'] },
  walk: { says: 'a thing walks to another spot', needs: ['who', 'to'] },
  leave: { says: 'a thing fades away', needs: ['who'] }
};
/** The badges a mark can be. */
const MARKS = ['tick', 'cross', 'question', 'warning', 'lock', 'clock', 'heart', 'star'];

/** The most things and moves a stage can have, the most words in a label and a bubble. */
const STAGE_MAX = { things: 6, moves: 6, label: 3, say: 4, coins: 10 };

/** How long after the one before a move comes, when nobody has said when (the service sets `at` from the voice). */
const EVERY = 1.6, FIRST = 0.8;

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** True for a name a thing can be: one of the cast, a person or a thing in the library, or an icon. */
const isThingName = (name) => CAST.includes(name) || Object.hasOwn(PEOPLE, name) || Object.hasOwn(THINGS, name) || Object.hasOwn(ICONS, name);

/** The rows a thing is drawn from: the library's own drawing, or the icon of that name. */
function drawingOf(name) {
  return PEOPLE[name] ?? THINGS[name] ?? (Object.hasOwn(ICONS, name) ? { rows: ICONS[name] } : null);
}

/** What a thing on a stage is drawn from: a person dressed as they are, or the library's drawing, or an icon's. */
const drawingFor = (th) => (Object.hasOwn(PEOPLE, th.is) ? { rows: personRows(th.is, th.wears ?? null) } : drawingOf(th.is));

/** How wide a thing is drawn, in picture pixels: 0 for one that cannot be drawn. */
function thingWidth(th) {
  const sc = SIZES[th.size] ?? SIZES.medium;
  if (CAST.includes(th.is)) return 14 * sc;
  const drawing = Array.isArray(th.rows) ? { rows: th.rows } : isThingName(th.is) ? drawingFor(th) : null;
  return drawing ? Math.max(0, ...drawing.rows.map((r) => String(r).length)) * sc : 0;
}

/** The keys a thing and each move may have. */
const THING_KEYS = ['id', 'is', 'rows', 'colours', 'spot', 'up', 'size', 'label', 'flip', 'skin', 'hair', 'wears'];

/** The most rows, and letters in a row, of a thing a reel draws itself. */
const OWN_MAX = { rows: 24, cols: 24 };

/** What a thing on a stage is drawn from: the reel's own rows, or the library's or an icon's. */
const thingDrawing = (th) => (Array.isArray(th.rows) ? { rows: th.rows, colours: th.colours ?? null } : drawingFor(th));
const MOVE_KEYS = ['do', 'cue', 'at', 'who', 'what', 'from', 'to', 'on', 'count', 'with', 'text', 'before', 'after', 'again'];

/**
 * Everything wrong with a stage picture, as messages for whoever wrote it, beyond its being an
 * object: [] when it can be played. `looks` checks a person's skin and hair (pictures.js).
 */
function stageProblems(p, looks = () => []) {
  const problems = [];
  if (!Object.hasOwn(PLACES, p.place)) problems.push(`picture.place must be one of: ${Object.keys(PLACES).join(', ')}`);
  if (!Array.isArray(p.things) || p.things.length < 1 || p.things.length > STAGE_MAX.things) {
    return [...problems, `picture.things must be a list of 1 to ${STAGE_MAX.things} things, such as [{ "id": "bank", "is": "bank", "spot": "left" }]`];
  }
  const ids = new Set(), taken = new Map();
  p.things.forEach((th, i) => {
    const where = `picture.things[${i}]`;
    if (!isPlain(th)) { problems.push(`${where} must be an object such as { "id": "bank", "is": "bank", "spot": "left" }`); return; }
    for (const key of Object.keys(th)) if (!THING_KEYS.includes(key)) problems.push(`${where}: a thing takes ${THING_KEYS.join(', ')}, not ${key}`);
    if (!isText(th.id) || ids.has(th.id)) problems.push(`${where} needs an id of its own, a short name the moves can use`);
    ids.add(th.id);
    if (th.rows !== undefined || th.colours !== undefined) {
      problems.push(...ownProblems(th, where));
    } else if (!isThingName(th.is)) problems.push(`${where}: "${th.is}" is not something the stage can draw; it can draw ${CAST.join(', ')}, the people and things in the library, and the icons`);
    if (!Object.hasOwn(SPOTS, th.spot)) { problems.push(`${where}.spot must be one of: ${SPOT_NAMES.join(', ')}`); return; }
    if (th.up !== undefined && typeof th.up !== 'boolean') problems.push(`${where}.up must be true or false`);
    if (th.flip !== undefined && typeof th.flip !== 'boolean') problems.push(`${where}.flip must be true or false`);
    if (th.rows !== undefined && th.is !== undefined) problems.push(`${where}: a thing is one from the library ("is") or drawn by the reel ("rows"), not both`);
    if (th.wears !== undefined && (!Object.hasOwn(PEOPLE, th.is) || !Object.hasOwn(WEARS, th.wears))) problems.push(`${where}.wears: only a person wears anything, and it is one of: ${Object.keys(WEARS).join(', ')}`);
    if (th.size !== undefined && !Object.hasOwn(SIZES, th.size)) problems.push(`${where}.size must be one of: ${Object.keys(SIZES).join(', ')}`);
    if (th.label !== undefined && (!isText(th.label) || words(th.label) > STAGE_MAX.label)) problems.push(`${where}.label must be ${STAGE_MAX.label} words at most`);
    problems.push(...looks(th, where));
    // two things in one spot stand on each other
    const key = `${th.up ? 'air' : 'ground'} ${th.spot}`;
    if (taken.has(key)) problems.push(`${where}: "${th.id}" stands where "${taken.get(key).id}" does; give it a spot of its own`);
    else taken.set(key, th);
  });
  // things side by side may be wide (a house, a bus), so long as they do not run into each other
  const placed = [...taken.entries()].map(([key, th]) => ({ layer: key.split(' ')[0], x: SPOTS[th.spot], w: thingWidth(th), th }));
  for (const a of placed) {
    for (const b of placed) {
      if (a.layer !== b.layer || a.x >= b.x || (a.w + b.w) / 2 <= b.x - a.x + OVERLAP) continue;
      problems.push(`picture.things: "${a.th.id}" and "${b.th.id}" are too wide to stand ${b.x - a.x === SPOT_WIDTH ? 'side by side' : 'so close'}; leave a spot between them${a.w > SPOT_WIDTH || b.w > SPOT_WIDTH ? ', as a wide thing such as a house or a bus needs' : ''}`);
    }
  }
  if (!Array.isArray(p.moves) || p.moves.length < 1 || p.moves.length > STAGE_MAX.moves) {
    return [...problems, `picture.moves must be a list of 1 to ${STAGE_MAX.moves} moves, so the picture shows something happening`];
  }
  p.moves.forEach((m, i) => {
    const where = `picture.moves[${i}]`;
    if (!isPlain(m)) { problems.push(`${where} must be an object such as { "do": "send", "what": "letter", "from": "bank", "to": "home" }`); return; }
    const spec = MOVES[m.do];
    if (!spec) { problems.push(`${where}.do must be one of: ${Object.keys(MOVES).join(', ')}`); return; }
    for (const key of Object.keys(m)) if (!MOVE_KEYS.includes(key)) problems.push(`${where}: a move takes ${MOVE_KEYS.join(', ')}, not ${key}`);
    for (const key of spec.needs) if (m[key] === undefined) problems.push(`${where}: a ${m.do} needs "${key}"`);
    for (const key of ['who', 'from', 'on']) if (m[key] !== undefined && !ids.has(m[key])) problems.push(`${where}.${key} must be the id of one of the things (${[...ids].join(', ')})`);
    if (m.to !== undefined) {
      if (m.do === 'walk') { if (!Object.hasOwn(SPOTS, m.to)) problems.push(`${where}.to must be a spot: ${SPOT_NAMES.join(', ')}`); }
      else if (m.do === 'meter') { if (typeof m.to !== 'number' || m.to < 0 || m.to > 1) problems.push(`${where}.to must be a number from 0 to 1`); }
      else if (m.do === 'count') { if (typeof m.to !== 'number' || !Number.isFinite(m.to) || m.to < 0 || m.to > 1e9) problems.push(`${where}.to must be a number`); }
      else if (!ids.has(m.to)) problems.push(`${where}.to must be the id of one of the things (${[...ids].join(', ')})`);
    }
    if (m.from !== undefined && m.from === m.to) problems.push(`${where}: a ${m.do} goes from one thing to another, not to itself`);
    if (m.what !== undefined && (!drawingOf(m.what) || Object.hasOwn(PEOPLE, m.what))) problems.push(`${where}.what must be a thing in the library or an icon, such as letter or money`);
    if (m.with !== undefined && !MARKS.includes(m.with)) problems.push(`${where}.with must be one of: ${MARKS.join(', ')}`);
    if (m.count !== undefined && (!Number.isInteger(m.count) || m.count < 1 || m.count > STAGE_MAX.coins)) problems.push(`${where}.count must be a whole number from 1 to ${STAGE_MAX.coins}`);
    if (m.text !== undefined && (!isText(m.text) || words(m.text) > STAGE_MAX.say)) problems.push(`${where}.text must be ${STAGE_MAX.say} words at most`);
    for (const key of ['before', 'after']) if (m[key] !== undefined && (typeof m[key] !== 'string' || [...m[key]].length > 8)) problems.push(`${where}.${key} must be a few letters, such as "£" or " days"`);
    if (m.cue !== undefined && !isText(m.cue)) problems.push(`${where}.cue must be the words the narrator says as it happens`);
    if (m.at !== undefined && (typeof m.at !== 'number' || !Number.isFinite(m.at) || m.at < 0)) problems.push(`${where}.at must be a number of seconds`);
    if (m.again !== undefined && typeof m.again !== 'boolean') problems.push(`${where}.again must be true or false`);
  });
  return problems;
}

/** What is wrong with a thing the reel draws itself: its rows and their letters. */
function ownProblems(th, where) {
  const rows = th.rows, own = isPlain(th.colours) ? Object.keys(th.colours) : [];
  if (!Array.isArray(rows) || !rows.length || rows.length > OWN_MAX.rows || !rows.every((r) => typeof r === 'string' && r.length > 0 && r.length <= OWN_MAX.cols)) {
    return [`${where}.rows must be 1 to ${OWN_MAX.rows} rows of 1 to ${OWN_MAX.cols} letters, such as ["..kk..", ".kyyk."]`];
  }
  const problems = [];
  if (new Set(rows.map((r) => r.length)).size > 1) problems.push(`${where}.rows must all be the same length, or the drawing breaks where one is not`);
  if (th.colours !== undefined && !(isPlain(th.colours) && Object.entries(th.colours).every(([k, c]) => [...k].length === 1 && k !== '.' && typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)))) {
    problems.push(`${where}.colours must be letters and the colours they stand for, such as { "h": "#6b3e2e" }`);
  }
  const odd = rows.join('').split('').find((ch) => ch !== '.' && !Object.hasOwn(PALETTE, ch) && !own.includes(ch));
  if (odd) problems.push(`${where}.rows uses "${odd}", which is not a palette letter: add it to colours`);
  return problems;
}

/** When each move starts: its own `at`, or one after another when nobody has said. */
function moveTimes(moves) {
  let last = FIRST - EVERY;
  return moves.map((m) => {
    last = typeof m.at === 'number' ? m.at : Math.round((last + EVERY) * 100) / 100;
    return last;
  });
}

// ---------------------------------------------------------------------------------------
// The places

function place(t, px, kind) {
  const { W, H } = px;
  if (kind === 'night') {
    px.sky('#0b1220', '#2f5d8a'); px.stars(t); px.moon(284, 24);
    px.hills('#1f3b5e', GROUND + 4, 22, 0, 2);
    px.rect('#142a45', 0, GROUND, W, H - GROUND);
  } else if (kind === 'sea') {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 12, 4);
    px.rect('#1f6aa0', 0, GROUND - 22, W, 22);
    for (let x = 0; x < W; x += 16) px.rect('#5aa6d6', x + Math.round(Math.sin(t * 2 + x / 20) * 2), GROUND - 16 + ((x / 16) % 3) * 5, 8, 2);
    px.rect('#e8c98a', 0, GROUND, W, H - GROUND); px.rect('#d4b06c', 0, GROUND, W, 2);
  } else if (kind === 'home') {
    px.rect('#3a2f4a', 0, 0, W, GROUND); px.rect('#2c2338', 0, 0, W, 6);
    for (let x = 12; x < W; x += 24) px.rect('#43375a', x, 6, 2, GROUND - 26);
    px.rect('#2c2338', 0, GROUND - 20, W, 20); px.rect('#4b3d62', 0, GROUND - 21, W, 2);
    px.window(250, 8, 44, 26, '#8fd3ff'); px.rect('#b9e6ff', 252, 10, 18, 10); px.rect(INK, 271, 8, 2, 26); px.rect(INK, 250, 20, 44, 2);
    px.rect('#7a4a24', 0, GROUND, W, 3); px.rect('#5a3418', 0, GROUND + 3, W, H - GROUND - 3);
    for (let x = 0; x < W; x += 40) px.rect('#4a2a12', x, GROUND + 3, 1, H - GROUND - 3);
  } else if (kind === 'street') {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 10, 4);
    for (const [x, w, h, c] of [[0, 70, 46, '#c49a86'], [70, 60, 58, '#d1ad8c'], [130, 76, 42, '#bf9282'], [206, 62, 54, '#cda489'], [268, 52, 48, '#c49a86']]) {
      const top = GROUND - 14 - h;
      px.rect('#6b5a55', x, top - 1, w, h + 1); px.rect(c, x + 1, top, w - 2, h);
      px.rect('#8a6f66', x, top - 3, w, 3);
      for (let wx = x + 9; wx < x + w - 12; wx += 18) { px.rect('#6b5a55', wx - 1, top + 9, 10, 12); px.rect('#cfe6f2', wx, top + 10, 8, 10); }
    }
    px.rect('#9a9a9a', 0, GROUND - 14, W, 14); px.rect('#bdbdbd', 0, GROUND - 14, W, 2);
    px.rect('#4a4a52', 0, GROUND, W, H - GROUND); px.rect(INK, 0, GROUND, W, 1);
    for (let x = 8; x < W; x += 40) px.rect(LIGHT, x, GROUND + 18, 20, 3);
  } else if (kind === 'office') {
    px.rect('#c9d3dc', 0, 0, W, GROUND); px.rect('#b4c0cb', 0, GROUND - 22, W, 22); px.rect('#9fadba', 0, GROUND - 23, W, 1);
    // a long window over the town, high on the wall
    px.rect(INK, 20, 8, 280, 46); px.rect('#8fd3ff', 21, 9, 278, 44);
    for (const [x, w, h] of [[24, 30, 26], [58, 22, 36], [84, 40, 20], [128, 26, 32], [158, 34, 24], [196, 24, 38], [224, 40, 22], [268, 28, 30]]) {
      px.rect('#6f87a3', x, 53 - h, w, h);
      for (let wy = 56 - h; wy < 50; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 6) px.rect('#cfe6f2', wx, wy, 3, 3);
    }
    for (const x of [94, 160, 226]) px.rect(INK, x, 8, 2, 46);
    px.rect('#5d6f86', 0, GROUND, W, H - GROUND); px.rect('#4f5f74', 0, GROUND, W, 2);
    for (let x = 0; x < W; x += 8) px.rect('#56687e', x + ((x / 8) % 2) * 4, GROUND + 12, 2, 2);
  } else if (kind === 'surgery') {
    px.rect('#d7eee6', 0, 0, W, GROUND); px.rect('#bfe0d4', 0, GROUND - 26, W, 26); px.rect('#9fcbbb', 0, GROUND - 27, W, 1);
    px.rect(INK, 148, 8, 24, 24); px.rect(LIGHT, 149, 9, 22, 22); px.rect(RED, 157, 12, 6, 16); px.rect(RED, 152, 17, 16, 6);
    px.rect(INK, 22, 12, 46, 30); px.rect('#c8925a', 23, 13, 44, 28);
    for (const [x, y, c] of [[27, 16, LIGHT], [44, 17, '#ffe08a'], [30, 28, '#8fd3ff'], [48, 29, LIGHT]]) px.rect(c, x, y, 13, 9);
    px.rect('#e9ecef', 0, GROUND, W, H - GROUND); px.rect('#c9ced6', 0, GROUND, W, 2);
    for (let x = 0; x < W; x += 20) px.rect('#d5dae0', x, GROUND + 2, 1, H - GROUND - 2);
  } else if (kind === 'shop') {
    px.rect('#f1e2c6', 0, 0, W, GROUND);
    for (const y of [16, 44]) {
      px.rect('#8a5a34', 6, y + 18, W - 12, 4); px.rect(INK, 6, y + 22, W - 12, 1);
      for (let x = 10; x < W - 14; x += 12) {
        const n = (x - 10) / 12, c = ['#d63a3a', '#3fa34d', '#1f4e9c', '#ffcc4d', '#ff8c2a', '#8e5bd6'][(n * 5 + y) % 6];
        const h = 10 + ((n * 7 + y) % 3) * 3;
        px.rect(INK, x, y + 18 - h, 9, h); px.rect(c, x + 1, y + 19 - h, 7, h - 1); px.rect(LIGHT, x + 2, y + 21 - h, 5, 2);
      }
    }
    px.rect('#e3cfa8', 0, GROUND - 20, W, 20);
    for (let x = 0; x < W; x += 16) for (let y = GROUND; y < H; y += 16) px.rect(((x + y) / 16) % 2 ? '#c9ced6' : '#f4f4ee', x, y, 16, 16);
  } else if (kind === 'school') {
    px.rect('#efe3c4', 0, 0, W, GROUND); px.rect('#d8c49a', 0, GROUND - 22, W, 22); px.rect('#bba57a', 0, GROUND - 23, W, 1);
    px.rect('#7a4a24', 70, 8, 180, 50); px.rect('#24533a', 74, 12, 172, 42);
    for (const [x, y, w] of [[84, 18, 40], [84, 26, 64], [84, 34, 30], [170, 20, 52], [176, 30, 36], [168, 40, 44]]) px.rect('#cfe3d6', x, y, w, 2);
    px.rect('#7a4a24', 64, 58, 192, 4);
    px.rect('#a36a3a', 0, GROUND, W, H - GROUND); px.rect('#8a5a34', 0, GROUND, W, 2);
    for (let x = 0; x < W; x += 32) px.rect('#8a5a34', x, GROUND + 2, 1, H - GROUND - 2);
  } else if (kind === 'kitchen') {
    px.rect('#f1ead8', 0, 0, W, GROUND);
    for (let y = 40; y < GROUND - 24; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < W; x += 8) px.rect('#e2d9c2', x, y, 7, 7);
    for (let x = 8; x < W - 8; x += 52) { px.rect(INK, x, 6, 46, 28); px.rect('#7fb3a0', x + 1, 7, 44, 26); px.rect('#6a9a88', x + 22, 7, 2, 26); px.rect(INK, x + 18, 18, 2, 4); px.rect(INK, x + 26, 18, 2, 4); }
    px.rect(INK, 0, GROUND - 25, W, 1); px.rect('#c9ced6', 0, GROUND - 24, W, 4); px.rect('#7fb3a0', 0, GROUND - 20, W, 20);
    for (let x = 30; x < W; x += 60) px.rect(INK, x, GROUND - 18, 1, 18);
    px.rect('#d8cfb8', 0, GROUND, W, H - GROUND);
    for (let x = 0; x < W; x += 16) for (let y = GROUND; y < H; y += 16) if (((x + y) / 16) % 2) px.rect('#c4b99e', x, y, 16, 16);
  } else if (kind === 'bedroom') {
    px.rect('#3c4a7a', 0, 0, W, GROUND); px.rect('#34406b', 0, GROUND - 20, W, 20);
    px.window(36, 10, 60, 46, '#13203a'); px.circle('#fdf6e3', 76, 26, 7); px.circle('#13203a', 79, 24, 6);
    for (const [x, y] of [[46, 18], [58, 40], [88, 46], [50, 32]]) px.rect(LIGHT, x, y, 1, 1);
    px.rect(INK, 65, 10, 2, 46); px.rect(INK, 36, 32, 60, 2);
    px.rect(INK, 230, 12, 40, 30); px.rect('#ffcc4d', 231, 13, 38, 28); px.rect('#3fa34d', 236, 28, 28, 10); px.circle('#d63a3a', 250, 22, 4);
    px.rect('#5a3a6a', 0, GROUND, W, H - GROUND); px.rect('#7a4a8a', 60, GROUND + 6, 200, H - GROUND - 12);
    for (let x = 64; x < 256; x += 8) px.rect('#9a6aaa', x, GROUND + 9, 4, 2);
  } else if (kind === 'cafe') {
    px.rect('#f3e6cf', 0, 0, W, GROUND);
    for (let x = 0; x < W; x += 20) { px.rect(x % 40 ? '#d63a3a' : LIGHT, x, 0, 20, 14); }
    px.rect(INK, 0, 14, W, 1);
    for (let x = 0; x < W; x += 20) px.rect(x % 40 ? '#d63a3a' : LIGHT, x + 4, 15, 12, 4);
    px.rect(INK, 200, 26, 96, 50); px.rect('#24333a', 201, 27, 94, 48);
    for (const [y, w] of [[34, 60], [44, 48], [54, 70], [64, 40]]) { px.rect('#e8e2d0', 208, y, w, 2); px.rect(GOLD, 284, y, 6, 2); }
    px.rect(INK, 20, 30, 40, 40); px.rect('#8fd3ff', 21, 31, 38, 38); px.rect(INK, 39, 30, 2, 40); px.rect(INK, 20, 49, 40, 2);
    px.rect('#8a5a34', 0, GROUND - 24, W, 24); px.rect('#a36a3a', 0, GROUND - 26, W, 3); px.rect(INK, 0, GROUND - 27, W, 1);
    px.rect('#6a4228', 0, GROUND, W, H - GROUND);
    for (let x = 0; x < W; x += 24) px.rect('#5a3820', x, GROUND, 1, H - GROUND);
  } else if (kind === 'park') {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 12, 4);
    px.hills('#5ab45a', GROUND - 18, 14, 0, 3);
    for (const [x, r] of [[24, 18], [92, 14], [228, 20], [300, 15]]) { px.rect('#6a4a24', x - 2, GROUND - 40, 5, 26); px.circle(INK, x, GROUND - 46, r + 1); px.circle('#2a7a35', x, GROUND - 46, r); px.circle('#3fa34d', x - 3, GROUND - 49, r - 5); }
    px.rect('#3fa34d', 0, GROUND - 14, W, 14);
    px.rect(INK, 140, GROUND - 26, 44, 3); px.rect('#a36a3a', 141, GROUND - 25, 42, 1); px.rect(INK, 140, GROUND - 20, 44, 3); px.rect(INK, 143, GROUND - 17, 2, 6); px.rect(INK, 179, GROUND - 17, 2, 6);
    px.rect('#d8c49a', 0, GROUND, W, H - GROUND); px.rect('#c4ad7e', 0, GROUND, W, 2);
    px.rect('#2a7a35', 0, GROUND + 20, W, H - GROUND - 20);
  } else if (kind === 'festival') {
    px.sky('#2a2a5a', '#e0785a'); px.stars(t);
    // the main stage far off, its lights swinging
    px.rect(INK, 118, 52, 84, 46); px.rect('#2b2b33', 120, 54, 80, 42); px.rect('#13203a', 126, 62, 68, 34);
    for (let i = 0; i < 3; i++) { const sx = 136 + i * 24, sw = Math.round(Math.sin(t * 1.6 + i) * 10); px.line(['#ffcc4d', '#55d6be', '#ff7eb6'][i], sx, 62, sx + sw, 94); }
    for (const [x, c] of [[20, '#d63a3a'], [60, '#1f4e9c'], [250, '#ffcc4d'], [290, '#3fa34d']]) {
      px.rect(INK, x - 14, GROUND - 30, 28, 1);
      for (let k = 0; k < 14; k++) px.rect(c, x - k, GROUND - 30 + k, 2 * k + 1, 1);
    }
    px.line(INK, 0, 36, W, 44);
    for (let x = 8; x < W; x += 18) { const y = 36 + Math.round(x * 8 / W); px.rect(['#d63a3a', '#ffcc4d', '#1f4e9c', '#3fa34d'][(x / 18 | 0) % 4], x, y + 1, 7, 5); }
    px.rect('#3a7a35', 0, GROUND - 16, W, 16); px.rect('#2a5a28', 0, GROUND, W, H - GROUND); px.rect('#4a8a40', 0, GROUND, W, 2);
  } else if (kind === 'station') {
    px.sky('#7a9ab8', '#c8d8e6');
    px.rect(INK, 0, 26, W, 3); px.rect('#24476b', 0, 22, W, 4);
    for (let x = 20; x < W; x += 70) px.rect('#24476b', x, 26, 4, GROUND - 26);
    px.circle(INK, 160, 46, 11); px.circle(LIGHT, 160, 46, 10); px.rect(INK, 159, 39, 2, 8); px.rect(INK, 159, 45, 6, 2); px.rect(INK, 159, 34, 2, 2);
    px.rect('#c8c2b0', 0, GROUND - 12, W, 12); px.rect('#f2e12b', 0, GROUND - 2, W, 2);
    px.rect('#8a8478', 0, GROUND, W, H - GROUND);
    for (let x = 0; x < W; x += 12) px.rect('#5a5448', x, GROUND + 12, 6, 3);
    px.rect('#6a6458', 0, GROUND + 10, W, 1); px.rect('#6a6458', 0, GROUND + 17, W, 1);
  } else if (kind === 'plain') {
    px.rect(NAVY, 0, 0, W, H);
    for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) px.rect('#1a2b47', x, y, 1, 1);
    px.rect('#0b1220', 0, GROUND, W, H - GROUND); px.rect('#24476b', 0, GROUND, W, 1);
  } else {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 12, 4); px.circle(GOLD, 284, 26, 11); px.circle('#ffe08a', 282, 24, 5);
    px.hills('#3fa34d', GROUND + 4, 18, 0, 3);
    px.rect('#2a7a35', 0, GROUND, W, H - GROUND); px.rect('#4cb55a', 0, GROUND, W, 2);
  }
}

// ---------------------------------------------------------------------------------------
// The cast

/** Reelie, the film reel who presents, standing with feet on `feet`. The same Reelie as the showreel's. */
function reelie(px, cx, feet, r, t, talking) {
  const cy = Math.round(feet - r - 1), step = 0;   // standing still
  for (const side of [-1, 1]) {
    const fx = Math.round(r * 0.45);
    px.rect(INK, cx + side * fx - 4, cy + r - 4 - step, 8, 6);
    px.rect('#46566e', cx + side * fx - 3, cy + r - 3 - step, 6, 3);
  }
  px.circle(INK, cx, cy, r);
  px.circle('#8094ab', cx, cy, r - 1);
  px.circle('#cfdbe7', cx - 1, cy - 1, r - 2);
  px.circle('#aebfd1', cx, cy, r - 3);
  for (let k = 0; k < 5; k++) {
    const a = t * 1.5 + (k * 2 * Math.PI) / 5 - Math.PI / 2;
    px.circle('#2b3a52', cx + Math.cos(a) * r * 0.67, cy + Math.sin(a) * r * 0.67, Math.max(1, Math.round(r * 0.15)));
  }
  const hub = Math.max(5, Math.round(r * 0.46)), e = Math.max(1, Math.round(hub / 6));
  px.circle(INK, cx, cy, hub + 1);
  px.circle(GOLD, cx, cy, hub);
  px.rect('#ffe08a', cx - Math.round(hub * 0.5), cy - hub + 1, Math.round(hub * 0.6), 1);
  const ex = Math.round(hub * 0.42), ey = Math.round(hub * 0.3), my = cy + Math.round(hub * 0.36), mw = Math.round(hub * 0.3);
  if ((t % 3.7) > 3.56) for (const x of [cx - ex, cx + ex]) px.rect(INK, x - e - Math.floor(e / 2), cy - ey + e, e * 3, e);
  else for (const x of [cx - ex, cx + ex]) px.rect(INK, x - Math.floor(e / 2), cy - ey, e, e * 2);
  if (talking && Math.floor(t * 8) % 2) { px.rect(INK, cx - mw, my - e, mw * 2 + 1, e * 3); px.rect(RED, cx - mw + e, my, mw * 2 + 1 - 2 * e, e); }
  else { px.rect(INK, cx - mw + e, my + e, mw * 2 + 1 - 2 * e, e); px.rect(INK, cx - mw, my, e, e); px.rect(INK, cx + mw, my, e, e); }
}

// ---------------------------------------------------------------------------------------
// Drawing a stage

/** Where every thing is at time t: its middle, its box, whether it is there yet, and how far it has faded. */
function layout(t, p, times) {
  const things = new Map();
  for (const th of p.things) {
    const sc = SIZES[th.size ?? 'medium'], cast = CAST.includes(th.is), rows = cast ? null : thingDrawing(th).rows;
    const w = cast ? 14 * sc : Math.max(...rows.map((r) => r.length)) * sc, h = cast ? 15 * sc + 2 : rows.length * sc;
    things.set(th.id, { ...th, sc, w, h, x: SPOTS[th.spot], feet: th.up ? AIR : GROUND, from: 0, gone: Infinity, walking: false });
  }
  p.moves.forEach((m, i) => {
    const th = things.get(m.who), at = times[i];
    if (!th) return;
    if (m.do === 'arrive') th.from = at;
    if (m.do === 'leave') th.gone = Math.min(th.gone, at);
    if (m.do === 'walk' && t >= at) {
      const k = Math.min(1, (t - at) / 1.6), to = SPOTS[m.to];
      th.walking = k < 1;
      th.x = Math.round(th.x + (to - th.x) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2));
      if (to < th.x && th.walking) th.facing = -1;
    }
  });
  for (const th of things.values()) {
    th.x = Math.max(2 + th.w / 2, Math.min(320 - 2 - th.w / 2, th.x));   // never past the picture's edge
    th.top = th.feet - th.h;
    th.cy = th.top + th.h / 2;
  }
  return things;
}

/** A thing's label: as big as fits between its neighbours, down to 10 pixels. */
function labelSize(px, label, room) {
  let size = 14;
  while (size > 10 && px.textW(label, size) > room) size -= 2;
  return size;
}

function drawThing(t, px, th, look, index) {
  if (t < th.from) return;
  const fade = th.gone === Infinity ? 0 : px.clamp((t - th.gone) / 0.6, 0, 1);
  if (fade >= 1) return;
  const drop = Math.round(px.tween(t, th.from + index * 0.12, 0.55, -th.feet - 8, 0, 'bounce'));
  const bob = th.walking ? -Math.abs(Math.round(Math.sin(t * 14) * 2)) : 0;
  const x = Math.round(th.x - th.w / 2), y = th.top + drop + bob;
  if (!th.up && drop === 0) px.rect('rgba(0,0,0,0.25)', x + 4, th.feet - 1, th.w - 8, 2);   // a shadow, so it stands on the ground
  if (th.is === 'reelie') reelie(px, Math.round(th.x), th.feet + drop + bob, Math.round(th.w / 2) - 1, t, true);
  else {
    const drawing = thingDrawing(th), own = th.rows ? null : look(th, index);
    px.sprite(drawing.rows, x, y, th.sc, th.flip === true || th.facing === -1, own || drawing.colours ? { ...drawing.colours, ...own } : null);
  }
  if (fade > 0) px.dither('#13203a', x - 2, y - 2, th.w + 4, th.h + 4, fade);
}

/** A small icon that flies from one thing to another; with a barrier between them, it bounces back off it. */
function flying(t, px, m, a, b, at, wall) {
  const takes = 1.4, since = t - at, k0 = m.again ? (since % (takes + 0.4)) / takes : since / takes;
  if (k0 < 0 || k0 > 1) return;
  let k = k0;
  if (wall) k = k0 < 0.5 ? k0 : 1 - k0;   // to the barrier, and back
  const x = px.lerp(a.x, b.x, k), y = px.lerp(a.cy, b.cy, k) - Math.sin(k * Math.PI) * 30, drawing = drawingOf(m.what);
  const w = Math.max(...drawing.rows.map((r) => r.length)) * 2, h = drawing.rows.length * 2;
  px.sprite(drawing.rows, Math.round(x - w / 2), Math.round(y - h / 2), 2, false, drawing.colours ?? null);
}

/** Draws stage `p` at time t, with `look(thing, i)` giving a person's colours (personLook in pictures.js). */
function drawStage(t, px, p, look = () => null) {
  const times = moveTimes(p.moves), things = layout(t, p, times);
  const live = (i) => t >= times[i];
  const blocked = (m) => p.moves.some((o, j) => o.do === 'block' && live(j) &&
    ((o.from === m.from && o.to === m.to) || (o.from === m.to && o.to === m.from)));
  place(t, px, p.place);

  // behind the things: streams and waves
  p.moves.forEach((m, i) => {
    if (!live(i)) return;
    const a = things.get(m.from), b = things.get(m.to), on = things.get(m.on);
    if (m.do === 'pulse' && on && t >= on.from) {
      // rings that spread and fade, kept inside the picture
      for (const lag of [0, 0.5]) {
        const k = ((t - times[i]) * 0.8 + lag) % 1, r = Math.round(Math.min(on.w / 2 + 3 + k * 14, on.x - 2, px.W - on.x - 2, GROUND - on.cy - 2));
        if (k < 0.85) px.ring(GOLD, Math.round(on.x), Math.round(on.cy), r, 2);
      }
    }
    if (!a || !b) return;
    if (m.do === 'flow') {
      for (let n = 0; n < 6; n++) {
        const k = ((t - times[i]) * 0.45 + n / 6) % 1, x = px.lerp(a.x, b.x, k), y = px.lerp(a.cy, b.cy, k);
        px.rect(INK, x - 3, y - 3, 6, 6); px.rect(TEAL, x - 2, y - 2, 4, 4);
      }
    } else if (m.do === 'wave') {
      // a wave back the other way, an answer to one already there, runs a little lower so both are seen
      const back = p.moves.some((o, j) => j < i && o.do === 'wave' && o.from === m.to && o.to === m.from) ? 10 : 0;
      const dir = Math.sign(b.x - a.x) || 1, x0 = a.x + dir * (a.w / 2 + 4), x1 = b.x - dir * (b.w / 2 + 4);
      const reach = px.clamp((t - times[i]) / 1.0, 0, 1), span = (x1 - x0) * reach;
      for (let d = 0; Math.abs(d) < Math.abs(span); d += dir * 4) {
        const k = d / (x1 - x0 || 1), y = px.lerp(a.cy, b.cy, k) + back, h = 3 + Math.round(Math.abs(Math.sin(t * 7 + d * 0.3)) * 10);
        px.rect(back ? TEAL : GOLD, x0 + d, Math.round(y - h / 2), 2, h);
      }
    }
  });

  [...things.values()].forEach((th, i) => drawThing(t, px, th, look, i));

  // the labels, each as big as fits between its neighbours
  const shown = [...things.values()].filter((th) => th.label && t >= th.from + 0.5 && th.gone === Infinity);
  for (const th of shown) {
    const near = shown.filter((o) => o !== th && o.feet === th.feet).map((o) => Math.abs(o.x - th.x));
    const room = Math.min(SPOT_WIDTH * 2 - 6, ...near.map((d) => d - 6)), size = labelSize(px, th.label, room);
    const y = th.up ? th.feet + 3 : GROUND + 4;
    px.text(th.label, Math.round(th.x), y, size, th.up ? LIGHT : CREAM, 'center', INK);
  }

  // in front of the things: what flies, rises, piles up and is said
  p.moves.forEach((m, i) => {
    if (!live(i)) return;
    const at = times[i], a = things.get(m.from), b = things.get(m.to), th = things.get(m.on ?? m.who);
    if (m.do === 'send' && a && b) flying(t, px, m, a, b, at, blocked(m));
    if (m.do === 'block' && a && b) {
      const x = Math.round((a.x + b.x) / 2), h = Math.round(px.tween(t, at, 0.4, 0, 54, 'back')), top = GROUND - h;
      px.rect(INK, x - 5, top - 1, 10, h + 1); px.rect(RED, x - 4, top, 8, h);
      for (let y = top + 4; y < GROUND - 4; y += 10) px.rect(LIGHT, x - 4, y, 8, 3);
    }
    if (!th) return;
    if (m.do === 'pile') {
      // beside the thing, on whichever side has room
      const n = Math.min(m.count, Math.floor((t - at) / 0.3) + 1), x = th.x + th.w / 2 + 20 <= px.W ? Math.round(th.x + th.w / 2 + 4) : Math.round(th.x - th.w / 2 - 18);
      for (let c = 0; c < n; c++) { const y = th.feet - 5 - c * 5; px.rect(INK, x - 1, y - 1, 16, 6); px.rect(GOLD, x, y, 14, 4); px.rect('#c98a12', x, y + 3, 14, 1); }
    }
    if (m.do === 'meter') {
      const w = Math.max(44, th.w), x = Math.round(th.x - w / 2), y = th.top - 12;
      const k = px.tween(t, at, 2, 0, m.to ?? 1, 'linear');
      px.rect(INK, x - 1, y - 1, w + 2, 9); px.rect(LIGHT, x, y, w, 7); px.rect(GREEN, x, y, Math.round(w * k), 7);
    }
    if (m.do === 'count') {
      const v = px.tween(t, at, 1.4, 0, m.to, 'out'), whole = Number.isInteger(m.to);
      const shownV = whole ? String(Math.round(v)) : v.toFixed(2);
      // on a plate as wide as the number at its end, so it does not shift as it counts
      const end = `${m.before ?? ''}${whole ? m.to : m.to.toFixed(2)}${m.after ?? ''}`, w = px.textW(end, 20) + 12;
      const x = px.clamp(Math.round(th.x - w / 2), 2, px.W - w - 2), y = Math.max(2, th.top - 28);
      px.window(x, y, w, 24, NAVY);
      px.text(`${m.before ?? ''}${shownV}${m.after ?? ''}`, x + w / 2, y + 2, 20, GOLD, 'center', INK);
    }
    if (m.do === 'mark') {
      if (px.tween(t, at, 0.3, 0, 1, 'back') < 0.5) return;
      const cx = Math.round(th.x + th.w / 2 - 2), cy = th.top + 2;
      px.circle(INK, cx, cy, 11); px.circle(LIGHT, cx, cy, 10);
      px.sprite(ICONS[m.with], cx - 8, cy - 8, 1);
    }
    if (m.do === 'say') {
      // a bubble lasts until the same thing says something else
      const next = p.moves.findIndex((o, j) => j > i && o.do === 'say' && o.who === m.who && live(j));
      if (next !== -1) return;
      const w = Math.min(140, px.textW(m.text, 12) + 10), x = px.clamp(Math.round(th.x - w / 2), 4, px.W - w - 4);
      px.bubble(m.text, x, Math.max(2, th.top - 28), 12, Math.round(th.x), LIGHT, '#202020', 130);
    }
  });
}

return { GROUND, PLACES, SPOTS, SIZES, CAST, MOVES, MARKS, STAGE_MAX, isThingName, drawingOf, thingWidth, OWN_MAX, stageProblems, moveTimes, drawStage };
})();

__m['pictures.js'] = (() => {
// Ready-made pictures: a scene can say picture: { type: 'list', items: [...] } instead of
// writing draw(t, px). Each one animates in time with the scene. Data only, so a script or
// an AI agent can write a whole reel without a line of drawing code.
const { ICON_SIZE, ICONS } = __m['icons.js'];
const { PALETTE } = __m['palette.js'];
const { PEOPLE, TOPS, LEGS, WEARS } = __m['library.js'];
const { drawStage, stageProblems } = __m['stage.js'];

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

/** One big word or number on a paper card, punched in, a gold line drawn under it, and a line of words beneath. */
function big(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const lay = memo(p, 'big', () => {
    const sub = p.sub ? px.wrap(p.sub, W - 76, 16) : [];
    const size = fit(px, p.text, sub.length > 1 ? 48 : 60, W - 76), wordW = px.textW(p.text, size);
    const w = Math.min(W - 24, Math.max(190, wordW + 64, ...sub.map((line) => px.textW(line, 16) + 44)));
    const h = 22 + size + 12 + (sub.length ? 8 + sub.length * 19 : 0) + 14;
    return { size, wordW, sub, w, h };
  });
  const { size, wordW, sub, w, h } = lay, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2), cy = y + 22;
  px.rect(NIGHT, x + 3, y + 3, w, h);
  px.window(x, y, w, h, LIGHT);
  // the line under the word is drawn from the left once the word has landed, and then stays
  const lineW = Math.round(px.tween(t, 0.6, 0.4, 0, wordW + 12, 'out'));
  if (lineW > 0) px.rect(GOLD, Math.round(W / 2 - wordW / 2 - 6), cy + size + 3, lineW, 5);
  const k = px.tween(t, 0.1, 0.6, 0, 1, 'back');
  if (k > 0.05) px.zoom(k, W / 2, cy + size / 2, () => px.text(p.text, W / 2, cy, size, INK, 'center'));
  if (sub.length) typedBlock(px, p.sub, W / 2, cy + size + 20, t, 0.9, 16, '#2b3550', W - 76);
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

/** The icons that are one person, whom an item can give a skin and a hair colour. */
const PERSON_ICONS = ['woman', 'man', 'girl', 'boy', 'baby'];
/** The skins and hair colours a person icon can have. */
const SKINS = { light: PALETTE.s, medium: PALETTE.S, deep: PALETTE.d };
const HAIRS = { black: '#2a1d14', brown: PALETTE.n, blonde: PALETTE.y, ginger: '#c2452d', grey: '#c3c9d0' };
/** The hair a person is given, by skin, when an item does not say. */
const HAIR_FOR = { light: ['brown', 'blonde', 'black', 'ginger'], medium: ['black', 'brown'], deep: ['black'] };

function hash(str) {
  let h = 7;
  for (const ch of str) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0;
  return h;
}

/**
 * The colours a person icon is drawn in, for px.sprite: the skin and hair its item says, or,
 * where it says nothing, a look of its own chosen from its label (or its place, unlabelled).
 * So nobody is drawn one colour by default, and the same person looks the same in every scene.
 * Null for an icon that is not one person.
 */
function personLook(item, i = 0) {
  if (!PERSON_ICONS.includes(item.icon)) return null;
  const h = hash((item.label ?? `${item.icon} ${i}`).trim().toLowerCase());
  const skin = item.skin ?? Object.keys(SKINS)[h % 3], hairs = HAIR_FOR[skin];
  return { s: SKINS[skin], n: HAIRS[item.hair ?? hairs[Math.floor(h / 3) % hairs.length]] };
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
    px.sprite(ICONS[item.icon], cx - size / 2, y0 + drop + (t > at + 0.6 ? px.bob(t + i, 2, 1) : 0), sc, false, personLook(item, i));
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
    px.sprite(ICONS[side.icon], x + w / 2 - size / 2, iy + (t > at + 0.5 ? px.bob(t + i * 2, 2, 1) : 0), sc, false, personLook(side, i));
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
 * The colours a person on a stage is drawn in: the skin and hair the reel says, or a look of
 * their own chosen from their label (or their id), so the same person looks the same in every
 * scene and nobody is one colour by default; an older person has grey hair unless told. Their
 * top and trousers say what they wear, or are their own everyday ones. Null for a thing that is
 * not a person.
 */
function stageLook(th) {
  const person = PEOPLE[th.is];
  if (!person) return null;
  const h = hash(String(th.label ?? th.id ?? th.is).trim().toLowerCase()), wears = WEARS[th.wears] ?? null;
  const clothes = { C: wears?.C ?? TOPS[Math.floor(h / 7) % TOPS.length], T: wears?.T ?? LEGS[Math.floor(h / 61) % LEGS.length], U: INK, ...(wears?.A ? { A: wears.A } : {}) };
  if (person.outline) return { C: wears?.C ?? TOPS[Math.floor(h / 7) % TOPS.length] };
  const skin = th.skin ?? Object.keys(SKINS)[h % 3], hairs = person.older ? ['grey'] : HAIR_FOR[skin];
  return { S: SKINS[skin], H: HAIRS[th.hair ?? hairs[Math.floor(h / 3) % hairs.length]], ...clothes };
}

/** A place, a few things standing in it, and moves between them (stage.js). */
function stage(t, px, p) { drawStage(t, px, p, (th, i) => (PEOPLE[th.is] ? stageLook(th) : personLook({ icon: th.is, label: th.label ?? th.id }, i))); }

/** What is wrong with a stage beyond its fields' being there: stage.js checks it, and a person's skin and hair are checked here. */
function stageCheck(p) {
  return stageProblems(p, (th, where) => {
    const wrong = [];
    for (const key of ['skin', 'hair']) {
      if (th[key] === undefined) continue;
      const people = Object.keys(PEOPLE).filter((name) => !PEOPLE[name].outline);
      if (!people.includes(th.is)) wrong.push(`${where}.${key}: only a ${people.join(', ')} takes ${key}`);
      else if (!Object.hasOwn(LOOKS[key], th[key])) wrong.push(`${where}.${key} must be one of: ${Object.keys(LOOKS[key]).join(', ')}`);
    }
    return wrong;
  });
}

/**
 * Every ready-made picture: its fields (a trailing ? marks optional ones), how it draws, and
 * any check beyond its fields. Kinds: text, list (of text), messages ([{ from, text }]), number,
 * flag (true or false), image (a name from images), objects (a list the picture's own check looks into), items (1 to 4 { icon, label? }), item
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
  sprite: { fields: { rows: 'rows', colours: 'colours?', label: 'text?' }, draw: sprite, check: spriteLetters },
  stage: { fields: { place: 'text', things: 'objects', moves: 'objects' }, draw: stage, check: stageCheck }
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

const LOOKS = { skin: SKINS, hair: HAIRS };
const isIconItem = (v, labelled) => v !== null && typeof v === 'object' && !Array.isArray(v) && ICON_NAMES.includes(v.icon) &&
  (labelled ? isText(v.label) : v.label === undefined || isText(v.label)) &&
  Object.entries(v).every(([k, x]) => k === 'icon' || k === 'label' || (k in LOOKS && PERSON_ICONS.includes(v.icon) && Object.hasOwn(LOOKS[k], x)));
const iconHelp = `icons: ${Object.keys(ICONS).join(', ')}. A ${PERSON_ICONS.join(', ')} can also take skin (${Object.keys(SKINS).join(', ')}) and hair (${Object.keys(HAIRS).join(', ')})`;

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
  objects: [(v) => Array.isArray(v) && v.length > 0, 'must be a list'],
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

return { highlight, PERSON_ICONS, SKINS, HAIRS, personLook, TABLE_MAX, stageLook, PICTURES, ICON_NAMES, SPRITE_MAX, pictureProblems, drawPicture, noSignal };
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
const { HAIRS, ICON_NAMES, PERSON_ICONS, PICTURES, SKINS, SPRITE_MAX, TABLE_MAX } = __m['pictures.js'];
const { PALETTE } = __m['palette.js'];
const { PEOPLE, THINGS, WEARS } = __m['library.js'];
const { CAST, MARKS, MOVES, OWN_MAX, PLACES, SIZES, SPOTS, STAGE_MAX } = __m['stage.js'];
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
  big: 'One big word or number on a paper card, punched in, with a line underneath: for the one number or word the reel turns on. Once in a reel is plenty.',
  image: "One of the reel's own images, named in images, slowly pushing in.",
  icons: 'One to four everyday icons dropping in one by one, each with a label underneath.',
  flow: 'One to four icons joined by arrows, arriving in turn: how one thing leads to the next.',
  compare: 'Two cards side by side: the one to avoid, with a cross, then the one to choose, with a tick.',
  table: 'A small table for things set out in rows and columns (a timetable, a bill, prices, dates): rows arrive one by one, the newest lit.',
  sprite: 'Pixel art of your own from rows of palette letters, scaled up to fill the picture, with an optional label.',
  stage: 'Something happening: a place, a few things standing in it, and moves between them (a letter flies, a barrier rises, coins pile up), each as the narrator says it.'
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
/** How a person icon looks; only woman, man, girl, boy and baby take them (reelFromData checks). */
const LOOK_SCHEMAS = {
  skin: { enum: Object.keys(SKINS), description: `For a ${PERSON_ICONS.join(', ')}: their skin. Leave it out when you do not know, and they get a look of their own.` },
  hair: { enum: Object.keys(HAIRS), description: `For a ${PERSON_ICONS.join(', ')}: their hair. Leave it out when you do not know.` }
};
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
    properties: { icon: { enum: ICON_NAMES }, label: TEXT, ...LOOK_SCHEMAS }
  },
  items: {
    type: 'array',
    minItems: 1,
    maxItems: 4,
    items: { type: 'object', additionalProperties: false, required: ['icon'], properties: { icon: { enum: ICON_NAMES }, label: TEXT, ...LOOK_SCHEMAS } }
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
    description: `Rows of pixels, one letter each: ${Object.keys(PALETTE).join(' ')} from the palette, a letter of your own from colours, or "." for see-through. Every row the same length.`
  },
  colours: {
    type: 'object',
    propertyNames: { pattern: '^[^. ]$' },
    additionalProperties: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' },
    description: 'Letters of your own for the rows, and the colours they stand for, such as { "h": "#6b3e2e" }.'
  }
};

/** The fields of a stage picture, as a schema: stage.js is the final word. */
const STAGE_SCHEMAS = {
  place: { enum: Object.keys(PLACES), description: Object.entries(PLACES).map(([name, says]) => `${name}: ${says}`).join(' ') },
  things: {
    type: 'array',
    minItems: 1,
    maxItems: STAGE_MAX.things,
    description: 'What stands on the stage, each in a spot of its own.',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'spot'],
      properties: {
        id: { ...TEXT, description: 'A short name of its own, for the moves to use.' },
        rows: { type: 'array', minItems: 1, maxItems: OWN_MAX.rows, items: { type: 'string', maxLength: OWN_MAX.cols }, description: `Instead of "is", for a thing the library does not have: your own drawing, rows of palette letters (as a sprite's), up to ${OWN_MAX.cols} by ${OWN_MAX.rows}, every row the same length.` },
        colours: KIND_SCHEMAS.colours,
        is: { enum: [...new Set([...CAST, ...Object.keys(PEOPLE), ...Object.keys(THINGS), ...ICON_NAMES])], description: `What it is: ${CAST.join(', ')} (the cast), a person, a thing in the library, or an icon.` },
        spot: { enum: Object.keys(SPOTS), description: 'Where it stands, left to right.' },
        up: { type: 'boolean', description: 'True to have it in the air (a cloud, the sun, a plane), not on the ground.' },
        size: { enum: Object.keys(SIZES), description: 'medium unless said; a big thing needs the spots either side of it clear.' },
        label: { ...TEXT, description: `${STAGE_MAX.label} words at most.` },
        flip: { type: 'boolean', description: 'True to face it the other way.' },
        wears: { enum: Object.keys(WEARS), description: `For a person: what they wear, which says what they do (${Object.entries(WEARS).filter(([, w]) => w).map(([name, w]) => `${name}: ${w.says}`).join('; ')}).` },
        skin: { ...LOOK_SCHEMAS.skin, description: 'For a person: their skin. Leave it out when you do not know, and they get a look of their own.' },
        hair: { ...LOOK_SCHEMAS.hair, description: 'For a person: their hair. Leave it out when you do not know.' }
      }
    }
  },
  moves: {
    type: 'array',
    minItems: 1,
    maxItems: STAGE_MAX.moves,
    description: 'What happens, in the order it happens.',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['do'],
      properties: {
        do: { enum: Object.keys(MOVES), description: Object.entries(MOVES).map(([name, m]) => `${name}: ${m.says} (takes ${m.needs.join(', ')})`).join('. ') },
        cue: { ...TEXT, description: 'The words the narrator says as it happens, so it happens then.' },
        at: { type: 'number', minimum: 0, description: 'Seconds into the scene; set from the voice when it is recorded.' },
        who: { type: 'string', description: 'The id of the thing that arrives, says, walks or leaves.' },
        on: { type: 'string', description: 'The id of the thing it happens on.' },
        from: { type: 'string', description: 'The id of the thing it starts from.' },
        to: { type: ['string', 'number'], description: 'The id of the thing it goes to; a spot for walk; a number for count, or 0 to 1 for meter.' },
        what: { enum: [...new Set([...Object.keys(THINGS), ...ICON_NAMES])], description: 'The thing that is sent.' },
        count: { type: 'integer', minimum: 1, maximum: STAGE_MAX.coins, description: 'How many coins.' },
        with: { enum: MARKS, description: 'The badge.' },
        text: { ...TEXT, description: `What is said, ${STAGE_MAX.say} words at most.` },
        before: { type: 'string', description: 'Before a counted number, such as £.' },
        after: { type: 'string', description: 'After a counted number, such as " days".' },
        again: { type: 'boolean', description: 'True to send it again and again.' }
      }
    }
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
      properties[key] = type === 'stage' ? STAGE_SCHEMAS[key] : KIND_SCHEMAS[want.replace('?', '')];
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

