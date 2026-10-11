"""
@file ck108.py
@brief MotoSpeed CK108 (SONiX 0C45:8502) vendor HID protocol: lighting, per-key colour, key remap, macros and profiles.
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
INFO_MACRO_SPACE = 0x0B  # info block offset of the macro space, in MACRO_SPACE_UNIT units
MACRO_SPACE_UNIT = 128  # bytes per macro space unit
LIGHTING_RECORD_SIZE = 0x2A  # lighting bytes per profile; profile n's record starts at n * LIGHTING_RECORD_SIZE
LIGHT_MODE = 0x00  # lighting offset: effect mode
LIGHT_BRIGHTNESS = 0x01  # lighting offset: brightness level
LIGHT_SPEED = 0x02  # lighting offset: effect speed
LIGHT_DIRECTION = 0x03  # lighting offset: effect direction
LIGHT_COLORFUL = 0x04  # lighting offset: rainbow flag
LIGHT_COLOR = 0x05  # lighting offset: effect colour, R G B
LIGHT_PRESET = 0x08  # lighting offset: Surmount colour, an index into PRESETS
LIGHT_BACKGROUND = 0x09  # lighting offset: custom-mode background colour, R G B

PROFILES = 3  # hardware profile slots
KEYMAP_SLOTS = 126  # 21 columns x 6 rows
KEYMAP_SIZE = KEYMAP_SLOTS * 3  # bytes per profile key map
LED_SLOTS = 144  # per-key colour buffer length in LEDs
KEY_COLORS_STRIDE = 0x200  # colour store bytes per profile, padding included; profile n's buffer starts at n * KEY_COLORS_STRIDE
LEDS_PER_CHUNK = 18  # LEDs per colour packet, 54 bytes

MODE_CUSTOM = 0x14  # per-key colour mode
MODES = {  # mode byte -> effect name, as the vendor UI names it except Static, its Normally on
    1: "Go with the stream",
    2: "Clouds fly",
    3: "Winding paths",
    4: "The trial of light",
    5: "Breathing",
    6: "Static",
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

PRESETS = ["red", "yellow", "green", "blue"]  # Surmount (mode 17) colours, by LIGHT_PRESET value
#? Names follow what the keys do: the vendor app labels these effects with left and right arrows, and swaps gather and spread on mode 18.
DIRECTIONS = {  # mode byte -> LIGHT_DIRECTION value by direction name
    1: {"left": 1, "right": 0},
    2: {"left": 1, "right": 0},
    3: {"clockwise": 1, "counterclockwise": 0},
    12: {"up": 1, "down": 0},
    18: {"inward": 1, "outward": 0},
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

SYSTEM = {"PowerOff": 0x81, "Sleep": 0x82, "Wake": 0x83}  # name -> HID generic desktop usage
MODIFIER_USAGE_BASE = 0xE0  # HID usage of LCtrl; modifier bit n is usage 0xE0 + n

ENTRY_DISABLED = bytes(3)  # key map entry: key does nothing

SHORTCUTS = ["Open", "New", "Undo", "Save", "Copy", "Cut", "Paste", "Find", "SelectAll", "ZoomOut", "ZoomIn"]  # built-in edit shortcuts, by firmware index

MACRO_MAGIC = 0x55AA  # first u16 of a stored macro blob
MACRO_HEADER_SIZE = 16  # magic, size, count, names flag, reserved
MACRO_LIMIT = 100  # most macros the vendor app stores
STEP_LIMIT = 2000  # most steps per macro the vendor app stores
CYCLES_MAX = 255  # most plays per key press, a u8
NAME_LIMIT = 255  # longest name in UTF-16 units, a u8 length
DELAY_STEP_MS = 10  # step pause resolution
DELAY_MAX_MS = 40000  # longest pause the vendor app stores; the 12-bit field holds 40950
STEP_KEYBOARD = 2  # step kind: keyboard page
STEP_CONSUMER = 3  # step kind: consumer page
STEP_DESKTOP = 4  # step kind: generic desktop page
STEP_PRESS = 0x8000  # step word: set for a press, clear for a release
STEP_KIND_SHIFT = 12  # step word: kind in bits 12..14
STEP_DELAY_MASK = 0x0FFF  # step word: pause in DELAY_STEP_MS units, bits 0..11

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
    @param[in] index 0-based macro position in the macro blob; describe_entry() and the CLI show it 1-based.
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
        return f"macro:{value + 1}"  # 1-based, as the macros command numbers them
    if kind == 0x05 and sub == 0x05 and value < len(SHORTCUTS):  # built-in shortcut
        return SHORTCUTS[value]  # shortcut name
    if kind in (0x00, 0x02) and sub == 0x00:  # empty matrix position or disabled key
        return "none"  # nothing
    return entry.hex(" ")  # unknown entry


def decode_macros(blob):
    """
    @brief Decode a macro blob read from the keyboard.
    @param[in] blob Bytes from CK108.read_macros(), starting at offset 0.
    @return List of macro dicts {name, cycles, steps}, in stored order; empty when the blob carries no magic.
            Each step is {press, target, delay}; target is {page: key|media|system, usage} or {page: raw, kind, data}, as in the configurator's backup files.
    @exception ValueError The blob is shorter than its header or a record says.
    """
    #- Header
    if len(blob) < MACRO_HEADER_SIZE or _u16(blob, 0) != MACRO_MAGIC:  # never written
        return []  # no macros
    size, count = _u16(blob, 2), _u16(blob, 4)  # declared length, macros stored
    if size > len(blob) or MACRO_HEADER_SIZE + count * 2 > size:  # truncated
        raise ValueError(f"macro blob is damaged: {size} bytes declared, {len(blob)} read")  # reject

    #- Records
    macros = []  # decoded macros
    for index in range(count):  # one record per offset
        at = _u16(blob, MACRO_HEADER_SIZE + index * 2)  # record offset from blob start
        steps, name_length = _u16(blob, at), blob[at + 3]  # step count, name length in UTF-16 units
        name_at = at + 4 + steps * 4  # first name byte
        if name_at + name_length * 2 > size:  # record runs past the end
            raise ValueError(f"macro {index + 1} runs past the blob end")  # reject
        name = blob[name_at : name_at + name_length * 2].decode("utf-16-le")  # stored name, empty without names
        macros.append({"name": name or f"Macro {index + 1}", "cycles": blob[at + 2], "steps": [_decode_step(blob, at + 4 + step * 4) for step in range(steps)]})  # macro
    return macros  # stored order


def encode_macros(macros, with_names):
    """
    @brief Encode macros as a blob, the way the vendor app lays it out.
    @param[in] macros Macro dicts, see decode_macros(), in the order key map entries refer to them.
    @param[in] with_names True to store names; False stores none, as the vendor app does when they do not fit.
    @return The blob.
    """
    #- Records, packed in order
    records = []  # encoded records
    for macro in macros:  # one record each
        name = macro["name"][:NAME_LIMIT].encode("utf-16-le") if with_names else b""  # stored name
        steps = b"".join(_encode_step(step) for step in macro["steps"])  # step bytes
        cycles = min(max(int(macro["cycles"]), 1), CYCLES_MAX)  # plays per key press
        records.append(len(macro["steps"]).to_bytes(2, "little") + bytes([cycles, len(name) // 2]) + steps + name)  # record

    #- Header and offset table
    at = MACRO_HEADER_SIZE + len(records) * 2  # first record follows the offset table
    offsets = b""  # record offsets
    for record in records:  # one offset each
        offsets += at.to_bytes(2, "little")  # record offset
        at += len(record)  # next record
    header = b"".join(value.to_bytes(2, "little") for value in (MACRO_MAGIC, at, len(records), int(with_names))) + bytes(8)  # magic, size, count, names flag, reserved
    return header + offsets + b"".join(records)  # whole blob


def pack_macros(macros, space):
    """
    @brief Build the blob to write, dropping the names when only that makes it fit, as the vendor app does.
    @param[in] macros Macro dicts, see decode_macros().
    @param[in] space Macro space of the keyboard in bytes, see CK108.read_info().
    @return (blob, has_names).
    @exception ValueError The macros do not fit even without names, or break a vendor app limit.
    """
    #- Vendor app limits
    if len(macros) > MACRO_LIMIT:  # too many macros
        raise ValueError(f"at most {MACRO_LIMIT} macros fit; there are {len(macros)}")  # reject
    for macro in macros:  # every macro
        if len(macro["steps"]) > STEP_LIMIT:  # too many steps
            raise ValueError(f"{macro['name']!r} has {len(macro['steps'])} steps; at most {STEP_LIMIT} fit")  # reject

    #- Fit, with names if possible
    for with_names in (True, False):  # names first, then without
        blob = encode_macros(macros, with_names)  # candidate blob
        if len(blob) <= space:  # fits the macro space
            return blob, with_names  # blob to write
    raise ValueError(f"the macros need {len(blob)} bytes; the keyboard holds {space}")  # too big


def describe_step(step):
    """
    @brief Name a macro step for display.
    @param[in] step Step dict, see decode_macros().
    @return E.g. "press LShift, then 20 ms".
    """
    #- What the step acts on
    target = step["target"]  # key, media, system or raw target
    names = {"key": {**{v: k for k, v in HID_KEYS.items()}, **{MODIFIER_USAGE_BASE + bit.bit_length() - 1: k for k, bit in MODIFIERS.items()}}, "media": {v: k for k, v in MEDIA.items()}, "system": {v: k for k, v in SYSTEM.items()}}  # usage -> name per page
    if target["page"] == "raw":  # undecoded step
        what = f"step kind {target['kind']} data {bytes(target['data']).hex(' ')}"  # stored bytes
    else:
        what = names[target["page"]].get(target["usage"], f"{target['page']} usage {target['usage']:#x}")  # usage name

    #- Direction and pause
    return f"{'press' if step['press'] else 'release'} {what}, then {step['delay']} ms"  # readable step


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
        @return Dict with raw block, firmware version, active profile, macro space in bytes and supported mode bytes.
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
            "macro_space": raw[INFO_MACRO_SPACE] * MACRO_SPACE_UNIT,
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

    def read_lighting(self, profile=None):
        """
        @brief Read one profile's lighting record.
        @param[in] profile 0..PROFILES-1; None reads the active profile's.
        @return LIGHTING_RECORD_SIZE bytes; LIGHT_* constants name the known offsets.
        @exception ValueError profile out of range.
        """
        base = self._profile_of(profile) * LIGHTING_RECORD_SIZE  # profile's record in the lighting store
        with self.session():  # session around the read
            return self.transfer(CMD_READ_LIGHTING, LIGHTING_RECORD_SIZE, base)[:LIGHTING_RECORD_SIZE]  # lighting record

    def write_lighting(self, *fields, profile=None):
        """
        @brief Write fields into one profile's lighting record in one session; the keyboard applies them on CMD_END.
        @param[in] fields (offset, data) pairs, offset a LIGHT_* constant within the record.
        @param[in] profile 0..PROFILES-1; None writes the active profile's.
        @exception ValueError profile out of range, or a field runs past the record.
        """
        #- Input validation
        base = self._profile_of(profile) * LIGHTING_RECORD_SIZE  # profile's record in the lighting store
        for offset, data in fields:  # every field
            #! Past the last record the same command reaches the key map store, so a field must stay inside its own record.
            if offset < 0 or offset + len(data) > LIGHTING_RECORD_SIZE:  # outside the record
                raise ValueError(f"lighting field {offset}+{len(data)} runs past the record")  # reject

        #- One packet per field, as the vendor app sends them
        with self.session():  # session around the writes
            for offset, data in fields:  # each field
                self.transfer(CMD_WRITE_LIGHTING, len(data), base + offset, data)  # field update

    def set_mode(self, mode, profile=None):
        """
        @brief Select a lighting effect.
        @param[in] mode A MODES key.
        @param[in] profile 0..PROFILES-1; None changes the active profile.
        @exception ValueError Unknown mode.
        """
        if mode not in MODES:  # known effect
            raise ValueError(f"unknown mode {mode}")  # reject
        self.write_lighting((LIGHT_MODE, bytes([mode])), profile=profile)  # effect byte

    def set_brightness(self, level, profile=None):
        """
        @brief Set backlight brightness.
        @param[in] level 0..5; the keyboard reported 5 at full brightness.
        @param[in] profile 0..PROFILES-1; None changes the active profile.
        """
        self.write_lighting((LIGHT_BRIGHTNESS, bytes([level])), profile=profile)  # brightness byte

    def set_speed(self, level, profile=None):
        """
        @brief Set effect speed.
        @param[in] level 0..5; the vendor slider writes 5 at its slow end and 0 at its fast end.
        @param[in] profile 0..PROFILES-1; None changes the active profile.
        """
        self.write_lighting((LIGHT_SPEED, bytes([level])), profile=profile)  # speed byte

    def set_direction(self, direction, profile=None):
        """
        @brief Set effect direction for the directional modes.
        @param[in] direction 0 or 1; DIRECTIONS names what each value does on each effect.
        @param[in] profile 0..PROFILES-1; None changes the active profile.
        """
        self.write_lighting((LIGHT_DIRECTION, bytes([direction])), profile=profile)  # direction byte

    def set_preset(self, index, profile=None):
        """
        @brief Choose the Surmount (mode 17) colour.
        @param[in] index Position in PRESETS.
        @param[in] profile 0..PROFILES-1; None changes the active profile.
        @exception ValueError index out of range.
        """
        if not 0 <= index < len(PRESETS):  # known colour
            raise ValueError(f"preset {index} not in 0..{len(PRESETS) - 1}")  # reject
        self.write_lighting((LIGHT_PRESET, bytes([index])), profile=profile)  # preset byte

    def set_color(self, rgb, colorful=False, profile=None):
        """
        @brief Set the effect colour, or switch the effect to rainbow.
        @param[in] rgb (r, g, b), each 0..255.
        @param[in] colorful True to use rainbow colours instead of rgb.
        @param[in] profile 0..PROFILES-1; None changes the active profile.
        """
        self.write_lighting((LIGHT_COLORFUL, bytes([int(colorful)])), (LIGHT_COLOR, bytes(rgb)), profile=profile)  # rainbow flag, then R G B, as two packets

    def read_key_colors(self, profile=None):
        """
        @brief Read one profile's per-key colour buffer, used by MODE_CUSTOM.
        @param[in] profile 0..PROFILES-1; None reads the active profile's.
        @return LED_SLOTS * 3 bytes, R G B per LED index.
        @exception ValueError profile out of range.
        """
        base = self._profile_of(profile) * KEY_COLORS_STRIDE  # profile's buffer in the colour store
        colors = bytearray()  # accumulated buffer
        with self.session():  # session around the reads
            for led in range(0, LED_SLOTS, LEDS_PER_CHUNK):  # one packet per chunk
                colors += self.transfer(CMD_READ_KEY_COLORS, LEDS_PER_CHUNK * 3, base + led * 3)[: LEDS_PER_CHUNK * 3]  # chunk colours
        return bytes(colors)  # full buffer

    def write_key_colors(self, colors, profile=None):
        """
        @brief Write one profile's per-key colour buffer; select MODE_CUSTOM in that profile to show it.
        @param[in] colors LED_SLOTS * 3 bytes, R G B per LED index.
        @param[in] profile 0..PROFILES-1; None writes the active profile's.
        @exception ValueError Wrong buffer length or profile out of range.
        """
        #- Input validation
        if len(colors) != LED_SLOTS * 3:  # full buffer only
            raise ValueError(f"need {LED_SLOTS * 3} colour bytes, got {len(colors)}")  # reject
        base = self._profile_of(profile) * KEY_COLORS_STRIDE  # profile's buffer in the colour store

        #- Chunked write
        size = LEDS_PER_CHUNK * 3  # bytes per packet
        with self.session():  # session around the writes
            for led in range(0, LED_SLOTS, LEDS_PER_CHUNK):  # one packet per chunk
                self.transfer(CMD_WRITE_KEY_COLORS, size, base + led * 3, colors[led * 3 : led * 3 + size])  # chunk colours

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
        with self.session():  # session around the writes
            self._write_chunked(CMD_WRITE_KEYMAP, profile * KEYMAP_SIZE, keymap)  # profile key map

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

    def read_macros(self):
        """
        @brief Read the macro blob: its header first, then as many bytes as the header declares, as the vendor app does.
        @return The blob; just the header when the keyboard holds no macros. See decode_macros().
        """
        #- Header, then the declared size
        space = self.read_info()["macro_space"]  # largest blob the keyboard holds
        with self.session():  # session around the header read
            header = self.transfer(CMD_READ_MACROS, MACRO_HEADER_SIZE, 0)[:MACRO_HEADER_SIZE]  # magic and declared size
        size = _u16(header, 2)  # declared blob length
        is_stored = _u16(header, 0) == MACRO_MAGIC and MACRO_HEADER_SIZE < size <= space  # a plausible blob with records
        return self._read_chunked(CMD_READ_MACROS, 0, size) if is_stored else header  # whole blob, or the header alone

    def write_macros(self, blob, keymaps=None):
        """
        @brief Write the macro blob, then key maps, in one session, as the vendor Apply does.
        @param[in] blob Blob from pack_macros().
        @param[in] keymaps {profile: KEYMAP_SIZE bytes} for the profiles whose macro references change with the blob; None for none.
        @exception ValueError A key map has the wrong length or profile.
        """
        #- Input validation
        keymaps = keymaps or {}  # no key maps to write
        for profile, keymap in keymaps.items():  # every key map to write
            if len(keymap) != KEYMAP_SIZE or not 0 <= profile < PROFILES:  # full map, valid slot
                raise ValueError(f"need {KEYMAP_SIZE} bytes for profile 0..{PROFILES - 1}")  # reject

        #- One session: blob first, then key maps
        with self.session():  # session around every write
            self._write_chunked(CMD_WRITE_MACROS, 0, blob)  # macro blob from offset 0
            for profile, keymap in keymaps.items():  # each changed profile
                self._write_chunked(CMD_WRITE_KEYMAP, profile * KEYMAP_SIZE, keymap)  # profile key map

    def _profile_of(self, profile):
        """
        @brief Resolve a profile argument.
        @param[in] profile 0..PROFILES-1, or None for the active profile.
        @return The profile index.
        @exception ValueError profile out of range.
        """
        if profile is None:  # active profile asked for
            return self.read_info()["profile"]  # keyboard's current profile
        if not 0 <= profile < PROFILES:  # valid slot
            raise ValueError(f"profile {profile} not in 0..{PROFILES - 1}")  # reject
        return profile  # as given

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

    def _write_chunked(self, cmd, base, data):
        """
        @brief Write data from base with one command per CHUNK_SIZE chunk; the caller wraps it in a session.
        @param[in] cmd Write command.
        @param[in] base Offset of the first byte.
        @param[in] data Bytes to write; the last chunk is short.
        """
        for offset in range(0, len(data), CHUNK_SIZE):  # one packet per chunk
            part = data[offset : offset + CHUNK_SIZE]  # chunk bytes
            self.transfer(cmd, len(part), base + offset, part)  # chunk write


def main(argv=None):
    """
    @brief Command-line front end: info, lighting, key map and macro dumps, lighting changes, single-key remaps, macro export and import.
    @param[in] argv Arguments; None reads sys.argv.
    @return Process exit code.
    @retval 0 Command completed.
    @retval 1 Keyboard missing or command failed.
    """
    #- Arguments
    parser = argparse.ArgumentParser(description=__doc__.split("@brief ")[1].splitlines()[0])  # brief from the file banner
    sub = parser.add_subparsers(dest="command", required=True)  # one subcommand per action
    sub.add_parser("info", help="firmware, active profile, supported modes")  # info dump
    p = sub.add_parser("lighting", help="dump a profile's lighting record")  # lighting dump
    p.add_argument("--profile", type=int, choices=range(PROFILES), help="0..2; the active profile when left out")  # lighting record to use
    p = sub.add_parser("keymap", help="dump a profile key map by key name")  # key map dump
    p.add_argument("--profile", type=int, default=0)  # profile slot
    p = sub.add_parser("mode", help="set lighting effect")  # mode change
    p.add_argument("mode", type=int, choices=sorted(MODES))  # effect byte
    p.add_argument("--profile", type=int, choices=range(PROFILES), help="0..2; the active profile when left out")  # lighting record to use
    p = sub.add_parser("brightness", help="set brightness 0..5")  # brightness change
    p.add_argument("level", type=int, choices=range(6))  # level
    p.add_argument("--profile", type=int, choices=range(PROFILES), help="0..2; the active profile when left out")  # lighting record to use
    p = sub.add_parser("speed", help="set effect speed 0..5")  # speed change
    p.add_argument("level", type=int, choices=range(6))  # level
    p.add_argument("--profile", type=int, choices=range(PROFILES), help="0..2; the active profile when left out")  # lighting record to use
    p = sub.add_parser("color", help="set effect colour RRGGBB, or 'rainbow'")  # colour change
    p.add_argument("color")  # hex colour or rainbow
    p.add_argument("--profile", type=int, choices=range(PROFILES), help="0..2; the active profile when left out")  # lighting record to use
    p = sub.add_parser("direction", help="set effect direction by name; the names depend on the effect")  # direction change
    p.add_argument("direction", choices=sorted({name for names in DIRECTIONS.values() for name in names}))  # direction name
    p.add_argument("--profile", type=int, choices=range(PROFILES), help="0..2; the active profile when left out")  # lighting record to use
    p = sub.add_parser("preset", help="set the Surmount (mode 17) colour")  # preset change
    p.add_argument("color", choices=PRESETS)  # preset colour
    p.add_argument("--profile", type=int, choices=range(PROFILES), help="0..2; the active profile when left out")  # lighting record to use
    p = sub.add_parser("profile", help="switch active profile 0..2")  # profile change
    p.add_argument("profile", type=int, choices=range(PROFILES))  # slot
    p = sub.add_parser("remap", help="remap one key, e.g. remap CapsLock LCtrl")  # single remap
    p.add_argument("key", help="physical key name from ck108_layout.json")  # source key
    p.add_argument("target", help="key, modifier, media or shortcut name, macro:N, or 'none'")  # new function
    p.add_argument("--profile", type=int, default=0)  # profile slot
    sub.add_parser("macros", help="list the stored macros and their steps")  # macro dump
    p = sub.add_parser("macros-export", help="save the stored macros to a JSON file")  # macro export
    p.add_argument("file", type=pathlib.Path)  # output file
    p = sub.add_parser("macros-import", help="replace the stored macros with a JSON file, or a configurator backup file's macros")  # macro import
    p.add_argument("file", type=pathlib.Path)  # input file
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
    @exception ValueError Unknown key or target name, or a direction the effect does not take.
    """
    #- Dumps
    if args.command == "info":  # info dump
        info = kb.read_info()  # info block
        print(f"device {info['vid']:04X}:{info['pid']:04X} firmware {info['firmware']:#06x} profile {info['profile']}")  # identity
        print("modes:", ", ".join(f"{m} {MODES.get(m, '?')}" for m in info["modes"]))  # supported effects
    elif args.command == "lighting":  # lighting dump
        block = kb.read_lighting(args.profile)  # lighting record
        print(f"mode {block[LIGHT_MODE]} ({MODES.get(block[LIGHT_MODE], '?')}) brightness {block[LIGHT_BRIGHTNESS]} speed {block[LIGHT_SPEED]}")  # effect
        names = {value: name for name, value in DIRECTIONS.get(block[LIGHT_MODE], {}).items()}  # direction names of this effect by value
        print(f"direction {block[LIGHT_DIRECTION]} ({names.get(block[LIGHT_DIRECTION], '-')}) colorful {block[LIGHT_COLORFUL]} color #{block[LIGHT_COLOR:LIGHT_COLOR + 3].hex()}")  # colour
        print(f"preset {block[LIGHT_PRESET]} ({PRESETS[block[LIGHT_PRESET]] if block[LIGHT_PRESET] < len(PRESETS) else '?'})")  # Surmount colour
        print("raw:", block.hex(" "))  # full block
    elif args.command == "keymap":  # key map dump
        keymap = kb.read_keymap(args.profile)  # profile map
        for key in load_layout():  # every physical key
            if key["slot"] is not None:  # remappable
                print(f"{key['name']:12} -> {describe_entry(keymap[key['slot'] * 3 : key['slot'] * 3 + 3])}")  # key and function
    elif args.command == "macros":  # macro dump
        _print_macros(decode_macros(kb.read_macros()))  # stored macros
    elif args.command == "macros-export":  # macro export
        macros = decode_macros(kb.read_macros())  # stored macros
        args.file.write_text(json.dumps(macros, indent=2) + chr(10), encoding="utf-8")  # same objects as a backup file's macros
        print(f"saved {len(macros)} macros to {args.file}")  # confirm

    #- Changes
    elif args.command == "mode":  # mode change
        kb.set_mode(args.mode, args.profile)  # effect byte
    elif args.command == "brightness":  # brightness change
        kb.set_brightness(args.level, args.profile)  # level
    elif args.command == "speed":  # speed change
        kb.set_speed(args.level, args.profile)  # level
    elif args.command == "color":  # colour change
        rainbow = args.color.lower() == "rainbow"  # rainbow request
        kb.set_color((0, 0, 0) if rainbow else bytes.fromhex(args.color.lstrip("#")), colorful=rainbow, profile=args.profile)  # colour or rainbow
    elif args.command == "direction":  # direction change
        mode = kb.read_lighting(args.profile)[LIGHT_MODE]  # effect the direction applies to
        names = DIRECTIONS.get(mode, {})  # direction names that effect takes
        if args.direction not in names:  # name the effect does not use
            raise ValueError(f"effect {mode} ({MODES.get(mode, '?')}) takes {', '.join(names) or 'no direction'}")  # reject
        kb.set_direction(names[args.direction], args.profile)  # direction byte
    elif args.command == "preset":  # preset change
        kb.set_preset(PRESETS.index(args.color), args.profile)  # preset byte
    elif args.command == "profile":  # profile change
        kb.set_profile(args.profile)  # slot
    elif args.command == "remap":  # single remap
        kb.remap(args.profile, _slot_of(args.key), _entry_of(args.target, len(decode_macros(kb.read_macros()))))  # new entry
    elif args.command == "macros-import":  # macro import
        _import_macros(kb, _parse_macros(json.loads(args.file.read_text(encoding="utf-8"))))  # replace the stored macros
    return 0  # done


def _print_macros(macros):
    """
    @brief Print macros, numbered as remap's macro:N targets, with their steps.
    @param[in] macros Macro dicts, see decode_macros().
    """
    if not macros:  # nothing stored
        print("no macros stored")  # say so
    for number, macro in enumerate(macros, 1):  # 1-based, as macro:N
        print(f"macro:{number} {macro['name']!r}, plays {macro['cycles']}x")  # heading
        for step in macro["steps"]:  # every step
            print(f"    {describe_step(step)}")  # readable step


def _import_macros(kb, macros):
    """
    @brief Replace the stored macros; keys that refer past the new list go back to their factory function, in the same session.
    @param[in] kb Open keyboard.
    @param[in] macros Checked macro dicts, see _parse_macros().
    @exception ValueError The macros do not fit; see pack_macros().
    """
    #- Fit the blob before touching anything
    blob, has_names = pack_macros(macros, kb.read_info()["macro_space"])  # blob, names dropped if only that fits

    #- Keys left pointing past the new list
    defaults = kb.read_default_keymap()  # factory key map
    names = {key["slot"]: key["name"] for key in load_layout() if key["slot"] is not None}  # slot -> key name
    keymaps, reset = {}, []  # changed key maps, reset key names
    for profile in range(PROFILES):  # every profile
        original = kb.read_keymap(profile)  # current map
        keymap = bytearray(original)  # edited copy
        for slot in range(KEYMAP_SLOTS):  # every entry
            entry = keymap[slot * 3 : slot * 3 + 3]  # entry bytes
            if entry[0] == 0x05 and entry[1] == 0x01 and entry[2] >= len(macros):  # macro that no longer exists
                keymap[slot * 3 : slot * 3 + 3] = defaults[slot * 3 : slot * 3 + 3]  # factory entry
                reset.append(f"{names.get(slot, f'slot {slot}')} (profile {profile})")  # report it
        if keymap != original:  # profile changed
            keymaps[profile] = bytes(keymap)  # write it with the blob

    #- Write and report
    kb.write_macros(blob, keymaps)  # blob, then changed key maps
    print(f"stored {len(macros)} macros, {len(blob)} bytes" + ("" if has_names else ", without names to fit"))  # result
    if reset:  # keys put back
        print("reset to factory:", ", ".join(reset))  # which ones


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


def _entry_of(target, macro_count):
    """
    @brief Key map entry for a target name.
    @param[in] target HID_KEYS, MODIFIERS, MEDIA or SHORTCUTS name, macro:N with N 1-based as the macros command lists them, or 'none'.
    @param[in] macro_count Macros stored on the keyboard.
    @return 3-byte entry.
    @exception ValueError Unknown target, or a macro that is not stored.
    """
    #- Nothing, or a stored macro
    if target.lower() == "none":  # disable the key
        return ENTRY_DISABLED  # disabled entry
    if target.lower().startswith("macro:"):  # macro reference
        number = target[len("macro:") :]  # 1-based macro number
        if not number.isdigit() or not 1 <= int(number) <= macro_count:  # stored macro only
            raise ValueError(f"{target!r}: the keyboard stores {macro_count} macros; see the macros command")  # reject
        return entry_macro(int(number) - 1)  # 0-based reference

    #- Key, modifier, media or shortcut name
    shortcuts = {name: index for index, name in enumerate(SHORTCUTS)}  # name -> firmware index
    for table, make in ((HID_KEYS, entry_key), (MODIFIERS, entry_modifier), (MEDIA, entry_media), (shortcuts, entry_shortcut)):  # every target kind
        for name, value in table.items():  # every name of that kind
            if name.lower() == target.lower():  # name match
                return make(value)  # encoded entry
    raise ValueError(f"unknown target {target!r}")  # no such target


def _parse_macros(value):
    """
    @brief Check macros loaded from JSON: a list saved by macros-export, or a configurator backup file holding a "macros" list.
    @param[in] value Parsed JSON.
    @return The macro list, see decode_macros().
    @exception ValueError A field is missing or out of range; the message names it.
    """
    #- Plain list or backup file
    macros = value.get("macros") if isinstance(value, dict) else value  # macro list
    if not isinstance(macros, list):  # neither shape
        raise ValueError("expected a list of macros, or a backup file with a 'macros' list")  # reject

    #- Every macro and step
    for index, macro in enumerate(macros):  # every macro
        where = f"macros[{index}]"  # field path for messages
        if not isinstance(macro, dict) or not isinstance(macro.get("name"), str) or not isinstance(macro.get("steps"), list):  # wrong shape
            raise ValueError(f"{where} needs a text name and a list of steps")  # reject
        _check_int(macro.get("cycles"), f"{where}.cycles", 1, CYCLES_MAX)  # plays per key press
        for number, step in enumerate(macro["steps"]):  # every step
            _check_step(step, f"{where}.steps[{number}]")  # step fields
    return macros  # checked list


def _check_step(step, where):
    """
    @brief Check one macro step loaded from JSON.
    @param[in] step Parsed step.
    @param[in] where Field path for messages.
    @exception ValueError A field is missing or out of range.
    """
    #- Direction and pause
    if not isinstance(step, dict) or not isinstance(step.get("press"), bool) or not isinstance(step.get("target"), dict):  # wrong shape
        raise ValueError(f"{where} needs press true/false and a target")  # reject
    _check_int(step.get("delay"), f"{where}.delay", 0, DELAY_MAX_MS)  # pause after the step

    #- Target by page
    target = step["target"]  # what the step acts on
    if target.get("page") == "key":  # keyboard usage, one data byte
        _check_int(target.get("usage"), f"{where}.target.usage", 0, 0xFF)  # key or modifier usage
    elif target.get("page") in ("media", "system"):  # u16 usage
        _check_int(target.get("usage"), f"{where}.target.usage", 0, 0xFFFF)  # consumer or generic desktop usage
    elif target.get("page") == "raw":  # undecoded step
        _check_int(target.get("kind"), f"{where}.target.kind", 0, 7)  # step kind
        data = target.get("data")  # stored data bytes
        if not isinstance(data, list) or len(data) != 2:  # wrong shape
            raise ValueError(f"{where}.target.data must hold 2 bytes")  # reject
        for byte in data:  # both bytes
            _check_int(byte, f"{where}.target.data", 0, 0xFF)  # byte range
    else:
        raise ValueError(f"{where}.target.page must be key, media, system or raw")  # unknown page


def _check_int(value, where, low, high):
    """
    @brief Require a whole number in a range.
    @param[in] value Parsed JSON value.
    @param[in] where Field path for messages.
    @param[in] low Lowest allowed value.
    @param[in] high Highest allowed value.
    @exception ValueError value is not a whole number from low to high.
    """
    if not isinstance(value, int) or isinstance(value, bool) or not low <= value <= high:  # bool is an int subclass
        raise ValueError(f"{where} must be a whole number from {low} to {high}")  # reject


def _decode_step(blob, at):
    """
    @brief Decode one 4-byte macro step.
    @param[in] blob Macro blob.
    @param[in] at Offset of the step word.
    @return Step dict, see decode_macros().
    """
    #- Word: press bit, kind, pause
    word, first, second = _u16(blob, at), blob[at + 2], blob[at + 3]  # step word, data bytes
    kind = (word >> STEP_KIND_SHIFT) & 0x7  # usage page code

    #- Data by kind
    target = {"page": "raw", "kind": kind, "data": [first, second]}  # kept as stored unless decoded below
    if kind == STEP_KEYBOARD and first == 0x01 and second and not second & (second - 1):  # exactly one modifier bit
        target = {"page": "key", "usage": MODIFIER_USAGE_BASE + second.bit_length() - 1}  # modifier as its usage
    elif kind == STEP_KEYBOARD and first == 0x02:  # plain key
        target = {"page": "key", "usage": second}  # key usage
    elif kind in (STEP_CONSUMER, STEP_DESKTOP):  # u16 LE usage
        target = {"page": "media" if kind == STEP_CONSUMER else "system", "usage": first | second << 8}  # media or power key
    return {"press": bool(word & STEP_PRESS), "target": target, "delay": (word & STEP_DELAY_MASK) * DELAY_STEP_MS}  # decoded step


def _encode_step(step):
    """
    @brief Encode one macro step.
    @param[in] step Step dict, see decode_macros().
    @return 4 bytes: step word, then data.
    """
    #- Data bytes and kind
    target = step["target"]  # what the step acts on
    if target["page"] == "key" and MODIFIER_USAGE_BASE <= target["usage"] < MODIFIER_USAGE_BASE + 8:  # modifier
        kind, data = STEP_KEYBOARD, bytes([0x01, 1 << (target["usage"] - MODIFIER_USAGE_BASE)])  # one-bit modifier mask
    elif target["page"] == "key":  # plain key
        kind, data = STEP_KEYBOARD, bytes([0x02, target["usage"]])  # key usage
    elif target["page"] in ("media", "system"):  # u16 usage
        kind, data = STEP_CONSUMER if target["page"] == "media" else STEP_DESKTOP, target["usage"].to_bytes(2, "little")  # consumer or generic desktop
    else:
        kind, data = target["kind"], bytes(target["data"])  # undecoded step, as read

    #- Word: press bit, kind, pause rounded down to the stored resolution
    units = min(max(step["delay"], 0), DELAY_MAX_MS) // DELAY_STEP_MS  # pause in 10 ms units
    return ((STEP_PRESS if step["press"] else 0) | kind << STEP_KIND_SHIFT | units).to_bytes(2, "little") + data  # step bytes


def _u16(data, at):
    """
    @brief Read a little-endian u16.
    @param[in] data Bytes.
    @param[in] at Offset of the low byte.
    @return The value.
    """
    return data[at] | data[at + 1] << 8  # u16 LE


if __name__ == "__main__":
    sys.exit(main())  # run the CLI
