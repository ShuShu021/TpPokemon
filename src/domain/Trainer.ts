import { Pokemon } from "./Pokemon";
import { DomainConflictError } from "./DomainConflictError";

export interface TrainerData {
  id?: number;
  name: string;
  level?: number;
  experience?: number;
  pokemons?: Pokemon[];
}

export class Trainer {
  readonly id?: number;
  name: string;
  private currentLevel: number;
  private currentExperience: number;
  private ownedPokemons: Pokemon[];

  constructor(data: TrainerData) {
    if (!data.name.trim()) {
      throw new Error("Le nom du dresseur est obligatoire.");
    }
    const level = data.level ?? 1;
    const experience = data.experience ?? 0;
    if (!Number.isInteger(level) || level < 1) {
      throw new Error("Le niveau doit être un entier supérieur ou égal à 1.");
    }
    if (!Number.isInteger(experience) || experience < 0 || experience >= 10) {
      throw new Error("L'expérience doit être un entier compris entre 0 et 9.");
    }

    this.id = data.id;
    this.name = data.name.trim();
    this.currentLevel = level;
    this.currentExperience = experience;
    this.ownedPokemons = data.pokemons ? [...data.pokemons] : [];
  }

  get level(): number {
    return this.currentLevel;
  }

  get experience(): number {
    return this.currentExperience;
  }

  get pokemons(): readonly Pokemon[] {
    return this.ownedPokemons;
  }

  addPokemon(pokemon: Pokemon): void {
    if (pokemon.id !== undefined && this.ownedPokemons.some((owned) => owned.id === pokemon.id)) {
      throw new DomainConflictError("Ce dresseur possède déjà ce Pokémon.");
    }
    this.ownedPokemons.push(pokemon);
  }

  healAtTavern(): void {
    for (const pokemon of this.ownedPokemons) {
      pokemon.heal();
    }
  }

  gainExperience(amount = 1): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error("Le gain d'expérience doit être un entier positif.");
    }
    const totalExperience = this.currentExperience + amount;
    this.currentLevel += Math.floor(totalExperience / 10);
    this.currentExperience = totalExperience % 10;
  }

  getStrongestAvailablePokemon(): Pokemon | undefined {
    return this.ownedPokemons
      .filter((pokemon) => pokemon.lifePoint > 0)
      .reduce<Pokemon | undefined>(
        (strongest, pokemon) => !strongest || pokemon.lifePoint > strongest.lifePoint ? pokemon : strongest,
        undefined
      );
  }
}
