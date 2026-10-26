# API Pokémon

API REST Express/TypeScript avec persistance PostgreSQL et modèle métier orienté objet.

## Démarrage

Prérequis : Node.js 20+ et PostgreSQL.

```powershell
npm install
Copy-Item .env.example .env
```

Créez d'abord la base `pokemon_game` dans PostgreSQL (par exemple avec `CREATE DATABASE pokemon_game;`). Renseignez ensuite `DATABASE_URL` et `PORT` dans `.env`, puis démarrez en développement :

```powershell
npm run dev
```

Au démarrage, l'API crée les tables manquantes dans la base indiquée. Pour compiler et lancer la version compilée :

```powershell
npm run build
npm start
```

## Règles métier

- Un Pokémon possède des PV actuels et maximaux, connaît au plus quatre attaques distinctes et ne peut attaquer s'il est K.-O.
- Les usages d'une attaque sont suivis séparément pour chaque Pokémon. Quand toutes ses attaques ont atteint leur limite, leurs compteurs sont réinitialisés et le combat continue. La taverne restaure tous les PV et réinitialise les usages.
- Chaque tranche de 10 points d'expérience augmente le niveau d'un dresseur ; le reste est conservé. Les combats ne donnent pas automatiquement d'expérience.
- Un défi aléatoire soigne les deux équipes, sélectionne un Pokémon vivant au hasard dans chaque équipe et oppose ces deux Pokémon jusqu'au K.-O.
- L'Arène 1 exécute 100 défis aléatoires. Son gagnant est déterminé par le niveau, puis par l'expérience ; une égalité exacte ne désigne aucun gagnant.
- Un défi déterministe choisit dans chaque équipe le Pokémon vivant ayant le plus de PV. L'Arène 2 enchaîne jusqu'à 100 combats sans soin et s'arrête lorsqu'un dresseur n'a plus de Pokémon vivant. Le dresseur avec le plus de Pokémon vivants gagne ; une égalité ne désigne aucun vainqueur. Les PV et usages persistent entre les combats.
- Un Pokémon doit connaître au moins une attaque pour participer à un combat.

## Routes

Toutes les routes API sont préfixées par `/api`. Les ressources sont retournées en JSON.

| Méthode | Route | Description |
| --- | --- | --- |
| GET, POST | `/attacks` | Lister ou créer une attaque |
| GET, PATCH, DELETE | `/attacks/:id` | Lire, modifier ou supprimer une attaque |
| GET, POST | `/pokemon` | Lister ou créer un Pokémon (`name`, `lifePoint`) |
| GET, PATCH, DELETE | `/pokemon/:id` | Lire, renommer ou supprimer un Pokémon |
| POST | `/pokemon/:id/attacks/:attackId` | Apprendre une attaque du catalogue |
| POST | `/pokemon/:id/heal` | Soigner un Pokémon |
| POST | `/pokemon/:id/attack` | Attaquer (`targetPokemonId`) |
| GET, POST | `/trainers` | Lister ou créer un dresseur (`name`) |
| GET, PATCH, DELETE | `/trainers/:id` | Lire, renommer ou supprimer un dresseur |
| POST | `/trainers/:id/pokemon/:pokemonId` | Ajouter un Pokémon à l'équipe |
| POST | `/trainers/:id/tavern` | Soigner toute l'équipe |
| POST | `/trainers/:id/experience` | Ajouter de l'expérience (`amount`, facultatif, vaut 1) |
| POST | `/battles/random` | Lancer un défi aléatoire |
| POST | `/battles/deterministic` | Lancer un défi déterministe |
| POST | `/arenas/1` | Lancer l'Arène 1 |
| POST | `/arenas/2` | Lancer l'Arène 2 |

Les routes de combat et d'arène attendent `{"firstTrainerId": 1, "secondTrainerId": 2}`. Les erreurs de validation renvoient le statut HTTP 400, les ressources absentes 404, les conflits de relation 409 et les erreurs internes 500.

## Vérification

```powershell
npm test
npm run build
```
