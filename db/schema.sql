-- Kabonk room state. Safe to run more than once.
-- Local:  npm run db:setup   (the server also runs this on start)

CREATE TABLE IF NOT EXISTS rooms (
    code       TEXT PRIMARY KEY CHECK (code ~ '^[A-Z]{4}$'),
    host_id    TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
    room_code  TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
    spectating BOOLEAN NOT NULL DEFAULT false,
    seat       BIGINT GENERATED ALWAYS AS IDENTITY,  -- join order, which is also turn order
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_code, id)
);
