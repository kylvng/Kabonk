const words = require("an-array-of-english-words");

// Trim and lowercase, so "Apple " and "apple" are the same word
function normalize(s) {
    return String(s ?? "").trim().toLowerCase();
}

// Local backup list: every word containing the prompt
function localWordsContaining(prompt) {
    const p = normalize(prompt);
    const result = new Set();
    for (const word of words) {
        if (word.includes(p)) result.add(word);
    }
    return result;
}

// How many local words contain each 2- and 3-letter string, built on first use
let substringCounts;
function localCount(prompt) {
    if (!substringCounts) {
        substringCounts = new Map();
        for (const word of words) {
            const seen = new Set();
            for (let len = 2; len <= 3; len++) {
                for (let i = 0; i + len <= word.length; i++) seen.add(word.slice(i, i + len));
            }
            for (const s of seen) substringCounts.set(s, (substringCounts.get(s) ?? 0) + 1);
        }
    }
    return substringCounts.get(normalize(prompt)) ?? 0;
}

module.exports = { normalize, localWordsContaining, localCount };
