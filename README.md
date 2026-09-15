# Dollhouse REST API

Work-in-progress REST API for managing players, runs, maps, leaderboards, challenges, settings, and related metadata across Dollhouse game servers.

**Base path:** `/api`

### Players

| Method   | Endpoint                                    | Description                   |
| -------- | ------------------------------------------- | ----------------------------- |
| `GET`    | `/players/search?q=`                        | Search players                |
| `GET`    | `/players/:playerId`                        | Get player                    |
| `GET`    | `/players/:playerId/challenges/weekly`      | Get weekly challenge progress |
| `GET`    | `/players/:playerId/points/history`         | Get point history             |
| `POST`   | `/players/:playerId/points`                 | Award or adjust points        |
| `GET`    | `/players/:playerId/settings`               | Get player settings           |
| `PATCH`  | `/players/:playerId/settings`               | Partially update settings     |
| `PUT`    | `/players/:playerId/blocks/:targetPlayerId` | Set communication blocks      |
| `GET`    | `/players/:playerId/blocks`                 | List blocked players          |
| `DELETE` | `/players/:playerId/blocks/:targetPlayerId` | Remove communication blocks   |

### Runs

| Method | Endpoint    | Description            |
| ------ | ----------- | ---------------------- |
| `GET`  | `/runs`     | Search and filter runs |
| `GET`  | `/runs/:id` | Get run details        |
| `POST` | `/runs`     | Submit a run           |

Run searches support filtering by player, map, tier, kills, deaths, presence, date range, mutators, and tags.

Multiple filters are combined with **AND** semantics. Mutator filters require an exact set match, while tag filters require all requested tags but allow additional tags.

### Leaderboards

| Method | Endpoint                           | Description           |
| ------ | ---------------------------------- | --------------------- |
| `GET`  | `/leaderboards/map/:mapId/fastest` | Fastest runs on a map |
| `GET`  | `/leaderboards/records`            | Player records        |
| `GET`  | `/leaderboards/extractions`        | Player extractions    |

Leaderboards support filtering by mutators, tags, and player.

### Maps & Metadata

| Method | Endpoint       | Description                   |
| ------ | -------------- | ----------------------------- |
| `GET`  | `/maps`        | List/search maps              |
| `GET`  | `/maps/:mapId` | Get a map                     |
| `GET`  | `/map-tags`    | List map tags                 |
| `GET`  | `/mutators`    | List mutators                 |
| `GET`  | `/run-tags`    | List run tags                 |
| `GET`  | `/tiers`       | List enabled difficulty tiers |

