const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { io: connect } = require("socket.io-client");
const { server, io } = require("../server");

test("room chat, validation, and leaving work across four clients in two rooms", async (t) => {
    const clients = [];
    t.after(async () => {
        for (const client of clients) client.disconnect();
        await new Promise((resolve) => io.close(resolve));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;

    async function client() {
        const socket = connect(url, { transports: ["websocket"], forceNew: true });
        clients.push(socket);
        await once(socket, "connect", { signal: AbortSignal.timeout(3000) });
        return socket;
    }

    async function response(socket, event, action) {
        const result = once(socket, event, { signal: AbortSignal.timeout(3000) });
        action();
        return (await result)[0];
    }

    async function create(socket, playerId, name) {
        return response(socket, "room-update", () => socket.emit("create-room", { playerId, name }));
    }

    async function join(socket, code, playerId, name) {
        return response(socket, "room-update", () => socket.emit("join-room", { roomCode: code, playerId, name }));
    }

    // Waiting for room-ok also drains earlier messages sent to this socket.
    async function check(socket, code) {
        await response(socket, "room-ok", () => socket.emit("check-room", { roomCode: code }));
    }

    const [alice, bob, charlie, dana] = await Promise.all([client(), client(), client(), client()]);
    const first = await create(alice, "alice", "Alice");
    const second = await create(charlie, "charlie", "Charlie");
    await join(bob, first.code, "bob", "Bob");
    await join(dana, second.code, "dana", "Dana");

    for (const bad of [undefined, null, {}, { roomCode: 123 }, { roomCode: [] }]) {
        const error = await response(bob, "join-error", () => bob.emit("check-room", bad));
        assert.match(error.message, /four-letter/);
    }
    for (const event of ["create-room", "join-room"]) {
        for (const bad of [undefined, null, { roomCode: 123, playerId: {}, name: [] }]) {
            const error = await response(bob, "join-error", () => bob.emit(event, bad));
            assert.ok(error.message);
        }
    }
    await check(bob, first.code.toLowerCase());

    const messages = new Map(clients.map((socket) => [socket, []]));
    for (const socket of clients) socket.on("chat", (message) => messages.get(socket).push(message));

    const receivedByBob = response(bob, "chat", () => {
        alice.emit("chat", { user: "Impersonated", roomCode: second.code, text: " Hello room one " });
    });
    assert.deepEqual(await receivedByBob, { user: "Alice", text: "Hello room one" });
    for (const socket of clients) await check(socket, first.code);
    assert.equal(messages.get(alice).length, 1);
    assert.equal(messages.get(charlie).length, 0);
    assert.equal(messages.get(dana).length, 0);

    const receivedByCharlie = response(charlie, "chat", () => dana.emit("chat", { text: "<script>alert(1)</script>" }));
    assert.deepEqual(await receivedByCharlie, { user: "Dana", text: "<script>alert(1)</script>" });
    for (const socket of clients) await check(socket, second.code);
    assert.equal(messages.get(alice).length, 1);
    assert.equal(messages.get(bob).length, 1);

    for (const bad of [null, {}, { text: 42 }, { text: "   " }, { text: "x".repeat(501) }]) {
        alice.emit("chat", bad);
    }
    await check(alice, first.code);
    await check(bob, first.code);
    assert.equal(messages.get(bob).length, 1);

    const remaining = response(bob, "room-update", () => alice.emit("leave-room"));
    const afterLeave = await remaining;
    assert.equal(afterLeave.hostId, "bob");
    assert.deepEqual(afterLeave.players.map((player) => player.name), ["Bob"]);

    // An explicit leave detaches the socket without needing a disconnect.
    alice.emit("chat", { text: "Should not send after leaving" });
    await check(alice, first.code);
    await check(bob, first.code);
    assert.equal(messages.get(bob).length, 1);
    await response(bob, "chat", () => bob.emit("chat", { text: "Still in room one" }));
    await check(alice, first.code);
    assert.equal(messages.get(alice).length, 1);

    // The leave acknowledgement arrives after membership cleanup.
    await bob.timeout(3000).emitWithAck("leave-room");
    const deleted = await response(bob, "join-error", () => bob.emit("check-room", { roomCode: first.code }));
    assert.match(deleted.message, /does not exist/);

    // Switching rooms removes the old membership and limits future chat.
    const third = await create(alice, "alice", "Alice");
    await join(bob, third.code, "bob", "Bob");
    const switched = response(alice, "room-update", () => {
        bob.emit("join-room", { roomCode: second.code, playerId: "bob", name: "Bob" });
    });
    assert.deepEqual((await switched).players.map((player) => player.name), ["Alice"]);
    await check(bob, second.code);
    const replaced = await client();
    messages.set(replaced, []);
    replaced.on("chat", (message) => messages.get(replaced).push(message));
    const takeover = await join(replaced, second.code, "bob", "Bob");
    assert.equal(takeover.players.filter((player) => player.id === "bob").length, 1);
    const beforeStale = messages.get(bob).length;
    bob.emit("chat", { text: "Stale socket" });
    const charlieCount = messages.get(charlie).length;
    await check(bob, second.code);
    await check(charlie, second.code);
    assert.equal(messages.get(charlie).length, charlieCount);
    await response(replaced, "chat", () => dana.emit("chat", { text: "Only current members" }));
    await check(bob, second.code);
    assert.equal(messages.get(bob).length, beforeStale);

    const afterDisconnect = response(dana, "room-update", () => charlie.disconnect());
    assert.equal((await afterDisconnect).hostId, "dana");
});
