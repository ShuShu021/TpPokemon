import { describe, expect, it } from "vitest";
import { Attack } from "./Attack";
import { Pokemon } from "./Pokemon";
import { Trainer } from "./Trainer";

describe("Pokemon", () => {
  it("learns at most four unique attacks", () => {
    const pokemon = new Pokemon({ name: "Pikachu", lifePoint: 30 });
    pokemon.learnAttack(new Attack({ id: 1, name: "Attaque 1", damage: 5, usageLimit: 2 }));
    expect(() => pokemon.learnAttack(new Attack({
      id: 1,
      name: "Attaque 1",
      damage: 5,
      usageLimit: 2
    }))).toThrow(/déjà cette attaque/);
    for (let id = 2; id <= 4; id += 1) {
      pokemon.learnAttack(new Attack({ id, name: `Attaque ${id}`, damage: 5, usageLimit: 2 }));
    }

    expect(() => pokemon.learnAttack(new Attack({
      id: 5,
      name: "Attaque 5",
      damage: 5,
      usageLimit: 2
    }))).toThrow(/quatre attaques/);
  });

  it("restores health and attack usages when healed", () => {
    const pokemon = new Pokemon({
      name: "Pikachu",
      lifePoint: 20,
      maxLifePoint: 30,
      attacks: [new Attack({ name: "Éclair", damage: 5, usageLimit: 1 })]
    });
    const opponent = new Pokemon({ name: "Salamèche", lifePoint: 20 });

    pokemon.attack(opponent, () => 0);
    pokemon.heal();

    expect(pokemon.lifePoint).toBe(30);
    expect(pokemon.attacks[0].usageCount).toBe(0);
  });

  it("resets exhausted attacks so combat can continue", () => {
    const pokemon = new Pokemon({
      name: "Pikachu",
      lifePoint: 20,
      attacks: [new Attack({ name: "Éclair", damage: 2, usageLimit: 1 })]
    });
    const opponent = new Pokemon({ name: "Salamèche", lifePoint: 20 });

    pokemon.attack(opponent, () => 0);
    pokemon.attack(opponent, () => 0);

    expect(opponent.lifePoint).toBe(16);
  });
});

describe("Trainer", () => {
  it("converts every ten experience points into a level", () => {
    const trainer = new Trainer({ name: "Sacha", experience: 9 });

    trainer.gainExperience(12);

    expect(trainer.level).toBe(3);
    expect(trainer.experience).toBe(1);
  });
});
