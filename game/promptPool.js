const { fetchWordsContaining } = require("./datamuse");
const { localWordsContaining } = require("./dictionary");
const { TIERS } = require("./generatePrompts");

const sharedCache = new Map();


const TIER_SCHEDULE = [
    { fromTurn: 0, tier: "easy" },
    { fromTurn: 10, tier: "medium" },
    { fromTurn: 25, tier: "hard" },
];

function tierForTurn(turn) {
    let tier = TIER_SCHEDULE[0].tier;
    for (const step of TIER_SCHEDULE) {
        if (turn >= step.fromTurn) tier = step.tier;
    }
    return tier;
}

function loadPromptList() {
    return require("./prompts.json");
}


async function loadWords(prompt, fetchWords, cache) {
    if (cache.has(prompt)) return cache.get(prompt);

    const words = localWordsContaining(prompt);
    try {
        const { words: fetched } = await fetchWords(prompt);
        for (const w of fetched) words.add(w);
        cache.set(prompt, words);
    } catch (err) {
        console.warn(`Word fetch failed for "${prompt}", using local list: ${err.message}`);
    }
    return words;
}

function createPromptPool({
    size = 3,
    fetchWords = fetchWordsContaining,
    prompts = loadPromptList(),
    cache = sharedCache,
} = {}) {
    const byTier = {};
    const ready = {};
    const pending = new Set();
    for (const tier of TIERS) {
        byTier[tier] = prompts.filter((p) => p.tier === tier).map((p) => p.prompt);
        ready[tier] = [];
    }
    const tiers = TIERS.filter((t) => byTier[t].length > 0);

    function pickPrompt(tier, exclude) {
        const taken = new Set([...pending, ...ready[tier].map((e) => e.prompt), exclude]);
        const options = byTier[tier].filter((p) => !taken.has(p));
        const from = options.length ? options : byTier[tier];
        return from[Math.floor(Math.random() * from.length)];
    }

    function resolveTier(tier) {
        if (tiers.includes(tier)) return tier;
        const i = Math.max(0, TIERS.indexOf(tier));
        return tiers.reduce((best, t) =>
            Math.abs(TIERS.indexOf(t) - i) < Math.abs(TIERS.indexOf(best) - i) ? t : best);
    }

    async function refill(tier, exclude) {
        const prompt = pickPrompt(tier, exclude);
        pending.add(prompt);
        const validWords = await loadWords(prompt, fetchWords, cache);
        pending.delete(prompt);
        ready[tier].push({ prompt, tier, validWords });
    }

    async function fill() {
        const jobs = [];
        for (const tier of tiers) {
            const inFlight = [...pending].filter((p) => byTier[tier].includes(p)).length;
            for (let i = ready[tier].length + inFlight; i < size; i++) jobs.push(refill(tier));
        }
        await Promise.all(jobs);
    }

    function next(tier = tiers[0]) {
        tier = resolveTier(tier);
        let entry = ready[tier].shift();
        if (!entry) {
            const prompt = pickPrompt(tier);
            entry = { prompt, tier, validWords: localWordsContaining(prompt) };
        }
        refill(tier, entry.prompt);
        return entry;
    }

    return { fill, next };
}

module.exports = { createPromptPool, tierForTurn, TIER_SCHEDULE };
