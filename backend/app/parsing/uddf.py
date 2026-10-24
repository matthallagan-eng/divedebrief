"""UDDF parser: turns a UDDF document into normalized dives, with no DB access.

UDDF stores everything in SI units (seconds, meters, kelvin), which is also
how we store it. The parser ignores XML namespaces so files from any UDDF 3.x
version and any exporting tool read the same way.

Dive computers record local wall-clock time without a timezone. Naive
datetimes are tagged as UTC so they round-trip unchanged; the frontend
formats them in UTC to show the original wall-clock time.
"""
from datetime import datetime, timezone

from lxml import etree

from .model import ParsedDive, ParsedSample, ParseError, ParseResult

__all__ = ["ParsedDive", "ParsedSample", "ParseResult", "UDDFParseError", "parse_uddf"]


class UDDFParseError(ParseError):
    pass


# No entity resolution or network access: uploaded XML is untrusted
_XML_PARSER = etree.XMLParser(
    resolve_entities=False, no_network=True, remove_comments=True, remove_pis=True
)


def parse_uddf(data: bytes) -> ParseResult:
    try:
        root = etree.fromstring(data, parser=_XML_PARSER)
    except etree.XMLSyntaxError as e:
        raise UDDFParseError(f"Not valid XML: {e}") from e

    _strip_namespaces(root)
    if root.tag != "uddf":
        raise UDDFParseError(f"Not a UDDF file (root element is <{root.tag}>)")

    model, serial = _single_dive_computer(root)
    sites = _site_positions(root)

    result = ParseResult(dives=[])
    dive_elements = root.findall("profiledata/repetitiongroup/dive")
    for index, dive_el in enumerate(dive_elements, start=1):
        label = dive_el.get("id") or f"#{index}"
        try:
            dive = _parse_dive(dive_el)
        except UDDFParseError as e:
            result.warnings.append(f"Skipped dive {label}: {e}")
            continue
        dive.computer_model = model
        dive.computer_serial = serial
        # The dive links to its site by id, alongside links to buddies and the like
        for link in dive_el.findall("informationbeforedive/link"):
            if link.get("ref") in sites:
                dive.latitude, dive.longitude = sites[link.get("ref")]
                break
        result.dives.append(dive)

    if not result.dives:
        detail = "; ".join(result.warnings) if result.warnings else "file contains no dives"
        raise UDDFParseError(f"No usable dives found ({detail})")
    return result


def _strip_namespaces(root: etree._Element) -> None:
    for el in root.iter():
        if isinstance(el.tag, str):
            el.tag = etree.QName(el).localname


def _single_dive_computer(root: etree._Element) -> tuple[str | None, str | None]:
    """Model and serial of the dive computer, if the file names exactly one."""
    computers = root.findall("diver/owner/equipment/divecomputer")
    if len(computers) != 1:
        return None, None
    dc = computers[0]
    model = _text(dc, "model") or _text(dc, "name")
    return model, _text(dc, "serialnumber")


def _site_positions(root: etree._Element) -> dict[str, tuple[float, float]]:
    """Site id -> (latitude, longitude), for the sites that have a position."""
    out = {}
    for site in root.findall("divesite/site"):
        try:
            lat, lon = _float(site, "geography/latitude"), _float(site, "geography/longitude")
        except UDDFParseError:
            continue  # a bad site position shouldn't lose the dive
        if site.get("id") and lat is not None and lon is not None:
            out[site.get("id")] = (lat, lon)
    return out


def _parse_dive(dive_el: etree._Element) -> ParsedDive:
    raw_dt = _text(dive_el, "informationbeforedive/datetime")
    if raw_dt is None:
        raise UDDFParseError("missing start datetime")
    try:
        started_at = datetime.fromisoformat(raw_dt)
    except ValueError as e:
        raise UDDFParseError(f"bad start datetime {raw_dt!r}") from e
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    samples: dict[float, ParsedSample] = {}
    for wp in dive_el.findall("samples/waypoint"):
        t = _float(wp, "divetime")
        depth = _float(wp, "depth")
        # Event-only waypoints (gas switches, alarms) carry no position
        if t is None or depth is None:
            continue
        # First reading wins if a tool emits two waypoints at the same time
        samples.setdefault(t, ParsedSample(t, depth, _float(wp, "temperature")))

    if not samples:
        raise UDDFParseError("no depth samples")
    return ParsedDive(
        started_at=started_at,
        samples=sorted(samples.values(), key=lambda s: s.t_s),
        uddf_id=dive_el.get("id"),
    )


def _text(el: etree._Element, path: str) -> str | None:
    found = el.find(path)
    if found is None or found.text is None:
        return None
    return found.text.strip() or None


def _float(el: etree._Element, path: str) -> float | None:
    raw = _text(el, path)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError as e:
        raise UDDFParseError(f"<{path}> is not a number: {raw!r}") from e
