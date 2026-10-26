import { Attack } from "./Attack";
import { DomainConflictError } from "./DomainConflictError";

export interface PokemonData {
  id?: number;
  name: string;
  lifePoint: number;
  maxLifePoint?: number;
  attacks?: Attack[];
}

export class Pokemon {
  readonly id?: number;
  name: string;
  readonly maxLifePoint: number;
  private currentLifePoint: number;
  private learnedAttacks: Attack[];

  constructor(data: PokemonData) {
    if (!data.name.trim()) {
      throw new Error("Le nom du Pokémon est obligatoire.");
    }
    const maxLifePoint = data.maxLifePoint ?? data.lifePoint;
    if (!Number.isInteger(maxLifePoint) || maxLifePoint <= 0) {
      throw new Error("Les points de vie maximum doivent être un entier positif.");
    }
    if (!Number.isInteger(data.lifePoint) || data.lifePoint < 0 || data.lifePoint > maxLifePoint) {
      throw new Error("Les points de vie actuels sont invalides.");
    }

    this.id = data.id;
    this.name = data.name.trim();
    this.maxLifePoint = maxLifePoint;
    this.currentLifePoint = data.lifePoint;
    this.learnedAttacks = data.attacks ? [...data.attacks] : [];
    if (this.learnedAttacks.length > 4) {
      throw new DomainConflictError("Un Pokémon ne peut pas apprendre plus de quatre attaques.");
    }
    const attackKeys = this.learnedAttacks.map((attack) => attack.id ?? attack.name);
    if (new Set(attackKeys).size !== attackKeys.length) {
      throw new Error("Un Pokémon ne peut pas apprendre deux fois la même attaque.");
    }
  }

  get lifePoint(): number {
    return this.currentLifePoint;
  }

  get attacks(): readonly Attack[] {
    return this.learnedAttacks;
  }

  learnAttack(attack: Attack): void {
    if (this.learnedAttacks.length >= 4) {
      throw new Error("Un Pokémon ne peut pas apprendre plus de quatre attaques.");
    }
    if (this.learnedAttacks.some((known) =>
      attack.id !== undefined && known.id !== undefined
        ? known.id === attack.id
        : known.name === attack.name
    )) {
      throw new DomainConflictError("Ce Pokémon connaît déjà cette attaque.");
    }
    this.learnedAttacks.push(new Attack({
      id: attack.id,
      name: attack.name,
      damage: attack.damage,
      usageLimit: attack.usageLimit
    }));
  }

  heal(): void {
    this.currentLifePoint = this.maxLifePoint;
    for (const attack of this.learnedAttacks) {
      attack.resetUsage();
    }
  }

  attack(target: Pokemon, random: () => number = Math.random): { attack: Attack; damage: number } {
    if (this.currentLifePoint <= 0) {
      throw new DomainConflictError(`${this.name} ne peut pas attaquer avec 0 PV.`);
    }
    if (target.lifePoint <= 0) {
      throw new DomainConflictError(`${target.name} est déjà K.-O.`);
    }
    if (this.learnedAttacks.length === 0) {
      throw new DomainConflictError(`${this.name} ne connaît aucune attaque.`);
    }

    let available = this.learnedAttacks.filter((move) => move.isAvailable);
    if (available.length === 0) {
      for (const move of this.learnedAttacks) {
        move.resetUsage();
      }
      available = [...this.learnedAttacks];
    }

    const index = Math.min(available.length - 1, Math.floor(random() * available.length));
    const chosenAttack = available[index];
    const damage = chosenAttack.use();
    target.currentLifePoint = Math.max(0, target.currentLifePoint - damage);
    return { attack: chosenAttack, damage };
  }
}
