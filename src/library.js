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
export const PEOPLE = {
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
export const WEARS = {
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
export function personRows(name, wears = null) {
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
export const TOPS = ['#55d6be', '#8e5bd6', '#d63a3a', '#1f4e9c', '#ff8c2a', '#3fa34d', '#ffcc4d', '#ff7eb6'];
export const LEGS = ['#2b3a52', '#24476b', '#5a3418', '#3a2f4a'];

/**
 * The things, by name: each drawing's rows, any colours of its own, its group, and what it is.
 * A thing whose name is also an icon's is drawn from here on a stage: a bigger, finer house.
 */
export const THINGS = {
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
      '....kkkkk....',
      '...kkeeekk...',
      '..kkkkkkkkk..',
      '.kwwwwwwwwkkk',
      'kwwwwwwwwwk.k',
      'kwwwwwwwwwk.k',
      'kwwwwwwwwwk.k',
      'kwwwwwwwwwkkk',
      'kwwwwwwwwwk..',
      'kkkkkkkkkkk..',
      'keeeeeeeeek..',
      'kkkkkkkkkkk..'
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
export const THING_GROUPS = Object.entries(THINGS).reduce((groups, [name, thing]) => {
  (groups[thing.group] ??= []).push(name);
  return groups;
}, {});
