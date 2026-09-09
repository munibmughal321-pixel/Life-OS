# LifeOS

A personal life management app built around a night-shift work schedule.

## Requirements
- [Node.js](https://nodejs.org) installed on your computer (any recent version).

## How to run it
1. Open a terminal in this folder.
2. Run:
   ```
   node server.js
   ```
3. Open your browser to: **http://localhost:3000**

That's it — no npm install, no build step.

## Where your data lives
Everything you enter is saved to `data/data.json` on your own computer.
Back that file up if you want to keep your history safe.

## Project structure
```
lifeos/
├── server.js              Tiny local server — serves the app, saves/loads data.json
├── data/data.json          Your saved data
└── public/
    ├── index.html           The app shell
    ├── css/
    │   ├── base.css          Colors, layout, nav
    │   └── components.css     Buttons, cards, chips, modals
    └── js/
        ├── utils.js           Small helper functions
        ├── state.js            The shape of the app's data
        ├── storage.js           Loads/saves data to the server
        ├── nav.js                Bottom nav + screen switching
        ├── app.js                 Entry point — wires everything together
        └── screens/
            ├── dashboard.js
            ├── activities.js
            ├── growth.js
            ├── finance.js
            ├── me.js
            └── deen.js
```

## Status
This is the **foundation** — the server, data layer, and navigation shell work end to end.
Each screen file is currently a placeholder and will be filled in one at a time.
