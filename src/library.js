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

/** What a person can wear, which says what they do: the colours of their top and trousers. */
export const WEARS = {
  everyday: null,
  'doctor-coat': { C: '#f4f4ee', T: '#2b3a52', says: 'a doctor' },
  scrubs: { C: '#3aa6a0', T: '#3aa6a0', says: 'a nurse, or anyone at a hospital' },
  'hi-vis': { C: '#ff8c2a', T: '#2b3a52', says: 'an engineer or a builder' },
  suit: { C: '#24476b', T: '#1c2f4a', says: 'someone at work in an office or a bank' },
  uniform: { C: '#1f2d4a', T: '#1f2d4a', says: 'a police officer, or anyone in a uniform' }
};

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
  bus: {
    group: 'Out and about', says: 'a bus',
    rows: [
      '.kkkkkkkkkkkkkkkkkkkkkkkkkkk.',
      'krrrrrrrrrrrrrrrrrrrrrrrrrrrk',
      'krkkkkkkkkkkkkkkkkkkkkkkkkkrk',
      'krk88k88k88k88k88k88k88k888rk',
      'krkkkkkkkkkkkkkkkkkkkkkkkkkrk',
      'krrrrrrrrrrrrrrrrrrrrrrrrrrrk',
      'krkkkkkkkkkkkkkkkkkkkkkkkkkrk',
      'krk88k88k88k88k88k88kk88kk8rk',
      'krkkkkkkkkkkkkkkkkkkkk88kkkrk',
      'krrrrrrrrrrrrrrrrrrrrk88krrrk',
      'krrrrrrrrrrrrrrrrrrrrk88krryk',
      'kkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kkkkk..........kkkkk.....',
      '....kkekk..........kkekk.....',
      '.....kkk............kkk......'
    ],
    colours: { 8: '#8fd3ff' }
  },
  car: {
    group: 'Out and about', says: 'a car',
    rows: [
      '.......kkkkkkkkkk.......',
      '......k88888k88888k.....',
      '.....k888888k888888k....',
      '..kkkkkkkkkkkkkkkkkkkkk.',
      '.kbbbbbbbbbbbbbbbbbbbbbk',
      'kybbbbbbbbbbbbbbbbbbbbrk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      '...kkkkk........kkkkk...',
      '...kkekk........kkekk...',
      '....kkk..........kkk....'
    ],
    colours: { 8: '#8fd3ff' }
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
  }
};

/** The things by what they are about, for the guides people and agents choose from. */
export const THING_GROUPS = Object.entries(THINGS).reduce((groups, [name, thing]) => {
  (groups[thing.group] ??= []).push(name);
  return groups;
}, {});
