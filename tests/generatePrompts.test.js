const test = require("node:test");
const assert = require("node:assert");
const { generatePrompts } = require("../game/generatePrompts");

// n made-up words for a prompt
const words = (prompt, n) => new Set(Array.from({ length: n }, (_, i) => `${prompt}${i}`));
const noLocal = () => 0;

test("uses the larger of the Datamuse and local counts", async () => {
    const data = {
        ab: { words: words("ab", 400), capped: true },  // capped, but only 400 a-z words
        cd: { words: words("cd", 40), capped: true },   // capped by names and phrases
        ef: { words: words("ef", 50), capped: false },
    };
    const local = { ab: 5000, cd: 30, ef: 350 };
    const fetchWords = async (p) => data[p] ?? { words: new Set(), capped: false };

    const { prompts } = await generatePrompts(fetchWords, { localCount: (p) => local[p] ?? 0 });

    assert.deepStrictEqual(prompts, [
        { prompt: "ab", count: 5000, tier: "easy" },
        { prompt: "ef", count: 350, tier: "medium" },
    ]);
});

test("filters by count, sorts by tier, and skips 3-letter strings with a small part", async () => {
    const data = {
        ab: { words: words("ab", 500), capped: false },
        bc: { words: words("bc", 150), capped: false },
        cd: { words: words("cd", 900), capped: true },   // hit the cap, but still allows "bcd"
        ce: { words: words("ce", 50), capped: false },   // too few, so "bce" is never queried
        abc: { words: words("abc", 140), capped: false },
        bcd: { words: words("bcd", 120), capped: false },
        bce: { words: words("bce", 100), capped: false },
        abx: { words: words("abx", 300), capped: false }, // "bx" is empty, so never queried
    };
    const calls = [];
    const fetchWords = async (p) => {
        calls.push(p);
        return data[p] ?? { words: new Set(), capped: false };
    };

    const { prompts, failed } = await generatePrompts(fetchWords, { localCount: noLocal });

    // sorted easy -> medium -> hard, then by count; being capped doesn't make a prompt easy
    assert.deepStrictEqual(prompts, [
        { prompt: "cd", count: 900, tier: "medium" },
        { prompt: "ab", count: 500, tier: "medium" },
        { prompt: "bc", count: 150, tier: "hard" },
        { prompt: "abc", count: 140, tier: "hard" },
        { prompt: "bcd", count: 120, tier: "hard" },
    ]);
    assert.ok(!calls.includes("abx"));
    assert.ok(!calls.includes("bce"));
    assert.strictEqual(calls.filter((p) => p.length === 2).length, 676);
    assert.deepStrictEqual(failed, []);
});

test("reuses saved results and saves new ones", async () => {
    const calls = [];
    const fetchWords = async (p) => {
        calls.push(p);
        return { words: new Set(), capped: false };
    };
    let lastSave;

    const { prompts } = await generatePrompts(fetchWords, {
        localCount: noLocal,
        saved: { ab: { count: 300, capped: false } },
        onSave: (results) => (lastSave = new Map(results)),
    });

    assert.ok(!calls.includes("ab"), "saved prompt was refetched");
    assert.deepStrictEqual(prompts, [{ prompt: "ab", count: 300, tier: "medium" }]);
    assert.strictEqual(lastSave.size, 676);
});

test("retries a failed query once, then records it as failed", async () => {
    const attempts = {};
    const fetchWords = async (p) => {
        attempts[p] = (attempts[p] ?? 0) + 1;
        if (p === "ab" && attempts[p] === 1) throw new Error("blip");
        if (p === "cd") throw new Error("down");
        return p === "ab" ? { words: words("ab", 200), capped: false } : { words: new Set(), capped: false };
    };

    const { prompts, failed } = await generatePrompts(fetchWords, { localCount: noLocal });

    assert.deepStrictEqual(prompts, [{ prompt: "ab", count: 200, tier: "hard" }]);
    assert.strictEqual(attempts.ab, 2);
    assert.deepStrictEqual(failed, ["cd"]);
});
