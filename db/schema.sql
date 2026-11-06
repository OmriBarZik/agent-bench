-- Schema for the agent benchmark (SQLite). Applied by openDb() in src/db.ts every time the
-- database is opened, so every statement must be idempotent.
-- JSON columns hold JSON text (query them with json_extract / ->>), timestamps are ISO-8601
-- UTC text, booleans are 0/1.

CREATE TABLE IF NOT EXISTS tasks (
    task_id       TEXT PRIMARY KEY,
    title         TEXT,
    difficulty    TEXT,            -- e.g. simple / medium / complex
    prompt        TEXT NOT NULL,
    prompt_version     TEXT,            -- first 8 hex chars of sha256(prompt); changes whenever prompt.md changes
    judge_prompt       TEXT,            -- rubric the judge uses to choose a decision
    judge_prompt_version TEXT,          -- same for judge_prompt
    success_threshold  REAL,            -- unused; older tasks stored a decimal cutoff
    chromium_sha       TEXT NOT NULL,
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
    prompt_version       TEXT,     -- tasks.prompt_version when this run started; NULL on runs from before versions
    judge_prompt_version TEXT,     -- tasks.judge_prompt_version when this run started
    claude_version     TEXT,
    model              TEXT,
    machine            TEXT,
    started_at         TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    finished_at        TEXT,
    status             TEXT DEFAULT 'running',   -- running / done / crashed / cancelled
    duration_ms        INTEGER,
    num_turns          INTEGER,
    cost_usd           REAL,
    input_tokens           INTEGER,     -- fresh input, not served from cache
    output_tokens          INTEGER,
    cache_creation_tokens  INTEGER,     -- input written into the prompt cache
    cache_read_tokens      INTEGER,     -- input served from the prompt cache
    total_tokens           INTEGER,     -- fresh input + cache write + cache read + output
    permission_denials INTEGER,
    raw_result         TEXT,       -- JSON: full claude -p output
    artifacts_path     TEXT,       -- folder with transcript + hook logs for this run
    branch             TEXT,       -- git branch in the Chromium checkout, named after run_id
    commit_sha         TEXT,       -- tip of that branch; NULL when the tree still matches the task SHA
    changed_files      TEXT,       -- JSON: [{ "status", "path", "previousPath"? }] vs the task SHA; submodule paths are prefixed
    auto_review        INTEGER     -- 1 when this run attached chrome-validate; NULL on runs from before the toggle
);

-- One judge session per agent run. These metrics are the judge's; the agent's stay on runs.
CREATE TABLE IF NOT EXISTS judge_runs (
    run_id                 TEXT PRIMARY KEY REFERENCES runs,
    model                  TEXT,
    finished_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    status                 TEXT,            -- done / crashed / cancelled
    duration_ms            INTEGER,
    num_turns              INTEGER,
    cost_usd               REAL,
    input_tokens           INTEGER,
    output_tokens          INTEGER,
    cache_creation_tokens  INTEGER,
    cache_read_tokens      INTEGER,
    total_tokens           INTEGER,
    decision               TEXT,            -- failed / partially-failed / partially-pass / pass
    success_threshold      REAL,            -- unused; older rows stored a decimal cutoff
    score                  REAL,            -- unused; older rows stored a decimal
    success                INTEGER,         -- 1 when decision is pass or partially-pass
    reason                 TEXT,
    error                  TEXT,
    blocked                INTEGER,         -- 1 when a missing, denied, or failing tool stopped the agent
    blockers               TEXT             -- JSON: [{ "kind", "tool", "detail" }]; kind is missing-tool / denied / exec-failed
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

-- One Chromium build started from the Runs tab, on this Mac or the build Mac.
-- A queue writes one row per run. status stays 'building' until the build finishes,
-- so a crash or a sleep still shows what was in progress the next morning.
CREATE TABLE IF NOT EXISTS chromium_builds (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       TEXT NOT NULL REFERENCES runs,
    target       TEXT NOT NULL,     -- local / remote
    host         TEXT NOT NULL,     -- local, or the build Mac host
    status       TEXT NOT NULL DEFAULT 'building',  -- building / passed / failed / cancelled
    started_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    finished_at  TEXT,
    duration_ms  INTEGER,
    error        TEXT               -- why it failed or was cancelled; NULL when it passed
);

CREATE INDEX IF NOT EXISTS chromium_builds_started_idx ON chromium_builds (started_at);
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

-- One row per Chromium build an agent asked for with the chrome-validate MCP server (start_build).
-- An agent may build many times in one run; build_number counts them from 1 inside the run.
CREATE TABLE IF NOT EXISTS builds (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id         TEXT REFERENCES runs,
    build_number   INTEGER NOT NULL,
    snapshot_sha   TEXT,            -- commit of the agent's working tree that was built (not on any branch)
    status         TEXT NOT NULL DEFAULT 'building',   -- building / ok / failed / cancelled / abandoned
    started_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    finished_at    TEXT,
    duration_ms    INTEGER,         -- snapshot + send + build + copy back
    send_ms        INTEGER,         -- snapshot and push to the build Mac
    build_ms       INTEGER,         -- autoninja on the build Mac
    copy_ms        INTEGER,         -- Chromium.app copied back
    failed_step    TEXT,            -- snapshot / send / build / copy when status = failed
    error          TEXT,            -- the compiler errors (or the tail of the log) the agent was shown
    log_path       TEXT             -- full build log on this Mac
);

CREATE INDEX IF NOT EXISTS builds_run_idx ON builds (run_id);

-- Build metrics per run, for the dashboard. Runs without builds have no row.
CREATE VIEW IF NOT EXISTS run_build_stats AS
SELECT run_id,
       COUNT(*)                                        AS builds,
       SUM(status = 'ok')                              AS ok_builds,
       SUM(status = 'failed')                          AS failed_builds,
       SUM(COALESCE(duration_ms, 0))                   AS build_total_ms,
       MIN(CASE WHEN status = 'ok' THEN build_number END) AS first_ok_build,
       (SELECT b2.status FROM builds b2 WHERE b2.run_id = builds.run_id
        ORDER BY b2.build_number DESC LIMIT 1)         AS last_build_status
FROM builds
GROUP BY run_id;

-- Runs-tab builds and agent builds in one status vocabulary for the dashboard.
-- An agent's ok is passed. abandoned means the session ended while the build was still running, so it counts as cancelled.
CREATE VIEW IF NOT EXISTS build_activity AS
SELECT run_id,
       'runs-tab' AS source,
       target,
       host,
       status,
       started_at,
       duration_ms,
       error
FROM chromium_builds
UNION ALL
SELECT run_id,
       'agent' AS source,
       'remote' AS target,
       'build mac' AS host,
       CASE status
         WHEN 'ok' THEN 'passed'
         WHEN 'abandoned' THEN 'cancelled'
         ELSE status
       END AS status,
       started_at,
       duration_ms,
       error
FROM builds;
