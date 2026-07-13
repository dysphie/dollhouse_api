'use strict';

import fs from "fs";
import { MutatorsService } from "./mutators.service.js";
import { MapsService } from "./maps.service.js";
import { PerfTagsService } from "./run-tags.service.js";
import { MapTagsService } from "./map-tags.service.js";
import { DatabaseService } from "./database.service.js";
import { TiersService } from "./tiers.service.js";
import Database from "better-sqlite3";

function log(msg) {
  console.log(`[seed-json] ${msg}`);
}

function toEnabledFlag(value) {
  return value === false || value === 0 ? 0 : 1;
}

function loadJsonConfig(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON at "${jsonPath}": ${err.message}`);
  }
  if (!data || typeof data !== "object") {
    throw new Error(`JSON file at "${jsonPath}" did not parse to an object`);
  }
  return data;
}

function seedTiersFromConfig(db, tiersData = []) {
  const tiersByName = new Map();

  for (const t of tiersData) {
    if (!t || !t.name) {
      throw new Error(`Tier entry missing required "name": ${JSON.stringify(t)}`);
    }
    const tier = TiersService.upsert(db, {
      name: t.name,
      description: t.description ?? "",
      points: t.points ?? 0,
      enabled: toEnabledFlag(t.enabled),
    });
    tiersByName.set(tier.name, tier);
  }

  log(`tiers: ${tiersByName.size} upserted`);
  return tiersByName;
}

function seedMutatorsFromConfig(db, mutatorsData = []) {
  let count = 0;

  for (const m of mutatorsData) {
    if (!m || !m.name) {
      throw new Error(`Mutator entry missing required "name": ${JSON.stringify(m)}`);
    }
    const cvars = Array.isArray(m.cvars)
      ? m.cvars.map((c) => ({
          name: c.name,
          value: String(c.value),
        }))
      : [];

    MutatorsService.upsert(db, {
      name: m.name,
      description: m.description ?? "",
      enabled: toEnabledFlag(m.enabled),
      cvars,
    });
    count++;
  }

  log(`mutators: ${count} upserted`);
  return count;
}

function seedPerfTagsFromConfig(db, tagsData = []) {
  let count = 0;

  for (const t of tagsData) {
    if (!t || !t.name) {
      throw new Error(`Perf tag entry missing required "name": ${JSON.stringify(t)}`);
    }
    PerfTagsService.upsert(db, {
      mapId: t.mapId ?? null,
      name: t.name,
      description: t.description ?? "",
      enabled: toEnabledFlag(t.enabled),
    });
    count++;
  }

  log(`perf tags: ${count} upserted`);
  return count;
}

function seedMapTagsFromConfig(db, mapTagsData = []) {
  const mapTagsByName = new Map();

  for (const mt of mapTagsData) {
    if (!mt || !mt.name) {
      throw new Error(`Map tag entry missing required "name": ${JSON.stringify(mt)}`);
    }
    const tag = MapTagsService.upsert(db, {
      name: mt.name,
      description: mt.description ?? "",
      enabled: toEnabledFlag(mt.enabled),
    });
    mapTagsByName.set(tag.name, tag);
  }

  log(`map tags: ${mapTagsByName.size} upserted`);
  return mapTagsByName;
}

function resolveMapTagIds(map, mapTagsByName) {
  const hasTagIds = Array.isArray(map.tagIds);
  const hasTagNames = Array.isArray(map.tags);
  if (!hasTagIds && !hasTagNames) return undefined;

  const ids = new Set(hasTagIds ? map.tagIds : []);

  if (hasTagNames) {
    for (const tagName of map.tags) {
      const tag = mapTagsByName.get(tagName);
      if (!tag) {
        throw new Error(
          `Map "${map.name}" references unknown map tag "${tagName}". ` +
          `Make sure it's defined under "map_tags" in the same JSON file.`
        );
      }
      ids.add(tag.id);
    }
  }

  return [...ids];
}

function seedMapsFromConfig(db, mapsData = [], tiersByName, mapTagsByName) {
  let count = 0;

  for (const m of mapsData) {
    if (!m || !m.name) {
      throw new Error(`Map entry missing required "name": ${JSON.stringify(m)}`);
    }

    let tierId = m.tierId;
    if (tierId === undefined) {
      if (!m.tier) {
        throw new Error(`Map "${m.name}" needs either "tierId" or "tier" (name)`);
      }
      const tier = tiersByName.get(m.tier);
      if (!tier) {
        throw new Error(
          `Map "${m.name}" references unknown tier "${m.tier}". ` +
          `Make sure it's defined under "tiers" in the same JSON file.`
        );
      }
      tierId = tier.id;
    }

    const tagIds = resolveMapTagIds(m, mapTagsByName);

    MapsService.upsert(db, {
      name: m.name,
      stage: m.stage ?? "",
      tierId,
      enabled: toEnabledFlag(m.enabled),
      ...(tagIds !== undefined ? { tagIds } : {}),
    });
    count++;
  }

  log(`maps: ${count} upserted`);
  return count;
}

function seedFromJsonFile(db, jsonPath) {
  const config = loadJsonConfig(jsonPath);

  const run = () => {
    const tiersByName = seedTiersFromConfig(db, config.tiers);
    seedMutatorsFromConfig(db, config.mutators);
    seedPerfTagsFromConfig(db, config.perf_tags ?? config.perfTags);
    const mapTagsByName = seedMapTagsFromConfig(db, config.map_tags ?? config.mapTags);
    seedMapsFromConfig(db, config.maps, tiersByName, mapTagsByName);
  };

  db.transaction(run)();
  log("done seeding from JSON.");
}

export {
  seedFromJsonFile,
  loadJsonConfig,
  seedTiersFromConfig,
  seedMutatorsFromConfig,
  seedPerfTagsFromConfig,
  seedMapTagsFromConfig,
  seedMapsFromConfig,
};
