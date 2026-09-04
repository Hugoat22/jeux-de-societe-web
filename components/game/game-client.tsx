'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Backpack,
  Bone,
  Check,
  ChevronRight,
  Clock3,
  Cross,
  Droplets,
  Eye,
  Flashlight,
  Heart,
  History,
  Layers,
  Link as LinkIcon,
  Map,
  Radio,
  RotateCcw,
  Soup,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  addPlayer,
  addTestPlayers,
  advanceDay,
  beginEquipment,
  beginSurvival,
  choiceAvailable,
  createGame,
  currentEvent,
  equipmentWeight,
  EQUIPMENT,
  GameState,
  resolveChoice,
  statusLabel,
  toggleEquipment,
} from '@/lib/game';

const STORAGE_PREFIX = 'cendre:game:';
const iconMap = { Droplets, Soup, Cross, Radio, Wrench, Link: LinkIcon, Layers, Map, Flashlight };

type Props = { code: string };

export function GameClient({ code }: Props) {
  const [game, setGame] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [panel, setPanel] = useState<'game' | 'character' | 'history'>('game');

  useEffect(() => {
    const normalizedCode = code.toUpperCase();
    let identity = sessionStorage.getItem('cendre:player-id');
    if (!identity) {
      identity = crypto.randomUUID();
      sessionStorage.setItem('cendre:player-id', identity);
    }
    // External session storage is the source of truth for this device identity.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerId(identity);
    const nickname = sessionStorage.getItem('cendre:nickname')?.trim() || 'Hugo';
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${normalizedCode}`);
    let initial = stored ? (JSON.parse(stored) as GameState) : createGame(normalizedCode, nickname);
    if (stored && !initial.players.some((player) => player.id === identity)) {
      initial = addPlayer(initial, nickname, identity);
    }
    if (!stored && initial.players[0]) {
      initial = { ...initial, hostPlayerId: identity, players: [{ ...initial.players[0], id: identity }] };
    }
    setGame(initial);
    setHydrated(true);

    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`cendre-${normalizedCode}`) : null;
    channel?.addEventListener('message', (message: MessageEvent<GameState>) => {
      setGame((current) => (!current || message.data.version > current.version ? message.data : current));
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === `${STORAGE_PREFIX}${normalizedCode}` && event.newValue) {
        const incoming = JSON.parse(event.newValue) as GameState;
        setGame((current) => (!current || incoming.version > current.version ? incoming : current));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      channel?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [code]);

  useEffect(() => {
    if (!hydrated || !game) return;
    localStorage.setItem(`${STORAGE_PREFIX}${game.code}`, JSON.stringify(game));
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`cendre-${game.code}`) : null;
    channel?.postMessage(game);
    channel?.close();
  }, [game, hydrated]);

  const currentPlayer = game?.players.find((player) => player.id === playerId) ?? game?.players[0];

  if (!game || !currentPlayer) {
    return <LoadingScreen />;
  }

  const update = (fn: (state: GameState) => GameState) => setGame((state) => (state ? fn(state) : state));

  if (panel === 'character') {
    return <CharacterScreen game={game} playerId={currentPlayer.id} onBack={() => setPanel('game')} />;
  }
  if (panel === 'history') {
    return <HistoryScreen game={game} onBack={() => setPanel('game')} />;
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <GameHeader game={game} onCharacter={() => setPanel('character')} onHistory={() => setPanel('history')} />
      {game.phase === 'lobby' && <Lobby game={game} currentPlayerId={currentPlayer.id} onFill={() => update(addTestPlayers)} onStart={() => update(beginEquipment)} />}
      {game.phase === 'equipment' && <Equipment game={game} onToggle={(id) => update((state) => toggleEquipment(state, id))} onStart={() => update(beginSurvival)} />}
      {game.phase === 'event' && <EventScreen game={game} onChoose={(choiceId) => update((state) => resolveChoice(state, choiceId))} />}
      {game.phase === 'resolution' && <ResolutionScreen game={game} onContinue={() => update(advanceDay)} />}
      {game.phase === 'finished' && <EndingScreen game={game} onRestart={() => {
        localStorage.removeItem(`${STORAGE_PREFIX}${game.code}`);
        window.location.assign('/');
      }} />}
    </main>
  );
}

function GameHeader({ game, onCharacter, onHistory }: { game: GameState; onCharacter: () => void; onHistory: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-5">
        <button className="flex items-center gap-2.5 text-left" onClick={() => window.location.assign('/')} aria-label="Retour à l’accueil">
          <span className="grid size-8 place-items-center rounded-full border border-primary/30 bg-primary/10"><Radio className="size-3.5 text-primary" /></span>
          <div>
            <div className="text-xs font-bold tracking-[0.18em]">CENDRE</div>
            <div className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">PARTIE {game.code}</div>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {game.day > 0 && <Badge variant="outline" className="mr-1 border-primary/25 bg-primary/10 font-mono text-[10px] text-primary">JOUR {game.day}</Badge>}
          <Button size="icon" variant="ghost" onClick={onHistory} aria-label="Historique"><History /></Button>
          <Button size="icon" variant="ghost" onClick={onCharacter} aria-label="Personnage"><Users /></Button>
        </div>
      </div>
    </header>
  );
}

function Lobby({ game, currentPlayerId, onFill, onStart }: { game: GameState; currentPlayerId: string; onFill: () => void; onStart: () => void }) {
  const isHost = game.hostPlayerId === currentPlayerId;
  return (
    <Screen>
      <SectionLabel icon={Radio}>Rassemblement</SectionLabel>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.045em]">Tout le monde est là&nbsp;?</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Annoncez le code à voix haute. Chaque survivant rejoint depuis son téléphone.</p>

      <Card className="mt-7 overflow-hidden border-primary/20 bg-primary/[0.06]">
        <CardContent className="p-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Code de la partie</p>
          <div className="mt-2 font-mono text-5xl font-black tracking-[0.2em] text-primary">{game.code}</div>
        </CardContent>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Survivants · {game.players.length}/6</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400" /> En direct</span>
      </div>
      <div className="mt-3 space-y-2">
        {game.players.map((player) => (
          <div key={player.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-card/65 p-3">
            <span className="grid size-10 place-items-center rounded-full bg-white/[0.06] text-sm font-bold">{player.nickname.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{player.nickname} {player.id === currentPlayerId && <span className="font-normal text-muted-foreground">(vous)</span>}</div>
              <div className="text-xs text-muted-foreground">{player.character.name} · {player.character.specialty}</div>
            </div>
            {player.isHost ? <Badge variant="outline" className="text-[9px]">HÔTE</Badge> : <Check className="size-4 text-emerald-400" />}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {game.players.length < 3 && <Button variant="outline" className="h-11 w-full rounded-xl border-dashed" onClick={onFill}>Ajouter Maya et Noé pour tester</Button>}
        <Button className="h-13 w-full justify-between rounded-xl px-5" disabled={!isHost || game.players.length < 3} onClick={onStart}>
          {isHost ? 'Préparer l’évacuation' : 'En attente de l’hôte'}
          <ArrowRight />
        </Button>
      </div>
      <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">Le mode local synchronise les onglets de ce navigateur. Le schéma Supabase fourni active le vrai multitéléphone.</p>
    </Screen>
  );
}

function Equipment({ game, onToggle, onStart }: { game: GameState; onToggle: (id: string) => void; onStart: () => void }) {
  const weight = equipmentWeight(game.selectedEquipment);
  return (
    <Screen>
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel icon={Clock3}>Évacuation · 90 secondes</SectionLabel>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em]">Vous ne pouvez pas tout prendre.</h1>
        </div>
        <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-center">
          <div className="font-mono text-xl font-bold text-primary">{weight}/8</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">charge</div>
        </div>
      </div>
      <Progress value={(weight / 8) * 100} className="mt-6 h-1.5" />

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {EQUIPMENT.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap] ?? Backpack;
          const selected = game.selectedEquipment.includes(item.id);
          const blocked = !selected && weight + item.weight > 8;
          return (
            <button
              key={item.id}
              disabled={blocked}
              onClick={() => onToggle(item.id)}
              className={`relative min-h-32 rounded-xl border p-4 text-left transition active:scale-[0.98] disabled:opacity-35 ${selected ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-card/60'}`}
            >
              <div className="flex items-start justify-between">
                <Icon className={`size-5 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-mono text-[10px] text-muted-foreground">{item.weight} KG</span>
              </div>
              <div className="mt-5 text-sm font-bold">{item.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{item.description}</div>
              {selected && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-0 -mx-5 mt-6 border-t border-white/10 bg-background/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
        <Button className="h-13 w-full justify-between rounded-xl px-5" disabled={weight === 0 || weight > 8} onClick={onStart}>
          Fermer le sac
          <ArrowRight />
        </Button>
      </div>
    </Screen>
  );
}

function EventScreen({ game, onChoose }: { game: GameState; onChoose: (id: string) => void }) {
  const event = currentEvent(game);
  if (!event) return null;
  return (
    <Screen>
      <ResourceStrip game={game} />
      {game.splitGroup && <SplitBanner game={game} />}
      {event.visibility === 'private' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3 text-xs">
          <Eye className="size-4 shrink-0 text-primary" />
          <span><strong>Visible seulement par vous.</strong> Vous choisissez ce que les autres sauront.</span>
        </div>
      )}

      <Card className="overflow-hidden border-white/10 bg-card/75 shadow-2xl shadow-black/20">
        <div className={`h-1 ${event.visibility === 'private' ? 'bg-primary' : event.category === 'issue' ? 'bg-emerald-500' : 'bg-white/15'}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{event.category}</Badge>
            <RiskSignal category={event.category} />
          </div>
          <p className="pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{event.kicker}</p>
          <CardTitle className="text-3xl font-black leading-none tracking-[-0.045em]">{event.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[15px] leading-7 text-muted-foreground">{event.description}</p>
        </CardContent>
      </Card>

      <div className="mt-6">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Décidez ensemble</p>
        <div className="space-y-3">
          {event.choices.map((choice, index) => {
            const available = choiceAvailable(game, choice);
            return (
              <button
                key={choice.id}
                disabled={!available}
                onClick={() => onChoose(choice.id)}
                className="group w-full rounded-xl border border-white/10 bg-card/55 p-4 text-left transition hover:border-primary/40 hover:bg-primary/[0.06] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + index)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <strong className="text-sm">{choice.label}</strong>
                      <RiskBadge risk={choice.risk} />
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{available ? choice.hint : 'Ressource ou équipement manquant.'}</span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-5 text-center text-[11px] text-muted-foreground">Les probabilités exactes restent cachées. Compétences, état et équipement influencent le résultat.</p>
    </Screen>
  );
}

function ResolutionScreen({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const event = currentEvent(game);
  return (
    <Screen>
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col justify-center">
        <div className="mb-5 grid size-12 place-items-center rounded-full border border-primary/30 bg-primary/10">
          {game.ending ? <Sparkles className="size-5 text-primary" /> : <Zap className="size-5 text-primary" />}
        </div>
        <SectionLabel icon={Activity}>Conséquence · Jour {game.day}</SectionLabel>
        <h1 className="mt-3 text-4xl font-black leading-none tracking-[-0.045em]">{event?.title}</h1>
        <p className="mt-6 text-lg leading-8 text-foreground/90">{game.lastResolution}</p>

        {game.splitGroup && (
          <div className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300"><Users className="size-4" /> Le groupe s’est séparé</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {game.players.filter((player) => game.splitGroup?.away.includes(player.id)).map((player) => player.nickname).join(' et ')} ont vécu l’expédition. Les autres ne connaissent que ce qu’ils raconteront.
            </p>
          </div>
        )}

        {game.players[0]?.character.conditions.map((condition) => (
          <div key={condition.name} className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <Bone className="size-5 text-destructive" />
            <div><div className="text-sm font-bold">{condition.name}</div><div className="text-xs text-muted-foreground">{condition.remainingDays} jours estimés · mobilité réduite</div></div>
          </div>
        ))}

        <Button className="mt-10 h-13 w-full justify-between rounded-xl px-5" onClick={onContinue}>
          Passer à la nuit
          <ArrowRight />
        </Button>
      </div>
    </Screen>
  );
}

function EndingScreen({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const survived = game.players.filter((player) => player.alive).length;
  const success = game.ending === 'evacuation';
  return (
    <Screen>
      <div className="pt-6 text-center">
        <div className={`mx-auto grid size-16 place-items-center rounded-full border ${success ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
          {success ? <Radio className="size-7" /> : <X className="size-7" />}
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Fin · Jour {game.day}</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">{success ? 'Vous avez quitté la zone.' : 'Le convoi est parti.'}</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          {success ? 'Le moteur du convoi couvre enfin le vent. Derrière vous, le refuge disparaît dans la cendre.' : 'La partie de démonstration s’arrête ici. Dans la version complète, la survie continuerait vers une autre issue.'}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-2">
        <Stat value={String(game.day)} label="jours" />
        <Stat value={`${survived}/${game.players.length}`} label="vivants" />
        <Stat value={String(game.log.length)} label="chapitres" />
      </div>

      <div className="mt-8 space-y-2">
        {game.players.map((player) => (
          <Card key={player.id} className="border-white/10 bg-card/60">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-full bg-white/[0.06] font-bold">{player.nickname[0]}</span>
              <div className="flex-1">
                <div className="text-sm font-bold">{player.nickname} <span className="font-normal text-muted-foreground">· {player.character.name}</span></div>
                <div className="mt-1 text-xs text-muted-foreground">{player.character.expeditions} expédition(s) · {player.character.sequelae.length} séquelle(s)</div>
              </div>
              <Badge variant="outline" className={player.alive ? 'text-emerald-300' : 'text-destructive'}>{player.alive ? 'VIVANT' : 'MORT'}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="outline" className="mt-8 h-12 w-full rounded-xl" onClick={onRestart}><RotateCcw /> Nouvelle partie</Button>
    </Screen>
  );
}

function CharacterScreen({ game, playerId, onBack }: { game: GameState; playerId: string; onBack: () => void }) {
  const player = game.players.find((candidate) => candidate.id === playerId) ?? game.players[0];
  const character = player.character;
  return (
    <main className="min-h-dvh bg-background">
      <SubHeader title="Mon survivant" onBack={onBack} />
      <Screen>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Survivant depuis {game.day} jour{game.day > 1 ? 's' : ''}</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">{character.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{character.specialty}</p>

        <div className="mt-7 grid grid-cols-2 gap-2">
          <ConditionStat icon={Heart} label="Santé" value={character.health} />
          <ConditionStat icon={Zap} label="Fatigue" value={character.fatigue} inverted />
          <ConditionStat icon={Soup} label="Faim" value={character.hunger} inverted />
          <ConditionStat icon={Droplets} label="Soif" value={character.thirst} inverted />
        </div>

        <h2 className="mt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Compétences</h2>
        <div className="mt-3 space-y-3">
          {Object.entries(character.skills).map(([skill, level]) => (
            <div key={skill} className="flex items-center gap-3">
              <span className="w-24 text-xs">{skill}</span>
              <div className="flex flex-1 gap-1.5">{[1,2,3,4,5].map((dot) => <span key={dot} className={`h-1.5 flex-1 rounded-full ${dot <= (level ?? 0) ? 'bg-primary' : 'bg-white/10'}`} />)}</div>
              <span className="w-5 text-right font-mono text-xs text-muted-foreground">{level}</span>
            </div>
          ))}
        </div>

        <Trait title="Trait" text={character.trait} />
        {character.conditions.map((condition) => <Trait key={condition.name} title="Blessure" text={`${condition.name} · ${condition.remainingDays} j`} danger />)}
        {character.sequelae.map((sequela) => <Trait key={sequela} title="Séquelle permanente" text={sequela} danger />)}
      </Screen>
    </main>
  );
}

function HistoryScreen({ game, onBack }: { game: GameState; onBack: () => void }) {
  return (
    <main className="min-h-dvh bg-background">
      <SubHeader title="Notre histoire" onBack={onBack} />
      <Screen>
        <h1 className="text-4xl font-black tracking-[-0.045em]">Ce qui reste.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Les décisions importantes de la partie, dans l’ordre où le groupe les a vécues.</p>
        <div className="relative mt-8 space-y-5 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-white/10">
          {[...game.log].reverse().map((entry, index) => (
            <div key={`${entry.day}-${index}`} className="relative flex gap-4">
              <span className={`relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full border-4 border-background ${entry.tone === 'good' ? 'bg-emerald-400' : entry.tone === 'bad' ? 'bg-destructive' : 'bg-primary'}`} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Jour {entry.day}</div>
                <div className="mt-1 text-sm font-bold">{entry.title}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.text}</p>
              </div>
            </div>
          ))}
          {game.log.length === 0 && <p className="text-sm text-muted-foreground">L’histoire n’a pas encore commencé.</p>}
        </div>
      </Screen>
    </main>
  );
}

function ResourceStrip({ game }: { game: GameState }) {
  return (
    <div className="mb-5 grid grid-cols-4 gap-2">
      <Resource icon={Droplets} value={game.resources.water} label="eau" />
      <Resource icon={Soup} value={game.resources.food} label="vivres" />
      <Resource icon={Cross} value={game.resources.medicine} label="soins" />
      <Resource icon={Wrench} value={game.resources.materials} label="mat." />
    </div>
  );
}

function Resource({ icon: Icon, value, label }: { icon: typeof Droplets; value: number; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-card/55 p-2.5 text-center"><Icon className="mx-auto size-3.5 text-primary" /><div className="mt-1.5 font-mono text-sm font-bold">{value}</div><div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div></div>;
}

function SplitBanner({ game }: { game: GameState }) {
  return <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-xs text-sky-200">Deux scènes sont actives : refuge et {game.splitGroup?.location}.</div>;
}

function RiskSignal({ category }: { category: string }) {
  return <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground"><span className="size-1.5 rounded-full bg-primary animate-pulse" /> Signal actif · {category}</span>;
}

function RiskBadge({ risk }: { risk: 'Faible' | 'Modéré' | 'Élevé' | 'Extrême' }) {
  const tone = risk === 'Faible' ? 'text-emerald-300' : risk === 'Modéré' ? 'text-amber-300' : 'text-red-300';
  return <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider ${tone}`}>{risk}</span>;
}

function ConditionStat({ icon: Icon, label, value, inverted = false }: { icon: typeof Heart; label: string; value: number; inverted?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-card/60 p-4"><Icon className="size-4 text-primary" /><div className="mt-4 text-xs text-muted-foreground">{label}</div><div className="mt-0.5 text-sm font-bold">{statusLabel(value, inverted)}</div><Progress className="mt-3 h-1" value={inverted ? 100 - value : value} /></div>;
}

function Trait({ title, text, danger = false }: { title: string; text: string; danger?: boolean }) {
  return <div className={`mt-4 rounded-xl border p-4 ${danger ? 'border-destructive/25 bg-destructive/[0.06]' : 'border-primary/20 bg-primary/[0.05]'}`}><div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div><div className="mt-1 text-sm font-bold">{text}</div></div>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-card/60 p-3 text-center"><div className="font-mono text-xl font-black text-primary">{value}</div><div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div></div>;
}

function SectionLabel({ icon: Icon, children }: { icon: typeof Radio; children: React.ReactNode }) {
  return <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary"><Icon className="size-3.5" />{children}</p>;
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="sticky top-0 z-20 border-b border-white/10 bg-background/90 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-5"><Button size="icon" variant="ghost" onClick={onBack}><ArrowLeft /></Button><span className="text-sm font-bold">{title}</span></div></header>;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-lg px-5 pb-10 pt-6">{children}</div>;
}

function LoadingScreen() {
  return <main className="grid min-h-dvh place-items-center bg-background"><div className="text-center"><Radio className="mx-auto size-6 animate-pulse text-primary" /><p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Recherche du signal</p></div></main>;
}
