const test = require("node:test");
const assert = require("node:assert");
const { createPromptPool, tierForTurn } = require("../game/promptPool");

const prompts = [
    { prompt: "ing", tier: "easy" }, { prompt: "str", tier: "easy" }, { prompt: "tch", tier: "easy" },
    { prompt: "qu", tier: "easy" },
    { prompt: "ght", tier: "medium" }, { prompt: "ack", tier: "medium" }, { prompt: "ough", tier: "medium" },
    { prompt: "mau", tier: "hard" }, { prompt: "sda", tier: "hard" }, { prompt: "zz", tier: "hard" },
];
const tierOf = (p) => prompts.find((e) => e.prompt === p).tier;

// Fake Datamuse: records calls, returns one made-up word per prompt
function fakeFetch({ fail = false } = {}) {
    const calls = [];
    const fetchWords = async (prompt) => {
        calls.push(prompt);
        if (fail) throw new Error("offline");
        return { words: new Set([`api${prompt}only`]), capped: false };
    };
    return { calls, fetchWords };
}

const tick = () => new Promise((r) => setImmediate(r));

test("fill() loads `size` distinct prompts for each tier", async () => {
    const { calls, fetchWords } = fakeFetch();
    const pool = createPromptPool({ size: 2, prompts, fetchWords, cache: new Map() });
    await pool.fill();
    assert.strictEqual(calls.length, 6);
    assert.strictEqual(new Set(calls).size, 6);
    for (const tier of ["easy", "medium", "hard"]) {
        assert.strictEqual(calls.filter((p) => tierOf(p) === tier).length, 2);
    }
});

test("next(tier) returns a ready prompt of that tier and refills the same tier", async () => {
    const { calls, fetchWords } = fakeFetch();
    const pool = createPromptPool({ size: 2, prompts, fetchWords, cache: new Map() });
    await pool.fill();

    const entry = pool.next("hard");
    assert.strictEqual(entry.tier, "hard");
    assert.strictEqual(tierOf(entry.prompt), "hard");
    assert.ok(entry.validWords instanceof Set);
    assert.strictEqual(calls.length, 7);
    assert.strictEqual(tierOf(calls[6]), "hard");
    // the refill doesn't pick the prompt that was just handed out
    assert.notStrictEqual(calls[6], entry.prompt);
});

test("next() with no tier uses easy", async () => {
    const { fetchWords } = fakeFetch();
    const pool = createPromptPool({ size: 1, prompts, fetchWords, cache: new Map() });
    await pool.fill();
    assert.strictEqual(pool.next().tier, "easy");
});

test("a tier with no prompts falls back to the nearest one", async () => {
    const { fetchWords } = fakeFetch();
    const noMedium = prompts.filter((p) => p.tier !== "medium");
    const pool = createPromptPool({ size: 1, prompts: noMedium, fetchWords, cache: new Map() });
    await pool.fill();
    assert.ok(["easy", "hard"].includes(pool.next("medium").tier));
});

test("valid words combine API words and local words", async () => {
    const { fetchWords } = fakeFetch();
    const pool = createPromptPool({ size: 1, prompts: [{ prompt: "tch", tier: "easy" }], fetchWords, cache: new Map() });
    await pool.fill();
    const { validWords } = pool.next("easy");
    assert.ok(validWords.has("apitchonly"), "API-only word missing");
    assert.ok(validWords.has("watch"), "local word missing");
});

test("a failed fetch still gives a prompt with local words", async (t) => {
    t.mock.method(console, "warn", () => {});
    const { fetchWords } = fakeFetch({ fail: true });
    const pool = createPromptPool({ size: 1, prompts: [{ prompt: "tch", tier: "easy" }], fetchWords, cache: new Map() });
    await pool.fill();
    const { prompt, validWords } = pool.next("easy");
    assert.strictEqual(prompt, "tch");
    assert.ok(validWords.has("kitchen"));
    assert.ok(!validWords.has("apitchonly"));
});

test("cached prompts aren't fetched again", async () => {
    const { calls, fetchWords } = fakeFetch();
    const cache = new Map();
    const one = [{ prompt: "tch", tier: "easy" }];
    await createPromptPool({ size: 1, prompts: one, fetchWords, cache }).fill();
    await createPromptPool({ size: 1, prompts: one, fetchWords, cache }).fill();
    assert.deepStrictEqual(calls, ["tch"]);
});

test("next() on an empty pool falls back to local words", async () => {
    const { fetchWords } = fakeFetch();
    const pool = createPromptPool({ size: 3, prompts, fetchWords, cache: new Map() });
    const entry = pool.next("medium"); // no fill()
    assert.strictEqual(tierOf(entry.prompt), "medium");
    assert.ok(entry.validWords.size > 0);
    await tick();
});

test("tierForTurn gets harder as the match goes on", () => {
    assert.strictEqual(tierForTurn(0), "easy");
    assert.strictEqual(tierForTurn(9), "easy");
    assert.strictEqual(tierForTurn(10), "medium");
    assert.strictEqual(tierForTurn(24), "medium");
    assert.strictEqual(tierForTurn(25), "hard");
    assert.strictEqual(tierForTurn(500), "hard");
});
