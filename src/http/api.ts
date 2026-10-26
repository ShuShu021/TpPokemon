import { Router } from "express";
import { z } from "zod";
import { Attack } from "../domain/Attack";
import { AttackRepository } from "../repositories/AttackRepository";
import { PokemonRepository } from "../repositories/PokemonRepository";
import { TrainerRepository } from "../repositories/TrainerRepository";
import { BattleService } from "../services/BattleService";
import { inTransaction, QueryExecutor } from "../db/pool";
import { ApiError, asyncRoute } from "./errors";

const router = Router();
const attackRepository = new AttackRepository();
const pokemonRepository = new PokemonRepository(attackRepository);
const trainerRepository = new TrainerRepository(pokemonRepository);
const battleService = new BattleService();

const nameSchema = z.string().trim().min(1).max(100);
const idSchema = z.coerce.number().int().positive();
const attackInput = z.object({
  name: nameSchema,
  damage: z.number().int().positive().max(2_147_483_647),
  usageLimit: z.number().int().positive().max(2_147_483_647)
});
const pokemonInput = z.object({
  name: nameSchema,
  lifePoint: z.number().int().positive().max(2_147_483_647)
});
const trainerInput = z.object({ name: nameSchema });
const experienceInput = z.object({ amount: z.number().int().positive().optional() });
const battleInput = z.object({
  firstTrainerId: z.number().int().positive(),
  secondTrainerId: z.number().int().positive()
}).refine((input) => input.firstTrainerId !== input.secondTrainerId, {
  message: "Les deux dresseurs doivent être différents."
});

function attackView(attack: Attack) {
  return {
    id: attack.id,
    name: attack.name,
    damage: attack.damage,
    usageLimit: attack.usageLimit,
    usageCount: attack.usageCount,
    information: attack.getInformation()
  };
}

function pokemonView(pokemon: import("../domain/Pokemon").Pokemon) {
  return {
    id: pokemon.id,
    name: pokemon.name,
    lifePoint: pokemon.lifePoint,
    maxLifePoint: pokemon.maxLifePoint,
    attacks: pokemon.attacks.map(attackView)
  };
}

function trainerView(trainer: import("../domain/Trainer").Trainer) {
  return {
    id: trainer.id,
    name: trainer.name,
    level: trainer.level,
    experience: trainer.experience,
    pokemons: trainer.pokemons.map(pokemonView)
  };
}

async function getTrainerOrFail(
  id: number,
  executor?: QueryExecutor,
  forUpdate = false
) {
  const trainer = await trainerRepository.findById(id, executor, forUpdate);
  if (!trainer) throw new ApiError(404, "Dresseur introuvable.");
  return trainer;
}

async function lockBattleTrainers(executor: QueryExecutor, trainerIds: number[]): Promise<void> {
  await executor.query(
    "SELECT id FROM trainers WHERE id = ANY($1::integer[]) ORDER BY id FOR UPDATE",
    [trainerIds]
  );
}

router.get("/attacks", asyncRoute(async (_request, response) => {
  response.json((await attackRepository.findAll()).map(attackView));
}));

router.post("/attacks", asyncRoute(async (request, response) => {
  const input = attackInput.parse(request.body);
  const attack = await attackRepository.create(new Attack(input));
  response.status(201).json(attackView(attack));
}));

router.get("/attacks/:id", asyncRoute(async (request, response) => {
  const attack = await attackRepository.findById(idSchema.parse(request.params.id));
  if (!attack) throw new ApiError(404, "Attaque introuvable.");
  response.json(attackView(attack));
}));

router.patch("/attacks/:id", asyncRoute(async (request, response) => {
  const input = attackInput.partial().parse(request.body);
  if (Object.keys(input).length === 0) throw new ApiError(400, "Au moins un champ doit être fourni.");
  const attack = await attackRepository.update(idSchema.parse(request.params.id), input);
  if (!attack) throw new ApiError(404, "Attaque introuvable.");
  response.json(attackView(attack));
}));

router.delete("/attacks/:id", asyncRoute(async (request, response) => {
  if (!await attackRepository.delete(idSchema.parse(request.params.id))) {
    throw new ApiError(404, "Attaque introuvable.");
  }
  response.status(204).end();
}));

router.get("/pokemon", asyncRoute(async (_request, response) => {
  response.json((await pokemonRepository.findAll()).map(pokemonView));
}));

router.post("/pokemon", asyncRoute(async (request, response) => {
  const input = pokemonInput.parse(request.body);
  response.status(201).json(pokemonView(await pokemonRepository.create(input.name, input.lifePoint)));
}));

router.get("/pokemon/:id", asyncRoute(async (request, response) => {
  const pokemon = await pokemonRepository.findById(idSchema.parse(request.params.id));
  if (!pokemon) throw new ApiError(404, "Pokémon introuvable.");
  response.json(pokemonView(pokemon));
}));

router.patch("/pokemon/:id", asyncRoute(async (request, response) => {
  const input = z.object({ name: nameSchema }).strict().parse(request.body);
  const pokemon = await pokemonRepository.rename(idSchema.parse(request.params.id), input.name);
  if (!pokemon) throw new ApiError(404, "Pokémon introuvable.");
  response.json(pokemonView(pokemon));
}));

router.delete("/pokemon/:id", asyncRoute(async (request, response) => {
  if (!await pokemonRepository.delete(idSchema.parse(request.params.id))) {
    throw new ApiError(404, "Pokémon introuvable.");
  }
  response.status(204).end();
}));

router.post("/pokemon/:id/attacks/:attackId", asyncRoute(async (request, response) => {
  const pokemonId = idSchema.parse(request.params.id);
  const attackId = idSchema.parse(request.params.attackId);
  const pokemon = await inTransaction(async (client) => {
    const current = await pokemonRepository.findById(pokemonId, client, true);
    if (!current) throw new ApiError(404, "Pokémon introuvable.");
    const attack = await attackRepository.findById(attackId, client);
    if (!attack) throw new ApiError(404, "Attaque introuvable.");
    current.learnAttack(attack);
    await pokemonRepository.learnAttack(current, attack, client);
    return pokemonRepository.findById(pokemonId, client);
  });
  if (!pokemon) throw new ApiError(404, "Pokémon introuvable.");
  response.status(201).json(pokemonView(pokemon));
}));

router.post("/pokemon/:id/heal", asyncRoute(async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const pokemon = await inTransaction(async (client) => {
    const current = await pokemonRepository.findById(id, client, true);
    if (!current) throw new ApiError(404, "Pokémon introuvable.");
    current.heal();
    await pokemonRepository.save(current, client);
    return pokemonRepository.findById(id, client);
  });
  if (!pokemon) throw new ApiError(404, "Pokémon introuvable.");
  response.json(pokemonView(pokemon));
}));

router.post("/pokemon/:id/attack", asyncRoute(async (request, response) => {
  const input = z.object({ targetPokemonId: z.number().int().positive() }).parse(request.body);
  const attackerId = idSchema.parse(request.params.id);
  if (input.targetPokemonId === attackerId) throw new ApiError(400, "Un Pokémon ne peut pas s'attaquer lui-même.");
  const result = await inTransaction(async (client) => {
    await client.query(
      "SELECT id FROM pokemon WHERE id = ANY($1::integer[]) ORDER BY id FOR UPDATE",
      [[attackerId, input.targetPokemonId]]
    );
    const attacker = await pokemonRepository.findById(attackerId, client);
    if (!attacker) throw new ApiError(404, "Pokémon attaquant introuvable.");
    const target = await pokemonRepository.findById(input.targetPokemonId, client);
    if (!target) throw new ApiError(404, "Pokémon cible introuvable.");
    const { attack, damage } = attacker.attack(target);
    await pokemonRepository.save(attacker, client);
    await pokemonRepository.save(target, client);
    return { attacker, target, attack, damage };
  });
  response.json({
    attacker: pokemonView(result.attacker),
    target: pokemonView(result.target),
    attack: attackView(result.attack),
    damage: result.damage
  });
}));

router.get("/trainers", asyncRoute(async (_request, response) => {
  response.json((await trainerRepository.findAll()).map(trainerView));
}));

router.post("/trainers", asyncRoute(async (request, response) => {
  const input = trainerInput.parse(request.body);
  response.status(201).json(trainerView(await trainerRepository.create(input.name)));
}));

router.get("/trainers/:id", asyncRoute(async (request, response) => {
  response.json(trainerView(await getTrainerOrFail(idSchema.parse(request.params.id))));
}));

router.patch("/trainers/:id", asyncRoute(async (request, response) => {
  const input = trainerInput.parse(request.body);
  const trainer = await trainerRepository.rename(idSchema.parse(request.params.id), input.name);
  if (!trainer) throw new ApiError(404, "Dresseur introuvable.");
  response.json(trainerView(trainer));
}));

router.delete("/trainers/:id", asyncRoute(async (request, response) => {
  if (!await trainerRepository.delete(idSchema.parse(request.params.id))) {
    throw new ApiError(404, "Dresseur introuvable.");
  }
  response.status(204).end();
}));

router.post("/trainers/:id/pokemon/:pokemonId", asyncRoute(async (request, response) => {
  const trainerId = idSchema.parse(request.params.id);
  const pokemonId = idSchema.parse(request.params.pokemonId);
  const trainer = await inTransaction(async (client) => {
    const current = await getTrainerOrFail(trainerId, client, true);
    if (current.pokemons.some((pokemon) => pokemon.id === pokemonId)) {
      throw new ApiError(409, "Ce dresseur possède déjà ce Pokémon.");
    }
    const pokemon = await pokemonRepository.findById(pokemonId, client, true);
    if (!pokemon) throw new ApiError(404, "Pokémon introuvable.");
    current.addPokemon(pokemon);
    await trainerRepository.addPokemon(current, pokemonId, client);
    return getTrainerOrFail(trainerId, client);
  });
  response.status(201).json(trainerView(trainer));
}));

router.post("/trainers/:id/tavern", asyncRoute(async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const trainer = await inTransaction(async (client) => {
    const current = await getTrainerOrFail(id, client, true);
    current.healAtTavern();
    await trainerRepository.save(current, client);
    return getTrainerOrFail(id, client);
  });
  response.json(trainerView(trainer));
}));

router.post("/trainers/:id/experience", asyncRoute(async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = experienceInput.parse(request.body);
  const trainer = await inTransaction(async (client) => {
    const current = await getTrainerOrFail(id, client, true);
    current.gainExperience(input.amount);
    await trainerRepository.save(current, client);
    return getTrainerOrFail(id, client);
  });
  response.json(trainerView(trainer));
}));

function battleView(result: import("../services/BattleService").DuelResult) {
  return {
    winnerPokemon: pokemonView(result.winnerPokemon),
    loserPokemon: pokemonView(result.loserPokemon),
    turns: result.turns
  };
}

router.post("/battles/random", asyncRoute(async (request, response) => {
  const input = battleInput.parse(request.body);
  const result = await inTransaction(async (client) => {
    await lockBattleTrainers(client, [input.firstTrainerId, input.secondTrainerId]);
    const first = await getTrainerOrFail(input.firstTrainerId, client, true);
    const second = await getTrainerOrFail(input.secondTrainerId, client, true);
    const battle = battleService.randomChallenge(first, second);
    await trainerRepository.save(first, client);
    await trainerRepository.save(second, client);
    return { first, second, battle };
  });
  response.json({
    firstTrainer: trainerView(result.first),
    secondTrainer: trainerView(result.second),
    battle: battleView(result.battle)
  });
}));

router.post("/battles/deterministic", asyncRoute(async (request, response) => {
  const input = battleInput.parse(request.body);
  const result = await inTransaction(async (client) => {
    await lockBattleTrainers(client, [input.firstTrainerId, input.secondTrainerId]);
    const first = await getTrainerOrFail(input.firstTrainerId, client, true);
    const second = await getTrainerOrFail(input.secondTrainerId, client, true);
    const battle = battleService.deterministicChallenge(first, second);
    await trainerRepository.save(first, client);
    await trainerRepository.save(second, client);
    return { first, second, battle };
  });
  response.json({
    firstTrainer: trainerView(result.first),
    secondTrainer: trainerView(result.second),
    battle: battleView(result.battle)
  });
}));

async function runArena(
  input: z.infer<typeof battleInput>,
  arena: "random" | "deterministic"
) {
  return inTransaction(async (client) => {
    await lockBattleTrainers(client, [input.firstTrainerId, input.secondTrainerId]);
    const first = await getTrainerOrFail(input.firstTrainerId, client, true);
    const second = await getTrainerOrFail(input.secondTrainerId, client, true);
    const result = arena === "random"
      ? battleService.randomArena(first, second)
      : battleService.deterministicArena(first, second);
    await trainerRepository.save(first, client);
    await trainerRepository.save(second, client);
    return { first, second, result };
  });
}

function arenaView(
  first: import("../domain/Trainer").Trainer,
  second: import("../domain/Trainer").Trainer,
  result: import("../services/BattleService").ArenaResult
) {
  return {
    winner: result.winner ? trainerView(result.winner) : null,
    firstTrainer: trainerView(first),
    secondTrainer: trainerView(second),
    battles: result.battles,
    stoppedEarly: result.stoppedEarly
  };
}

router.post("/arenas/1", asyncRoute(async (request, response) => {
  const input = battleInput.parse(request.body);
  const { first, second, result } = await runArena(input, "random");
  response.json(arenaView(first, second, result));
}));

router.post("/arenas/2", asyncRoute(async (request, response) => {
  const input = battleInput.parse(request.body);
  const { first, second, result } = await runArena(input, "deterministic");
  response.json(arenaView(first, second, result));
}));

export default router;
