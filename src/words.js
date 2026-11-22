// The player's own words, in each language a reel can be in: what its buttons say and what
// it says before Play is pressed, and (APP_WORDS) what the player in a chat says while a reel
// is being recorded. A reel's own words are written in its language by whoever made it; these
// are the few around it. Data only. English is what everything falls back to. The other
// languages were written without anyone who speaks them reading them over.

/** The words of the player itself. */
export const WORDS = {
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
export const APP_WORDS = {
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
export const LANG_CODES = { english: 'en', french: 'fr', german: 'de', spanish: 'es', italian: 'it', portuguese: 'pt', dutch: 'nl' };

/** The player's words in `language` (as a reel names it: french), or in English for one it has none for. */
export function wordsFor(language) {
  return WORDS[language] ?? WORDS.english;
}

/** `words` with each {name} in it replaced by that name's value. */
export function filled(words, values) {
  return words.replace(/\{(\w+)\}/g, (all, name) => (name in values ? String(values[name]) : all));
}
