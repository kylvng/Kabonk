const test = require("node:test");
const assert = require("node:assert");
const { fetchWordsContaining, MAX_RESULTS } = require("../game/datamuse");

test("keeps only a-z words and reports the cap", async (t) => {
    const results = ["watch", "eye-catching", "body snatcher", "Kitchen", "pitch"].map((word) => ({ word }));
    t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => results }));

    const { words, capped } = await fetchWordsContaining("tch");
    assert.deepStrictEqual([...words], ["watch", "pitch"]);
    assert.strictEqual(capped, false);

    const full = Array.from({ length: MAX_RESULTS }, (_, i) => ({ word: `w${i}` }));
    t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => full }));
    assert.strictEqual((await fetchWordsContaining("w")).capped, true);
});

test("throws on an error status", async (t) => {
    t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 429 }));
    await assert.rejects(fetchWordsContaining("tch"), /429/);
});

test("times out even if the request never finishes or ignores the abort", async (t) => {
    t.mock.method(globalThis, "fetch", () => new Promise(() => {}));
    const start = Date.now();
    await assert.rejects(fetchWordsContaining("tch", { timeoutMs: 50 }), /timed out/);
    assert.ok(Date.now() - start < 1000);
});
