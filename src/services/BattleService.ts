import { Pokemon } from "../domain/Pokemon";
import { Trainer } from "../domain/Trainer";

export interface DuelResult {
  winnerPokemon: Pokemon;
  loserPokemon: Pokemon;
  turns: number;
}

export interface ArenaResult {
  winner: Trainer | null;
  battles: number;
  stoppedEarly: boolean;
}

export class BattleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BattleError";
  }
}

function randomPokemon(trainer: Trainer, random: () => number): Pokemon {
  const candidates = trainer.pokemons.filter(
    (pokemon) => pokemon.lifePoint > 0 && pokemon.attacks.length > 0
  );
  if (candidates.length === 0) {
    throw new BattleError(`${trainer.name} doit avoir un Pokémon vivant possédant au moins une attaque.`);
  }
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

function strongestPokemon(trainer: Trainer): Pokemon {
  const candidates = trainer.pokemons
    .filter((pokemon) => pokemon.lifePoint > 0 && pokemon.attacks.length > 0)
    .sort((left, right) => right.lifePoint - left.lifePoint);
  if (!candidates[0]) {
    throw new BattleError(`${trainer.name} doit avoir un Pokémon vivant possédant au moins une attaque.`);
  }
  return candidates[0];
}

function fight(first: Pokemon, second: Pokemon, random: () => number): DuelResult {
  let turns = 0;
  while (first.lifePoint > 0 && second.lifePoint > 0) {
    first.attack(second, random);
    turns += 1;
    if (second.lifePoint > 0) {
      second.attack(first, random);
      turns += 1;
    }
  }
  return first.lifePoint > 0
    ? { winnerPokemon: first, loserPokemon: second, turns }
    : { winnerPokemon: second, loserPokemon: first, turns };
}

export class BattleService {
  randomChallenge(first: Trainer, second: Trainer, random: () => number = Math.random): DuelResult {
    first.healAtTavern();
    second.healAtTavern();
    return fight(randomPokemon(first, random), randomPokemon(second, random), random);
  }

  deterministicChallenge(first: Trainer, second: Trainer): DuelResult {
    return fight(strongestPokemon(first), strongestPokemon(second), Math.random);
  }

  randomArena(first: Trainer, second: Trainer, combatCount = 100, random: () => number = Math.random): ArenaResult {
    let battles = 0;
    for (; battles < combatCount; battles += 1) {
      this.randomChallenge(first, second, random);
    }
    return {
      winner: this.rankedTrainer(first, second),
      battles,
      stoppedEarly: false
    };
  }

  deterministicArena(first: Trainer, second: Trainer, combatCount = 100): ArenaResult {
    let battles = 0;
    for (; battles < combatCount; battles += 1) {
      if (!first.pokemons.some((pokemon) => pokemon.lifePoint > 0) ||
          !second.pokemons.some((pokemon) => pokemon.lifePoint > 0)) {
        break;
      }
      this.deterministicChallenge(first, second);
    }
    const firstAlive = first.pokemons.filter((pokemon) => pokemon.lifePoint > 0).length;
    const secondAlive = second.pokemons.filter((pokemon) => pokemon.lifePoint > 0).length;
    return {
      winner: firstAlive === secondAlive ? null : firstAlive > secondAlive ? first : second,
      battles,
      stoppedEarly: battles < combatCount
    };
  }

  private rankedTrainer(first: Trainer, second: Trainer): Trainer | null {
    if (first.level !== second.level) return first.level > second.level ? first : second;
    if (first.experience !== second.experience) {
      return first.experience > second.experience ? first : second;
    }
    return null;
  }
}
