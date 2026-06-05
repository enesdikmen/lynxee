export const UI_LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
  { code: 'tr', label: 'TR' },
  { code: 'de', label: 'DE' },
  { code: 'it', label: 'IT' },
  { code: 'pt', label: 'PT' },
] as const

export type UiLanguage = (typeof UI_LANGUAGES)[number]['code']

export type UiText = {
  toolbar: {
    language: string
    languageAria: string
    regenerate: string
    regenerateTitle: string
    share: string
    shareCopied: string
    shareTitle: string
    pdf: string
    pdfTitle: string
    lockCard: string
    unlockCard: string
    lockCardTitle: string
    unlockCardTitle: string
    loadingSnapshot: string
  }
  citySearch: {
    placeholder: string
    pickCity: string
    ariaLabel: string
    searching: string
    failed: string
    noMatches: string
  }
  poster: {
    portraitTitle: string
    sightingsOnGbif: string
    iucnRedList: string
    doingWell: string
    watchList: string
    atRisk: string
    comparisonTitle: string
    cities: string
    countries: string
    comparedWith: (count: string, cohort: string) => string
    recordingIntensity: string
    threatenedShare: string
    percentile: (rank: number) => string
    percentileAria: (label: string, rank: number) => string
    mostObservedSpecies: string
    observations: (count: string) => string
    imageUnavailable: string
    imageUnavailableAria: (alt: string) => string
    seasonality: string
    recordsSince: (year: number) => string
    monthlyObservations: string
    peakYear: (year: number, count: string) => string
    inLastDecade: (percent: number) => string
    evidenceMix: string
    evidenceLabels: Record<string, string>
    otherSources: (count: number) => string
    atRiskRibbon: (category: string) => string
    signatureRibbon: (ratio: string) => string
    sources: string
    dataFrom: string
    scanQr: string
    thematic: {
      inSeason: (month: string) => string
      smallWonder: string
      nightCreature: string
    }
  }
}

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en'

export const normalizeUiLanguage = (language?: string | null): UiLanguage => {
  const normalized = (language ?? '').trim().toLowerCase()
  return UI_LANGUAGES.some((option) => option.code === normalized)
    ? (normalized as UiLanguage)
    : DEFAULT_UI_LANGUAGE
}

const englishText: UiText = {
  toolbar: {
    language: 'Language',
    languageAria: 'Common names language',
    regenerate: 'Regenerate',
    regenerateTitle: 'Regenerate layout and data',
    share: 'Share',
    shareCopied: 'Link copied',
    shareTitle: 'Copy a shareable link to this exact poster',
    pdf: 'PDF',
    pdfTitle: "Open the browser print dialog - choose 'Save as PDF'",
    lockCard: 'Lock card',
    unlockCard: 'Unlock card',
    lockCardTitle: 'Lock card content and position',
    unlockCardTitle: 'Unlock card',
    loadingSnapshot: 'Loading full place snapshot...',
  },
  citySearch: {
    placeholder: 'Search a city...',
    pickCity: 'Pick a city',
    ariaLabel: 'Search a city',
    searching: 'Searching...',
    failed: 'Search failed',
    noMatches: 'No matches',
  },
  poster: {
    portraitTitle: 'Biodiversity Portrait',
    sightingsOnGbif: 'Sightings on GBIF',
    iucnRedList: 'IUCN Red List',
    doingWell: 'Doing well',
    watchList: 'Watch list',
    atRisk: 'At risk',
    comparisonTitle: 'How this place compares',
    cities: 'cities',
    countries: 'countries',
    comparedWith: (count, cohort) => `vs ${count} ${cohort}`,
    recordingIntensity: 'Recording intensity',
    threatenedShare: 'Threatened share',
    percentile: (rank) => `Above ${rank}%`,
    percentileAria: (label, rank) => `${label} is above ${rank}% of similar places`,
    mostObservedSpecies: 'Most observed species',
    observations: (count) => `${count} observations`,
    imageUnavailable: 'Image unavailable',
    imageUnavailableAria: (alt) => `${alt} image unavailable`,
    seasonality: 'Seasonality',
    recordsSince: (year) => `Records since ${year}`,
    monthlyObservations: 'Monthly observations',
    peakYear: (year, count) => `Peak ${year}: ${count} obs`,
    inLastDecade: (percent) => `${percent}% in last decade`,
    evidenceMix: 'Evidence mix',
    evidenceLabels: {
      HUMAN_OBSERVATION: 'Citizen science',
      PRESERVED_SPECIMEN: 'Museum + herbarium',
      MATERIAL_SAMPLE: 'Field samples',
      MACHINE_OBSERVATION: 'Cameras + sensors',
      OBSERVATION: 'Field observation',
    },
    otherSources: (count) => `${count} other source${count === 1 ? '' : 's'}`,
    atRiskRibbon: (category) => `At risk - ${category}`,
    signatureRibbon: (ratio) => `Signature - ${ratio}`,
    sources: 'Sources',
    dataFrom: 'Data from',
    scanQr: 'Scan to open this poster',
    thematic: {
      inSeason: (month) => `In season - ${month}`,
      smallWonder: 'Small wonder',
      nightCreature: 'Night creature',
    },
  },
}

const frenchText: UiText = {
  toolbar: {
    language: 'Langue',
    languageAria: 'Langue des noms communs',
    regenerate: 'Regenerer',
    regenerateTitle: 'Regenerer la mise en page et les donnees',
    share: 'Partager',
    shareCopied: 'Lien copie',
    shareTitle: 'Copier un lien partageable vers cette affiche',
    pdf: 'PDF',
    pdfTitle: "Ouvrir la boite de dialogue d'impression - choisir 'Enregistrer au format PDF'",
    lockCard: 'Verrouiller la carte',
    unlockCard: 'Deverrouiller la carte',
    lockCardTitle: 'Verrouiller le contenu et la position de la carte',
    unlockCardTitle: 'Deverrouiller la carte',
    loadingSnapshot: 'Chargement complet du lieu...',
  },
  citySearch: {
    placeholder: 'Rechercher une ville...',
    pickCity: 'Choisir une ville',
    ariaLabel: 'Rechercher une ville',
    searching: 'Recherche...',
    failed: 'Echec de la recherche',
    noMatches: 'Aucun resultat',
  },
  poster: {
    portraitTitle: 'Portrait de biodiversite',
    sightingsOnGbif: 'Observations sur GBIF',
    iucnRedList: "Liste rouge de l'IUCN",
    doingWell: 'En bon etat',
    watchList: 'A surveiller',
    atRisk: 'Menace',
    comparisonTitle: 'Comparaison de ce lieu',
    cities: 'villes',
    countries: 'pays',
    comparedWith: (count, cohort) => `vs ${count} ${cohort}`,
    recordingIntensity: 'Intensite de collecte',
    threatenedShare: 'Part menacee',
    percentile: (rank) => `Au-dessus ${rank}%`,
    percentileAria: (label, rank) => `${label} est au-dessus de ${rank}% des lieux similaires`,
    mostObservedSpecies: 'Espece la plus observee',
    observations: (count) => `${count} observations`,
    imageUnavailable: 'Image indisponible',
    imageUnavailableAria: (alt) => `Image indisponible pour ${alt}`,
    seasonality: 'Saisonnalite',
    recordsSince: (year) => `Donnees depuis ${year}`,
    monthlyObservations: 'Observations mensuelles',
    peakYear: (year, count) => `Pic ${year}: ${count} obs`,
    inLastDecade: (percent) => `${percent}% sur la derniere decennie`,
    evidenceMix: 'Types de preuves',
    evidenceLabels: {
      HUMAN_OBSERVATION: 'Science participative',
      PRESERVED_SPECIMEN: 'Musee + herbier',
      MATERIAL_SAMPLE: 'Echantillons de terrain',
      MACHINE_OBSERVATION: 'Cameras + capteurs',
      OBSERVATION: 'Observation de terrain',
    },
    otherSources: (count) => `${count} autre source${count === 1 ? '' : 's'}`,
    atRiskRibbon: (category) => `Menace - ${category}`,
    signatureRibbon: (ratio) => `Signature - ${ratio}`,
    sources: 'Sources',
    dataFrom: 'Donnees de',
    scanQr: 'Scanner pour ouvrir cette affiche',
    thematic: {
      inSeason: (month) => `De saison - ${month}`,
      smallWonder: 'Petite merveille',
      nightCreature: 'Creature nocturne',
    },
  },
}

const spanishText: UiText = {
  toolbar: {
    language: 'Idioma',
    languageAria: 'Idioma de los nombres comunes',
    regenerate: 'Regenerar',
    regenerateTitle: 'Regenerar diseno y datos',
    share: 'Compartir',
    shareCopied: 'Enlace copiado',
    shareTitle: 'Copiar un enlace compartible a este poster',
    pdf: 'PDF',
    pdfTitle: "Abrir el dialogo de impresion - elegir 'Guardar como PDF'",
    lockCard: 'Bloquear tarjeta',
    unlockCard: 'Desbloquear tarjeta',
    lockCardTitle: 'Bloquear contenido y posicion de la tarjeta',
    unlockCardTitle: 'Desbloquear tarjeta',
    loadingSnapshot: 'Cargando instantanea completa del lugar...',
  },
  citySearch: {
    placeholder: 'Buscar una ciudad...',
    pickCity: 'Elegir una ciudad',
    ariaLabel: 'Buscar una ciudad',
    searching: 'Buscando...',
    failed: 'La busqueda fallo',
    noMatches: 'Sin resultados',
  },
  poster: {
    portraitTitle: 'Retrato de biodiversidad',
    sightingsOnGbif: 'Observaciones en GBIF',
    iucnRedList: 'Lista Roja de la IUCN',
    doingWell: 'En buen estado',
    watchList: 'En seguimiento',
    atRisk: 'En riesgo',
    comparisonTitle: 'Comparacion de este lugar',
    cities: 'ciudades',
    countries: 'paises',
    comparedWith: (count, cohort) => `frente a ${count} ${cohort}`,
    recordingIntensity: 'Intensidad de registro',
    threatenedShare: 'Proporcion amenazada',
    percentile: (rank) => `Por encima ${rank}%`,
    percentileAria: (label, rank) => `${label} esta por encima del ${rank}% de lugares similares`,
    mostObservedSpecies: 'Especie mas observada',
    observations: (count) => `${count} observaciones`,
    imageUnavailable: 'Imagen no disponible',
    imageUnavailableAria: (alt) => `Imagen de ${alt} no disponible`,
    seasonality: 'Estacionalidad',
    recordsSince: (year) => `Registros desde ${year}`,
    monthlyObservations: 'Observaciones mensuales',
    peakYear: (year, count) => `Pico ${year}: ${count} obs`,
    inLastDecade: (percent) => `${percent}% en la ultima decada`,
    evidenceMix: 'Mezcla de evidencias',
    evidenceLabels: {
      HUMAN_OBSERVATION: 'Ciencia ciudadana',
      PRESERVED_SPECIMEN: 'Museo + herbario',
      MATERIAL_SAMPLE: 'Muestras de campo',
      MACHINE_OBSERVATION: 'Camaras + sensores',
      OBSERVATION: 'Observacion de campo',
    },
    otherSources: (count) => `${count} otra fuente${count === 1 ? '' : 's'}`,
    atRiskRibbon: (category) => `En riesgo - ${category}`,
    signatureRibbon: (ratio) => `Firma - ${ratio}`,
    sources: 'Fuentes',
    dataFrom: 'Datos de',
    scanQr: 'Escanear para abrir este poster',
    thematic: {
      inSeason: (month) => `En temporada - ${month}`,
      smallWonder: 'Pequena maravilla',
      nightCreature: 'Criatura nocturna',
    },
  },
}

const turkishText: UiText = {
  toolbar: {
    language: 'Dil',
    languageAria: 'Yaygin ad dili',
    regenerate: 'Yenile',
    regenerateTitle: 'Duzeni ve verileri yeniden olustur',
    share: 'Paylas',
    shareCopied: 'Baglanti kopyalandi',
    shareTitle: 'Bu poster icin paylasilabilir baglantiyi kopyala',
    pdf: 'PDF',
    pdfTitle: "Tarayici yazdirma penceresini ac - 'PDF olarak kaydet'i sec",
    lockCard: 'Karti kilitle',
    unlockCard: 'Kart kilidini ac',
    lockCardTitle: 'Kart icerigini ve konumunu kilitle',
    unlockCardTitle: 'Kart kilidini ac',
    loadingSnapshot: 'Tam yer anlik goruntusu yukleniyor...',
  },
  citySearch: {
    placeholder: 'Sehir ara...',
    pickCity: 'Sehir sec',
    ariaLabel: 'Sehir ara',
    searching: 'Araniyor...',
    failed: 'Arama basarisiz',
    noMatches: 'Eslesme yok',
  },
  poster: {
    portraitTitle: 'Biyocesitlilik Portresi',
    sightingsOnGbif: 'GBIF gozlemleri',
    iucnRedList: 'IUCN Kirmizi Liste',
    doingWell: 'Iyi durumda',
    watchList: 'Izleme listesi',
    atRisk: 'Risk altinda',
    comparisonTitle: 'Bu yerin karsilastirmasi',
    cities: 'sehir',
    countries: 'ulke',
    comparedWith: (count, cohort) => `${count} ${cohort} ile karsilastirma`,
    recordingIntensity: 'Kayit yogunlugu',
    threatenedShare: 'Tehdit altindaki pay',
    percentile: (rank) => `%${rank} ustunde`,
    percentileAria: (label, rank) => `${label}, benzer yerlerin %${rank} ustunde`,
    mostObservedSpecies: 'En cok gozlenen tur',
    observations: (count) => `${count} gozlem`,
    imageUnavailable: 'Gorsel yok',
    imageUnavailableAria: (alt) => `${alt} gorseli yok`,
    seasonality: 'Mevsimsellik',
    recordsSince: (year) => `${year} yilindan beri kayitlar`,
    monthlyObservations: 'Aylik gozlemler',
    peakYear: (year, count) => `Zirve ${year}: ${count} gozlem`,
    inLastDecade: (percent) => `son on yilda %${percent}`,
    evidenceMix: 'Kanit karisimi',
    evidenceLabels: {
      HUMAN_OBSERVATION: 'Vatandas bilimi',
      PRESERVED_SPECIMEN: 'Muze + herbaryum',
      MATERIAL_SAMPLE: 'Saha ornekleri',
      MACHINE_OBSERVATION: 'Kameralar + sensorler',
      OBSERVATION: 'Saha gozlemi',
    },
    otherSources: (count) => `${count} diger kaynak`,
    atRiskRibbon: (category) => `Risk altinda - ${category}`,
    signatureRibbon: (ratio) => `Imza - ${ratio}`,
    sources: 'Kaynaklar',
    dataFrom: 'Veri kaynagi',
    scanQr: 'Bu posteri acmak icin tara',
    thematic: {
      inSeason: (month) => `Sezonda - ${month}`,
      smallWonder: 'Kucuk mucize',
      nightCreature: 'Gece canlisi',
    },
  },
}

const germanText: UiText = {
  toolbar: {
    language: 'Sprache',
    languageAria: 'Sprache der Trivialnamen',
    regenerate: 'Neu generieren',
    regenerateTitle: 'Layout und Daten neu generieren',
    share: 'Teilen',
    shareCopied: 'Link kopiert',
    shareTitle: 'Teilbaren Link zu diesem Poster kopieren',
    pdf: 'PDF',
    pdfTitle: "Druckdialog des Browsers offnen - 'Als PDF speichern' wahlen",
    lockCard: 'Karte sperren',
    unlockCard: 'Karte entsperren',
    lockCardTitle: 'Inhalt und Position der Karte sperren',
    unlockCardTitle: 'Karte entsperren',
    loadingSnapshot: 'Vollstandiger Orts-Snapshot wird geladen...',
  },
  citySearch: {
    placeholder: 'Stadt suchen...',
    pickCity: 'Stadt auswahlen',
    ariaLabel: 'Stadt suchen',
    searching: 'Suche lauft...',
    failed: 'Suche fehlgeschlagen',
    noMatches: 'Keine Treffer',
  },
  poster: {
    portraitTitle: 'Biodiversitatsportrat',
    sightingsOnGbif: 'GBIF-Nachweise',
    iucnRedList: 'IUCN Rote Liste',
    doingWell: 'Ungefahrdet',
    watchList: 'Beobachtungsliste',
    atRisk: 'Gefahrdet',
    comparisonTitle: 'Vergleich dieses Ortes',
    cities: 'Stadte',
    countries: 'Lander',
    comparedWith: (count, cohort) => `vs ${count} ${cohort}`,
    recordingIntensity: 'Erfassungsintensitat',
    threatenedShare: 'Anteil gefahrdeter Arten',
    percentile: (rank) => `Uber ${rank}%`,
    percentileAria: (label, rank) => `${label} liegt uber ${rank}% vergleichbarer Orte`,
    mostObservedSpecies: 'Am haufigsten beobachtete Art',
    observations: (count) => `${count} Beobachtungen`,
    imageUnavailable: 'Bild nicht verfugbar',
    imageUnavailableAria: (alt) => `${alt}: Bild nicht verfugbar`,
    seasonality: 'Saisonalitat',
    recordsSince: (year) => `Nachweise seit ${year}`,
    monthlyObservations: 'Monatliche Beobachtungen',
    peakYear: (year, count) => `Hochstwert ${year}: ${count} Beob.`,
    inLastDecade: (percent) => `${percent}% im letzten Jahrzehnt`,
    evidenceMix: 'Evidenzmix',
    evidenceLabels: {
      HUMAN_OBSERVATION: 'Burgerwissenschaft',
      PRESERVED_SPECIMEN: 'Museum + Herbarium',
      MATERIAL_SAMPLE: 'Feldproben',
      MACHINE_OBSERVATION: 'Kameras + Sensoren',
      OBSERVATION: 'Feldbeobachtung',
    },
    otherSources: (count) => `${count} weitere Quelle${count === 1 ? '' : 'n'}`,
    atRiskRibbon: (category) => `Gefahrdet - ${category}`,
    signatureRibbon: (ratio) => `Signatur - ${ratio}`,
    sources: 'Quellen',
    dataFrom: 'Daten von',
    scanQr: 'Scannen, um dieses Poster zu offnen',
    thematic: {
      inSeason: (month) => `Saison - ${month}`,
      smallWonder: 'Kleines Wunder',
      nightCreature: 'Nachtaktive Art',
    },
  },
}

const italianText: UiText = {
  toolbar: {
    language: 'Lingua',
    languageAria: 'Lingua dei nomi comuni',
    regenerate: 'Rigenera',
    regenerateTitle: 'Rigenera layout e dati',
    share: 'Condividi',
    shareCopied: 'Link copiato',
    shareTitle: 'Copia un link condivisibile a questo poster',
    pdf: 'PDF',
    pdfTitle: "Apri il dialogo di stampa - scegli 'Salva come PDF'",
    lockCard: 'Blocca scheda',
    unlockCard: 'Sblocca scheda',
    lockCardTitle: 'Blocca contenuto e posizione della scheda',
    unlockCardTitle: 'Sblocca scheda',
    loadingSnapshot: 'Caricamento snapshot completo del luogo...',
  },
  citySearch: {
    placeholder: 'Cerca una citta...',
    pickCity: 'Scegli una citta',
    ariaLabel: 'Cerca una citta',
    searching: 'Ricerca...',
    failed: 'Ricerca non riuscita',
    noMatches: 'Nessun risultato',
  },
  poster: {
    portraitTitle: 'Ritratto della biodiversita',
    sightingsOnGbif: 'Osservazioni su GBIF',
    iucnRedList: 'Lista Rossa IUCN',
    doingWell: 'In buono stato',
    watchList: 'Da monitorare',
    atRisk: 'A rischio',
    comparisonTitle: 'Confronto di questo luogo',
    cities: 'citta',
    countries: 'paesi',
    comparedWith: (count, cohort) => `rispetto a ${count} ${cohort}`,
    recordingIntensity: 'Intensita di registrazione',
    threatenedShare: 'Quota minacciata',
    percentile: (rank) => `Sopra ${rank}%`,
    percentileAria: (label, rank) => `${label} e sopra il ${rank}% dei luoghi simili`,
    mostObservedSpecies: 'Specie piu osservata',
    observations: (count) => `${count} osservazioni`,
    imageUnavailable: 'Immagine non disponibile',
    imageUnavailableAria: (alt) => `Immagine di ${alt} non disponibile`,
    seasonality: 'Stagionalita',
    recordsSince: (year) => `Dati dal ${year}`,
    monthlyObservations: 'Osservazioni mensili',
    peakYear: (year, count) => `Picco ${year}: ${count} oss.`,
    inLastDecade: (percent) => `${percent}% nell'ultimo decennio`,
    evidenceMix: 'Mix di evidenze',
    evidenceLabels: {
      HUMAN_OBSERVATION: 'Scienza partecipata',
      PRESERVED_SPECIMEN: 'Museo + erbario',
      MATERIAL_SAMPLE: 'Campioni sul campo',
      MACHINE_OBSERVATION: 'Fotocamere + sensori',
      OBSERVATION: 'Osservazione sul campo',
    },
    otherSources: (count) => `${count} ${count === 1 ? 'altra fonte' : 'altre fonti'}`,
    atRiskRibbon: (category) => `A rischio - ${category}`,
    signatureRibbon: (ratio) => `Firma - ${ratio}`,
    sources: 'Fonti',
    dataFrom: 'Dati da',
    scanQr: 'Scansiona per aprire questo poster',
    thematic: {
      inSeason: (month) => `Di stagione - ${month}`,
      smallWonder: 'Piccola meraviglia',
      nightCreature: 'Creatura notturna',
    },
  },
}

const portugueseText: UiText = {
  toolbar: {
    language: 'Idioma',
    languageAria: 'Idioma dos nomes comuns',
    regenerate: 'Regenerar',
    regenerateTitle: 'Regenerar layout e dados',
    share: 'Compartilhar',
    shareCopied: 'Link copiado',
    shareTitle: 'Copiar um link compartilhavel para este poster',
    pdf: 'PDF',
    pdfTitle: "Abrir a caixa de dialogo de impressao - escolher 'Salvar como PDF'",
    lockCard: 'Bloquear cartao',
    unlockCard: 'Desbloquear cartao',
    lockCardTitle: 'Bloquear conteudo e posicao do cartao',
    unlockCardTitle: 'Desbloquear cartao',
    loadingSnapshot: 'Carregando instantaneo completo do lugar...',
  },
  citySearch: {
    placeholder: 'Buscar uma cidade...',
    pickCity: 'Escolher uma cidade',
    ariaLabel: 'Buscar uma cidade',
    searching: 'Buscando...',
    failed: 'Busca falhou',
    noMatches: 'Sem resultados',
  },
  poster: {
    portraitTitle: 'Retrato da biodiversidade',
    sightingsOnGbif: 'Observacoes no GBIF',
    iucnRedList: 'Lista Vermelha da IUCN',
    doingWell: 'Em bom estado',
    watchList: 'Lista de atencao',
    atRisk: 'Em risco',
    comparisonTitle: 'Comparacao deste lugar',
    cities: 'cidades',
    countries: 'paises',
    comparedWith: (count, cohort) => `comparado com ${count} ${cohort}`,
    recordingIntensity: 'Intensidade de registro',
    threatenedShare: 'Proporcao ameacada',
    percentile: (rank) => `Acima ${rank}%`,
    percentileAria: (label, rank) => `${label} esta acima de ${rank}% de lugares semelhantes`,
    mostObservedSpecies: 'Especie mais observada',
    observations: (count) => `${count} observacoes`,
    imageUnavailable: 'Imagem indisponivel',
    imageUnavailableAria: (alt) => `Imagem de ${alt} indisponivel`,
    seasonality: 'Sazonalidade',
    recordsSince: (year) => `Registros desde ${year}`,
    monthlyObservations: 'Observacoes mensais',
    peakYear: (year, count) => `Pico ${year}: ${count} obs`,
    inLastDecade: (percent) => `${percent}% na ultima decada`,
    evidenceMix: 'Mistura de evidencias',
    evidenceLabels: {
      HUMAN_OBSERVATION: 'Ciencia cidada',
      PRESERVED_SPECIMEN: 'Museu + herbario',
      MATERIAL_SAMPLE: 'Amostras de campo',
      MACHINE_OBSERVATION: 'Cameras + sensores',
      OBSERVATION: 'Observacao de campo',
    },
    otherSources: (count) => `${count} outra fonte${count === 1 ? '' : 's'}`,
    atRiskRibbon: (category) => `Em risco - ${category}`,
    signatureRibbon: (ratio) => `Assinatura - ${ratio}`,
    sources: 'Fontes',
    dataFrom: 'Dados de',
    scanQr: 'Escaneie para abrir este poster',
    thematic: {
      inSeason: (month) => `Na temporada - ${month}`,
      smallWonder: 'Pequena maravilha',
      nightCreature: 'Criatura noturna',
    },
  },
}

export const UI_TEXT: Record<UiLanguage, UiText> = {
  en: englishText,
  fr: frenchText,
  es: spanishText,
  tr: turkishText,
  de: germanText,
  it: italianText,
  pt: portugueseText,
}

export const getUiText = (language?: string | null): UiText =>
  UI_TEXT[normalizeUiLanguage(language)]
