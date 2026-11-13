// builds prompts.json from Datamuse. Run with `npm run prompts`
const fs = require("fs");
const path = require("path");
const { fetchWordsContaining } = require("./datamuse");
const dictionary = require("./dictionary");

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const MIN_WORDS = 100;
const MEDIUM_MIN_WORDS = 300;
const EASY_MIN_WORDS = 1000;
const TIERS = ["easy", "medium", "hard"];

function tierFor(count) {
    if (count >= EASY_MIN_WORDS) return "easy";
    return count >= MEDIUM_MIN_WORDS ? "medium" : "hard";
}

async function mapLimit(items, limit, fn) {
    let i = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (i < items.length) {
            await fn(items[i++]);
        }
    });
    await Promise.all(workers);
}


async function generatePrompts(fetchWords, {
    concurrency = 5,
    localCount = dictionary.localCount,
    saved = {},
    onProgress = () => {},
    onSave = () => {},
} = {}) {
    const results = new Map(Object.entries(saved));
    const failed = [];
    let phase = "";
    let done = 0;
    let total = 0;

    const query = async (prompt) => {
        if (results.has(prompt)) {
            onProgress({ phase, done: ++done, total, prompt });
            return;
        }
        try {
            let r;
            try {
                r = await fetchWords(prompt);
            } catch {
                r = await fetchWords(prompt);
            }
            results.set(prompt, { count: r.words.size, capped: r.capped });
        } catch {
            failed.push(prompt);
        }
        onProgress({ phase, done: ++done, total, prompt });
        if (done % 200 === 0) onSave(results);
    };

    const pairs = [];
    for (const a of LETTERS) {
        for (const b of LETTERS) pairs.push(a + b);
    }
    [phase, done, total] = ["2-letter", 0, pairs.length];
    await mapLimit(pairs, concurrency, query);

    const realWords = (p) => Math.max(results.get(p)?.count ?? 0, localCount(p));

    const enoughWords = (p) => results.get(p)?.capped || realWords(p) >= MIN_WORDS;
    const triples = [];
    for (const pair of pairs) {
        if (!enoughWords(pair)) continue;
        for (const c of LETTERS) {
            if (enoughWords(pair[1] + c)) triples.push(pair + c);
        }
    }
    [phase, done, total] = ["3-letter", 0, triples.length];
    await mapLimit(triples, concurrency, query);
    onSave(results);

    const prompts = [...results.keys()]
        .map((prompt) => ({ prompt, count: realWords(prompt) }))
        .filter((p) => p.count >= MIN_WORDS)
        .map((p) => ({ ...p, tier: tierFor(p.count) }))
        .sort((a, b) =>
            TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) ||
            b.count - a.count ||
            a.prompt.localeCompare(b.prompt));

    return { prompts, queries: pairs.length + triples.length, failed };
}

if (require.main === module) {
    const start = Date.now();
    const fetchWords = (prompt) => fetchWordsContaining(prompt, { timeoutMs: 10000 });
    let currentPhase, phaseStart;

    const savedFile = path.join(__dirname, ".datamuse-counts.json");
    const saved = fs.existsSync(savedFile) ? JSON.parse(fs.readFileSync(savedFile, "utf8")) : {};
    const savedCount = Object.keys(saved).length;
    if (savedCount) console.log(`Resuming with ${savedCount} saved results from ${savedFile}`);

    generatePrompts(fetchWords, {
        concurrency: 5,
        saved,
        onSave: (results) => fs.writeFileSync(savedFile, JSON.stringify(Object.fromEntries(results))),
        onProgress: ({ phase, done, total, prompt }) => {
            if (phase !== currentPhase) [currentPhase, phaseStart] = [phase, Date.now()];
            if (done % 100 !== 0 && done !== total) return;
            const secs = (Date.now() - phaseStart) / 1000;
            const pct = ((done / total) * 100).toFixed(0);
            const left = ((secs / done) * (total - done)).toFixed(0);
            const line = `${phase}: ${done}/${total} (${pct}%), about ${left}s left, last: ${prompt}`;
            if (process.stdout.isTTY) process.stdout.write(`\r${line}  ${done === total ? "\n" : ""}`);
            else console.log(line);
        },
    }).then(({ prompts, queries, failed }) => {
        const out = path.join(__dirname, "prompts.json");
        fs.writeFileSync(out, JSON.stringify(prompts, null, 2) + "\n");
        const secs = ((Date.now() - start) / 1000).toFixed(1);
        const perTier = TIERS.map((t) => `${prompts.filter((p) => p.tier === t).length} ${t}`).join(", ");
        console.log(`Wrote ${prompts.length} prompts (${perTier}) to ${out}`);
        console.log(`${queries} prompts checked in ${secs}s, ${failed.length} failed`);
        if (failed.length) {
            console.log(`Failed: ${failed.slice(0, 20).join(", ")}${failed.length > 20 ? ", ..." : ""}`);
            console.log("Run again to retry them; saved results are reused.");
        }
    });
}

module.exports = { generatePrompts, tierFor, TIERS, MIN_WORDS, MEDIUM_MIN_WORDS, EASY_MIN_WORDS };
