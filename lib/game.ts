export type Phase = 'lobby' | 'equipment' | 'event' | 'resolution' | 'finished';

export type SkillKey =
  | 'Médecine'
  | 'Bricolage'
  | 'Force'
  | 'Orientation'
  | 'Survie'
  | 'Discrétion'
  | 'Négociation'
  | 'Observation';

export type Character = {
  name: string;
  specialty: string;
  health: number;
  hunger: number;
  thirst: number;
  fatigue: number;
  morale: number;
  skills: Partial<Record<SkillKey, number>>;
  trait: string;
  conditions: { name: string; remainingDays: number }[];
  sequelae: string[];
  expeditions: number;
};

export type Player = {
  id: string;
  nickname: string;
  isHost: boolean;
  isBot?: boolean;
  ready: boolean;
  character: Character;
  alive: boolean;
};

export type ResourceKey = 'water' | 'food' | 'medicine' | 'materials';

export type Effect =
  | { type: 'resource'; key: ResourceKey; amount: number }
  | { type: 'flag'; key: string; value: boolean | string | number }
  | { type: 'morale'; amount: number; target?: 'all' | 'self' }
  | { type: 'health'; amount: number; target?: 'all' | 'self' }
  | { type: 'fatigue'; amount: number; target?: 'all' | 'self' }
  | { type: 'condition'; name: string; days: number }
  | { type: 'split'; awayCount: number }
  | { type: 'expedition' }
  | { type: 'finish'; ending: 'evacuation' | 'death' | 'missed' };

export type EventChoice = {
  id: string;
  label: string;
  hint: string;
  risk: 'Faible' | 'Modéré' | 'Élevé' | 'Extrême';
  requires?: {
    resource?: ResourceKey;
    amount?: number;
    flag?: string;
    resources?: Partial<Record<ResourceKey, number>>;
    anyFlags?: string[];
  };
  effects: Effect[];
  result: string;
};

export type EventCondition =
  | { kind: 'day'; gte: number }
  | { kind: 'flag'; key: string; equals: boolean | string | number }
  | { kind: 'flag_set'; key: string };

export type EventDefinition = {
  id: string;
  title: string;
  kicker: string;
  description: string;
  category: 'refuge' | 'expédition' | 'social' | 'météo' | 'issue';
  visibility: 'public' | 'private';
  unique: boolean;
  cooldownDays: number;
  weight: number;
  minDay?: number;
  conditions?: EventCondition[];
  choices: EventChoice[];
};

export type LogEntry = {
  day: number;
  title: string;
  text: string;
  tone?: 'neutral' | 'good' | 'bad';
};

export type GameState = {
  code: string;
  version: number;
  phase: Phase;
  day: number;
  seed: number;
  hostPlayerId: string;
  players: Player[];
  selectedEquipment: string[];
  resources: Record<ResourceKey, number>;
  flags: Record<string, boolean | string | number>;
  seenEvents: string[];
  currentEventId?: string;
  lastChoiceId?: string;
  lastResolution?: string;
  log: LogEntry[];
  splitGroup?: { away: string[]; location: string };
  ending?: 'evacuation' | 'death' | 'missed';
};

export type EquipmentDefinition = {
  id: string;
  label: string;
  description: string;
  weight: number;
  icon: string;
  grant: Partial<Record<ResourceKey, number>>;
  flag?: string;
};

export const EQUIPMENT: EquipmentDefinition[] = [
  { id: 'water', label: 'Réserve d’eau', description: '12 rations', weight: 2, icon: 'Droplets', grant: { water: 12 } },
  { id: 'food', label: 'Vivres', description: '12 rations', weight: 2, icon: 'Soup', grant: { food: 12 } },
  { id: 'medkit', label: 'Trousse médicale', description: '2 soins', weight: 1, icon: 'Cross', grant: { medicine: 2 } },
  { id: 'radio', label: 'Radio à manivelle', description: 'Capte les secours', weight: 2, icon: 'Radio', grant: {}, flag: 'has_radio' },
  { id: 'tools', label: 'Caisse à outils', description: 'Répare et renforce', weight: 2, icon: 'Wrench', grant: { materials: 2 }, flag: 'has_tools' },
  { id: 'rope', label: 'Corde', description: 'Sécurise les sorties', weight: 1, icon: 'Link', grant: {}, flag: 'has_rope' },
  { id: 'blankets', label: 'Couvertures', description: 'Protège du froid', weight: 2, icon: 'Layers', grant: {}, flag: 'has_blankets' },
  { id: 'map', label: 'Carte routière', description: 'Réduit les détours', weight: 1, icon: 'Map', grant: {}, flag: 'has_map' },
  { id: 'lamp', label: 'Lampe & piles', description: 'Explore dans le noir', weight: 1, icon: 'Flashlight', grant: {}, flag: 'has_lamp' },
];

const CHOICE = (
  id: string,
  label: string,
  hint: string,
  risk: EventChoice['risk'],
  result: string,
  effects: Effect[],
  requires?: EventChoice['requires'],
): EventChoice => ({ id, label, hint, risk, result, effects, requires });

export const EVENTS: EventDefinition[] = [
  {
    id: 'radio_silence',
    title: 'La fréquence morte',
    kicker: 'Une voix sous le souffle',
    description: 'La radio grésille depuis l’aube. Entre deux nappes de parasites, une suite de chiffres revient. Il faudrait démonter le boîtier pour stabiliser le signal.',
    category: 'refuge',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 8,
    choices: [
      CHOICE('repair', 'Tenter la réparation', 'La radio pourrait révéler une voie de sortie.', 'Modéré', 'Après une heure de silence tendu, une fréquence de secours émerge. Quelqu’un transmet encore.', [{ type: 'flag', key: 'radio_repaired', value: true }, { type: 'resource', key: 'materials', amount: -1 }], { flag: 'has_radio' }),
      CHOICE('listen', 'Écouter sans toucher', 'Aucun coût, mais peu de chances de comprendre.', 'Faible', 'Vous notez quelques mots : “convoi”, “nord”, puis le signal disparaît.', [{ type: 'flag', key: 'heard_convoy', value: true }]),
      CHOICE('ignore', 'Couper la radio', 'Le groupe économise son énergie.', 'Faible', 'Le refuge retombe dans le silence. Personne ne dit que c’était une erreur.', [{ type: 'morale', amount: -3 }]),
    ],
  },
  {
    id: 'warehouse_signal',
    title: 'Huit kilomètres',
    kicker: 'Entrepôt — secteur nord',
    description: 'Un ancien entrepôt logistique apparaît sur la carte. La route est exposée, mais les réserves ne tiendront pas indéfiniment.',
    category: 'expédition',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 7,
    choices: [
      CHOICE('pair', 'Envoyer deux personnes', 'Le refuge reste occupé. Les absents vivront une scène séparée.', 'Élevé', 'Deux silhouettes disparaissent dans la poussière. Elles reviennent à la nuit avec des réserves — et une histoire que les autres n’ont pas vécue.', [{ type: 'split', awayCount: 2 }, { type: 'expedition' }, { type: 'resource', key: 'food', amount: 6 }, { type: 'resource', key: 'water', amount: 4 }]),
      CHOICE('all', 'Partir tous ensemble', 'Plus de bras, mais le refuge sera abandonné.', 'Modéré', 'Le groupe progresse lentement mais rapporte l’essentiel. Au retour, la porte du refuge est entrouverte.', [{ type: 'expedition' }, { type: 'resource', key: 'food', amount: 5 }, { type: 'flag', key: 'shelter_exposed', value: true }]),
      CHOICE('stay', 'Rester au refuge', 'Aucun risque immédiat.', 'Faible', 'La journée passe sans incident. Le niveau des réserves devient difficile à ignorer.', [{ type: 'morale', amount: -4 }]),
    ],
  },
  {
    id: 'tainted_water',
    title: 'Un reflet huileux',
    kicker: 'Événement privé',
    description: 'En remplissant ta gourde, tu remarques une pellicule étrange sur l’eau commune. Personne d’autre ne semble l’avoir vue.',
    category: 'social',
    visibility: 'private',
    unique: true,
    cooldownDays: 99,
    weight: 6,
    choices: [
      CHOICE('warn', 'Prévenir le groupe', 'Vous perdrez de l’eau, mais pas leur confiance.', 'Faible', 'La réserve suspecte est jetée. Les regards sont inquiets, mais reconnaissants.', [{ type: 'resource', key: 'water', amount: -3 }, { type: 'morale', amount: 4 }, { type: 'flag', key: 'warned_water', value: true }]),
      CHOICE('hide', 'Ne rien dire', 'Garder l’information pour toi.', 'Élevé', 'Tu remplis une autre gourde et recules. Deux personnes boivent avant la tombée du jour.', [{ type: 'health', amount: -7, target: 'all' }, { type: 'flag', key: 'hid_tainted_water', value: true }]),
    ],
  },
  {
    id: 'missing_ration',
    title: 'Le ventre vide',
    kicker: 'Événement privé',
    description: 'Tu n’as presque rien mangé depuis deux jours. Une ration dépasse du sac commun. Personne ne regarde.',
    category: 'social',
    visibility: 'private',
    unique: true,
    cooldownDays: 99,
    weight: 6,
    choices: [
      CHOICE('steal', 'Prendre la ration', 'Le manque sera visible. Ton nom, peut-être pas.', 'Élevé', 'La faim se calme. Au comptage du soir, une ration manque.', [{ type: 'resource', key: 'food', amount: -1 }, { type: 'morale', amount: -2 }, { type: 'flag', key: 'ration_stolen', value: true }]),
      CHOICE('resist', 'Refermer le sac', 'Tu gardes la confiance du groupe.', 'Modéré', 'Tu t’éloignes du sac. Cette nuit-là, le sommeil vient difficilement.', [{ type: 'fatigue', amount: 8 }, { type: 'flag', key: 'resisted_hunger', value: true }]),
    ],
  },
  {
    id: 'injured_stranger',
    title: 'Quelqu’un à la grille',
    kicker: 'Une inconnue blessée',
    description: 'Une femme s’effondre devant le refuge. Sa plaie est profonde. Elle connaît, dit-elle, un passage vers le nord.',
    category: 'social',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 6,
    choices: [
      CHOICE('help', 'La soigner', 'Coûte 1 médicament et 2 rations.', 'Modéré', 'Mina repart au matin. Avant de disparaître, elle dessine une route et promet de ne pas oublier.', [{ type: 'resource', key: 'medicine', amount: -1 }, { type: 'resource', key: 'food', amount: -2 }, { type: 'flag', key: 'helped_mina', value: true }, { type: 'morale', amount: 5 }], { resource: 'medicine', amount: 1 }),
      CHOICE('refuse', 'Fermer la grille', 'Vous gardez vos ressources.', 'Faible', 'Ses pas s’éloignent lentement. Personne ne parle pendant le repas.', [{ type: 'flag', key: 'helped_mina', value: false }, { type: 'morale', amount: -7 }]),
    ],
  },
  {
    id: 'storm_front',
    title: 'Le ciel devient orange',
    kicker: 'Tempête de cendres',
    description: 'Le vent arrache déjà des plaques du toit. Il reste peu de temps avant que la visibilité tombe à zéro.',
    category: 'météo',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 6,
    choices: [
      CHOICE('reinforce', 'Renforcer le refuge', 'Consomme 2 matériaux.', 'Modéré', 'Les renforts grincent toute la nuit, mais le toit tient.', [{ type: 'resource', key: 'materials', amount: -2 }, { type: 'flag', key: 'shelter_reinforced', value: true }], { resource: 'materials', amount: 2 }),
      CHOICE('endure', 'Se barricader', 'Gardez le matériel, subissez la tempête.', 'Élevé', 'La cendre entre partout. Au matin, chacun semble avoir vieilli.', [{ type: 'health', amount: -8, target: 'all' }, { type: 'fatigue', amount: 12, target: 'all' }]),
    ],
  },
  {
    id: 'collapsed_tunnel',
    title: 'Sous la dalle',
    kicker: 'Le raccourci',
    description: 'Un tunnel effondré éviterait deux jours de marche. Un passage subsiste, étroit et instable.',
    category: 'expédition',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 5,
    choices: [
      CHOICE('crawl', 'Passer sous les gravats', 'Rapide, mais une erreur coûtera cher.', 'Extrême', 'La dalle cède au dernier passage. Tout le monde sort — l’un de vous avec la jambe brisée.', [{ type: 'condition', name: 'Fracture de la jambe', days: 2 }, { type: 'flag', key: 'tunnel_crossed', value: true }]),
      CHOICE('detour', 'Faire le détour', 'Perdez du temps et des forces.', 'Modéré', 'Le détour est long, silencieux, mais tout le monde atteint le refuge.', [{ type: 'fatigue', amount: 14, target: 'all' }]),
    ],
  },
  {
    id: 'night_watch',
    title: 'Des pas dans la nuit',
    kicker: 'Tour de garde',
    description: 'Une forme tourne autour du refuge. Faut-il réveiller tout le monde ou laisser une seule personne surveiller ?',
    category: 'refuge',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 5,
    choices: [
      CHOICE('one', 'Une personne veille', 'Le groupe récupère, le veilleur s’épuise.', 'Modéré', 'Les pas cessent avant l’aube. Le veilleur jure avoir reconnu une silhouette humaine.', [{ type: 'fatigue', amount: 18 }, { type: 'flag', key: 'saw_scout', value: true }]),
      CHOICE('all', 'Tout le monde debout', 'Plus sûr, mais épuisant.', 'Faible', 'À plusieurs, vous faites assez de bruit pour éloigner l’intrus.', [{ type: 'fatigue', amount: 8, target: 'all' }]),
      CHOICE('sleep', 'Ignorer les bruits', 'Dormir et espérer.', 'Élevé', 'Au réveil, un sac a disparu près de l’entrée.', [{ type: 'resource', key: 'food', amount: -3 }]),
    ],
  },
  {
    id: 'family_returns',
    title: 'Une dette revient',
    kicker: 'Conséquence retardée',
    description: 'Des silhouettes approchent avec un drapeau blanc. Au centre, un visage familier : Mina.',
    category: 'social',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 10,
    minDay: 8,
    conditions: [{ kind: 'flag_set', key: 'helped_mina' }],
    choices: [
      CHOICE('meet', 'Aller à leur rencontre', 'Vos choix passés décideront de l’accueil.', 'Modéré', 'Mina se souvient. Si vous l’avez aidée, elle offre des médicaments et la route du convoi. Sinon, son groupe reprend la route sans un mot.', [{ type: 'flag', key: 'mina_returned', value: true }]),
      CHOICE('hide', 'Rester cachés', 'Aucun contact, aucune dette.', 'Faible', 'Le groupe passe devant le refuge et disparaît vers le nord.', [{ type: 'flag', key: 'mina_ignored', value: true }]),
    ],
  },
  {
    id: 'last_convoy',
    title: 'Dernier convoi',
    kicker: 'Fenêtre : quatre jours',
    description: 'Une transmission confirme un départ au nord. Le convoi n’attendra pas. Il faut décider qui part et avec quelles réserves.',
    category: 'issue',
    visibility: 'public',
    unique: true,
    cooldownDays: 99,
    weight: 20,
    minDay: 10,
    choices: [
      CHOICE('leave', 'Partir cette nuit', 'Nécessite eau, vivres et une route fiable.', 'Élevé', 'À l’aube du quatrième jour, des moteurs apparaissent derrière la poussière. Le groupe a atteint le convoi.', [{ type: 'resource', key: 'water', amount: -3 }, { type: 'resource', key: 'food', amount: -3 }, { type: 'finish', ending: 'evacuation' }], { resources: { water: 3, food: 3 }, anyFlags: ['radio_repaired', 'heard_convoy', 'safe_route'] }),
      CHOICE('miss', 'Rester au refuge', 'L’occasion passera, la survie continue.', 'Extrême', 'Les moteurs grondent très loin, puis plus rien. La fenêtre se referme.', [{ type: 'finish', ending: 'missed' }]),
    ],
  },
];

const CHARACTER_TEMPLATES: Character[] = [
  { name: 'Sacha', specialty: 'Répare tout, sauf les gens', health: 100, hunger: 0, thirst: 0, fatigue: 12, morale: 72, skills: { Bricolage: 4, Observation: 3, Médecine: 1 }, trait: 'Calme sous pression', conditions: [], sequelae: [], expeditions: 0 },
  { name: 'Maya', specialty: 'Lit le terrain comme une carte', health: 100, hunger: 0, thirst: 0, fatigue: 8, morale: 68, skills: { Orientation: 4, Survie: 3, Négociation: 2 }, trait: 'Claustrophobe', conditions: [], sequelae: [], expeditions: 0 },
  { name: 'Noé', specialty: 'Ancien secouriste bénévole', health: 100, hunger: 0, thirst: 0, fatigue: 10, morale: 76, skills: { Médecine: 4, Force: 3, Discrétion: 1 }, trait: 'Insomniaque', conditions: [], sequelae: [], expeditions: 0 },
  { name: 'Inès', specialty: 'Voit ce que les autres ratent', health: 100, hunger: 0, thirst: 0, fatigue: 9, morale: 70, skills: { Observation: 4, Discrétion: 3, Bricolage: 2 }, trait: 'Fragile', conditions: [], sequelae: [], expeditions: 0 },
  { name: 'Eliott', specialty: 'Ne perd jamais le nord', health: 100, hunger: 0, thirst: 0, fatigue: 11, morale: 66, skills: { Survie: 4, Orientation: 3, Force: 2 }, trait: 'Résistant au froid', conditions: [], sequelae: [], expeditions: 0 },
  { name: 'Lina', specialty: 'Trouve les mots qui restent', health: 100, hunger: 0, thirst: 0, fatigue: 7, morale: 80, skills: { Négociation: 4, Médecine: 2, Observation: 3 }, trait: 'Asthmatique', conditions: [], sequelae: [], expeditions: 0 },
];

const cloneCharacter = (index: number): Character =>
  JSON.parse(JSON.stringify(CHARACTER_TEMPLATES[index % CHARACTER_TEMPLATES.length])) as Character;

export function createGame(code: string, nickname: string): GameState {
  const hostId = crypto.randomUUID();
  return {
    code,
    version: 1,
    phase: 'lobby',
    day: 0,
    seed: hashCode(code),
    hostPlayerId: hostId,
    players: [{ id: hostId, nickname, isHost: true, ready: true, character: cloneCharacter(0), alive: true }],
    selectedEquipment: ['water', 'food', 'medkit', 'radio', 'rope'],
    resources: { water: 0, food: 0, medicine: 0, materials: 0 },
    flags: {},
    seenEvents: [],
    log: [],
  };
}

export function addTestPlayers(state: GameState): GameState {
  if (state.players.length >= 3) return state;
  const names = ['Maya', 'Noé'];
  const extras = names.map((nickname, index) => ({
    id: `bot-${index + 1}`,
    nickname,
    isHost: false,
    isBot: true,
    ready: true,
    character: cloneCharacter(index + 1),
    alive: true,
  }));
  return { ...state, players: [...state.players, ...extras], version: state.version + 1 };
}

export function addPlayer(state: GameState, nickname: string, playerId: string): GameState {
  if (state.phase !== 'lobby' || state.players.some((player) => player.id === playerId) || state.players.length >= 6) return state;
  return {
    ...state,
    version: state.version + 1,
    players: [...state.players, { id: playerId, nickname, isHost: false, ready: true, character: cloneCharacter(state.players.length), alive: true }],
  };
}

export function equipmentWeight(ids: string[]) {
  return ids.reduce((total, id) => total + (EQUIPMENT.find((item) => item.id === id)?.weight ?? 0), 0);
}

export function toggleEquipment(state: GameState, id: string): GameState {
  if (state.phase !== 'equipment') return state;
  const selected = state.selectedEquipment.includes(id)
    ? state.selectedEquipment.filter((item) => item !== id)
    : [...state.selectedEquipment, id];
  if (equipmentWeight(selected) > 8) return state;
  return { ...state, selectedEquipment: selected, version: state.version + 1 };
}

export function beginEquipment(state: GameState): GameState {
  if (state.players.length < 3) return state;
  return { ...state, phase: 'equipment', version: state.version + 1 };
}

export function beginSurvival(state: GameState): GameState {
  if (equipmentWeight(state.selectedEquipment) > 8 || state.selectedEquipment.length === 0) return state;
  const resources: GameState['resources'] = { water: 0, food: 0, medicine: 0, materials: 0 };
  const flags = { ...state.flags };
  for (const id of state.selectedEquipment) {
    const item = EQUIPMENT.find((candidate) => candidate.id === id);
    if (!item) continue;
    for (const [key, amount] of Object.entries(item.grant)) {
      resources[key as ResourceKey] += amount ?? 0;
    }
    if (item.flag) flags[item.flag] = true;
  }
  const started: GameState = {
    ...state,
    day: 1,
    phase: 'event',
    resources,
    flags,
    version: state.version + 1,
    log: [{ day: 0, title: 'Évacuation', text: `Le groupe emporte ${state.selectedEquipment.length} objets. La porte se referme.`, tone: 'neutral' }],
  };
  return drawEvent(started);
}

export function currentEvent(state: GameState) {
  return EVENTS.find((event) => event.id === state.currentEventId);
}

export function choiceAvailable(state: GameState, choice: EventChoice) {
  if (!choice.requires) return true;
  if (choice.requires.flag && !state.flags[choice.requires.flag]) return false;
  if (choice.requires.anyFlags && !choice.requires.anyFlags.some((flag) => state.flags[flag])) return false;
  if (choice.requires.resource) {
    if (state.resources[choice.requires.resource] < (choice.requires.amount ?? 1)) return false;
  }
  if (choice.requires.resources && Object.entries(choice.requires.resources).some(([key, amount]) => state.resources[key as ResourceKey] < (amount ?? 0))) return false;
  return true;
}

function applyEffect(state: GameState, effect: Effect): GameState {
  if (effect.type === 'resource') {
    return { ...state, resources: { ...state.resources, [effect.key]: Math.max(0, state.resources[effect.key] + effect.amount) } };
  }
  if (effect.type === 'flag') return { ...state, flags: { ...state.flags, [effect.key]: effect.value } };
  if (effect.type === 'finish') return { ...state, ending: effect.ending, phase: 'finished' };
  if (effect.type === 'split') {
    const away = state.players.filter((player) => player.alive).slice(-effect.awayCount).map((player) => player.id);
    return { ...state, splitGroup: { away, location: 'Entrepôt — secteur nord' } };
  }
  if (effect.type === 'expedition') {
    return { ...state, players: state.players.map((player, index) => index > 0 ? { ...player, character: { ...player.character, expeditions: player.character.expeditions + 1 } } : player) };
  }
  const targetIndex = 'target' in effect && effect.target === 'all' ? -1 : 0;
  return {
    ...state,
    players: state.players.map((player, index) => {
      if (!player.alive || (targetIndex >= 0 && index !== targetIndex)) return player;
      const character = { ...player.character };
      if (effect.type === 'morale') character.morale = clamp(character.morale + effect.amount);
      if (effect.type === 'health') character.health = clamp(character.health + effect.amount);
      if (effect.type === 'fatigue') character.fatigue = clamp(character.fatigue + effect.amount);
      if (effect.type === 'condition') character.conditions = [...character.conditions, { name: effect.name, remainingDays: effect.days }];
      return { ...player, character, alive: character.health > 0 };
    }),
  };
}

export function resolveChoice(state: GameState, choiceId: string): GameState {
  if (state.phase !== 'event') return state;
  const event = currentEvent(state);
  const choice = event?.choices.find((candidate) => candidate.id === choiceId);
  if (!event || !choice || !choiceAvailable(state, choice)) return state;
  let next: GameState = { ...state, lastChoiceId: choiceId, lastResolution: choice.result, phase: 'resolution' };
  for (const effect of choice.effects) next = applyEffect(next, effect);
  if (event.id === 'family_returns' && choiceId === 'meet' && state.flags.helped_mina === true) {
    next = applyEffect(next, { type: 'resource', key: 'medicine', amount: 2 });
    next = applyEffect(next, { type: 'flag', key: 'safe_route', value: true });
    next.lastResolution = 'Mina se souvient de votre aide. Elle dépose deux soins et trace une route sûre vers le nord.';
  }
  next.log = [...next.log, { day: state.day, title: event.title, text: next.lastResolution ?? choice.result, tone: endingTone(next.ending) }];
  next.version += 1;
  return next;
}

export function advanceDay(state: GameState): GameState {
  if (state.phase !== 'resolution') return state;
  let next: GameState = { ...state, day: state.day + 1, phase: 'event', splitGroup: undefined, lastChoiceId: undefined, lastResolution: undefined, version: state.version + 1 };
  next = applyDailyNeeds(next);
  next = progressConditions(next);
  if (next.players.every((player) => !player.alive)) {
    return { ...next, phase: 'finished', ending: 'death', log: [...next.log, { day: next.day, title: 'Le dernier silence', text: 'Aucun membre du groupe n’a survécu.', tone: 'bad' }] };
  }
  return drawEvent(next);
}

function applyDailyNeeds(state: GameState): GameState {
  const living = state.players.filter((player) => player.alive).length;
  const waterUsed = Math.min(state.resources.water, Math.max(1, Math.ceil(living / 2)));
  const foodUsed = Math.min(state.resources.food, Math.max(1, Math.floor(living / 2)));
  const waterShortage = waterUsed < Math.max(1, Math.ceil(living / 2));
  const foodShortage = foodUsed < Math.max(1, Math.floor(living / 2));
  return {
    ...state,
    resources: { ...state.resources, water: state.resources.water - waterUsed, food: state.resources.food - foodUsed },
    players: state.players.map((player) => {
      if (!player.alive) return player;
      const character = {
        ...player.character,
        thirst: clamp(player.character.thirst + (waterShortage ? 28 : 6)),
        hunger: clamp(player.character.hunger + (foodShortage ? 20 : 4)),
        fatigue: clamp(player.character.fatigue - 7),
        health: clamp(player.character.health - (waterShortage ? 8 : 0) - (foodShortage ? 3 : 0)),
      };
      return { ...player, character, alive: character.health > 0 };
    }),
  };
}

function progressConditions(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      let sequelae = [...player.character.sequelae];
      const conditions = player.character.conditions
        .map((condition) => ({ ...condition, remainingDays: condition.remainingDays - 1 }))
        .filter((condition) => {
          if (condition.remainingDays <= 0 && condition.name === 'Fracture de la jambe' && !sequelae.includes('Jambe fragile')) {
            sequelae = [...sequelae, 'Jambe fragile'];
          }
          return condition.remainingDays > 0;
        });
      return { ...player, character: { ...player.character, conditions, sequelae } };
    }),
  };
}

function drawEvent(state: GameState): GameState {
  const unseen = EVENTS.filter((event) => !state.seenEvents.includes(event.id));
  let eligible = unseen.filter((event) => (event.minDay ?? 1) <= state.day && conditionsMet(state, event.conditions ?? []));
  if (state.day < 10) eligible = eligible.filter((event) => event.id !== 'last_convoy');
  if (state.day >= 10) {
    const finale = unseen.find((event) => event.id === 'last_convoy');
    if (finale) eligible = [finale];
  } else if (state.day >= 8) {
    const delayed = eligible.find((event) => event.id === 'family_returns');
    if (delayed) eligible = [delayed, ...eligible.filter((event) => event.id !== delayed.id)];
  }
  const event = eligible[seededIndex(state.seed + state.day * 31, eligible.length)] ?? unseen[0] ?? EVENTS[EVENTS.length - 1];
  return { ...state, currentEventId: event.id, seenEvents: [...state.seenEvents, event.id] };
}

function conditionsMet(state: GameState, conditions: EventCondition[]) {
  return conditions.every((condition) => {
    if (condition.kind === 'day') return state.day >= condition.gte;
    if (condition.kind === 'flag_set') return Object.hasOwn(state.flags, condition.key);
    return state.flags[condition.key] === condition.equals;
  });
}

function seededIndex(seed: number, length: number) {
  if (length <= 1) return 0;
  const value = Math.abs(Math.sin(seed) * 10000);
  return Math.floor((value - Math.floor(value)) * length);
}

function hashCode(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function endingTone(ending?: GameState['ending']): LogEntry['tone'] {
  if (ending === 'evacuation') return 'good';
  if (ending === 'death' || ending === 'missed') return 'bad';
  return 'neutral';
}

export function statusLabel(value: number, inverted = false) {
  const normalized = inverted ? 100 - value : value;
  if (normalized >= 75) return 'Stable';
  if (normalized >= 50) return 'Fragile';
  if (normalized >= 25) return 'Critique';
  return 'Extrême';
}
