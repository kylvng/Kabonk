const test = require("node:test");
const assert = require("node:assert");
const { checkWord } = require("../game/wordCheck");

const validWords = new Set(["watch", "kitchen", "catching"]);

test("accepts a valid word and returns it normalized", () => {
    assert.deepStrictEqual(checkWord("watch", "tch", validWords, []), { valid: true, word: "watch" });
});

test("trims and ignores case in both input and prompt", () => {
    for (const input of [" Watch ", "WATCH", "\twatch\n"]) {
        assert.deepStrictEqual(checkWord(input, "TcH", validWords, []), { valid: true, word: "watch" });
    }
});

test("empty or whitespace-only input", () => {
    assert.strictEqual(checkWord("", "tch", validWords, []).reason, "empty");
    assert.strictEqual(checkWord("   ", "tch", validWords, []).reason, "empty");
    assert.strictEqual(checkWord(undefined, "tch", validWords, []).reason, "empty");
});

test("missing the prompt letters", () => {
    assert.deepStrictEqual(checkWord("apple", "tch", validWords, []), { valid: false, reason: "missing-letters" });
});

test("contains the prompt but isn't a real word", () => {
    assert.deepStrictEqual(checkWord("tchxyz", "tch", validWords, []), { valid: false, reason: "not-a-word" });
});

test("already used, in a different case", () => {
    assert.deepStrictEqual(checkWord("Watch", "tch", validWords, ["watch"]), { valid: false, reason: "already-used" });
});

test("usedWords works as an array or a Set", () => {
    assert.strictEqual(checkWord("watch", "tch", validWords, new Set(["watch"])).reason, "already-used");
    assert.strictEqual(checkWord("kitchen", "tch", validWords, new Set(["watch"])).valid, true);
});

test("checks run in order: letters, then real word, then used", () => {
    // fails both the letters and real-word checks -> letters reported
    assert.strictEqual(checkWord("zzz", "tch", validWords, ["zzz"]).reason, "missing-letters");
    // fake word that's somehow in the used list -> real-word reported
    assert.strictEqual(checkWord("tchxyz", "tch", validWords, ["tchxyz"]).reason, "not-a-word");
});

test("fast enough to run during a turn", () => {
    const big = new Set(Array.from({ length: 50000 }, (_, i) => `w${i}tch`));
    const used = new Set(Array.from({ length: 100 }, (_, i) => `w${i}tch`));
    const n = 10000;
    const start = performance.now();
    for (let i = 0; i < n; i++) checkWord(` W${i}TCH `, "tch", big, used);
    const avgMs = (performance.now() - start) / n;
    assert.ok(avgMs < 0.1, `average ${avgMs} ms per check`);
});
