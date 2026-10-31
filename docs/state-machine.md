# Kabonk - Game Flow State Machine

## Overview
This document lists every screen in Kabonk, the states each screen can be in, and the decisions that move a player from one state to another. 

**Format:** Each screen will start with a short paragraph of its description, followed by bullet points for its states and transitions.

**Accounts:** Right now, there are no accounts or usernames. This will be a possible add-on if our team has enough time. Players will join through invite links and room codes.

___

## Game Rules
- Each player starts with two hearts (host can change amount of hearts in settings).
- **Prompt:** Depending on game mode, players will have a prompt to solve.
  - **Word Bomb:** String of letters will appear. Players will have to input a valid word containing the string of letters. Words cannot be repeated unless someone loses a life. After a life is lost, all words could be used again.
  - **Math:** Basic arithmetic problems will appear. Players will have to input the answer before the bomb explodes.
- **Bomb timer:** resets after each valid word and gets faster each time. When someone loses a life, timer will go back to normal speed. It will behave the same in other game modes (host can change bomb speed in settings).

---

## Home Screen
The page that contains the game title and main menu buttons.

### State: Main Menu
- **What is shown:** Player sees the title "Kabonk!", alongside three buttons: "Create Room", "Join Room", and "How to Play".
- **Transitions:**
  - Clicks "Create Room" → **Create Room Pop-up**
  - Clicks "Join Room" → **Join Room Pop-up**
  - Clicks "How to Play" → **How to Play Pop-up**

### State: How to Play Pop-up
- **What is shown:** When player clicks "How to Play", a pop-up will show the game instructions over the home screen. The background will dim and it does not lead to another screen.
- **Transitions:**
  - Clicks the "X" -> Main Menu
 
### State: Create Room Pop-up
- **What is shown:** Game mode options are shown (Word Bomb, Math, other options for future modes). Word Bomb is selected by default, so a mode is always selected. When a mode is selected, there will be a highlighted border for indication. The player who creates the room is the host.
- **Transitions:**
  - Clicks different modes -> stays in the Create Room Pop-Up, highlight will move to the selected mode
  - Clicks "Create" -> Room Lobby Screen and waiting for players (as the host), room code at the bottom of the screen and link is generated
  - Clicks "X" -> Main Menu
 
### State: Join Room Pop-up
- **What is shown:** Player is shown an input box in order to paste a code for joining games.
- **Transitions:**
  - Clicks "Join" and inputs valid code, game not started -> Room Lobby Screen: Waiting for Players
  - Clicks "Join" and inputs valid code, game started -> Room Lobby Screen: Spectating Game
  - Clicks "Join" and inputs valid code, but game is full -> Stays in Join Room Pop-up and shows error "The existing room is full"
  - Clicks "Join" and inputs invalid code -> Stays in Join Room Pop-up and shows error "The following room does not exist"
  - Clicks "X" -> Main Menu

### Joining by Invite Link
- Player skips home screen and goes straight to the room lobby screen
  - Game not started -> Room Lobby Screen: Waiting for Players
  - Game started -> Room Lobby Screen: Spectating
  - Room does not exist -> Show Error

---

## Room Lobby Screen
Room players enter after creating/joining. Players are shown in a circle around a bomb with their hearts, and an arrow pointing to whose turn it is. There is a chat feature shown on the right side in every state, and an invite code is shown at the bottom left.

There are going to be two views of this screen:
- **Player view:** everyone who joins the room
- **Host view:** creator of the lobby (has host controls)

### State: Waiting for Players
- **What is shown:** Players are gathered in a room before the game starts. They can chat or share invite code/link.
- **Transitions:**
  - Host clicks "Start Game" -> Starts **"Your Turn"** for the first player / **"Other Player's Turn"** for every other player
  - New player joins lobby -> Stays in **"Waiting for Players"** as player list updates
  - Player leaves -> Stays in **"Waiting for Players"** as player list updates
 
### State: Your Turn
- **What is shown:** The prompt is shown, the bomb timer is running. player has to type in an answer.
- **Transitions:**
  - Inputs a valid answer -> **"Other player's turn"** as bomb passes on and timer resets faster
  - Inputs an invalid answer (doesn't contain string, invalid answer, word already used)-> Error pops up as answer shakes to emphasize fail, stays in **"Your turn"**
  - Timer runs out -> Bomb explodes and player loses life

### State: Other Player's Turn
- **What is shown:** Player watches the current player type and can use chat.
- **Transitions:**
  - Bomb passes to this player -> Starts **"Your Turn"**
  - Only one player has hearts left -> **Winner Pop-up**

### State: Bomb Explodes
- **What is shown:** Player that holds the bomb loses a heart. The timer resets to normal speed and the list of words that were used is cleared.
- **Transitions:**
  - Player still has hearts -> Next Player's turn
  - Player doesn't have anymore hearts -> Player starts spectating and moves on to next player's turn
  - Only one player has hearts left -> **Winner Pop-up**

### State: Spectating
- **What is shown:** Player can watch the game and use chat, but cannot take turns. Players enter this state when they join a current game that is not full, or when they hit 0 hearts.
- **Transitions:**
  - Game ends -> **Winner Pop-up**
 
### State: Winner Pop-Up
- **What is shown:** Pop-up shows the winner with "Play Again" and "Return to Main Menu" buttons.
- **Transitions:**
  - Clicks "Play Again" -> **"Waiting for Players"**, joining the next game's lobby
  - Clicks "Return to Main Menu" -> **Main Menu Screen**
  - Doesn't click any button -> Player starts spectating the next game if started
 
### Host Controls (Only Host can See)
- Host will see buttons that normal players cannot see at the bottom of the screen next to the invite code.
- Clicks "Settings" -> Settings open where host can change:
  - Bomb timer length
  - Number of hearts
  - More settings added soon???
- Clicks "Remove User" -> Dropdown of player list where host can remove player from lobby, sending them back to the main menu.
- Clicks "Give Host" -> Dropdown of player list where different player can become host and see host view.

---

## Other Events that can Happen
- **Host Leaves:** Random player will become host.
- **Player Leaves during Game**: Player will lose all hearts and spectate the game if they're able to rejoin.








