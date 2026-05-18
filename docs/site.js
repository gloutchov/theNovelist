/* global document, navigator, window */

const translations = {
  it: {
    'nav.features': 'Funzionalità',
    'nav.gallery': 'Immagini',
    'nav.privacy': 'Privacy',
    'nav.download': 'Download',
    'hero.eyebrow': 'Desktop app open source',
    'hero.copy':
      'Progetta, scrivi, revisiona ed esporta romanzi con canvas narrativi, editor semplificato, memoria locale del progetto e assistenza AI opzionale.',
    'hero.download': 'Scarica la release',
    'hero.repo': 'Repository GitHub',
    'facts.versionLabel': 'Versione',
    'facts.platformsLabel': 'Piattaforme',
    'facts.licenseLabel': 'Licenza',
    'intro.eyebrow': 'Per scrittori affermati e non',
    'intro.title': 'Un ambiente pensato per scrivere romanzi dalla A alla Z.',
    'intro.body':
      "The Novelist offre una scrivania adatta allo sviluppo delle trame, alla gestione della timeline, all'organizzazione di personaggi e locations. Ogni storia ha la sua memoria, così che l'autore possa avere sempre consapevolezza di ciò che scrive, ed essere aiutato dalla AI quando e se è necessario, con analisi approfondite del testo.",
    'features.eyebrow': 'Funzionalita principali',
    'features.title': 'Dalla mappa narrativa al manoscritto completo.',
    'features.dashboard.title': 'Cruscotto progetto',
    'features.dashboard.body':
      'A che punto è il romanzo? Quante pagine sono state scritte? I tempi stabiliti sono rispettati? I personaggi, le location, sono veramente presenti nella storia? Tutti i dettagli del romanzo sono disponibili e sempre aggiornati, per non perdere mai il filo.',
    'features.canvas.title': 'Canvas narrativi',
    'features.canvas.body':
      'Scrivi una scena. Decidi in quale capitolo va inclusa. Ordina i capitoli nel modo più incisivo. Organizza la trama principale e quelle secondarie. In ogni momento è possibile riorganizzare tutto quanto, per rendere la scrittura molto più snella.',
    'features.editor.title': 'Editor semplificato',
    'features.editor.body':
      'Un ambiente essenziale per scrivere senza distrazioni, con le funzioni basilari, la possibilità di descrivere e definire i personaggi, le location, e le scene. Dotato di un consulente AI per ricerche su quanto già scritto, per non perdere mai il punto della situazione.',
    'features.memory.title': 'Memoria locale',
    'features.memory.body':
      "Ogni progetto ha la sua memoria. Il programma si segna ogni parola scritta, ogni idea condivisa con la AI, ogni cambiamento. Tutto quanto è sempre disponibile all'autore.",
    'features.ai.title': 'AI (opzionale)',
    'features.ai.body':
      "Quando abilitata, l'intelligenza artificiale può eseguire analisi di coerenza, eventi aperti, stile e ritmo del testo. Si può optare tra OpenAI API o un modello locale tramite Ollama.",
    'features.export.title': 'Export',
    'features.export.body':
      "Il testo può essere esportato nei formati principali: ePub, Word, e stampato su carta o in PDF. Ciò vale sia per il singolo capitolo, sia per l'intero romanzo.",
    'gallery.eyebrow': "Immagini dell'app",
    'gallery.title': "Anteprime dell'interfaccia.",
    'gallery.dashboard': 'Il Cruscotto offre controlli e stato di avanzamento del progetto.',
    'gallery.canvas': 'I Canvas sono utili per visualizzare trame, capitoli e relazioni narrative.',
    'gallery.editor':
      "L'Editor semplificato riduce le distrazioni e snellisce le attività di scrittura.",
    'gallery.outline':
      "La Scaletta offre uno strumento drag and drop per organizzare l'ordine di lettura.",
    'gallery.timeline':
      'La Timeline è utile a gestire la cronologia degli eventi, e sfruttare al meglio i flashback.',
    'gallery.characters':
      'Le Schede personaggio/location mostrano relazioni, immagini e collegamenti narrativi.',
    'gallery.revisions':
      'Lo Storico revisioni è importante per confrontare e recuperare versioni precedenti.',
    'gallery.analysis':
      'Usa la AI per svolgere Analisi di coerenza, ritmo, stile, eventi aperti e convenzioni.',
    'privacy.eyebrow': 'AI e privacy',
    'privacy.title': "Il controllo è nelle mani dell'autore.",
    'privacy.body':
      "L'intelligenza artificiale è uno strumento dalle potenzialità incredibili, ma l'autore deve sempre essere consapevole di quali informazioni andrà a gestire. Per questo motivo le funzioni AI sono disattivate per default nei nuovi progetti. L'autore decide, progetto per progetto, se abilitare il provider, consentire chiamate API esterne e condividere la memoria locale del progetto con servizi remoti. In alternativa può essere implementato un modello locale tramite Ollama.",
    'privacy.item1': 'Supporto OpenAI API e Ollama.',
    'privacy.item2': 'Persistenza locale con database SQLite.',
    'privacy.item3': 'Documentazione tecnica del modello di sicurezza.',
    'download.eyebrow': 'Download e codice',
    'download.title': 'Scarica la build o esplora il repository.',
    'download.body':
      'Le build pubbliche sono disponibili nelle GitHub Releases. Il codice sorgente, la documentazione utente e il modello di sicurezza sono nel repository.',
    'download.releases': 'Releases',
    'download.source': 'Codice sorgente',
    'download.docs': 'Manuale',
  },
  en: {
    'nav.features': 'Features',
    'nav.gallery': 'Images',
    'nav.privacy': 'Privacy',
    'nav.download': 'Download',
    'hero.eyebrow': 'Open source desktop app',
    'hero.copy':
      'Plan, write, revise, and export novels with narrative canvases, a streamlined editor, local project memory, and optional AI assistance.',
    'hero.download': 'Download release',
    'hero.repo': 'GitHub repository',
    'facts.versionLabel': 'Version',
    'facts.platformsLabel': 'Platforms',
    'facts.licenseLabel': 'License',
    'intro.eyebrow': 'For established and emerging writers',
    'intro.title': 'A workspace designed to write novels from A to Z.',
    'intro.body':
      'The Novelist offers a writing desk for developing plots, managing the timeline, and organizing characters and locations. Every story has its own memory, so the author can always stay aware of what has been written and receive AI help when, and only when, it is needed, with in-depth text analysis.',
    'features.eyebrow': 'Main features',
    'features.title': 'From narrative map to complete manuscript.',
    'features.dashboard.title': 'Project dashboard',
    'features.dashboard.body':
      'How far along is the novel? How many pages have been written? Are the planned deadlines being met? Are the characters and locations truly present in the story? Every detail of the novel is available and always up to date, so you never lose the thread.',
    'features.canvas.title': 'Narrative canvases',
    'features.canvas.body':
      'Write a scene. Decide which chapter it belongs in. Arrange chapters in the most effective order. Organize the main plot and subplots. Everything can be reorganized at any time, making the writing process much leaner.',
    'features.editor.title': 'Streamlined editor',
    'features.editor.body':
      'An essential writing environment without distractions, with basic tools and the ability to describe and define characters, locations, and scenes. It includes an AI consultant for searching what has already been written, so you never lose track of the situation.',
    'features.memory.title': 'Local memory',
    'features.memory.body':
      'Every project has its own memory. The program records every written word, every idea shared with the AI, and every change. Everything remains available to the author.',
    'features.ai.title': 'AI (optional)',
    'features.ai.body':
      'When enabled, artificial intelligence can analyze coherence, open events, style, and text rhythm. You can choose between the OpenAI API or a local model through Ollama.',
    'features.export.title': 'Export',
    'features.export.body':
      'Text can be exported to the main formats: ePub, Word, and print on paper or to PDF. This applies to both a single chapter and the entire novel.',
    'gallery.eyebrow': 'App images',
    'gallery.title': 'Interface previews.',
    'gallery.dashboard': 'The Dashboard provides checks and project progress status.',
    'gallery.canvas': 'Canvases help visualize plots, chapters, and narrative relationships.',
    'gallery.editor':
      'The streamlined editor reduces distractions and makes writing tasks smoother.',
    'gallery.outline':
      'The Outline provides a drag-and-drop tool for organizing the reading order.',
    'gallery.timeline':
      'The Timeline helps manage event chronology and make the most of flashbacks.',
    'gallery.characters':
      'Character/location cards show relationships, images, and narrative links.',
    'gallery.revisions':
      'Revision history is important for comparing and recovering previous versions.',
    'gallery.analysis':
      'Use AI to run analyses of coherence, rhythm, style, open events, and conventions.',
    'privacy.eyebrow': 'AI and privacy',
    'privacy.title': 'Control stays in the author hands.',
    'privacy.body':
      'Artificial intelligence is a tool with incredible potential, but the author must always know which information it will handle. For this reason, AI features are disabled by default in new projects. The author decides, project by project, whether to enable the provider, allow external API calls, and share local project memory with remote services. Alternatively, a local model can be implemented through Ollama.',
    'privacy.item1': 'OpenAI API and Ollama support.',
    'privacy.item2': 'Local persistence with SQLite.',
    'privacy.item3': 'Technical security model documentation.',
    'download.eyebrow': 'Download and source',
    'download.title': 'Download a build or explore the repository.',
    'download.body':
      'Public builds are available from GitHub Releases. Source code, user documentation, and the security model are in the repository.',
    'download.releases': 'Releases',
    'download.source': 'Source code',
    'download.docs': 'Manual',
  },
};

const buttons = document.querySelectorAll('[data-language]');
const translatable = document.querySelectorAll('[data-i18n]');
const localizedImages = document.querySelectorAll('[data-src-it][data-src-en]');
const localizedBackgrounds = document.querySelectorAll('[data-background-it][data-background-en]');
const localizedLinks = document.querySelectorAll('[data-href-it][data-href-en]');
let currentLanguage = 'it';

function getImageSource(image, language) {
  const sourceKey =
    image.dataset.lightPreview === 'true' ? `data-light-src-${language}` : `data-src-${language}`;
  return image.getAttribute(sourceKey) || image.getAttribute(`data-src-${language}`);
}

function updateImageSource(image) {
  const source = getImageSource(image, currentLanguage);
  const alt = image.getAttribute(`data-alt-${currentLanguage}`);
  if (source) {
    image.setAttribute('src', source);
  }
  if (alt) {
    image.setAttribute('alt', alt);
  }
}

function setLanguage(language) {
  const dictionary = translations[language] ?? translations.it;
  currentLanguage = translations[language] ? language : 'it';
  document.documentElement.lang = language;
  translatable.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key && dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });
  localizedImages.forEach((image) => {
    updateImageSource(image);
  });
  localizedBackgrounds.forEach((element) => {
    const source = element.getAttribute(`data-background-${language}`);
    if (source) {
      element.style.setProperty('--hero-image', `url("${source}")`);
    }
  });
  localizedLinks.forEach((element) => {
    const href = element.getAttribute(`data-href-${language}`);
    if (href) {
      element.setAttribute('href', href);
    }
  });
  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-language') === language;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  window.localStorage.setItem('the-novelist-site-language', language);
}

localizedImages.forEach((image) => {
  image.addEventListener('mouseenter', () => {
    image.dataset.lightPreview = 'true';
    updateImageSource(image);
  });
  image.addEventListener('mouseleave', () => {
    delete image.dataset.lightPreview;
    updateImageSource(image);
  });
  image.addEventListener('focus', () => {
    image.dataset.lightPreview = 'true';
    updateImageSource(image);
  });
  image.addEventListener('blur', () => {
    delete image.dataset.lightPreview;
    updateImageSource(image);
  });
});

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    setLanguage(button.getAttribute('data-language') || 'it');
  });
});

const savedLanguage = window.localStorage.getItem('the-novelist-site-language');
const browserLanguage = navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'it';
setLanguage(savedLanguage || browserLanguage);
