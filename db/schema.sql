-- Schema for the agent benchmark (SQLite). Applied by openDb() in src/db.ts every time the
-- database is opened, so every statement must be idempotent.
-- JSON columns hold JSON text (query them with json_extract / ->>), timestamps are ISO-8601
-- UTC text, booleans are 0/1.

CREATE TABLE IF NOT EXISTS tasks (
    task_id       TEXT PRIMARY KEY,
    title         TEXT,
    difficulty    TEXT,            -- e.g. simple / medium / complex
    prompt        TEXT NOT NULL,
    chromium_sha  TEXT NOT NULL,
    scoring       TEXT             -- JSON: how success is checked for this task
);

CREATE TABLE IF NOT EXISTS configs (
    config_id     TEXT PRIMARY KEY,
    description   TEXT,
    config_hash   TEXT NOT NULL,   -- hash of MCP config + skills + CLAUDE.md + permissions
    tools         TEXT,            -- JSON
    permissions   TEXT             -- JSON
);

CREATE TABLE IF NOT EXISTS runs (
    run_id             TEXT PRIMARY KEY,
    task_id            TEXT REFERENCES tasks,
    config_id          TEXT REFERENCES configs,
    repeat             INTEGER,
    claude_version     TEXT,
    model              TEXT,
    machine            TEXT,
    started_at         TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    finished_at        TEXT,
    status             TEXT DEFAULT 'running',   -- running / done / crashed
    duration_ms        INTEGER,
    num_turns          INTEGER,
    cost_usd           REAL,
    input_tokens       INTEGER,
    output_tokens      INTEGER,
    cache_read_tokens  INTEGER,
    permission_denials INTEGER,
    success            INTEGER,    -- boolean
    score              REAL,
    score_details      TEXT,       -- JSON
    raw_result         TEXT,       -- JSON: full claude -p output
    artifacts_path     TEXT        -- folder with transcript + hook logs for this run
);

CREATE TABLE IF NOT EXISTS tool_calls (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       TEXT REFERENCES runs,
    session_id   TEXT,
    tool_use_id  TEXT,
    phase        TEXT,             -- pre / post
    tool         TEXT,             -- Bash, Read, mcp__server__tool, Skill...
    program      TEXT,             -- for Bash: the program actually run (rg, mytool...)
    command      TEXT,
    is_error     INTEGER,          -- boolean
    response_preview TEXT,
    ts           TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS tool_calls_run_idx ON tool_calls (run_id);
CREATE INDEX IF NOT EXISTS tool_calls_tool_use_idx ON tool_calls (tool_use_id, phase);
CREATE INDEX IF NOT EXISTS runs_task_config_idx ON runs (task_id, config_id);

-- One row per tool call attempt: ran = 0 means it was blocked/denied.
CREATE VIEW IF NOT EXISTS tool_attempts AS
SELECT p.run_id, p.tool_use_id, p.tool, p.program, p.command,
       (q.id IS NOT NULL)            AS ran,
       COALESCE(q.is_error, 0)       AS is_error
FROM tool_calls p
LEFT JOIN tool_calls q
  ON q.tool_use_id = p.tool_use_id AND q.phase = 'post'
WHERE p.phase = 'pre';
