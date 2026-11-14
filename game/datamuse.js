const MAX_RESULTS = 1000;

// Words containing the prompt, from Datamuse. Throws on network errors or timeouts.
// capped is true when Datamuse hit its result limit, so the list may be incomplete.
async function fetchWordsContaining(prompt, { timeoutMs = 3000 } = {}) {
    const url = `https://api.datamuse.com/words?sp=*${encodeURIComponent(prompt)}*&max=${MAX_RESULTS}`;
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Datamuse timed out after ${timeoutMs}ms for "${prompt}"`));
        }, timeoutMs);
    });

    const request = async () => {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
            throw new Error(`Datamuse returned ${res.status} for "${prompt}"`);
        }
        return res.json();
    };

    let results;
    try {
        results = await Promise.race([request(), timeout]);
    } finally {
        clearTimeout(timer);
    }
    const words = new Set();
    for (const { word } of results) {
        if (/^[a-z]+$/.test(word)) words.add(word);
    }

    return { words, capped: results.length >= MAX_RESULTS };
}

module.exports = { fetchWordsContaining, MAX_RESULTS };
