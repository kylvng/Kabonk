# Kabonk

A multiplayer word game built with Express and Socket.IO. The Node server serves both the website and the multiplayer connections.

## Run locally

Use Node.js 22 (also specified in `.node-version`). From the repository root:

```sh
npm ci
npm start
```

Open http://localhost:3000. To use a different port, run `PORT=10000 npm start`.

Run the automated checks with `npm test`.

## Deploy to Render

Deploy the root application as a **Web Service**. The `websocket-demo/` directory is a separate prototype.

1. Push and merge the deployment changes so `render.yaml` is available on `main`.
2. Sign in at https://dashboard.render.com and choose **New > Blueprint**.
3. Connect the `kylvng/Kabonk` GitHub repository and select `main`.
4. Review the Blueprint. It creates one Node web service named `kabonk` on the **Free** instance plan. Keep it to one instance because rooms and games are stored in server memory.
5. Deploy and wait for the service to become live. Copy the HTTPS `onrender.com` address from the service dashboard. Render assigns the exact address based on name availability.

The Blueprint uses `npm ci --omit=dev` to install production dependencies, `npm start` to launch the app, and `/health` to check that HTTP is responding. No frontend build, database, or secrets are required for the current app. The server already listens on `0.0.0.0` and Render's `PORT`. Socket.IO connects to the page's origin, so the same code works locally and over HTTPS.

If creating a Web Service manually instead, use these same settings, Node runtime, repository root, `main` branch, and `NODE_ENV=production`. The `.node-version` file selects Node 22.

### Verify the public deployment

- Open the assigned HTTPS address and confirm the home page loads.
- Open `/health` at that address and confirm HTTP 200 with `{"status":"ok"}`.
- In two separate browser sessions or devices, create a room and join using its code.
- Confirm both players appear, chat reaches the other player, and a game can start and accept words.
- Leave the room and confirm the other player sees the update.

Complete these checks on the public address before closing issue #32. Local checks do not verify Render's HTTPS and WebSocket routing.

### Free hosting limits

Render provides a public `onrender.com` address and managed HTTPS, so a purchased domain is optional. Free web services sleep after 15 minutes without inbound HTTP requests or WebSocket messages and take about a minute to wake up. Free instance hours and bandwidth/build limits also apply.

Rooms, players, and games are held in memory. A deploy, restart, or idle shutdown clears them, so players must create a new room afterward. Avoid deploying during a game. Persistent rooms and running multiple instances would require shared storage and additional multiplayer infrastructure.

See Render's [free service limits](https://render.com/docs/free), [Web Service setup](https://render.com/docs/web-services), and [WebSocket support](https://render.com/docs/websocket).
