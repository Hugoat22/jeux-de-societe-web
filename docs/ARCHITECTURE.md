# Cendre — cadrage du MVP

Ce document fixe les décisions de game design et d’architecture qui précèdent l’implémentation. Le principe directeur est simple : chaque mécanique doit provoquer une discussion ou un arbitrage autour de la table.

## 1. Décisions de game design

### Boucle de jeu du MVP

Une partie suit une boucle courte de 20 à 35 minutes :

1. former un groupe de 3 à 6 joueurs ;
2. choisir collectivement 8 unités d’équipement en 90 secondes ;
3. survivre à une succession de journées variables ;
4. décider qui prend les risques et qui consomme les ressources rares ;
5. gérer une expédition qui sépare temporairement le groupe ;
6. découvrir puis réussir une unique opportunité d’évacuation ;
7. raconter la partie dans un épilogue commun et des bilans individuels.

Le MVP vise une tension lisible. Il n’essaie pas encore de simuler tout un monde.

### Problèmes identifiés et réponses

| Risque | Conséquence | Décision MVP |
| --- | --- | --- |
| Journées trop longues à 6 joueurs | attente et décrochage | une phase dure 45 s maximum ; les choix privés se résolvent dès que tous ont répondu |
| Effet boule de neige de la faim/soif | partie perdue bien avant sa fin | jauges en 4 états lisibles, consommation prévisible, une chance de récupération par expédition |
| Alpha player qui décide de tout | faible autonomie | participation aux risques nominative et choix privés ponctuels |
| Secret révélé dans le trafic client | jeu social cassé | projections publiques/privées calculées côté serveur ; aucun futur ni secret d’autrui envoyé au client |
| Séparation qui isole les conversations | frustration physique autour de la table | séparation courte, informations distinctes, mais résolution simultanée en une journée |
| Mort précoce | spectateur inactif | le mort devient « voix du journal » puis peut reprendre un survivant rencontré ; pour le MVP, une fenêtre de renfort est garantie dans les 2 jours |
| Hasard arbitraire | décisions perçues comme inutiles | tirage déterministe par seed ; score de résolution explicable, risque affiché par bande qualitative |
| Catalogue trop petit | répétition | tags, cooldown, unicité, chaînes et poids dynamiques dès le premier événement |
| Partie interminable | fatigue | pas de jour de fin fixe, mais une pression croissante après le jour 8 et une opportunité avant le jour 16 dans le MVP |
| Trop de jauges | sensation de tableur | santé, faim, soif, fatigue et moral sont regroupés en quatre niveaux textuels avec une seule alerte prioritaire |

### Contrats de rythme

- Une journée apporte au plus une décision collective principale et une décision privée par joueur.
- Chaque choix expose son coût certain et qualifie son risque ; les conséquences exactes restent cachées.
- Une séparation produit deux scènes différentes, pas deux sous-parties longues.
- Une blessure modifie un futur choix ; elle n’est jamais seulement une perte de santé.
- Un événement différé rappelle explicitement l’acte qui l’a rendu possible.

## 2. Architecture cible

```text
Téléphone A ─┐
Téléphone B ─┼─ HTTPS / Realtime ─ API autoritaire ─ moteur déterministe
Téléphone C ─┘                         │                    │
                                      ├─ projections       ├─ catalogue d’événements versionné
                                      ├─ commandes         └─ journal d’effets
                                      └─ Supabase/Postgres
```

### Frontend

- Next.js App Router, TypeScript strict, Tailwind CSS, composants accessibles inspirés de shadcn/ui.
- PWA installable, mobile first, mode portrait prioritaire.
- Une seule source de vérité côté client : la projection retournée pour le joueur courant.
- Realtime sert de signal d’invalidation. Après un message, le client recharge sa projection ; le message ne contient pas de secret.
- Un adaptateur local (`localStorage` + `BroadcastChannel`) permet de tester la boucle sans compte Supabase. Il n’est pas considéré comme sécurisé ni destiné à la production.

### Backend

- Les clients envoient des commandes (`CREATE_GAME`, `JOIN_GAME`, `SUBMIT_CHOICE`, `ADVANCE_PHASE`), jamais des mutations d’état arbitraires.
- Une transaction verrouille la partie, valide la commande, exécute le moteur, écrit les effets, puis incrémente `version`.
- Les commandes possèdent un `command_id` unique pour être idempotentes sur réseau mobile instable.
- Le serveur utilise une seed par partie et un compteur de tirages. Un résultat peut être rejoué pour audit sans être prévisible par les clients.
- Les données privées sont stockées séparément des vues publiques. Le rôle de service n’est utilisé que dans les fonctions serveur.

### Projection des informations

Chaque requête de lecture reçoit `game_id` et l’identité authentifiée. Elle retourne :

- `public`: jour, phase, ressources, membres visibles, question collective, journal public ;
- `group`: lieu, membres du sous-groupe, scène et informations observées par ce groupe ;
- `private`: personnage complet, problèmes cachés, choix privés, objets personnels, invitations ;
- `meta`: version, échéance et autorisations d’action.

Le catalogue complet, les poids, les jets, les conséquences non résolues et les choix privés des autres ne sont jamais inclus.

## 3. Modèle de données

### Tables principales

| Table | Rôle | Champs clés |
| --- | --- | --- |
| `games` | agrégat racine | `id`, `code`, `status`, `phase`, `day`, `seed`, `rng_cursor`, `version`, `host_player_id`, `phase_deadline`, `content_version` |
| `players` | siège et identité | `id`, `game_id`, `user_id`, `nickname`, `ready`, `connected_at`, `last_seen_at` |
| `characters` | incarnation courante | `id`, `player_id`, `name`, `health`, `hunger`, `thirst`, `fatigue`, `morale`, `alive`, `joined_day`, `died_day`, `cause_of_death` |
| `character_skills` | compétences extensibles | `character_id`, `skill_key`, `level`, `xp` |
| `character_traits` | traits et séquelles | `id`, `character_id`, `trait_key`, `kind`, `is_private`, `acquired_day`, `metadata` |
| `conditions` | blessures/maladies | `id`, `character_id`, `condition_key`, `severity`, `remaining_days`, `stage`, `metadata` |
| `groups` | sous-groupes actifs | `id`, `game_id`, `name`, `location_key`, `status` |
| `group_members` | appartenance temporelle | `group_id`, `character_id`, `joined_day` |
| `inventories` | conteneur | `id`, `game_id`, `group_id`, `character_id`, `kind` |
| `inventory_items` | ressource/objet | `inventory_id`, `item_key`, `quantity`, `condition` |
| `world_states` | variables compactes | `game_id`, `weather`, `danger`, `flags`, `discovered_regions`, `known_groups`, `active_opportunities` |
| `event_instances` | événement tiré | `id`, `game_id`, `definition_id`, `group_id`, `day`, `status`, `public_payload`, `resolution` |
| `decisions` | question à résoudre | `id`, `event_instance_id`, `scope`, `rule`, `deadline`, `resolved_at` |
| `decision_options` | choix matérialisés | `id`, `decision_id`, `option_key`, `label`, `public_cost` |
| `votes` | réponses individuelles | `decision_id`, `player_id`, `option_key`, `submitted_at`; contenu accessible uniquement au votant jusqu’à résolution |
| `scheduled_effects` | conséquences retardées | `id`, `game_id`, `due_day_min`, `due_day_max`, `conditions`, `effects`, `resolved_at` |
| `game_log` | histoire append-only | `id`, `game_id`, `day`, `visibility`, `group_id`, `player_id`, `kind`, `payload`, `created_at` |
| `processed_commands` | idempotence | `game_id`, `command_id`, `player_id`, `result`, `created_at` |

### Invariants

- Un joueur n’a qu’un personnage vivant à la fois.
- Un personnage vivant appartient à exactement un groupe actif.
- Une phase résolue n’accepte plus de vote.
- Toute mutation de `games.version` et tout événement de journal sont écrits dans la même transaction.
- Les ressources ne deviennent jamais négatives ; un manque génère un effet de pénurie.
- Les entrées de `game_log` sont immuables.

## 4. Machine à états

```text
LOBBY
  └─ tous prêts, hôte lance
      ↓
EVACUATION_DRAFT
  └─ capacité validée ou minuterie écoulée
      ↓
DAWN ─ consommation, conditions, morts
  ↓
EVENT_REVEAL
  ├─ aucune décision → RESOLUTION
  ├─ décision collective → COLLECTIVE_DECISION
  ├─ sélection de participants → PARTICIPANT_SELECTION
  └─ décision privée → PRIVATE_DECISIONS
          ↓
PRIVATE_DECISIONS / PARTICIPANT_SELECTION / COLLECTIVE_DECISION
  └─ toutes les réponses ou échéance
      ↓
RESOLUTION ─ jet déterministe, effets immédiats, programmation d’effets
  ↓
NIGHT ─ progression du monde, recomposition des groupes, récapitulatif
  ├─ victoire/mort totale → FINISHED
  └─ sinon jour + 1 → DAWN
```

`PAUSED` est un état orthogonal réservé à l’hôte. `FINISHED` est terminal. Le serveur est le seul à faire avancer la machine ; un client peut uniquement demander l’avancement lorsqu’il possède l’autorisation affichée dans sa projection.

## 5. Événements data-driven

Les définitions sont validées au build avec TypeScript et en base avec une version de contenu. Exemple simplifié :

```ts
type EventDefinition = {
  id: string
  version: number
  title: string
  description: string
  category: 'shelter' | 'expedition' | 'social' | 'weather' | 'exit'
  tags: string[]
  scope: 'all' | 'group' | 'player'
  unique?: boolean
  cooldownDays?: number
  weight: number
  dynamicWeight?: Expression
  conditions: Expression[]
  reveal: { public?: TextTemplate; group?: TextTemplate; private?: TextTemplate }
  decision?: {
    kind: 'collective' | 'participants' | 'private'
    rule: 'majority' | 'host-breaks-tie' | 'unanimous' | 'individual'
    minParticipants?: number
    maxParticipants?: number
    options: EventOption[]
  }
  outcomes: OutcomeRule[]
  followUps?: ScheduledFollowUp[]
}
```

Une expression n’exécute jamais du JavaScript arbitraire. C’est un petit AST déclaratif :

```ts
type Expression =
  | { op: 'flag'; key: string; equals: boolean | string | number }
  | { op: 'resource'; key: string; gte: number }
  | { op: 'day'; gte?: number; lte?: number }
  | { op: 'has_item'; key: string; scope: 'group' | 'participant' }
  | { op: 'all' | 'any'; expressions: Expression[] }
  | { op: 'not'; expression: Expression }
```

Les effets possibles sont limités et validés : ajuster une ressource/jauge, ajouter une condition ou un trait, poser un flag, écrire un journal, créer/séparer/fusionner un groupe, programmer un effet, révéler une information ou ouvrir une opportunité de sortie.

### Résolution contrôlée

```text
score = compétence pertinente la plus forte
      + soutien des autres participants (plafonné)
      + équipement
      + état du refuge et du monde
      - fatigue, blessures et difficulté
      + tirage déterministe [-2, +2]
```

Le seuil affiché au joueur devient une bande : faible, modéré, élevé ou extrême. Le journal de résolution conserve les composantes du score pour les tests et l’équilibrage, sans les révéler pendant la partie.

## 6. Catalogue du MVP

1. `radio_silence` — réparer la radio ; amorce l’évacuation.
2. `warehouse_signal` — expédition et séparation du groupe.
3. `tainted_water` — information privée, possibilité d’avertir ou de se taire.
4. `missing_ration` — choix privé de voler ; découverte différée possible.
5. `injured_stranger` — dépenser des médicaments ou refuser ; retour différé.
6. `storm_front` — renforcer le refuge ou accepter des dégâts.
7. `collapsed_tunnel` — test de force/bricolage, fracture temporaire possible.
8. `night_watch` — fatigue contre sécurité.
9. `family_returns` — conséquence du choix sur l’inconnu.
10. `last_convoy` — opportunité de sortie en plusieurs étapes.

Une fracture dure plusieurs jours et peut devenir la séquelle permanente `jambe_fragile`.

## 7. Arborescence cible

```text
app/
  api/commands/route.ts       # point d’entrée autoritaire
  game/[code]/page.tsx        # projection du joueur
  page.tsx                    # créer/rejoindre
components/
  game/                       # écrans par phase
  ui/                         # primitives possédées par le projet
content/events/               # définitions data-driven
lib/
  engine/                     # état, sélection, résolution, effets, projections
  repositories/               # ports local et Supabase
  supabase/                   # clients serveur/navigateur
supabase/
  migrations/                 # schéma, RLS, fonctions RPC
  tests/                      # tests d’autorisation allow/deny
tests/
  engine/                     # scénarios déterministes
docs/
  ARCHITECTURE.md
```

## 8. Découpage de développement

1. Vertical slice locale : accueil, création, lobby simulé et premier événement.
2. Domaine pur : état, seed, phases, commandes et dix événements.
3. Boucle jouable : équipement, décisions, expédition, blessure, séquelle, mort et évacuation.
4. Persistance : schéma Postgres, projections, RLS et commandes transactionnelles.
5. Temps réel : invalidation Broadcast et reconnexion par version.
6. PWA : manifeste, hors-ligne limité à l’écran d’accueil, reprise après veille.
7. Validation : tests déterministes, deux navigateurs, téléphone étroit, perte/reprise réseau.
8. Équilibrage : télémétrie anonymisée des causes de mort et choix, puis contenu supplémentaire.

## 9. Hors périmètre du premier MVP

Authentification sociale, huit joueurs, plusieurs catastrophes, crafting libre, carte ouverte, chat texte, matchmaking public, classement global, boutique, notifications push et génération narrative par IA. Ces éléments n’améliorent pas la validation de la boucle sociale initiale.

