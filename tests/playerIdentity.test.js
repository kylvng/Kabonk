const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

function storage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value)
    };
}

function openPage(file, search, sessionStorage, localStorage) {
    const handlers = {};
    const requests = [];
    const socket = {
        on: (event, handler) => { handlers[event] = handler; },
        emit: (event, details) => { requests.push({ event, details }); }
    };
    const script = readFileSync(path.join(__dirname, "../public/js", file), "utf8");
    vm.runInNewContext(script, {
        URLSearchParams,
        crypto: webcrypto,
        sessionStorage,
        localStorage,
        window: { location: { search } },
        document: {
            getElementById: () => ({ addEventListener() {} }),
            querySelectorAll: () => []
        },
        console: { log() {} },
        io: () => socket
    });
    return { handlers, requests };
}

test("home and room pages preserve identity on refresh while new tabs get separate players", () => {
    const sharedStorage = storage();
    // An ID from the old implementation must not merge new tabs into one player.
    sharedStorage.setItem("playerId", "legacy-shared-id");
    const jeffTab = storage();
    const butterTab = storage();

    openPage("main.js", "", jeffTab, sharedStorage);
    openPage("main.js", "", butterTab, sharedStorage);
    const jeff = openPage("room.js", "?mode=join&name=Jeff&code=ABCD", jeffTab, sharedStorage);
    const butter = openPage("room.js", "?mode=join&name=Butter&code=ABCD", butterTab, sharedStorage);
    jeff.handlers.connect();
    butter.handlers.connect();

    const jeffId = jeff.requests[0].details.playerId;
    const butterId = butter.requests[0].details.playerId;
    assert.notEqual(jeffId, butterId);
    assert.equal(jeffId, jeffTab.getItem("playerId"));
    assert.equal(butter.requests[0].details.name, "Butter");

    const refreshed = openPage("room.js", "?mode=join&name=Butter&code=ABCD", butterTab, sharedStorage);
    refreshed.handlers.connect();
    assert.equal(refreshed.requests[0].details.playerId, butterId);
    assert.equal(refreshed.requests[0].details.name, "Butter");
});
