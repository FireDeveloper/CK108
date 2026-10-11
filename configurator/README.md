# CK108 Configurator

A static web app that configures the MotoSpeed CK108 keyboard over WebHID, replacing the vendor's Windows-only driver app. The protocol it speaks is specified in `../PROTOCOL.md`.

Current stage: connect, show the keyboard's identity and active profile, edit lighting (effect, brightness, speed, direction, colour, rainbow and Surmount's preset colour, each control shown only for the effects that use it), paint per-key colours for Custom backlit mode on a drawing of the keyboard or pick one of the ready-made patterns or a gradient of your own colours, with Undo, switch the active profile and remap its keys (to another key, modifiers, a media key, a built-in edit shortcut, a macro, or nothing), record, build and edit macros, and save every setting to a JSON backup file and restore chosen parts from one. Every change is written to the keyboard and read back. The interface is monochrome in light and dark themes, follows the system theme or a choice remembered in the browser, and adapts to narrow windows.

## Run

```sh
npm install
npm run dev
```

Open the printed `http://localhost:...` address in Chrome or Edge, click **Connect keyboard** and pick the CK108 in the browser's device picker. Close the vendor MotoSpeed app first; it holds the keyboard open.

## Build and host

```sh
npm run build
```

`build/` is a plain static site: upload it to any static host. To serve it under a sub-path, set `BASE_PATH` when building, e.g. `BASE_PATH=/CK108 npm run build`; `../.github/workflows/pages.yml` does this to publish to GitHub Pages on every push to `main`. WebHID itself adds these requirements:

- serve it over `https://` (or `http://localhost` while developing)
- open it in a Chromium browser; Firefox and Safari do not implement WebHID

If the page is embedded in an iframe, the iframe needs `allow="hid"`.

On Linux the browser needs access to the keyboard's hidraw node; add `/etc/udev/rules.d/50-ck108.rules` with `SUBSYSTEM=="hidraw", ATTRS{idVendor}=="0c45", ATTRS{idProduct}=="8502", TAG+="uaccess"` and replug the keyboard. Windows and macOS need nothing.

## Layout

- `src/lib/ck108/protocol.ts` - packet framing, checksum and block decoders, no browser APIs
- `src/lib/ck108/keyboard.ts` - WebHID transport: request/reply with timeout and retries, sessions, one operation at a time
- `src/lib/ck108/connection.svelte.ts` - reactive connection state shared through context
- `src/lib/ck108/layout.ts` - physical keys (name, LED index, key map slot, drawing rectangle), read from `../ck108/ck108_layout.json`, the table the Python driver uses too
- `src/lib/ck108/usages.ts` - the HID usages the keyboard can send, with names, picker groups and browser key codes
- `src/lib/ck108/keymap.ts` - key map entries: decode, encode, and display names for what a key does
- `src/lib/ck108/macros.ts` - the macro blob: model, encoder, decoder, and fitting it into the keyboard's macro space
- `src/lib/backup/backup.ts` - the backup file format: JSON with byte blocks as hex and macros as readable objects, checked field by field on load
- `src/lib/device/` - the keyboard in the app frame: the device panel with the profile switch, the connect screen, and the placeholder shown while settings are read
- `src/lib/lighting/`, `src/lib/key-colors/`, `src/lib/remap/`, `src/lib/macros/`, `src/lib/backup/` - the editors behind each screen
- `src/lib/ui/` - the shared components, from the app frame, cards and dialogs down to every form control, plus the theme switch and its stored choice; pages build their UI from these and never from raw form elements
- `src/app.css` - the design tokens: a hue-free gray scale, the light and dark theme aliases, type, spacing, radius and motion; `src/app.html` applies a stored theme before the first paint
- `src/routes/` - pages; the root layout gates every page behind the connect screen and prerenders, so each route ships as static HTML

WebHID hands the report ID to `sendReport()` separately from the data, so data indexes in `protocol.ts` are one less than the byte numbers in `PROTOCOL.md`.
