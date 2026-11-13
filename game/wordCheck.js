const { normalize } = require("./dictionary");

// Checks a player's answer.
// validWords: Set for this prompt (from the prompt pool)
// usedWords: array or Set of words accepted since the last explosion (the `word` values returned here)
function checkWord(input, prompt, validWords, usedWords) {
    const word = normalize(input);

    if (!word) {
        return { valid: false, reason: "empty" };
    }
    if (!word.includes(normalize(prompt))) {
        return { valid: false, reason: "missing-letters" };
    }
    if (!validWords.has(word)) {
        return { valid: false, reason: "not-a-word" };
    }
    const used = usedWords instanceof Set ? usedWords.has(word) : usedWords.includes(word);
    if (used) {
        return { valid: false, reason: "already-used" };
    }

    return { valid: true, word };
}

module.exports = { checkWord };
