import { MapsService } from "./maps.service.js";
import { PlayersService } from "./players.service.js";
import { WeaponsService } from "./weapons.service.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const CHALLENGE_TEMPLATES = [
    {
        name: "Clean Sweep",
        description: "Complete a map from start to finish.",
        type: "map_completion"
    },
    {
        name: "Speed Runner",
        description: "Complete a map within the target time.",
        type: "map_time"
    },
    {
        name: "Weapon Specialist",
        description: "Rack up kills with a specific weapon.",
        type: "weapon_kills"
    }
];

const CHALLENGES_PER_WEEK = 3;

const randomBetween = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const pickChallengeTemplates = () => {
    const templates = [];
    for (let i = 0; i < CHALLENGES_PER_WEEK; i++) {
        const template = CHALLENGE_TEMPLATES[randomBetween(0, CHALLENGE_TEMPLATES.length - 1)];
        templates.push(template);
    }
    return templates;
};

const getCurrentWeekWindow = (now = new Date()) => {
    const dayOfWeek = now.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;

    const startsAt = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysSinceMonday,
        0, 0, 0, 0
    ));

    const expiresAt = new Date(startsAt.getTime() + WEEK_MS);

    return {
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString()
    };
};

const findWeeklyChallenges = (db, window) => {
    return db.prepare(`
        SELECT id, name, description
        FROM challenges
        WHERE starts_at = ? AND expires_at = ?
        ORDER BY id
    `).all(window.starts_at, window.expires_at);
};

const generateWeeklyChallenges = (db, window) => {
    const templates = pickChallengeTemplates();

    const insertChallenge = db.prepare(`
        INSERT INTO challenges (name, description, starts_at, expires_at)
        VALUES (?, ?, ?, ?)
        RETURNING id
    `);

    const insertRequirement = db.prepare(`
        INSERT INTO challenge_requirements (challenge_id, type, amount)
        VALUES (?, ?, ?)
        RETURNING id
    `);

    const insertMapRequirement = db.prepare(`
        INSERT INTO challenge_requirement_maps (requirement_id, map_id, time_limit)
        VALUES (?, ?, ?)
    `);

    const insertWeaponRequirement = db.prepare(`
        INSERT INTO challenge_requirement_weapons (requirement_id, weapon_id)
        VALUES (?, ?)
    `);

    const generate = db.transaction(() => {
        for (const template of templates) {
            const challenge = insertChallenge.get(
                template.name,
                template.description,
                window.starts_at,
                window.expires_at
            );

            if (template.type === "map_completion") {
                const map = MapsService.random(db);
                if (!map) continue;

                const requirement = insertRequirement.get(challenge.id, template.type, 1);
                insertMapRequirement.run(requirement.id, map.id, null);
            }

            if (template.type === "map_time") {
                const map = MapsService.random(db);
                if (!map) continue;

                const timeLimit = randomBetween(120, 600);
                const requirement = insertRequirement.get(challenge.id, template.type, null);
                insertMapRequirement.run(requirement.id, map.id, timeLimit);
            }

            if (template.type === "weapon_kills") {
                const weapon = WeaponsService.random(db);
                if (!weapon) continue;

                const amount = randomBetween(15, 50);
                const requirement = insertRequirement.get(challenge.id, template.type, amount);
                insertWeaponRequirement.run(requirement.id, weapon.id);
            }
        }
    });

    generate();
};

const getWeeklyChallengesForPlayer = (db, playerId, window) => {
    return db.prepare(`
        SELECT
            c.id,
            c.name,
            c.description,
            c.starts_at,
            c.expires_at,
            pc.completed_at
        FROM challenges c
        LEFT JOIN player_challenges pc
            ON pc.challenge_id = c.id AND pc.player_id = ?
        WHERE c.starts_at = ? AND c.expires_at = ?
        ORDER BY c.id
    `).all(playerId, window.starts_at, window.expires_at);
};

const markCompleted = (db, playerId, challengeId) => {
    return db.prepare(`
        INSERT INTO player_challenges (
            player_id,
            challenge_id,
            completed_at
        )
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(player_id, challenge_id) DO NOTHING
    `).run(playerId, challengeId);
};

const getWeeklyForPlayer = (db, playerId) => {

    const window = getCurrentWeekWindow();

    const existing = findWeeklyChallenges(db, window);
    if (existing.length === 0) {
        generateWeeklyChallenges(db, window);
    }

    return getWeeklyChallengesForPlayer(db, playerId, window);
};

export const ChallengesService = {
    markCompleted,
    getCurrentWeekWindow,
    getWeeklyForPlayer
};
