const test = require("node:test");
const assert = require("node:assert");
const prompts = require("../game/prompts.json");
const { tierFor, TIERS, MIN_WORDS } = require("../game/generatePrompts");

test("prompts.json has usable, unique prompts", () => {
    assert.ok(prompts.length > 0);
    assert.strictEqual(new Set(prompts.map((p) => p.prompt)).size, prompts.length);
    for (const { prompt, count, tier } of prompts) {
        assert.match(prompt, /^[a-z]{2,3}$/);
        assert.ok(count >= MIN_WORDS, `${prompt}: ${count}`);
        assert.strictEqual(tier, tierFor(count), `${prompt}: ${count} words but tier ${tier}`);
    }
});

test("easy prompts include the common ones", () => {
    const easy = new Set(prompts.filter((p) => p.tier === "easy").map((p) => p.prompt));
    for (const p of ["ing", "tch", "str", "qu", "er"]) assert.ok(easy.has(p), `${p} isn't easy`);
});

test("every tier has prompts", () => {
    for (const tier of TIERS) {
        assert.ok(prompts.some((p) => p.tier === tier), `no ${tier} prompts`);
    }
});

test("tierFor", () => {
    assert.strictEqual(tierFor(25000), "easy");
    assert.strictEqual(tierFor(1000), "easy");
    assert.strictEqual(tierFor(999), "medium");
    assert.strictEqual(tierFor(300), "medium");
    assert.strictEqual(tierFor(299), "hard");
    assert.strictEqual(tierFor(100), "hard");
});
