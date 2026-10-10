# MotoSpeed CK108 configuration protocol

Recovered from `Motospeed.exe` (an InstallShield 2009 package around `MotoSpeed Gaming Keyboard CK108 English.exe` and `HidServ.dll`) by decompiling both with Ghidra, then checked against a live keyboard. The reference implementation is `ck108/ck108.py`.

## Status

| Area | Decoded from the app | Checked on hardware |
|---|---|---|
| Framing, checksum, reply matching | yes | yes |
| Info block (`0x03`) | yes | yes |
| Lighting block read (`0x05`) | yes | yes |
| Key map read (`0x07`), slot/LED matrix | yes | yes, every key decodes to itself |
| Per-key colour read (`0x10`) | yes | yes |
| Lighting writes (`0x06`) | yes | yes, single fields and the `0x23`-byte settings block written, read back and restored |
| Per-key colour write (`0x11`) | yes | yes, pattern written, read back and the original restored |
| Key map write (`0x08`) | yes | yes, one key changed on an inactive profile, read back and restored; a remap on the active profile read back |
| Macro blob (`0x09` / `0x0A`) | yes | stored and read back byte for byte, together with a key map entry that plays it; a recorded macro (Shift+H, I) typed "Hi" when its key was pressed |
| Profile switch (info write `0x04`) | yes | yes, byte 10 written and read back with the rest of the block unchanged; the keyboard uses the new profile's key map at once (a macro key fired only on its own profile); lighting and per-key colours stay the same across profiles |

## Transport

There is no kernel driver. The keyboard is SONiX `VID 0x0C45`, `PID 0x8502`, and all configuration goes over plain HID to the vendor collection on interface 1: usage page `0xFF1C`, usage `0x92`, 64-byte input and output reports with report ID `0x04`. Any HID stack works: hidapi, Windows `hid.dll`, or WebHID in Chromium browsers (the vendor page is not on WebHID's blocklist).

`HidServ.dll` is a generic transport wrapper. Its `Request*` exports take a 16-byte selector `{flags, VID, PID, usage page, usage}` and a checksum of their own arguments, a guard against other programs calling the DLL. A new app does not need the DLL.

## Packet

Every request and reply is 64 bytes:

| Byte | Field |
|---|---|
| 0 | report ID `0x04` |
| 1..2 | checksum, u16 LE, sum of bytes 3..63 |
| 3 | command |
| 4 | payload length, at most `0x38` |
| 5..6 | offset, u16 LE |
| 7 | status: `0` in requests; `0xFF` or `0xFE` in a reply means rejected |
| 8..63 | payload |

The reply echoes the command at byte 3. The vendor app waits up to 1000 ms for it and retries a command up to 3 times on timeout or rejection.

## Commands

| Cmd | Name | Payload |
|---|---|---|
| `0x01` | begin session | none |
| `0x02` | end session | none; the keyboard applies changes |
| `0x03` | read info | `0x2C` bytes |
| `0x04` | write info | `0x2C` bytes |
| `0x05` | read lighting | length / offset into the lighting block |
| `0x06` | write lighting | length / offset into the lighting block |
| `0x07` | read key map | offset = profile x `0x17A` + byte |
| `0x08` | write key map | same addressing as `0x07` |
| `0x09` | read macro blob | offset = byte |
| `0x0A` | write macro blob | offset = byte |
| `0x0F` | read factory key map | offset = byte, `0x17A` bytes |
| `0x10` | read per-key colours | offset = LED index x 3 |
| `0x11` | write per-key colours | offset = LED index x 3 |

The vendor app wraps every lighting, colour, key map and macro access in `0x01` ... `0x02`, with a 10 ms pause before `0x02`. The info commands run outside a session.

Do not send `0x0B`, `0x0C`, `0x0D`, `0x0E` or `0xEE`. The app contains builders for them but nothing calls them. `0xEE` is sent without waiting for a reply, and the app ships a firmware update dialog, so treat it as a possible jump to the bootloader.

## Info block (`0x03` / `0x04`)

| Offset | Meaning |
|---|---|
| 0..1 | `55 AA` |
| 4..7 | VID, PID (LE) |
| 8..9 | firmware version, u16 LE (`0x0109` on the test unit) |
| 10 | active profile, 0..2 |
| 11 | macro space in 128-byte units (`0x18`, 3072 bytes, on the test unit) |
| 16.. | supported mode bytes in UI order, zero-terminated |

Switching profile is read-modify-write: read the block, change byte 10, write it back with `0x04`, outside a session. Lighting and per-key colours are shared by every profile; a profile holds only its key map.

## Lighting block (`0x05` / `0x06`)

`0x38` bytes. The vendor app reads all of it at launch and writes single fields with `0x06`.

| Offset | Field | Values |
|---|---|---|
| `0x00` | mode | see the mode list |
| `0x01` | brightness | 0..5 |
| `0x02` | speed | 0..5; the vendor slider writes 5 at its slow end |
| `0x03` | direction | 0 / 1 for the directional modes |
| `0x04` | colourful | 1 = rainbow instead of the colour below |
| `0x05..0x07` | colour | R G B |
| `0x08` | Report1..4 buttons | 0..3 |
| `0x09..0x0B` | custom-mode background colour | R G B |
| `0x12`, `0x13` | per-mode flags | |
| `0x19..0x1C` | extra colour slot + flag | R G B, flag |
| `0x1E..0x21` | extra colour slot + flag | R G B, flag |
| `0x2A..0x32` | unknown, non-zero on the test unit | leave untouched |

Factory defaults, written by the app's Default button with one `0x06` of `0x23` bytes at offset 0: `01 04 01 00 01 FF FF FF 00 00 FF FF FF 00 00 FF FF FF 00 00 FF FF FF 00 00 FF FF FF 00 00 FF FF FF 00 00`.

### Modes

`1` Go with the stream, `2` Clouds fly, `3` Winding paths, `4` The trial of light, `5` Breathing, `6` Normally on (static), `7` Pass without trace, `8` Ripple graff, `9` Fast run without trace, `10` Swift action, `11` Flowers blooming, `12` Snow winter jasmine, `13` Hurricane, `14` Accumulate, `15` Digital Times, `16` Both ways, `17` Surmount, `18` Fast and the Furious, `20` Custom backlit mode (per-key colours).

### Controls per effect

Which controls the vendor app shows for each effect, taken from its per-mode control visibility. Brightness applies to every effect.

| Effects | Speed | Direction | Colour (`0x04..0x07`) | Rainbow (`0x04`) |
|---|---|---|---|---|
| 1, 2, 3 | yes | yes | yes | yes |
| 5, 7, 8, 9, 13, 14, 15 | yes | | yes | yes |
| 4, 10, 11 | yes | | | |
| 12 | yes | yes | | |
| 6 | | | yes | |
| 16 | | | yes | yes |
| 18 | | yes | | |
| 17 | | | four preset colours, offset not traced | |
| 20 | | | per-key colours (`0x10` / `0x11`) | |

The vendor colour picker writes `0x04 = 0` and then `0x05..0x07` as two packets, so picking a colour also turns rainbow off; the rainbow switch writes `0x04` alone. Direction `0` / `1` are the left and right arrow buttons in the vendor UI; which way each runs on the keyboard is not checked yet.

## Key matrix

Keys sit in a 21-column x 6-row matrix, and both tables index it, transposed:

- key map slot = column x 6 + row (126 slots, 3 bytes each, `0x17A` bytes per profile)
- LED index = row x 21 + column (the colour buffer is 144 LEDs, `0x1B0` bytes)

`ck108/ck108_layout.json` lists every key with its name, set-1 scancode, LED index, key map slot and the rectangle the vendor UI drew it in (for drawing a keyboard). It includes Fn (slot 35, LED 110) and the top-right media keys (LEDs 17..20), which the vendor UI never drew. Unused matrix positions read back as `02 00 00`.

The exe also carries a static key map at `0x6C6638` with a different 8-row layout; it does not match this keyboard. Use `0x0F` to get the real factory map.

## Key map entries

| Bytes | Meaning |
|---|---|
| `00 00 00` | disabled; the vendor app writes it only for an entry it cannot encode |
| `02 02 uu` | HID keyboard usage `uu` |
| `02 01 mm` | modifiers, mask: LCtrl `01`, LShift `02`, LAlt `04`, LWin `08`, RCtrl `10`, RShift `20`, RAlt `40`, RWin `80` |
| `03 lo hi` | HID consumer usage (media key) |
| `05 01 nn` | play macro `nn`, 0-based position in the macro blob |
| `05 02 02` | Fn |
| `05 05 nn` | built-in edit shortcut: `0` Open, `1` New, `2` Undo, `3` Save, `4` Copy, `5` Cut, `6` Paste, `7` Find, `8` Select All, `9` Zoom out, `10` Zoom in |

There is no entry that sends a modifier together with a key; the vendor app offers the shortcuts above, and a macro for any other combination. Its parser also reads `04 lo hi` as a generic desktop usage, but its dialog never writes one.

Usages the keyboard can send, from its HID report descriptor: keyboard usages `0x04..0x70` in the NKRO report (F13..F21 included), consumer usages, and generic desktop `0x81..0x83` (power off, sleep, wake).

Media usages offered by the vendor app: Media player `0x183`, Play/Pause `0xCD`, Stop `0xB7`, Previous `0xB6`, Next `0xB5`, Volume down `0xEA`, Volume up `0xE9`, Mute `0xE2`, WWW Home `0x223`, Refresh `0x227`, Stop `0x226`, Back `0x224`, Forward `0x225`, Favorites `0x22A`, Search `0x221`, My Computer `0x194`, Calculator `0x192`, Email `0x18A`.

The vendor Apply button writes, in one session: the macro blob (`0x0A`, always, even with no macros), then the key map of the edited profile (`0x08`); Import writes every profile. Its key editor rebuilds every untouched slot from the factory map (`0x0F`), and clearing a key restores its factory entry.

## Per-key colours (`0x10` / `0x11`)

R G B per LED index, sent in packets of 18 LEDs (54 bytes) at offset LED x 3. The vendor app writes the background colour to lighting offset `0x09` first, then the whole buffer, then selects mode `20`.

## Macro blob (`0x09` / `0x0A`)

Every multi-byte field is little-endian, so a stored blob starts with the bytes `AA 55`. Records are packed with no padding.

Reading: read 16 bytes at offset 0; if the first u16 is `0x55AA`, read the total size from offset 0 in `0x38`-byte chunks, otherwise there are no macros (a keyboard that never stored any reads back zeros). Writing: the whole blob from offset 0 in `0x38`-byte chunks, at its exact length, the last chunk short. The blob may not exceed the macro space in info byte 11; the vendor app first tries with names, then without, then refuses ("Macro space exceeds the hardware space").

| Offset | Field |
|---|---|
| 0 | u16 `0x55AA` |
| 2 | u16 total size: header, offset table, records and names |
| 4 | u16 macro count N, at most 100 in the vendor app |
| 6 | u16 1 = names included |
| 8..15 | reserved; the vendor app leaves them uninitialised, write zeros |
| 16 | N x u16, offset of each record from blob start; the first is `16 + 2N` |

Each record:

| Field | Size |
|---|---|
| step count, at most 2000 in the vendor app | u16 |
| plays per key press, 1..255 | u8 |
| name length in UTF-16 units, 0 without names | u8 |
| steps | 4 bytes each |
| name | UTF-16LE, without terminator |

A record without a name shows as "Macro N" in the vendor app. The play-once / repeat / repeat-until-pressed options in the vendor UI are not stored in the blob.

Each step is a u16 word then 2 data bytes:

| Word bits | Field |
|---|---|
| 0..11 | pause after the step, in 10 ms units; the vendor app caps it at 40000 ms |
| 12..14 | kind: `2` keyboard, `3` consumer, `4` generic desktop, the same numbering as key map byte 0 |
| 15 | `1` press, `0` release |

Keyboard data is `01 mask` for a modifier, one bit per step, or `02 usage` for a key; consumer and generic desktop data is the u16 usage. The vendor app records macros from the keyboard only; there are no mouse steps.
