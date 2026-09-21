/**
 * Italian copy.
 *
 * Typed against `Copy`, so a key added to English and forgotten here is a compile error rather
 * than a screen that silently falls back to English. `check:i18n` catches the reverse too.
 *
 * ## Terms I am not confident about
 *
 * Gym vocabulary in Italian is largely borrowed from English and usage varies between gyms, so
 * these are choices rather than certainties and are worth a native check:
 *
 *   sets      -> "serie"        (widely used; "set" is also heard)
 *   reps      -> "ripetizioni"  (standard, often shortened to "rip")
 *   volume    -> "volume"       (kept, it is the technical term here too)
 *   rest      -> "recupero"     ("riposo" reads as sleep rather than inter-set rest)
 *   routine   -> "scheda"       (what an Italian gym actually calls a training plan)
 *   workout   -> "allenamento"
 *   streak    -> "giorni di fila" (no single Italian noun carries the fitness sense)
 *   pace      -> "ritmo"
 *   PR        -> "record"
 */
import type { Copy } from './en';

export const it: Copy = {
  tabs: {
    home: 'Home',
    activities: 'Attività',
    workout: 'Allenamento',
    exercises: 'Esercizi',
    profile: 'Profilo',
  },

  common: {
    save: 'Salva',
    cancel: 'Annulla',
    done: 'Fatto',
    delete: 'Elimina',
    edit: 'Modifica',
    add: 'Aggiungi',
    close: 'Chiudi',
    retry: 'Riprova',
    search: 'Cerca',
    filters: 'Filtri',
    clear: 'Cancella',
    back: 'Indietro',
    loading: 'Caricamento',
    noValue: '-',
    system: 'Sistema',
  },

  home: {
    eyebrowMorning: 'Buongiorno',
    eyebrowAfternoon: 'Buon pomeriggio',
    eyebrowEvening: 'Buonasera',
    thisWeek: 'Questa settimana',
    sessions: 'Sessioni',
    distance: 'Distanza',
    volume: 'Volume',
    calories: 'Calorie',
    trainingLoad: 'Carico di lavoro',
    lastSixWeeks: 'Ultime 6 settimane',
    latestSessions: 'Ultime sessioni',
    streak_one: '{count} giorno',
    streak_other: '{count} giorni',
    goalRemaining: '{count} all obiettivo settimanale',
    goalMet: 'Obiettivo settimanale raggiunto',
    goalLeft_one: 'Manca {count} sessione per l obiettivo settimanale.',
    goalLeft_other: 'Mancano {count} sessioni per l obiettivo settimanale.',
    emptyTitle: 'Nessun allenamento',
    emptyMessage:
      'Scegli una scheda e vai ad allenarti. Kinetiq tiene il conto dalla prima serie che completi.',
  },

  activities: {
    title: 'Attività',
    eyebrow: 'Cronologia',
    searchPlaceholder: 'Nome sessione, note, esercizio',
    sortRecent: 'Recenti',
    sortLongest: 'Più lunghe',
    sortFurthest: 'Più distanti',
    sortHeaviest: 'Più pesanti',
    kindRuns: 'Corse',
    kindRides: 'Uscite in bici',
    kindStrength: 'Pesi',
    kindWalks: 'Camminate',
    kindYoga: 'Yoga',
    today: 'Oggi',
    yesterday: 'Ieri',
    session_one: '{count} sessione',
    session_other: '{count} sessioni',
    emptyTitle: 'Nessun risultato',
    emptyMessage: 'Prova un altro filtro, oppure cancella la ricerca.',
  },

  workout: {
    title: 'Allenamento',
    eyebrow: 'Allenati',
    yourRoutines: 'Le tue schede',
    newRoutine: 'Nuova scheda',
    routinesReady_one: '{count} scheda pronta',
    routinesReady_other: '{count} schede pronte',
    recordActivity: 'Registra un attività',
    recordSubtitle: 'Corsa, bici o camminata',
    startWorkout: 'Inizia questo allenamento',
    routineOptions: 'Opzioni scheda',
    rename: 'Rinomina',
    duplicate: 'Duplica',
    deleteRoutine: 'Elimina scheda',
    inProgress: '{name} è già in corso. Completala o scartala prima di iniziarne un altra.',
    paused: 'In pausa',
    resume: 'Riprendi',
    discard: 'Scarta',
    finish: 'Completa e salva',
    restTimer: 'Timer di recupero',
    exercise_one: '{count} esercizio',
    exercise_other: '{count} esercizi',
    set_one: '{count} serie',
    set_other: '{count} serie',
  },

  exercises: {
    title: 'Esercizi',
    eyebrow: 'Libreria',
    searchLabel: 'Cerca esercizi',
    searchPlaceholder: 'Stacchi, lat machine, affondi',
    searchHint: 'Cerca nel catalogo esercizi',
    count_one: '{count} esercizio',
    count_other: '{count} esercizi',
    countFor_one: '{count} esercizio per "{query}"',
    countFor_other: '{count} esercizi per "{query}"',
    addExercises: 'Aggiungi esercizi',
    addExercise: 'Aggiungi esercizio',
    fromLibrary: 'Cercati in diretta nella libreria esercizi',
    noneMatch: 'Nessun esercizio corrisponde',
    unavailable: 'Ricerca esercizi non disponibile',
    outdated: 'Risultati non aggiornati',
    outdatedDetail: 'La ricerca non è andata a buon fine. Questi sono i risultati precedenti.',
    updating: 'Aggiornamento',
    updatingDetail: 'Mostro la ricerca precedente mentre questa è in corso',
    loadMore: 'Carica altri',
    allLoaded_one: 'Caricato {count} esercizio',
    allLoaded_other: 'Caricati tutti i {count} esercizi',
  },

  profile: {
    title: 'Atleta',
    eyebrow: 'Profilo',
    preferences: 'Preferenze',
    units: 'Unità',
    appearance: 'Aspetto',
    language: 'Lingua',
    weeklyGoal: 'Obiettivo settimanale',
    storedOnDevice: 'Schede e cronologia sono salvate su questo dispositivo',
    ageYears: '{count} anni',
  },

  settings: {
    title: 'Impostazioni',
    you: 'Tu',
    usedForEstimates: 'Usati per le stime',
    name: 'Nome',
    height: 'Altezza',
    birthYear: 'Anno di nascita',
    app: 'App',
    trainingPreferences: 'Preferenze di allenamento',
    trainingSubtitle: 'Recupero predefinito, avvio automatico, velocità o ritmo',
    notifications: 'Notifiche',
    permissions: 'Autorizzazioni',
    permissionsSubtitle: 'Posizione, notifiche, movimento',
    metric: 'Metrico',
    imperial: 'Imperiale',
    light: 'Chiaro',
    dark: 'Scuro',
    english: 'English',
    italian: 'Italiano',
    languageHint: 'Cambia subito tutta l app.',
  },

  errors: {
    offlineTitle: 'Nessuna connessione',
    offlineMessage: 'Schede e cronologia sono qui. Per esercizi nuovi serve la rete.',
    genericTitle: 'Qualcosa è andato storto',
    saveFailed: 'Salvataggio non riuscito. Non hai perso nulla, la scheda è come l hai lasciata.',
    permissionDenied: 'Autorizzazione negata',
  },
};
