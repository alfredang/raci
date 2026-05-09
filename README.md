# RACI Collab

A modern, collaborative RACI matrix tool. Add roles and activities, drag colored markers (Accountable / Responsible / Consulted) into cells, and invite teammates by sharing a QR code. Pure HTML/CSS/JS + Firebase Realtime Database — no build step.

## Setup

1. **Create a Firebase project** at <https://console.firebase.google.com>.
2. **Enable Anonymous Auth**: Authentication → Sign-in method → Anonymous → Enable.
3. **Enable Realtime Database**: Build → Realtime Database → Create database → choose location → start in **test mode** (for an MVP). You can lock it down later.
4. **Register a Web App** in Project settings → General → Your apps → Add app (Web). Copy the config object.
5. **Create `js/firebase-config.js`** by copying `js/firebase-config.example.js` and pasting your config values.

```bash
cp js/firebase-config.example.js js/firebase-config.js
# then edit js/firebase-config.js with your Firebase project values
```

## Run locally

ES modules require a server (not `file://`). Any static server works:

```bash
python3 -m http.server 5173
# then open http://localhost:5173
```

## Use it

- **Create new board** → you get a unique URL.
- Click **Share** → scan the QR code from another device, or copy the link.
- Click any column or row header to rename. Use **+ Add role** / **+ Add activity** to grow the matrix.
- **Drag** the colored A / R / C swatches from the palette into any cell. Multiple markers per cell are allowed.
- **Click** a marker to remove it, or drag it to the trash can in the palette.
- Drag a marker between cells to move it.

## Recommended Realtime Database rules (basic)

For a quick demo, "test mode" is fine. For something a little tighter (any signed-in user with a board ID can read/write that board):

```json
{
  "rules": {
    "boards": {
      "$boardId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

## Tech

- Firebase Realtime Database (live sync) + Anonymous Auth
- Vanilla JS (ES modules, no bundler)
- HTML5 Drag and Drop
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) via CDN for the join QR code

## Files

- `index.html` — single-page shell + templates
- `css/styles.css` — modern grid + palette styling
- `js/app.js` — router, Firebase init, anonymous sign-in
- `js/board.js` — grid render, drag-and-drop, RTDB sync
- `js/qr.js` — share modal + QR rendering
- `js/presence.js` — live online-user avatars
