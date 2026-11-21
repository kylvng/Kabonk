const fs = require("fs");
const path = require("path");
const { Client, Pool } = require("pg");

const enabled = Boolean(process.env.DATABASE_URL);

function connectionConfig(connectionString) {
    const url = new URL(connectionString);
    if (["require", "prefer", "verify-ca"].includes(url.searchParams.get("sslmode"))) {
        url.searchParams.set("sslmode", "verify-full");
    }
    return {
        connectionString: url.toString(),
        enableChannelBinding: url.searchParams.get("channel_binding") === "require",
    };
}

let pool = null;
if (enabled) {
    pool = new Pool(connectionConfig(process.env.DATABASE_URL));
    pool.on("error", (err) => console.error("Database connection error:", err.message));
}


async function init() {
    if (!enabled) return;
    const client = new Client(connectionConfig(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL));
    await client.connect();
    try {
        await client.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
    } finally {
        await client.end();
    }
}

async function query(sql, params) {
    if (!enabled) return { rows: [] };
    return pool.query(sql, params);
}


let writes = Promise.resolve();
function write(sql, params) {
    if (!enabled) return writes;
    writes = writes
        .then(() => pool.query(sql, params))
        .catch((err) => console.error("Database write failed:", err.message));
    return writes;
}

function flush() {
    return writes;
}

async function close() {
    if (!enabled) return;
    await flush();
    await pool.end();
}

module.exports = { enabled, init, query, write, flush, close };
