# CK108

An open configurator for the MotoSpeed CK108 keyboard (SONiX `0C45:8502`) that replaces the vendor's Windows-only app: lighting effects, per-key colours, key remapping on every profile, macros, profile switching, and backup files.

**Use it at <https://firedeveloper.github.io/CK108/>** in Chrome, Edge or another Chromium browser. Click **Connect keyboard** and pick the CK108 in the browser's device list. Close the MotoSpeed app first if it is running; it holds the keyboard open.

Every change is written to the keyboard's own memory and stays there after the page is closed. Save a backup file from the **Backup** tab before experimenting.

## What is here

| Path | What it is |
|---|---|
| `configurator/` | The web configurator, a static SvelteKit site that talks to the keyboard over WebHID. Its README covers running and hosting it. |
| `ck108/ck108.py` | Python reference library and command line over hidapi: info, lighting, per-key colours, key maps, macros and profile switching. |
| `ck108/ck108_layout.json` | The physical key table both share: names, LED indexes, key map slots and drawing positions. |
| `PROTOCOL.md` | The vendor HID protocol, recovered from the vendor app and checked on a keyboard. |

## Run it locally

```sh
cd configurator
npm install
npm run dev
```

Open the printed `http://localhost:...` address in a Chromium browser.

The Python tool needs `pip install hidapi`; then `python ck108/ck108.py info` prints the firmware and active profile, and `python ck108/ck108.py --help` lists the other commands. Its `macros-export` and `macros-import` read and write the same macro objects as the configurator's backup files, and `macros-import` also takes a whole backup file.

## Notes

Tested on firmware `0x0109`. This project is not affiliated with MotoSpeed.

Licensed under the MIT License, see `LICENSE`.
