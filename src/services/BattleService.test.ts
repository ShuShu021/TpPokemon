import { describe, expect, it } from "vitest";
import { Attack } from "../domain/Attack";
import { Pokemon } from "../domain/Pokemon";
import { Trainer } from "../domain/Trainer";
import { BattleService } from "./BattleService";

function pokemon(name: string, lifePoint: number, damage: number): Pokemon {
  return new Pokemon({
    name,
    lifePoint,
    attacks: [new Attack({ name: `${name} attaque`, damage, usageLimit: 1 })]
  });
}

describe("BattleService", () => {
  it("uses current HP to choose deterministic combatants", () => {
    const firstWeak = pokemon("Faible", 5, 1);
    const firstStrong = pokemon("Fort", 30, 10);
    const second = pokemon("Rival", 10, 1);
    const first = new Trainer({ name: "Sacha", pokemons: [firstWeak, firstStrong] });
    const rival = new Trainer({ name: "Ondine", pokemons: [second] });

    const result = new BattleService().deterministicChallenge(first, rival);

    expect(result.winnerPokemon).toBe(firstStrong);
    expect(firstWeak.lifePoint).toBe(5);
  });

  it("uses level and then experience to rank the random arena", () => {
    const first = new Trainer({
      name: "Sacha",
      level: 3,
      experience: 0,
      pokemons: [pokemon("Pikachu", 20, 5)]
    });
    const second = new Trainer({
      name: "Ondine",
      level: 3,
      experience: 1,
      pokemons: [pokemon("Stari", 20, 5)]
    });

    const result = new BattleService().randomArena(first, second, 2, () => 0);

    expect(result.battles).toBe(2);
    expect(result.winner).toBe(second);
    expect(first.pokemons[0].lifePoint).toBe(5);
  });

  it("stops the deterministic arena when one trainer loses all Pokémon", () => {
    const first = new Trainer({
      name: "Sacha",
      pokemons: [pokemon("Pikachu", 20, 50)]
    });
    const second = new Trainer({
      name: "Ondine",
      pokemons: [pokemon("Stari", 5, 1)]
    });

    const result = new BattleService().deterministicArena(first, second, 100);

    expect(result.battles).toBe(1);
    expect(result.stoppedEarly).toBe(true);
    expect(result.winner).toBe(first);
  });

  it("ranks surviving Pokémon when the deterministic arena reaches its limit", () => {
    const first = new Trainer({
      name: "Sacha",
      pokemons: [pokemon("Pikachu", 10_000, 10_000), pokemon("Carapuce", 10_000, 10_000)]
    });
    const second = new Trainer({
      name: "Ondine",
      pokemons: Array.from(
        { length: 101 },
        (_unused, index) => pokemon(`Stari ${index + 1}`, 10_000, 1)
      )
    });
    const result = new BattleService().deterministicArena(first, second);

    expect(result.battles).toBe(100);
    expect(result.winner).toBe(first);
    expect(result.stoppedEarly).toBe(false);
  });
});
