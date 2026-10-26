import { DomainConflictError } from "./DomainConflictError";

export interface AttackData {
  id?: number;
  name: string;
  damage: number;
  usageLimit: number;
  usageCount?: number;
}

export class Attack {
  readonly id?: number;
  readonly name: string;
  readonly damage: number;
  readonly usageLimit: number;
  private currentUsageCount: number;

  constructor(data: AttackData) {
    if (!data.name.trim()) {
      throw new Error("Le nom de l'attaque est obligatoire.");
    }
    if (!Number.isInteger(data.damage) || data.damage <= 0) {
      throw new Error("Les dégâts doivent être un entier positif.");
    }
    if (!Number.isInteger(data.usageLimit) || data.usageLimit <= 0) {
      throw new Error("La limite d'usage doit être un entier positif.");
    }
    const usageCount = data.usageCount ?? 0;
    if (!Number.isInteger(usageCount) || usageCount < 0 || usageCount > data.usageLimit) {
      throw new Error("Le compteur d'usage est invalide.");
    }

    this.id = data.id;
    this.name = data.name.trim();
    this.damage = data.damage;
    this.usageLimit = data.usageLimit;
    this.currentUsageCount = usageCount;
  }

  get usageCount(): number {
    return this.currentUsageCount;
  }

  get isAvailable(): boolean {
    return this.currentUsageCount < this.usageLimit;
  }

  use(): number {
    if (!this.isAvailable) {
      throw new DomainConflictError(`L'attaque ${this.name} a atteint sa limite d'usage.`);
    }
    this.currentUsageCount += 1;
    return this.damage;
  }

  resetUsage(): void {
    this.currentUsageCount = 0;
  }

  getInformation(): string {
    return `${this.name} — dégâts : ${this.damage}, usages : ${this.currentUsageCount}/${this.usageLimit}`;
  }
}
