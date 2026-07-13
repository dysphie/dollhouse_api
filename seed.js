'use strict';

import crypto from "crypto";
import { MutatorsService } from "./services/mutators.service.js";
import { TiersService } from "./services/tiers.service.js";
import { MapsService } from "./services/maps.service.js";
import { PlayersService } from "./services/players.service.js";
import { PerfTagsService } from "./services/run-tags.service.js";
import { RunsService } from "./services/runs.service.js";
import { CommunicationBlocksService } from "./services/blocks.service.js";
import { DatabaseService } from "./services/database.service.js";
import { WeaponsService } from "./services/weapons.service.js";
import Database from "better-sqlite3";

const CONFIG = {
  NUM_PLAYERS: 3000,
  NUM_MAPS: 250,
  YEARS_OF_HISTORY: 3,
  NUM_SESSIONS: 35000,
  MAX_PLAYERS_PER_SESSION: 4,
  COMM_BLOCK_PAIR_COUNT: 400,
  LOG_EVERY: 5000,
};

const NOW = Date.now();
const PERIOD_MS = CONFIG.YEARS_OF_HISTORY * 365 * 24 * 60 * 60 * 1000;
const START_TS = NOW - PERIOD_MS;

const TIERS = [
  { name: 'Easy', points: 10 },
  { name: 'Medium', points: 25 },
  { name: 'Hard', points: 50 },
  { name: 'Extreme', points: 100 },
  { name: 'Nightmare', points: 200 },
];

const MAP_BASE_NAMES = [
  'nmo_bank', 'nmo_hospital', 'nmo_broadway', 'nmo_courtyard', 'nmo_ravenholm',
  'nmo_downtown', 'nmo_stormfront', 'nmo_arclight', 'nmo_precinct', 'nmo_greyharbor',
  'nmo_underpass', 'nmo_lockdown', 'nmo_quarantine', 'nmo_deadline', 'nmo_asylum',
  'nmo_foundry', 'nmo_subgrid', 'nmo_outbreak', 'nmo_terminal', 'nmo_millhouse',
  'nms_riverside', 'nms_docks', 'nms_wardline', 'nms_overpass', 'nms_lastlight',
];

const MUTATOR_NAMES = [
  'friendly_fire', 'hardcore', 'permadeath', 'low_gravity', 'infinite_ammo',
  'one_hit_kill', 'fast_zombies', 'night_mode', 'fog', 'no_hud',
  'iron_man', 'speedrun', 'pacifist', 'no_sprint', 'zombie_horde', 'blood_moon',
];

const PERF_TAG_NAMES = [
  'no_damage', 'solo', 'flawless', 'speedrun', 'pacifist_run', 'no_reload',
  'headshot_only', 'night_run', 'full_squad', 'clutch', 'first_try',
  'iron_man_run', 'stealth', 'chaos', 'comeback',
];

const WEAPON_CLASSNAMES = [
  'fa_1911', 'fa_glock17', 'fa_mkii', 'fa_sw686', 'fa_m92fs',
  'fa_1022', 'fa_1022_25mag', 'fa_cz858', 'fa_sako85', 'fa_jae700',
  'fa_sks', 'fa_fnfal', 'fa_500a', 'fa_870', 'fa_superx3',
  'fa_sv10', 'fa_winchester1892', 'fa_mac10', 'fa_mp5a3',
  'fa_m16a4', 'fa_m16a4_carryhandle',
  'bow_deerhunter',
  'me_axe_fire', 'me_bat_metal', 'me_chainsaw', 'me_abrasivesaw',
  'me_crowbar', 'me_etool', 'me_fubar', 'me_hatchet', 'me_kitknife',
  'me_machete', 'me_pipe_lead', 'me_shovel', 'me_sledge', 'me_wrench',
  'exp_grenade', 'exp_molotov', 'exp_tnt',
  'tool_flare_gun',
];

const NAME_PARTS_A = [
  'Shadow', 'Iron', 'Night', 'Grim', 'Silent', 'Rusty', 'Ghost', 'Feral',
  'Lone', 'Broken', 'Blood', 'Wild', 'Crimson', 'Ashen', 'Hollow', 'Fallen',
];
const NAME_PARTS_B = [
  'Walker', 'Reaper', 'Hunter', 'Wolf', 'Fang', 'Ranger', 'Blade', 'Runner',
  'Crow', 'Viper', 'Storm', 'Ember', 'Howl', 'Scout', 'Warden', 'Drifter',
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  n = Math.min(n, copy.length);
  for (let i = 0; i < n; i++) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}

function weightedActivityLevel() {
  const r = Math.random();
  if (r < 0.55) return { level: 'casual', runs: [5, 30] };
  if (r < 0.85) return { level: 'regular', runs: [30, 120] };
  return { level: 'hardcore', runs: [120, 400] };
}

function randomSteamId(i) {
  return `STEAM_0:${i % 2}:${100000 + i}`;
}

function randomPlayerName(i) {
  return `${pick(NAME_PARTS_A)}${pick(NAME_PARTS_B)}${randInt(1, 999)}_${i}`;
}

function log(msg) {
  console.log(`[seed] ${msg}`);
}

function seedTiers() {
  return TIERS.map((t) =>
    TiersService.upsert(db, {
      name: t.name,
      description: `${t.name} difficulty tier`,
      points: t.points,
      enabled: 1,
    })
  );
}

function seedMutators() {
  return MUTATOR_NAMES.map((name) =>
    MutatorsService.upsert(db, { name, description: '', enabled: 1 })
  );
}

function seedPerfTags() {
  return PERF_TAG_NAMES.map((name) =>
    PerfTagsService.upsert(db, { mapId: null, name, description: '', enabled: 1 })
  );
}

function seedWeapons() {
  return WEAPON_CLASSNAMES.map((className) =>
    WeaponsService.upsert(db, { className, enabled: 1 })
  );
}

function seedMaps(tiers) {
  const maps = [];
  let generated = 0;
  let baseIdx = 0;
  let suffix = 1;

  while (generated < CONFIG.NUM_MAPS) {
    const base = MAP_BASE_NAMES[baseIdx % MAP_BASE_NAMES.length];
    baseIdx++;
    if (baseIdx % MAP_BASE_NAMES.length === 0) suffix++;
    const filename = suffix === 1 ? base : `${base}_v${suffix}`;

    const tier = pick(tiers);
    const map = MapsService.upsert(db, {
      filename,
      stage: '',
      tierId: tier.id,
      enabled: 1,
    });
    maps.push(map);
    generated++;

    if (generated % CONFIG.LOG_EVERY === 0) log(`maps: ${generated}/${CONFIG.NUM_MAPS}`);
  }
  return maps;
}

function seedPlayers() {
  const players = [];
  for (let i = 0; i < CONFIG.NUM_PLAYERS; i++) {
    const activity = weightedActivityLevel();
    const player = PlayersService.upsert(db, {
      steamId: randomSteamId(i),
      name: randomPlayerName(i),
    });

    player._joinedAt = START_TS + Math.floor(Math.random() * PERIOD_MS * 0.7);
    player._activity = activity;
    player._targetRuns = randInt(activity.runs[0], activity.runs[1]);
    players.push(player);

    if ((i + 1) % CONFIG.LOG_EVERY === 0) log(`players: ${i + 1}/${CONFIG.NUM_PLAYERS}`);
  }
  return players;
}

function pickMutators(mutators) {
  const n = Math.random() < 0.5 ? 0 : randInt(1, 4);
  return pickN(mutators, n).map((m) => m.id);
}

function pickTags(tags) {
  const n = Math.random() < 0.6 ? 0 : randInt(1, 3);
  return pickN(tags, n).map((t) => t.id);
}

function generateWeaponKills(totalKills, weaponsPool) {
  if (totalKills <= 0) return [];
  const numWeapons = randInt(1, Math.min(5, weaponsPool.length));
  const chosen = pickN(weaponsPool, numWeapons);
  let remaining = totalKills;
  const result = [];
  chosen.forEach((weapon, idx) => {
    const isLast = idx === chosen.length - 1;
    const share = isLast ? remaining : randInt(0, remaining);
    result.push({ weaponId: weapon.id, kills: share });
    remaining -= share;
  });
  return result.filter((w) => w.kills > 0);
}

function tierDifficultyFactor(map, tiersById) {
  const tier = tiersById.get(map.tierId);
  if (!tier) return 1;
  return 1 + tier.points / 100;
}

function generateRunStats(map, tiersById) {
  const diff = tierDifficultyFactor(map, tiersById);
  const kills = Math.max(0, Math.round(randInt(0, 60) * diff));
  const deaths = Math.random() < 0.15 * diff ? randInt(1, 3) : 0;
  const zombieDamageDealt = kills * randInt(15, 45);
  const zombieDamageTaken = Math.round(randInt(0, 400) * diff);
  const damageTaken = zombieDamageTaken + (deaths > 0 ? randInt(0, 100) : 0);
  const presencePercentage = deaths > 0 ? randInt(20, 90) : randInt(70, 100);
  const extractionTime = Math.round(randInt(300, 1800) * diff);

  return { kills, deaths, zombieDamageDealt, zombieDamageTaken, damageTaken, presencePercentage, extractionTime };
}

function seedSessions(players, maps, mutators, tags, weapons, tiersById) {
  const tiersMap = tiersById;
  let runsCreated = 0;

  for (let s = 0; s < CONFIG.NUM_SESSIONS; s++) {
    const sessionId = crypto.randomUUID();
    const sessionTs = START_TS + Math.floor(Math.random() * PERIOD_MS);
    const map = pick(maps);

    const eligible = players.filter((p) => p._joinedAt <= sessionTs && p._runsSoFar === undefined ? true : true);
    const groupSize = randInt(1, CONFIG.MAX_PLAYERS_PER_SESSION);
    const participants = pickN(eligible.length ? eligible : players, groupSize);

    const sessionMutators = pickMutators(mutators);
    const sessionTags = pickTags(tags);

    for (const player of participants) {
      const stats = generateRunStats(map, tiersMap);
      RunsService.insert(db, {
        playerId: player.id,
        sessionId,
        mapId: map.id,
        damageTaken: stats.damageTaken,
        zombieDamageTaken: stats.zombieDamageTaken,
        zombieDamageDealt: stats.zombieDamageDealt,
        kills: stats.kills,
        deaths: stats.deaths,
        presencePercentage: stats.presencePercentage,
        extractionTime: stats.extractionTime,
        replayId: `replay_${sessionId}_${player.id}.dem`,
        mutators: sessionMutators,
        tags: pickTags(tags).length ? sessionTags : [],
        weaponKills: generateWeaponKills(stats.kills, weapons),
      });
      runsCreated++;
    }

    if ((s + 1) % CONFIG.LOG_EVERY === 0) {
      log(`sessions: ${s + 1}/${CONFIG.NUM_SESSIONS} (runs so far: ${runsCreated})`);
    }
  }

  log(`total runs created: ${runsCreated}`);
}

function seedCommunicationBlocks(players) {
  for (let i = 0; i < CONFIG.COMM_BLOCK_PAIR_COUNT; i++) {
    const a = pick(players);
    let b = pick(players);
    let attempts = 0;
    while (b.id === a.id && attempts < 5) {
      b = pick(players);
      attempts++;
    }
    if (b.id === a.id) continue;

    CommunicationBlocksService.update(db, {
      player_id: a.id,
      target_player_id: b.id,
      blocks: {
        chat: Math.random() < 0.8,
        voice: Math.random() < 0.6,
        voicecmd: Math.random() < 0.4,
      },
    });
  }
  log(`communication blocks: ${CONFIG.COMM_BLOCK_PAIR_COUNT}`);
}

function runSeed() {
  log('seeding tiers, mutators, perf tags...');
  const tiers = seedTiers();
  const tiersById = new Map(tiers.map((t) => [t.id, t]));
  const mutators = seedMutators();
  const tags = seedPerfTags();
  const weapons = seedWeapons();

  log('seeding maps...');
  const maps = seedMaps(tiers);

  log('seeding players...');
  const players = seedPlayers();

  log('seeding sessions/runs (this is the bulk of the work)...');
  seedSessions(players, maps, mutators, tags, weapons, tiersById);

  log('seeding communication blocks...');
  //seedCommunicationBlocks(players); //FIXME

  log('done.');
}

const db = new Database("./db.sqlite3");
DatabaseService.initialize(db);
db.transaction(runSeed)();