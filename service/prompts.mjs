// Ready-made things to ask for: MCP prompts, which Claude shows in its own menu under Pixel
// Reel, so someone who finds writing hard work can pick "A reel of this letter" instead of
// working out what to type. Each is the words a person would say, with what makes a good
// reel of that kind of thing; the same advice is in the guide (WHAT_TO_PUT_IN), for when the
// person asks in their own words.

/** What goes into a reel, by what the person hands over. Each is one line of the guide. */
export const WHAT_TO_PUT_IN = {
  letter: 'A letter, bill or form: who it is from and what it is about; what the person has to do, if anything; by when; what happens if they do not; and who to ring. Use its real amounts and dates.',
  document: 'A document or web page: the few things that matter most to someone reading it for the first time. Stick to what it says, and add no facts of your own.',
  chat: 'A chat: what was worked out, what was decided and what happens next, not the back and forth.',
  howTo: 'How to do something: the steps in order, one a scene, and the mistake people usually make.'
};

const PRIVATE = 'Leave out names, addresses, and account or reference numbers: anyone with the link can watch.';

/** The prompts, as prompts/list shows them, each with `words(args)`: what choosing it asks Claude. */
export const PROMPTS = [
  {
    name: 'reel_about',
    title: 'A reel about...',
    description: 'A pixel reel that explains whatever you name: how something works, how to do something, or a question you have.',
    arguments: [{ name: 'about', description: 'What you want explained, in a few words.', required: true }],
    words: ({ about }) => `Make me a pixel reel about this: ${about}`
  },
  {
    name: 'reel_of_a_letter',
    title: 'A reel of a letter or bill',
    description: 'A pixel reel of a letter, bill or form you have pasted, attached or photographed: what it says, what to do, and by when.',
    arguments: [],
    words: () => 'Make me a pixel reel of the letter I have given you in this chat: pasted, attached, or in a photo. ' +
      'If I have not given you one yet, ask me for it in one short sentence, and wait.\n' +
      'I find letters hard to read. Tell me, in this order: who it is from and what it is about; what I have to do, if anything; by when; what happens if I do not; and who to ring if I am stuck. ' +
      `Use its real amounts and dates. ${PRIVATE} If part of it is unclear, say so plainly, do not guess.`
  },
  {
    name: 'reel_of_a_document',
    title: 'A reel of a document or web page',
    description: 'A pixel reel of something long: a document you have attached, or a web page you give the address of.',
    arguments: [{ name: 'link', description: 'The web address, if it is a web page. Leave it empty for a document you have attached.', required: false }],
    words: ({ link }) => `Make me a pixel reel of ${link ? `the web page at ${link}` : 'the document I have given you in this chat'}. ` +
      `${link ? 'If you cannot read it, tell me so in one short sentence.' : 'If I have not given you one yet, ask me for it in one short sentence, and wait.'}\n` +
      'Pick out the few things that matter most to someone reading it for the first time, and say them in plain words. Stick to what it says: add no facts of your own.'
  },
  {
    name: 'reel_of_this_chat',
    title: 'A reel of this chat',
    description: 'A pixel reel of the conversation so far: what was worked out, what was decided, and what happens next.',
    arguments: [],
    words: () => 'Make me a pixel reel of our chat so far. Not the back and forth: what we worked out, what was decided, and what happens next. ' +
      `Start by saying what it is about, so it makes sense to someone who was not here. ${PRIVATE}`
  }
];

const named = (word) => word[0].toUpperCase() + word.slice(1);
const listed = (words) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words.at(-1)}` : words[0]);

/**
 * The choices every prompt offers besides its own, where the service has them to offer:
 * who reads the reel (`narrators`, besides Peter) and the language it is in (`languages`,
 * besides English). A person picking a prompt sees them as boxes to fill in or leave empty.
 */
function choices({ narrators = [], languages = [] } = {}) {
  return [
    ...(narrators.length ? [{
      name: 'voice',
      description: `Who reads it aloud: ${listed(['Peter', ...narrators.map(named)])}. Leave it empty for Peter.`,
      required: false,
      words: (voice) => ` Have it read by ${voice}.`
    }] : []),
    ...(languages.length ? [{
      name: 'language',
      description: `The language to make it in: ${listed(['English', ...languages.map(named)])}. Leave it empty for English.`,
      required: false,
      words: (language) => ` Make it in ${language}.`
    }] : [])
  ];
}

/** The prompts without their words, for prompts/list. `offered` is { narrators, languages }: what the service can do besides Peter and English. */
export function promptList(offered) {
  const extra = choices(offered).map(({ words: _words, ...choice }) => choice);
  return PROMPTS.map(({ words: _words, ...prompt }) => ({ ...prompt, arguments: [...prompt.arguments, ...extra] }));
}

/**
 * What choosing the prompt `name` asks, as prompts/get answers: one message from the person.
 * What they typed is kept to one line of a sensible length. Null if there is no such prompt;
 * throws if something it needs was not given. `offered` as for promptList: a voice or a
 * language that was asked for is added to the words, for Claude to set on the reel.
 */
export function promptMessages(name, given = {}, offered = {}) {
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) return null;
  const tidy = (key, most = 600) => String(given?.[key] ?? '').replace(/\s+/g, ' ').trim().slice(0, most);
  const args = {};
  for (const { name: key, required } of prompt.arguments) {
    args[key] = tidy(key);
    if (required && !args[key]) throw new Error(`"${prompt.title}" needs ${key}.`);
  }
  const asked = choices(offered).map((choice) => [choice, tidy(choice.name, 40)]).filter(([, value]) => value).map(([choice, value]) => choice.words(value)).join('');
  const text = asked ? `${prompt.words(args)}\n${asked.trim()}` : prompt.words(args);
  return { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text } }] };
}
