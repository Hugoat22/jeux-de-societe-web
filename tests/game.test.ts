import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTestPlayers,
  advanceDay,
  beginEquipment,
  beginSurvival,
  createGame,
  currentEvent,
  equipmentWeight,
  resolveChoice,
  toggleEquipment,
} from '../lib/game.ts';

function startedGame(code = '4827') {
  let state = createGame(code, 'Hugo');
  state = addTestPlayers(state);
  state = beginEquipment(state);
  state = beginSurvival(state);
  return state;
}

test('a game cannot start with fewer than three survivors', () => {
  const state = createGame('1234', 'Hugo');
  assert.equal(beginEquipment(state).phase, 'lobby');
});

test('equipment never exceeds the carrying capacity', () => {
  let state = beginEquipment(addTestPlayers(createGame('1234', 'Hugo')));
  for (const id of ['tools', 'blankets', 'lamp', 'map']) state = toggleEquipment(state, id);
  assert.ok(equipmentWeight(state.selectedEquipment) <= 8);
});

test('the same code produces the same first event', () => {
  assert.equal(currentEvent(startedGame('3141'))?.id, currentEvent(startedGame('3141'))?.id);
});

test('a choice resolves once and is written to history', () => {
  const state = startedGame();
  const event = currentEvent(state);
  assert.ok(event);
  const choice = event.choices.find((candidate) => !candidate.requires);
  assert.ok(choice);
  const resolved = resolveChoice(state, choice.id);
  assert.equal(resolved.phase, 'resolution');
  assert.equal(resolved.log.at(-1)?.title, event.title);
  assert.equal(resolveChoice(resolved, choice.id).version, resolved.version);
});

test('a healed fracture leaves a permanent weak-leg sequela', () => {
  let state = startedGame();
  state = {
    ...state,
    phase: 'resolution',
    players: state.players.map((player, index) => index === 0 ? {
      ...player,
      character: { ...player.character, conditions: [{ name: 'Fracture de la jambe', remainingDays: 1 }] },
    } : player),
  };
  state = advanceDay(state);
  assert.ok(state.players[0].character.sequelae.includes('Jambe fragile'));
});

