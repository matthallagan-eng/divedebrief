"""FIT parser for Garmin Descent dive activities, using the official Garmin
FIT SDK. Turns a .fit file into the same normalized dives as the UDDF parser.

FIT timestamps are UTC. Like UDDF from dive computers, dives are stored by
their local wall-clock start, tagged as UTC: the activity message's
local_timestamp gives the offset. Each diving session in the file is one
dive; sample times are seconds since the session start.
"""
from datetime import datetime, timedelta, timezone

from garmin_fit_sdk import Decoder, Stream

from .model import ParsedDive, ParsedSample, ParseError, ParseResult

FIT_EPOCH = datetime(1989, 12, 31, tzinfo=timezone.utc)
SEMICIRCLE_DEG = 180 / 2**31
KELVIN = 273.15
# Above this water density (kg/m3), a custom water setting counts as salt
SALT_DENSITY = 1010


class FITParseError(ParseError):
    pass


def parse_fit(data: bytes) -> ParseResult:
    def decoder() -> Decoder:
        # Each check consumes the stream, so every step gets a fresh one
        return Decoder(Stream.from_byte_array(bytearray(data)))

    if not decoder().is_fit():
        raise FITParseError("Not a FIT file")
    if not decoder().check_integrity():
        raise FITParseError("File is damaged (checksum mismatch)")
    try:
        messages, errors = decoder().read(convert_datetimes_to_dates=False)
    except Exception as e:  # the SDK raises plain exceptions on corrupt data
        raise FITParseError(f"Could not decode: {e}") from e
    if errors:
        raise FITParseError(f"Could not decode: {errors[0]}")

    sessions = [s for s in messages.get("session_mesgs", []) if s.get("sport") == "diving"]
    if not sessions:
        raise FITParseError("Not a dive activity")

    result = ParseResult(dives=[])
    offset = _local_offset(messages)
    if offset is None:
        offset = timedelta(0)
        result.warnings.append("No local time in the file; start times are shown in UTC")

    model, serial = _computer(messages)
    water = _water_type(messages)
    records = messages.get("record_mesgs", [])
    tanks = sorted(
        (m["timestamp"], m["pressure"])
        for m in messages.get("tank_update_mesgs", [])
        if m.get("timestamp") is not None and m.get("pressure") is not None
        # Gas switches are out of scope, so only the first sensor is read
        and m.get("sensor") == messages["tank_update_mesgs"][0].get("sensor")
    )

    for index, session in enumerate(sessions, start=1):
        start = session.get("start_time")
        if start is None:
            result.warnings.append(f"Skipped dive #{index}: missing start time")
            continue
        end = start + (session.get("total_elapsed_time") or float("inf"))
        samples = _samples([r for r in records if start <= r.get("timestamp", -1) <= end], start, tanks)
        if not samples:
            result.warnings.append(f"Skipped dive #{index}: no depth samples")
            continue
        entry, exit_ = _position(session, "start"), _position(session, "end")
        lat, lon = entry or exit_ or (None, None)
        result.dives.append(
            ParsedDive(
                started_at=(FIT_EPOCH + timedelta(seconds=start) + offset),
                samples=samples,
                computer_model=model,
                computer_serial=serial,
                water_type=water,
                latitude=lat,
                longitude=lon,
                entry=entry,
                exit=exit_,
            )
        )

    if not result.dives:
        detail = "; ".join(result.warnings) or "file contains no dives"
        raise FITParseError(f"No usable dives found ({detail})")
    return result


def _samples(records: list[dict], start: int, tanks: list[tuple[int, float]]) -> list[ParsedSample]:
    out: dict[float, ParsedSample] = {}
    pending = iter(tanks)
    tank = next(pending, None)
    for r in records:
        if r.get("depth") is None:
            continue
        ts = r["timestamp"]
        pressure = None
        # A tank reading goes on the first sample at or after it
        while tank is not None and tank[0] <= ts:
            pressure = tank[1]
            tank = next(pending, None)
        temp = r.get("temperature")
        t = float(ts - start)
        out.setdefault(
            t,
            ParsedSample(
                t_s=t,
                depth_m=r["depth"],
                temp_k=None if temp is None else temp + KELVIN,
                heart_rate=r.get("heart_rate"),
                tank_pressure_bar=pressure,
                ndl_s=r.get("ndl_time"),
                ceiling_m=r.get("next_stop_depth"),
                tts_s=r.get("time_to_surface"),
                n2_load_pct=r.get("n2_load"),
                cns_pct=r.get("cns_load"),
                po2_bar=r.get("po2"),
            ),
        )
    return sorted(out.values(), key=lambda s: s.t_s)


def _local_offset(messages: dict) -> timedelta | None:
    for activity in messages.get("activity_mesgs", []):
        local, utc = activity.get("local_timestamp"), activity.get("timestamp")
        if local is not None and utc is not None:
            return timedelta(seconds=local - utc)
    return None


def _computer(messages: dict) -> tuple[str | None, str | None]:
    file_ids = messages.get("file_id_mesgs", [])
    if not file_ids:
        return None, None
    fid = file_ids[0]
    product = fid.get("garmin_product")
    model = None
    if isinstance(product, str):
        model = "Garmin " + " ".join(w[:1].upper() + w[1:] for w in product.split("_"))
    serial = fid.get("serial_number")
    return model, None if serial is None else str(serial)


def _water_type(messages: dict) -> str | None:
    for s in messages.get("dive_settings_mesgs", []):
        kind = s.get("water_type")
        if kind == "fresh":
            return "fresh"
        if kind in ("salt", "en13319"):
            return "salt"
        density = s.get("water_density")
        if density:
            return "salt" if density > SALT_DENSITY else "fresh"
    return None


def _position(session: dict, which: str) -> tuple[float, float] | None:
    # The watch often has no fix yet when the dive starts
    lat, lon = session.get(f"{which}_position_lat"), session.get(f"{which}_position_long")
    if lat is None or lon is None:
        return None
    return lat * SEMICIRCLE_DEG, lon * SEMICIRCLE_DEG
