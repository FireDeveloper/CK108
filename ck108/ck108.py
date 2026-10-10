"""
@file ck108.py
@brief MotoSpeed CK108 (SONiX 0C45:8502) vendor HID protocol: lighting, per-key colour, key remap and profiles.
@note Recovered from the vendor configurator and its HidServ.dll; the wire format is specified in PROTOCOL.md.
@note Requires the hidapi package (pip install hidapi); no driver install, the keyboard enumerates as plain HID.
"""

import argparse
import contextlib
import json
import pathlib
import sys
import time

import hid

#& Public Variables

VID = 0x0C45  # SONiX vendor ID
PID = 0x8502  # CK108 product ID
USAGE_PAGE = 0xFF1C  # vendor-defined configuration collection
USAGE = 0x92  # configuration collection usage

REPORT_ID = 0x04  # first byte of every request and reply
PACKET_SIZE = 64  # report length, report ID included
CHUNK_SIZE = 0x38  # largest payload carried by one packet
TIMEOUT_MS = 1000  # reply wait per attempt, as in the vendor app
RETRIES = 3  # attempts per command, as in the vendor app
STATUS_REJECTED = (0xFF, 0xFE)  # reply status bytes that mean failure
SESSION_END_DELAY = 0.010  # seconds the vendor app waits before CMD_END

CMD_BEGIN = 0x01  # open a configuration session
CMD_END = 0x02  # close the session and apply
CMD_READ_INFO = 0x03  # read the 44-byte info block
CMD_WRITE_INFO = 0x04  # write the 44-byte info block back
CMD_READ_LIGHTING = 0x05  # read the lighting block at an offset
CMD_WRITE_LIGHTING = 0x06  # write the lighting block at an offset
CMD_READ_KEYMAP = 0x07  # read a profile key map
CMD_WRITE_KEYMAP = 0x08  # write a profile key map
CMD_READ_MACROS = 0x09  # read the macro blob
CMD_WRITE_MACROS = 0x0A  # write the macro blob
CMD_READ_DEFAULT_KEYMAP = 0x0F  # read the factory key map
CMD_READ_KEY_COLORS = 0x10  # read per-key colours
CMD_WRITE_KEY_COLORS = 0x11  # write per-key colours

INFO_SIZE = 0x2C  # info block length
INFO_PROFILE = 0x0A  # info block offset of the active profile
LIGHTING_SIZE = 0x38  # lighting block length
LIGHT_MODE = 0x00  # lighting offset: effect mode
LIGHT_BRIGHTNESS = 0x01  # lighting offset: brightness level
LIGHT_SPEED = 0x02  # lighting offset: effect speed
LIGHT_DIRECTION = 0x03  # lighting offset: effect direction
LIGHT_COLORFUL = 0x04  # lighting offset: rainbow flag
LIGHT_COLOR = 0x05  # lighting offset: effect colour, R G B
LIGHT_REPORT = 0x08  # lighting offset: Report1..4 selector
LIGHT_BACKGROUND = 0x09  # lighting offset: custom-mode background colour, R G B

PROFILES = 3  # hardware profile slots
KEYMAP_SLOTS = 126  # 21 columns x 6 rows
KEYMAP_SIZE = KEYMAP_SLOTS * 3  # bytes per profile key map
LED_SLOTS = 144  # per-key colour buffer length in LEDs
LEDS_PER_CHUNK = 18  # LEDs per colour packet, 54 bytes

MODE_CUSTOM = 0x14  # per-key colour mode
MODES = {  # mode byte -> vendor UI name
    1: "Go with the stream",
    2: "Clouds fly",
    3: "Winding paths",
    4: "The trial of light",
    5: "Breathing",
    6: "Normally on",
    7: "Pass without trace",
    8: "Ripple graff",
    9: "Fast run without trace",
    10: "Swift action",
    11: "Flowers blooming",
    12: "Snow winter jasmine",
    13: "Hurricane",
    14: "Accumulate",
    15: "Digital Times",
    16: "Both ways",
    17: "Surmount",
    18: "Fast and the Furious",
    MODE_CUSTOM: "Custom backlit mode",
}

MODIFIERS = {"LCtrl": 0x01, "LShift": 0x02, "LAlt": 0x04, "LWin": 0x08, "RCtrl": 0x10, "RShift": 0x20, "RAlt": 0x40, "RWin": 0x80}  # name -> modifier mask bit

MEDIA = {  # name -> HID consumer usage, in the vendor app's menu order
    "MediaPlayer": 0x183,
    "PlayPause": 0xCD,
    "Stop": 0xB7,
    "PrevTrack": 0xB6,
    "NextTrack": 0xB5,
    "VolumeDown": 0xEA,
    "VolumeUp": 0xE9,
    "Mute": 0xE2,
    "WWWHome": 0x223,
    "WWWRefresh": 0x227,
    "WWWStop": 0x226,
    "WWWBack": 0x224,
    "WWWForward": 0x225,
    "WWWFavorites": 0x22A,
    "WWWSearch": 0x221,
    "MyComputer": 0x194,
    "Calculator": 0x192,
    "Email": 0x18A,
}

HID_KEYS = {  # name -> HID keyboard usage
    **{chr(ord("A") + i): 0x04 + i for i in range(26)},
    **{str((i + 1) % 10): 0x1E + i for i in range(10)},
    "Enter": 0x28, "Esc": 0x29, "Backspace": 0x2A, "Tab": 0x2B, "Space": 0x2C, "-": 0x2D, "=": 0x2E, "[": 0x2F, "]": 0x30, "\\": 0x31,
    ";": 0x33, "'": 0x34, "`": 0x35, ",": 0x36, ".": 0x37, "/": 0x38, "CapsLock": 0x39,
    **{f"F{i + 1}": 0x3A + i for i in range(12)},
    "PrintScreen": 0x46, "ScrollLock": 0x47, "Pause": 0x48, "Insert": 0x49, "Home": 0x4A, "PageUp": 0x4B, "Delete": 0x4C, "End": 0x4D,
    "PageDown": 0x4E, "Right": 0x4F, "Left": 0x50, "Down": 0x51, "Up": 0x52, "NumLock": 0x53, "Num/": 0x54, "Num*": 0x55, "Num-": 0x56,
    "Num+": 0x57, "NumEnter": 0x58, **{f"Num{(i + 1) % 10}": 0x59 + i for i in range(10)}, "Num.": 0x63, "NonUS\\": 0x64, "App": 0x65,
}

ENTRY_DISABLED = bytes(3)  # key map entry: key does nothing

SHORTCUTS = ["Open", "New", "Undo", "Save", "Copy", "Cut", "Paste", "Find", "SelectAll", "ZoomOut", "ZoomIn"]  # built-in edit shortcuts, by firmware index

LAYOUT_PATH = pathlib.Path(__file__).with_name("ck108_layout.json")  # key name / LED / slot table

#& Public Functions


class CK108Error(Exception):
    """@brief Keyboard missing, command rejected, or no reply within the retry budget."""


def build_packet(cmd, length=0, offset=0, payload=b""):
    """
    @brief Frame one request: report ID, checksum, command, length, offset, status, payload.
    @param[in] cmd Command byte (CMD_*).
    @param[in] length Length field, 0..CHUNK_SIZE.
    @param[in] offset Offset field, 0..0xFFFF.
    @param[in] payload Bytes placed from byte 8; at most CHUNK_SIZE.
    @return The PACKET_SIZE-byte report.
    @exception ValueError A field is out of range.
    """
    #- Input validation
    if not 0 <= length <= CHUNK_SIZE or not 0 <= offset <= 0xFFFF or len(payload) > CHUNK_SIZE:  # fields fit the header
        raise ValueError(f"bad packet fields: length={length} offset={offset} payload={len(payload)}")  # reject the request

    #- Header and payload
    packet = bytearray(PACKET_SIZE)  # zero-filled report
    packet[0] = REPORT_ID  # report ID
    packet[3] = cmd  # command
    packet[4] = length  # payload length
    packet[5:7] = offset.to_bytes(2, "little")  # data offset
    packet[8 : 8 + len(payload)] = payload  # payload

    #- Checksum over bytes 3..63
    packet[1:3] = (sum(packet[3:]) & 0xFFFF).to_bytes(2, "little")  # u16 LE sum
    return bytes(packet)  # framed request


def find_path():
    """
    @brief Locate the CK108 configuration collection.
    @return hidapi device path of the first match.
    @exception CK108Error No CK108 is connected.
    """
    for dev in hid.enumerate(VID, PID):  # every collection of every CK108
        if dev["usage_page"] == USAGE_PAGE and dev["usage"] == USAGE:  # vendor configuration collection
            return dev["path"]  # first match
    raise CK108Error(f"no keyboard {VID:04X}:{PID:04X} with collection {USAGE_PAGE:04X}/{USAGE:02X}")  # keyboard absent


def entry_key(usage):
    """
    @brief Key map entry that sends one HID keyboard usage.
    @param[in] usage HID keyboard usage, e.g. HID_KEYS["A"].
    @return 3-byte entry.
    """
    return bytes([0x02, 0x02, usage])  # single key


def entry_modifier(mask):
    """
    @brief Key map entry that acts as modifier keys.
    @param[in] mask OR of MODIFIERS bits.
    @return 3-byte entry.
    """
    return bytes([0x02, 0x01, mask])  # modifier mask


def entry_media(usage):
    """
    @brief Key map entry that sends one HID consumer usage.
    @param[in] usage HID consumer usage, e.g. MEDIA["Mute"].
    @return 3-byte entry.
    """
    return bytes([0x03]) + usage.to_bytes(2, "little")  # consumer usage


def entry_macro(index):
    """
    @brief Key map entry that plays a stored macro.
    @param[in] index 0-based macro position in the macro blob.
    @return 3-byte entry.
    """
    return bytes([0x05, 0x01, index])  # macro reference


def entry_shortcut(index):
    """
    @brief Key map entry that sends a built-in edit shortcut.
    @param[in] index Position in SHORTCUTS.
    @return 3-byte entry.
    """
    return bytes([0x05, 0x05, index])  # built-in shortcut


def describe_entry(entry):
    """
    @brief Name a 3-byte key map entry for display.
    @param[in] entry 3-byte entry.
    @return Readable name, or the hex bytes when unknown.
    """
    #- Reverse lookups
    keys = {v: k for k, v in HID_KEYS.items()}  # usage -> key name
    media = {v: k for k, v in MEDIA.items()}  # usage -> media name

    #- Decode by type byte
    kind, sub, value = entry  # entry bytes
    if kind == 0x02 and sub == 0x02:  # single key
        return keys.get(value, f"usage {value:#04x}")  # key name
    if kind == 0x02 and sub == 0x01:  # modifiers
        return "+".join(name for name, bit in MODIFIERS.items() if value & bit) or "none"  # modifier names
    if kind == 0x03:  # consumer usage
        usage = sub | value << 8  # u16 LE usage
        return media.get(usage, f"consumer {usage:#05x}")  # media name
    if entry == b"\x05\x02\x02":  # Fn layer key
        return "Fn"  # Fn
    if kind == 0x05 and sub == 0x01:  # macro reference
        return f"macro {value}"  # 0-based macro index
    if kind == 0x05 and sub == 0x05 and value < len(SHORTCUTS):  # built-in shortcut
        return SHORTCUTS[value]  # shortcut name
    if kind in (0x00, 0x02) and sub == 0x00:  # empty matrix position or disabled key
        return "none"  # nothing
    return entry.hex(" ")  # unknown entry


def load_layout():
    """
    @brief Load the key table: name, scancode, LED index, key map slot and vendor UI rectangle per key.
    @return List of dicts, sorted by LED index.
    """
    return json.loads(LAYOUT_PATH.read_text(encoding="utf-8"))  # parsed table


class CK108:
    """@brief Open handle on the CK108 configuration collection; use as a context manager."""

    def __init__(self, path=None):
        """
        @brief Open the configuration collection.
        @param[in] path hidapi device path; None picks the first CK108 found.
        @exception CK108Error No CK108 is connected.
        """
        self._dev = hid.device()  # hidapi handle
        self._dev.open_path(path or find_path())  # claim the collection

    def __enter__(self):
        """@brief Return the open handle."""
        return self  # handle

    def __exit__(self, *exc):
        """@brief Release the collection."""
        self.close()  # release the handle

    def close(self):
        """@brief Release the collection."""
        self._dev.close()  # release the handle

    def transfer(self, cmd, length=0, offset=0, payload=b""):
        """
        @brief Send one command and return its reply payload.
        @param[in] cmd Command byte (CMD_*).
        @param[in] length Length field, 0..CHUNK_SIZE.
        @param[in] offset Offset field, 0..0xFFFF.
        @param[in] payload Bytes placed from byte 8; at most CHUNK_SIZE.
        @return Reply payload, CHUNK_SIZE bytes from the reply's byte 8.
        @exception CK108Error Every attempt timed out or came back with a STATUS_REJECTED status.
        """
        request = build_packet(cmd, length, offset, payload)  # framed request
        status = None  # last reply status seen
        for _ in range(RETRIES):  # vendor app retry budget
            #- Send and wait for the echoed command
            self._dev.write(request)  # output report
            reply = self._read_reply(cmd)  # reply with matching command byte

            #- Accept, or retry on timeout or rejection
            if reply is not None and reply[7] not in STATUS_REJECTED:  # valid reply
                return bytes(reply[8 : 8 + CHUNK_SIZE])  # reply payload
            status = None if reply is None else reply[7]  # remember why this attempt failed
        raise CK108Error(f"command {cmd:#04x} failed: " + ("no reply" if status is None else f"status {status:#04x}"))  # retries exhausted

    @contextlib.contextmanager
    def session(self):
        """
        @brief Wrap commands in CMD_BEGIN ... CMD_END, as the vendor app does around every lighting, colour and key map access.
        @note CMD_END is sent even when a command inside the session raises.
        """
        self.transfer(CMD_BEGIN)  # open the session
        try:
            yield self  # caller's commands
        finally:
            time.sleep(SESSION_END_DELAY)  # vendor app pauses before closing
            self.transfer(CMD_END)  # close the session

    def read_info(self):
        """
        @brief Read the info block.
        @return Dict with raw block, firmware version, active profile and supported mode bytes.
        @note Sent outside a session, as the vendor app does at launch.
        """
        raw = self.transfer(CMD_READ_INFO, INFO_SIZE)[:INFO_SIZE]  # info block
        modes = raw[16:]  # mode list, zero-terminated
        return {  # decoded info
            "raw": raw,
            "vid": int.from_bytes(raw[4:6], "little"),
            "pid": int.from_bytes(raw[6:8], "little"),
            "firmware": int.from_bytes(raw[8:10], "little"),
            "profile": raw[INFO_PROFILE],
            "modes": list(modes[: modes.index(0)] if 0 in modes else modes),
        }

    def set_profile(self, profile):
        """
        @brief Switch the active hardware profile.
        @param[in] profile 0..PROFILES-1.
        @exception ValueError profile out of range.
        """
        #- Input validation
        if not 0 <= profile < PROFILES:  # valid slot
            raise ValueError(f"profile {profile} not in 0..{PROFILES - 1}")  # reject

        #- Read-modify-write the info block
        info = bytearray(self.read_info()["raw"])  # current block
        info[INFO_PROFILE] = profile  # new active profile
        self.transfer(CMD_WRITE_INFO, INFO_SIZE, 0, bytes(info))  # write it back

    def read_lighting(self):
        """
        @brief Read the lighting block.
        @return LIGHTING_SIZE bytes; LIGHT_* constants name the known offsets.
        """
        with self.session():  # session around the read
            return self.transfer(CMD_READ_LIGHTING, LIGHTING_SIZE, 0)[:LIGHTING_SIZE]  # lighting block

    def write_lighting(self, *fields):
        """
        @brief Write fields into the lighting block in one session; the keyboard applies them on CMD_END.
        @param[in] fields (offset, data) pairs, offset a LIGHT_* constant, data at most CHUNK_SIZE bytes.
        """
        with self.session():  # session around the writes
            for offset, data in fields:  # one packet per field, as the vendor app sends them
                self.transfer(CMD_WRITE_LIGHTING, len(data), offset, data)  # field update

    def set_mode(self, mode):
        """
        @brief Select a lighting effect.
        @param[in] mode A MODES key.
        @exception ValueError Unknown mode.
        """
        if mode not in MODES:  # known effect
            raise ValueError(f"unknown mode {mode}")  # reject
        self.write_lighting((LIGHT_MODE, bytes([mode])))  # effect byte

    def set_brightness(self, level):
        """
        @brief Set backlight brightness.
        @param[in] level 0..5; the keyboard reported 5 at full brightness.
        """
        self.write_lighting((LIGHT_BRIGHTNESS, bytes([level])))  # brightness byte

    def set_speed(self, level):
        """
        @brief Set effect speed.
        @param[in] level 0..5; the vendor slider writes 5 at its slow end and 0 at its fast end.
        """
        self.write_lighting((LIGHT_SPEED, bytes([level])))  # speed byte

    def set_direction(self, reverse):
        """
        @brief Set effect direction for the directional modes.
        @param[in] reverse False for the default direction, True to reverse it.
        """
        self.write_lighting((LIGHT_DIRECTION, bytes([int(reverse)])))  # direction byte

    def set_color(self, rgb, colorful=False):
        """
        @brief Set the effect colour, or switch the effect to rainbow.
        @param[in] rgb (r, g, b), each 0..255.
        @param[in] colorful True to use rainbow colours instead of rgb.
        """
        self.write_lighting((LIGHT_COLORFUL, bytes([int(colorful)])), (LIGHT_COLOR, bytes(rgb)))  # rainbow flag, then R G B, as two packets

    def read_key_colors(self):
        """
        @brief Read the per-key colour buffer used by MODE_CUSTOM.
        @return LED_SLOTS * 3 bytes, R G B per LED index.
        """
        colors = bytearray()  # accumulated buffer
        with self.session():  # session around the reads
            for led in range(0, LED_SLOTS, LEDS_PER_CHUNK):  # one packet per chunk
                colors += self.transfer(CMD_READ_KEY_COLORS, LEDS_PER_CHUNK * 3, led * 3)[: LEDS_PER_CHUNK * 3]  # chunk colours
        return bytes(colors)  # full buffer

    def write_key_colors(self, colors):
        """
        @brief Write the per-key colour buffer; select MODE_CUSTOM to show it.
        @param[in] colors LED_SLOTS * 3 bytes, R G B per LED index.
        @exception ValueError Wrong buffer length.
        """
        #- Input validation
        if len(colors) != LED_SLOTS * 3:  # full buffer only
            raise ValueError(f"need {LED_SLOTS * 3} colour bytes, got {len(colors)}")  # reject

        #- Chunked write
        size = LEDS_PER_CHUNK * 3  # bytes per packet
        with self.session():  # session around the writes
            for led in range(0, LED_SLOTS, LEDS_PER_CHUNK):  # one packet per chunk
                self.transfer(CMD_WRITE_KEY_COLORS, size, led * 3, colors[led * 3 : led * 3 + size])  # chunk colours

    def read_keymap(self, profile):
        """
        @brief Read one profile's key map.
        @param[in] profile 0..PROFILES-1.
        @return KEYMAP_SIZE bytes, 3 per slot; slot = column * 6 + row.
        """
        return self._read_chunked(CMD_READ_KEYMAP, profile * KEYMAP_SIZE, KEYMAP_SIZE)  # profile key map

    def read_default_keymap(self):
        """
        @brief Read the factory key map stored in the keyboard.
        @return KEYMAP_SIZE bytes, same layout as read_keymap().
        """
        return self._read_chunked(CMD_READ_DEFAULT_KEYMAP, 0, KEYMAP_SIZE)  # factory key map

    def write_keymap(self, profile, keymap):
        """
        @brief Write one profile's key map.
        @param[in] profile 0..PROFILES-1.
        @param[in] keymap KEYMAP_SIZE bytes, see read_keymap().
        @exception ValueError Wrong length or profile out of range.
        @warning The vendor app writes the macro blob in the same session first; entries that reference a macro need that blob present.
        """
        #- Input validation
        if len(keymap) != KEYMAP_SIZE or not 0 <= profile < PROFILES:  # full map, valid slot
            raise ValueError(f"need {KEYMAP_SIZE} bytes for profile 0..{PROFILES - 1}")  # reject

        #- Chunked write
        base = profile * KEYMAP_SIZE  # profile offset in the key map store
        with self.session():  # session around the writes
            for offset in range(0, KEYMAP_SIZE, CHUNK_SIZE):  # one packet per chunk
                part = keymap[offset : offset + CHUNK_SIZE]  # chunk bytes
                self.transfer(CMD_WRITE_KEYMAP, len(part), base + offset, part)  # chunk entries

    def remap(self, profile, slot, entry):
        """
        @brief Change one key in one profile.
        @param[in] profile 0..PROFILES-1.
        @param[in] slot Key map slot, from load_layout().
        @param[in] entry 3-byte entry from entry_key(), entry_modifier(), entry_media(), entry_shortcut(), entry_macro() or ENTRY_DISABLED.
        """
        keymap = bytearray(self.read_keymap(profile))  # current map
        keymap[slot * 3 : slot * 3 + 3] = entry  # new entry
        self.write_keymap(profile, bytes(keymap))  # full map back

    def _read_reply(self, cmd):
        """
        @brief Read input reports until one echoes cmd, or until a read times out.
        @param[in] cmd Command byte the reply must echo at byte 3.
        @return The reply report, or None on timeout.
        """
        while True:  # skip unrelated reports
            reply = self._dev.read(PACKET_SIZE, TIMEOUT_MS)  # next input report
            if not reply:  # timed out
                return None  # no reply
            if reply[0] == REPORT_ID and reply[3] == cmd:  # our reply
                return reply  # matched

    def _read_chunked(self, cmd, base, size):
        """
        @brief Read size bytes from base with one command per CHUNK_SIZE chunk, inside one session.
        @param[in] cmd Read command.
        @param[in] base Offset of the first byte.
        @param[in] size Total length.
        @return The bytes read.
        """
        data = bytearray()  # accumulated bytes
        with self.session():  # session around the reads
            for offset in range(0, size, CHUNK_SIZE):  # one packet per chunk
                length = min(CHUNK_SIZE, size - offset)  # last chunk is short
                data += self.transfer(cmd, length, base + offset)[:length]  # chunk bytes
        return bytes(data)  # full block


def main(argv=None):
    """
    @brief Command-line front end: info, lighting and key map dumps, lighting changes and single-key remaps.
    @param[in] argv Arguments; None reads sys.argv.
    @return Process exit code.
    @retval 0 Command completed.
    @retval 1 Keyboard missing or command failed.
    """
    #- Arguments
    parser = argparse.ArgumentParser(description=__doc__.split("@brief ")[1].splitlines()[0])  # brief from the file banner
    sub = parser.add_subparsers(dest="command", required=True)  # one subcommand per action
    sub.add_parser("info", help="firmware, active profile, supported modes")  # info dump
    sub.add_parser("lighting", help="dump the lighting block")  # lighting dump
    p = sub.add_parser("keymap", help="dump a profile key map by key name")  # key map dump
    p.add_argument("--profile", type=int, default=0)  # profile slot
    p = sub.add_parser("mode", help="set lighting effect")  # mode change
    p.add_argument("mode", type=int, choices=sorted(MODES))  # effect byte
    p = sub.add_parser("brightness", help="set brightness 0..5")  # brightness change
    p.add_argument("level", type=int, choices=range(6))  # level
    p = sub.add_parser("speed", help="set effect speed 0..5")  # speed change
    p.add_argument("level", type=int, choices=range(6))  # level
    p = sub.add_parser("color", help="set effect colour RRGGBB, or 'rainbow'")  # colour change
    p.add_argument("color")  # hex colour or rainbow
    p = sub.add_parser("profile", help="switch active profile 0..2")  # profile change
    p.add_argument("profile", type=int, choices=range(PROFILES))  # slot
    p = sub.add_parser("remap", help="remap one key, e.g. remap CapsLock LCtrl")  # single remap
    p.add_argument("key", help="physical key name from ck108_layout.json")  # source key
    p.add_argument("target", help="key, modifier, media or shortcut name, or 'none'")  # new function
    p.add_argument("--profile", type=int, default=0)  # profile slot
    args = parser.parse_args(argv)  # parsed arguments

    #- Run
    try:
        with CK108() as kb:  # open the keyboard
            return _run(kb, args)  # dispatch
    except (CK108Error, ValueError, OSError) as err:  # missing keyboard, bad input, I/O failure
        print(f"error: {err}", file=sys.stderr)  # report it
        return 1  # failure


#& Private Functions


def _run(kb, args):
    """
    @brief Execute one parsed subcommand.
    @param[in] kb Open keyboard.
    @param[in] args Parsed arguments from main().
    @return 0.
    @exception ValueError Unknown key or target name.
    """
    #- Dumps
    if args.command == "info":  # info dump
        info = kb.read_info()  # info block
        print(f"device {info['vid']:04X}:{info['pid']:04X} firmware {info['firmware']:#06x} profile {info['profile']}")  # identity
        print("modes:", ", ".join(f"{m} {MODES.get(m, '?')}" for m in info["modes"]))  # supported effects
    elif args.command == "lighting":  # lighting dump
        block = kb.read_lighting()  # lighting block
        print(f"mode {block[LIGHT_MODE]} ({MODES.get(block[LIGHT_MODE], '?')}) brightness {block[LIGHT_BRIGHTNESS]} speed {block[LIGHT_SPEED]}")  # effect
        print(f"direction {block[LIGHT_DIRECTION]} colorful {block[LIGHT_COLORFUL]} color #{block[LIGHT_COLOR:LIGHT_COLOR + 3].hex()}")  # colour
        print("raw:", block.hex(" "))  # full block
    elif args.command == "keymap":  # key map dump
        keymap = kb.read_keymap(args.profile)  # profile map
        for key in load_layout():  # every physical key
            if key["slot"] is not None:  # remappable
                print(f"{key['name']:12} -> {describe_entry(keymap[key['slot'] * 3 : key['slot'] * 3 + 3])}")  # key and function

    #- Changes
    elif args.command == "mode":  # mode change
        kb.set_mode(args.mode)  # effect byte
    elif args.command == "brightness":  # brightness change
        kb.set_brightness(args.level)  # level
    elif args.command == "speed":  # speed change
        kb.set_speed(args.level)  # level
    elif args.command == "color":  # colour change
        rainbow = args.color.lower() == "rainbow"  # rainbow request
        kb.set_color((0, 0, 0) if rainbow else bytes.fromhex(args.color.lstrip("#")), colorful=rainbow)  # colour or rainbow
    elif args.command == "profile":  # profile change
        kb.set_profile(args.profile)  # slot
    elif args.command == "remap":  # single remap
        kb.remap(args.profile, _slot_of(args.key), _entry_of(args.target))  # new entry
    return 0  # done


def _slot_of(name):
    """
    @brief Key map slot of a physical key.
    @param[in] name Key name from ck108_layout.json, case-insensitive.
    @return Slot index.
    @exception ValueError Unknown key.
    """
    for key in load_layout():  # every physical key
        if key["name"].lower() == name.lower():  # name match
            return key["slot"]  # slot
    raise ValueError(f"unknown key {name!r}; names are in {LAYOUT_PATH.name}")  # no such key


def _entry_of(target):
    """
    @brief Key map entry for a target name.
    @param[in] target HID_KEYS, MODIFIERS, MEDIA or SHORTCUTS name, or 'none'.
    @return 3-byte entry.
    @exception ValueError Unknown target.
    """
    if target.lower() == "none":  # disable the key
        return ENTRY_DISABLED  # disabled entry
    shortcuts = {name: index for index, name in enumerate(SHORTCUTS)}  # name -> firmware index
    for table, make in ((HID_KEYS, entry_key), (MODIFIERS, entry_modifier), (MEDIA, entry_media), (shortcuts, entry_shortcut)):  # every target kind
        for name, value in table.items():  # every name of that kind
            if name.lower() == target.lower():  # name match
                return make(value)  # encoded entry
    raise ValueError(f"unknown target {target!r}")  # no such target


if __name__ == "__main__":
    sys.exit(main())  # run the CLI
