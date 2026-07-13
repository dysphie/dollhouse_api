PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    steam_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    join_date INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
    last_seen INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
    bio TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
    player_id INTEGER PRIMARY KEY,
    raw_maps BOOLEAN DEFAULT 0 NOT NULL,
    show_self_keys BOOLEAN DEFAULT 0 NOT NULL,
    show_other_keys BOOLEAN DEFAULT 0 NOT NULL,
    show_ragdolls BOOLEAN DEFAULT 0 NOT NULL,
    show_self_kills BOOLEAN DEFAULT 0 NOT NULL,
    show_other_kills BOOLEAN DEFAULT 0 NOT NULL,
    hide_tips BOOLEAN DEFAULT 0 NOT NULL,
    render_distance INTEGER DEFAULT -1 NOT NULL,
    hide_distance INTEGER DEFAULT -1 NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS weapons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS run_weapon_kills (
    run_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    weapon_id INTEGER NOT NULL,
    kills INTEGER NOT NULL,

    PRIMARY KEY (run_id, player_id, weapon_id),

    FOREIGN KEY (run_id) REFERENCES runs(run_id),
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (weapon_id) REFERENCES weapons(id)
);

CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',

    starts_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,

    created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
);

CREATE TABLE IF NOT EXISTS challenge_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,

    type TEXT NOT NULL CHECK (
        type IN (
            'map_completion',
            'map_time',
            'weapon_kills'
        )
    ),

    amount INTEGER,

    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenge_requirement_maps (
    requirement_id INTEGER PRIMARY KEY,
    map_id INTEGER NOT NULL,
    time_limit REAL,

    FOREIGN KEY (requirement_id) REFERENCES challenge_requirements(id) ON DELETE CASCADE,
    FOREIGN KEY (map_id) REFERENCES maps(id)
);

CREATE TABLE IF NOT EXISTS challenge_requirement_weapons (
    requirement_id INTEGER PRIMARY KEY,
    weapon_id INTEGER NOT NULL,

    FOREIGN KEY (requirement_id) REFERENCES challenge_requirements(id) ON DELETE CASCADE,
    FOREIGN KEY (weapon_id) REFERENCES weapons(id)
);

CREATE TABLE IF NOT EXISTS challenge_requirement_mutators (
    requirement_id INTEGER NOT NULL,
    mutator_id INTEGER NOT NULL,

    PRIMARY KEY (requirement_id, mutator_id),

    FOREIGN KEY (requirement_id) REFERENCES challenge_requirements(id) ON DELETE CASCADE,
    FOREIGN KEY (mutator_id) REFERENCES mutators(id)
);

CREATE TABLE IF NOT EXISTS challenge_requirement_tags (
    requirement_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,

    PRIMARY KEY (requirement_id, tag_id),

    FOREIGN KEY (requirement_id) REFERENCES challenge_requirements(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS player_challenges (
    player_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,

    completed_at DATETIME,

    PRIMARY KEY (player_id, challenge_id),

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mutators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS mutator_cvars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutator_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (mutator_id) REFERENCES mutators(id)
);

CREATE TABLE IF NOT EXISTS tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    points INTEGER NOT NULL,
    enabled INTEGER DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    stage TEXT DEFAULT '',
    tier_id INTEGER,
    enabled INTEGER DEFAULT 1 NOT NULL,
    UNIQUE(filename, stage),
    FOREIGN KEY (tier_id) REFERENCES tiers(id)
);

CREATE TABLE IF NOT EXISTS map_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS map_map_tags (
    map_id INTEGER NOT NULL,
    map_tag_id INTEGER NOT NULL,

    PRIMARY KEY (map_id, map_tag_id),

    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
    FOREIGN KEY (map_tag_id) REFERENCES map_tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS perf_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    map_id INTEGER,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1 NOT NULL,
    FOREIGN KEY (map_id) REFERENCES maps(id)
);

CREATE TABLE IF NOT EXISTS runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    map_id INTEGER NOT NULL,
    damage_taken INTEGER DEFAULT 0 NOT NULL,
    zombie_damage_taken INTEGER DEFAULT 0 NOT NULL,
    zombie_damage_dealt INTEGER DEFAULT 0 NOT NULL,
    kills INTEGER DEFAULT 0 NOT NULL,
    deaths INTEGER DEFAULT 0 NOT NULL,
    presence_percentage REAL DEFAULT 0.0 NOT NULL,
    extraction_time REAL,
    replay_id TEXT,
    points_awarded INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (map_id) REFERENCES maps(id)
);

CREATE TABLE IF NOT EXISTS points_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('run_completion', 'bonus', 'penalty', 'admin_adjustment')),
    reason TEXT NOT NULL,
    run_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE TABLE IF NOT EXISTS run_mutators (
    run_id INTEGER NOT NULL,
    mutator_id INTEGER NOT NULL,
    PRIMARY KEY (run_id, mutator_id),
    FOREIGN KEY (run_id) REFERENCES runs(run_id),
    FOREIGN KEY (mutator_id) REFERENCES mutators(id)
);

CREATE TABLE IF NOT EXISTS run_perf_tags (
    run_id INTEGER NOT NULL,
    perf_tag_id INTEGER NOT NULL,
    PRIMARY KEY (run_id, perf_tag_id),
    FOREIGN KEY (run_id) REFERENCES runs(run_id),
    FOREIGN KEY (perf_tag_id) REFERENCES perf_tags(id)
);

CREATE TABLE IF NOT EXISTS communication_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    target_player_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('chat', 'voice', 'voicecmd')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
    UNIQUE(player_id, target_player_id, kind),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (target_player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings_filter_mutators (
    player_id INTEGER NOT NULL,
    mutator_id INTEGER NOT NULL,

    PRIMARY KEY (player_id, mutator_id),

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (mutator_id) REFERENCES mutators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings_filter_tags (
    player_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,

    PRIMARY KEY (player_id, tag_id),

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES perf_tags(id) ON DELETE CASCADE
);

-- Supports LeaderboardsService.fastestOnMap and .mostRecords, which
-- window/partition over (map_id, extraction_time) for extracted runs only.
CREATE INDEX IF NOT EXISTS idx_runs_map_extraction
    ON runs(map_id, extraction_time)
    WHERE extraction_time IS NOT NULL;
 
-- Supports fastestOnMap's per-player partition and general player/map
-- lookups (e.g. mostExtractions' COUNT(DISTINCT map_id) per player).
CREATE INDEX IF NOT EXISTS idx_runs_player_map
    ON runs(player_id, map_id);

-- Supports finding each player's fastest time on a specific map
CREATE INDEX IF NOT EXISTS idx_runs_player_map_extraction 
    ON runs(player_id, map_id, extraction_time ASC, created_at ASC)
    WHERE extraction_time IS NOT NULL;

-- Supports finding the fastest time per map
CREATE INDEX IF NOT EXISTS idx_runs_map_extraction_player 
    ON runs(map_id, extraction_time ASC, player_id)
    WHERE extraction_time IS NOT NULL;

-- Supports counting distinct maps per player with filters
CREATE INDEX IF NOT EXISTS idx_runs_player_map_extraction_only 
    ON runs(player_id, map_id)
    WHERE extraction_time IS NOT NULL;

-- For run_mutators filtering
CREATE INDEX IF NOT EXISTS idx_run_mutators_run_mutator 
    ON run_mutators(run_id, mutator_id);

-- For run_perf_tags filtering  
CREATE INDEX IF NOT EXISTS idx_run_perf_tags_run_tag 
    ON run_perf_tags(run_id, perf_tag_id);

-- Helps when filtering by both mutators and tags simultaneously
CREATE INDEX IF NOT EXISTS idx_runs_created_map 
    ON runs(map_id, created_at DESC)
    WHERE extraction_time IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_runs_session_id ON runs(session_id);
CREATE INDEX IF NOT EXISTS idx_runs_map_id ON runs(map_id);
CREATE INDEX IF NOT EXISTS idx_runs_session_created ON runs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_run_mutators_run_id ON run_mutators(run_id);
CREATE INDEX IF NOT EXISTS idx_run_perf_tags_run_id ON run_perf_tags(run_id);