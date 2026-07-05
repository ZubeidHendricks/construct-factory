#!/usr/bin/env python3
"""Port mechanic systems (event groups + their full dependency closure) from a
purchased Construct 3 RTS source into a local game project.

The port brings across: event groups (verbatim), function definitions,
object types (+ their images extracted from the source .c3p), families
(members pruned to what's ported), single-global plugin objects, referenced
voice/sound files, required layers, and hidden helper instances — then
verifies every objectClass referenced by ported events actually exists.

NOTE ON LICENSE: the source's license permits using code portions in your own
projects but forbids publishing its sources. The destination game folder must
stay gitignored. This tool itself contains no licensed content.

Usage:  python3 tools/port_rts.py
"""

import json, re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "reference/nuke-them-all"
C3P = Path("/Users/zubeidhendricks/Documents/screenshots/source/NukeGameFull077_ready.c3p")
DEST = ROOT / "games/dala"
SHEET = "District Six events"
LAYOUT = "District Six"

# ---- phase configuration ----------------------------------------------------
GROUPS = [
    # phase 1: selection & orders
    "Group Selector Mouse box",
    "TroopsFreindlySelection",
    # phase 2: production + territory
    "ROBOT FACTORIES v4 Rio",
    "RALLY Point Robot factories",
    "FLAG CAPTURING SYSTEM V3 (FIXED By RIO) REWORKED",
    # camera: edge-scroll / zoom / pan (the map is bigger than the viewport)
    "CAMERA Scroll, Zoom, Pan (FIXED)",
    # phase 3: combat feedback + a live opponent
    "HEALTHBARS",
    "TroopsEnemy AI 2.0 (Fixed, with aggression)",
    # phase 4: stakes
    "WIN Lose Conditions",
]
FUNCTIONS = [
    "createCursorTarget", "LETSGO", "READY",
    "FaceForFactories", "RobotFManufactured", "RobotFactoryCaptured",
    "createFriendlyTroopMinion", "countOurRobots", "RallyVoice",
    "FlagCapturedLady", "FlagLostLady",
]
OBJECT_TYPES = [  # subfolder-qualified paths under SRC/objectTypes
    "OurUnits/TroopsFreindly", "OurUnits/spr_hero_tank", "ZExtras/FirebotFLY",
    "OurUnits/LightTank", "OurUnits/GruntTroopsFreindly", "MapElements/Flag",
    "System/SelectionBox", "System/Cursor_All", "System/CursorTarget",
    "System/LOS_lineofsight", "ZExtras/Wayline",
    "Texts/TextTotalSelected", "Texts/ID", "Texts/MyORDERTextTank", "Texts/MyOrderRobotText",
    # phase 2
    "OurUnits/Firebot" if (SRC / "objectTypes/OurUnits/Firebot.json").exists() else "ZExtras/Firebot",
    "OurUnits/LazerBotTroopsFreindly", "OurUnits/RocketBotTroopsFreindly",
    "EnemyUnits/HeadBot", "EnemyUnits/TroopsEnemy",
    "ZExtras/MechBASE", "ZExtras/OurMech",
    "MapElements/RobotFactory", "System/ProgressBar", "System/ProgressBarBackground",
    "ZExtras/CommanderSign", "ZExtras/FactoryDotMap1", "ZExtras/FlagCapture",
    "Texts/OurFortRemainingClock", "Texts/OurTowersAmount", "OurUnits/OurFort",
    # pulled in by factory/flag group internals
    "EnemyUnits/ShieldBot", "MapElements/TankFactory", "MapElements/VehicleFactory",
    "System/TimeRemainsSec", "ZExtras/UnitFrame", "System/UnitSelectorSandbox",
]
PLUGINS = ["Keyboard", "Gamepad", "Browser", "Audio"]  # single-globals to port
FAMILIES = ["OurUnits", "OurTanksFamily", "OurRobotFamily", "Enemies", "Factories"]
UI_LAYER = "UI"
BUILTIN = {"System", "Functions"}

jload = lambda p: json.loads(Path(p).read_text())
jdump = lambda p, o: Path(p).write_text(json.dumps(o, indent="\t") + "\n")


def _object_classes(event):
    """All objectClass values used anywhere under an event node."""
    out = set()
    def walk(events):
        for e in events:
            for part in ("conditions", "actions"):
                for x in e.get(part, []):
                    if isinstance(x, dict) and x.get("objectClass"):
                        out.add(x["objectClass"])
            if e.get("children"):
                walk(e["children"])
    walk([event])
    return out


def find_ot(name):
    hits = list((SRC / "objectTypes").rglob(f"{name}.json"))
    if not hits:
        sys.exit(f"FATAL: objectType {name} not found in source")
    return jload(hits[0])


def main():
    manifest = jload(DEST / "project.c3proj")
    layout = jload(DEST / f"layouts/{LAYOUT}.json")
    sheet = jload(DEST / f"eventSheets/{SHEET}.json")
    zf = zipfile.ZipFile(C3P)
    names = zf.namelist()

    # fresh-uid allocator above anything already in the layout
    used_uids = [i.get("uid", 0) for layer in layout["layers"] for i in layer["instances"]]
    next_uid = [max(used_uids, default=0) + 100]
    def uid():
        next_uid[0] += 1
        return next_uid[0]

    def use_addon(kind, aid, aname):
        if not any(a["id"] == aid and a["type"] == kind for a in manifest["usedAddons"]):
            manifest["usedAddons"].append({"type": kind, "id": aid, "name": aname, "author": "Scirra", "bundled": False})

    # -- source manifest is ground truth for addon display names
    src_manifest = jload(SRC / "project.c3proj")
    src_addons = {(a["type"], a["id"]): a for a in src_manifest["usedAddons"]}
    def use_addon_like_src(kind, aid):
        a = src_addons.get((kind, aid))
        use_addon(kind, aid, a["name"] if a else aid)

    ported_types = set(manifest["objectTypes"]["items"])

    # ---- 1. single-global plugin objects -------------------------------------
    for p in PLUGINS:
        if p in ported_types:
            continue
        ot = find_ot(p)
        if "singleglobal-inst" in ot:
            ot["singleglobal-inst"]["uid"] = uid()
        jdump(DEST / f"objectTypes/{p}.json", ot)
        manifest["objectTypes"]["items"].append(p)
        ported_types.add(p)
        use_addon_like_src("plugin", ot["plugin-id"])
        print(f"[plugin] {p}")

    # ---- 2. object types + images --------------------------------------------
    img_entries = {n.lower(): n for n in names if n.lower().startswith("images\\")}
    def extract_images(ot_name):
        # animation frames: images\name-anim-NNN.png ; single-image plugins
        # (Particles, 9-patch, TiledBg, Tilemap): images\name.png
        prefix = f"images\\{ot_name.lower()}-"
        exact = f"images\\{ot_name.lower()}.png"
        got = 0
        for low, real in img_entries.items():
            if low.startswith(prefix) or low == exact:
                data = zf.read(real)
                fname = real.split("\\")[-1]
                (DEST / "images" / fname).write_bytes(data)
                got += 1
        return got

    for path in OBJECT_TYPES:
        name = path.split("/")[-1]
        if name in ported_types:
            continue
        ot = jload(SRC / "objectTypes" / f"{path}.json")
        jdump(DEST / f"objectTypes/{name}.json", ot)
        manifest["objectTypes"]["items"].append(name)
        ported_types.add(name)
        use_addon_like_src("plugin", ot["plugin-id"])
        for b in ot.get("behaviorTypes", []):
            use_addon_like_src("behavior", b["behaviorId"])
        for e in ot.get("effectTypes", []):
            use_addon_like_src("effect", e["effectId"])
        n_img = extract_images(name)
        n_frames = sum(len(a.get("frames", [])) for a in ot.get("animations", {}).get("items", []))
        if ot["plugin-id"] == "Sprite" and n_img < n_frames:
            print(f"  WARN {name}: {n_frames} frames but {n_img} images extracted")
        print(f"[objectType] {name} (+{n_img} images)")

    # ---- 3. families (members pruned to ported types) -------------------------
    fam_names = set(manifest.get("families", {}).get("items", []))
    for f in FAMILIES:
        if f in fam_names:
            continue
        if not (SRC / f"families/{f}.json").exists():
            print(f"  WARN family {f} not found in source; skipped")
            continue
        fam = jload(SRC / f"families/{f}.json")
        orig = fam.get("members", [])
        fam["members"] = [m for m in orig if m in ported_types]
        for b in fam.get("behaviorTypes", []):
            use_addon_like_src("behavior", b["behaviorId"])
        jdump(DEST / f"families/{f}.json", fam)
        manifest["families"]["items"].append(f)
        fam_names.add(f)
        print(f"[family] {f}: {len(orig)} -> {len(fam['members'])} members {fam['members']}")

    # ---- 4. functions + groups from the source sheets ---------------------------
    # index every function definition across ALL source sheets
    all_fn_defs, got_groups = {}, {}

    def index_defs(events):
        for e in events:
            if e.get("eventType") == "function-block":
                all_fn_defs.setdefault(e.get("functionName"), e)
            if e.get("eventType") == "group" and e.get("title") in GROUPS:
                got_groups[e["title"]] = e
            if e.get("children"):
                index_defs(e["children"])
    for sp in (SRC / "eventSheets").glob("*.json"):
        if sp.name.endswith(".uistate.json"):
            continue
        try:
            index_defs(jload(sp)["events"])
        except Exception:
            pass

    for gtitle in GROUPS:
        if gtitle not in got_groups:
            sys.exit(f"FATAL: group {gtitle} not found")

    # function closure: start from configured FUNCTIONS + everything the ported
    # groups call, then chase callFunction refs inside ported defs to fixpoint
    def calls_in(events, acc):
        for e in events:
            for part in ("conditions", "actions"):
                for x in e.get(part, []):
                    if x.get("callFunction"):
                        acc.add(x["callFunction"])
            if e.get("children"):
                calls_in(e["children"], acc)
        return acc

    needed = set(FUNCTIONS)
    for grp in got_groups.values():
        calls_in([grp], needed)
    ported_fns, queue = {}, sorted(needed)
    while queue:
        fn = queue.pop()
        if fn in ported_fns:
            continue
        if fn not in all_fn_defs:
            sys.exit(f"FATAL: function {fn} called by ported code but no definition found")
        ported_fns[fn] = all_fn_defs[fn]
        for extra in sorted(calls_in([all_fn_defs[fn]], set())):
            if extra not in ported_fns:
                queue.append(extra)

    # ---- 4.5 event-variable auto-closure ----------------------------------------
    # Sheet-level variables (source has 264) referenced by ported code — via
    # {"variable": name} params or expression tokens — must be defined too.
    var_catalog = {}
    def index_vars(events):
        for e in events:
            if e.get("eventType") == "variable":
                var_catalog.setdefault(e["name"], e)
            if e.get("children"):
                index_vars(e["children"])
    for sp in (SRC / "eventSheets").glob("*.json"):
        if not sp.name.endswith(".uistate.json"):
            try:
                index_vars(jload(sp)["events"])
            except Exception:
                pass

    var_token = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
    var_refs = set()
    def scan_vars(events):
        for e in events:
            for part in ("conditions", "actions"):
                for x in e.get(part, []):
                    if not isinstance(x, dict):
                        continue
                    params = x.get("parameters")
                    if isinstance(params, dict):
                        v = params.get("variable")
                        if isinstance(v, str):
                            var_refs.add(v)
                        for val in params.values():
                            if isinstance(val, str):
                                var_refs.update(var_token.findall(val))
            if e.get("children"):
                scan_vars(e["children"])
    for e in list(ported_fns.values()) + list(got_groups.values()):
        scan_vars([e])

    # variables already defined inside the ported groups themselves don't need copying
    have_vars = set()
    def index_have(events):
        for e in events:
            if e.get("eventType") == "variable":
                have_vars.add(e["name"])
            if e.get("children"):
                index_have(e["children"])
    index_have(sheet["events"])
    for e in list(ported_fns.values()) + list(got_groups.values()):
        index_have([e])

    new_vars = [var_catalog[v] for v in sorted(var_refs) if v in var_catalog and v not in have_vars]
    for v in new_vars:
        print(f"[variable] {v['name']} ({v.get('type')}, init={v.get('initialValue')!r})")
    # definitions go first so everything after can reference them
    sheet["events"] = new_vars + sheet["events"]

    for fn in sorted(ported_fns):
        sheet["events"].append(ported_fns[fn])
        print(f"[function] {fn}")
    for gtitle in GROUPS:
        sheet["events"].append(got_groups[gtitle])
        print(f"[group] {gtitle} ({len(got_groups[gtitle].get('children', []))} events)")

    # ---- 5. object auto-closure: port everything the events actually touch ------
    # References hide in three places: objectClass, "object"-style parameters,
    # and expressions ("Spr_LightCone.X"). Match tokens against the full source
    # catalog and auto-port whatever is missing (objects don't chain further:
    # we don't port their event sheets).
    src_ot_catalog = {}
    for p in (SRC / "objectTypes").rglob("*.json"):
        if not p.name.endswith(".uistate.json"):
            src_ot_catalog[p.stem] = p
    src_fam_catalog = {p.stem for p in (SRC / "families").glob("*.json")}

    TOKEN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
    refs = set()
    def scan(events):
        for e in events:
            for part in ("conditions", "actions"):
                for x in e.get(part, []):
                    if not isinstance(x, dict):
                        continue
                    if x.get("objectClass"):
                        refs.add(x["objectClass"])
                    params = x.get("parameters")
                    if isinstance(params, dict):
                        for v in params.values():
                            if isinstance(v, str):
                                refs.update(TOKEN.findall(v))
            if e.get("children"):
                scan(e["children"])
    for e in list(ported_fns.values()) + list(got_groups.values()):
        scan([e])

    def port_object(name):
        ot = jload(src_ot_catalog[name])
        if "singleglobal-inst" in ot:
            ot["singleglobal-inst"]["uid"] = uid()
        jdump(DEST / f"objectTypes/{name}.json", ot)
        manifest["objectTypes"]["items"].append(name)
        ported_types.add(name)
        use_addon_like_src("plugin", ot["plugin-id"])
        for b in ot.get("behaviorTypes", []):
            use_addon_like_src("behavior", b["behaviorId"])
        for ef in ot.get("effectTypes", []):
            use_addon_like_src("effect", ef["effectId"])
        n_img = extract_images(name)
        print(f"[auto-closure] objectType {name} (+{n_img} images)")

    for r in sorted(refs):
        if r in ported_types or r in fam_names or r in BUILTIN:
            continue
        if r in src_ot_catalog:
            port_object(r)
        elif r in src_fam_catalog:
            fam = jload(SRC / f"families/{r}.json")
            fam["members"] = [m for m in fam.get("members", []) if m in ported_types]
            for b in fam.get("behaviorTypes", []):
                use_addon_like_src("behavior", b["behaviorId"])
            for ef in fam.get("effectTypes", []):
                use_addon_like_src("effect", ef["effectId"])
            jdump(DEST / f"families/{r}.json", fam)
            manifest["families"]["items"].append(r)
            fam_names.add(r)
            print(f"[auto-closure] family {r} ({len(fam['members'])} members)")
        # tokens that match nothing are ordinary expression words — ignore

    # hard check: every objectClass must now resolve
    missing = {r for e in list(ported_fns.values()) + list(got_groups.values())
               for r in _object_classes(e)
               if r not in ported_types and r not in fam_names and r not in BUILTIN}
    if missing:
        sys.exit(f"FATAL: ported events reference missing objects: {sorted(missing)}")
    print(f"[check] all objectClass refs resolve ({len(ported_types)} object types total)")

    # family membership recompute: objects auto-ported AFTER a family was
    # written never made it into that family's member list, so they lose the
    # family's instance variables (e.g. TankGritty.MaxHealth via Enemies).
    # Re-prune every ported family's SOURCE member list against the final set.
    for f in sorted(fam_names):
        fp = DEST / f"families/{f}.json"
        sp_ = SRC / f"families/{f}.json"
        if not fp.exists() or not sp_.exists():
            continue
        fam = jload(fp)
        src_members = jload(sp_).get("members", [])
        fresh = [m for m in src_members if m in ported_types]
        if fresh != fam.get("members", []):
            print(f"[family] {f}: members {len(fam.get('members', []))} -> {len(fresh)} after closure")
            fam["members"] = fresh
            jdump(fp, fam)

    # layer closure: any layer name quoted in ported events must exist
    layer_refs = set()
    def scan_layers(events):
        for e in events:
            for part in ("conditions", "actions"):
                for x in e.get(part, []):
                    if not isinstance(x, dict):
                        continue
                    params = x.get("parameters")
                    lv = params.get("layer") if isinstance(params, dict) else None
                    if isinstance(lv, str) and lv.startswith('"') and lv.endswith('"'):
                        layer_refs.add(lv.strip('"'))
            if e.get("children"):
                scan_layers(e["children"])
    for e in list(ported_fns.values()) + list(got_groups.values()):
        scan_layers([e])
    for lname in sorted(layer_refs):
        if not any(l["name"] == lname for l in layout["layers"]):
            base = json.loads(json.dumps(layout["layers"][0]))
            base.update({"name": lname, "instances": [], "sid": 900000000010000 + len(layout["layers"]),
                         "parallaxX": 0, "parallaxY": 0})
            layout["layers"].append(base)
            print(f"[layer] {lname} added (referenced by ported events)")

    # ---- 6. sounds referenced by ported events ----------------------------------
    wanted = set()
    def scan_sounds(events):
        for e in events:
            for x in e.get("actions", []):
                if not isinstance(x, dict):
                    continue
                # any Audio action can name project sound files
                if x.get("objectClass") == "Audio" or "play" in (x.get("id") or ""):
                    params = x.get("parameters")
                    if isinstance(params, dict):
                        for v in params.values():
                            if not isinstance(v, str):
                                continue
                            # names appear either quoted inside expressions
                            # ("Win Fanfare", choose("a","b")) or as the raw value
                            wanted.update(q.lower() for q in re.findall(r'"([^"]+)"', v))
                            wanted.add(v.lower())
            if e.get("children"):
                scan_sounds(e["children"])
    for e in list(ported_fns.values()) + list(got_groups.values()):
        scan_sounds([e])
    snd_entries = {n.split("\\")[-1].rsplit(".", 1)[0].lower(): n for n in names if n.lower().startswith("sounds\\")}
    (DEST / "sounds").mkdir(exist_ok=True)
    n_snd = 0
    for w in sorted(wanted):
        real = snd_entries.get(w)
        if not real:
            continue
        fname = real.split("\\")[-1]
        (DEST / "sounds" / fname).write_bytes(zf.read(real))
        if not any(i["name"] == fname for i in manifest["rootFileFolders"]["sound"]["items"]):
            manifest["rootFileFolders"]["sound"]["items"].append(
                {"name": fname, "type": "audio/webm; codecs=opus", "sid": 900000000000000 + n_snd, "file-info": {"purpose": "none"}})
        n_snd += 1
    print(f"[sounds] {n_snd} voice files extracted")

    # ---- 7. UI layer + hidden helper instances ---------------------------------
    if not any(l["name"] == UI_LAYER for l in layout["layers"]):
        base = json.loads(json.dumps(layout["layers"][0]))
        base.update({"name": UI_LAYER, "instances": [], "sid": 900000000000999, "parallaxX": 0, "parallaxY": 0})
        layout["layers"].append(base)
        print(f"[layer] {UI_LAYER} added")

    # mirror one source instance per helper type (their code repositions them)
    HELPERS = ["SelectionBox", "Cursor_All", "CursorTarget", "LOS_lineofsight", "Wayline",
               "TextTotalSelected", "ID", "MyORDERTextTank", "MyOrderRobotText"]
    src_inst = {}
    for lp in sorted((SRC / "layouts").glob("*.json")):
        if lp.name.endswith(".uistate.json"):
            continue
        try:
            L = jload(lp)
        except Exception:
            continue
        for layer in L.get("layers", []):
            for inst in layer.get("instances", []):
                if inst["type"] in HELPERS and inst["type"] not in src_inst:
                    src_inst[inst["type"]] = inst
    ui = next(l for l in layout["layers"] if l["name"] == UI_LAYER)
    have = {i["type"] for layer in layout["layers"] for i in layer["instances"]}
    for h in HELPERS:
        if h in have:
            continue
        if h in src_inst:
            inst = json.loads(json.dumps(src_inst[h]))
            inst["uid"] = uid()
            # park offscreen: their code repositions these at runtime, and
            # onscreen they stack into a visible mess at layout start
            inst["world"]["x"], inst["world"]["y"] = -2000, -2000
        else:  # no placed instance anywhere in source; minimal default
            ot = jload(DEST / f"objectTypes/{h}.json")
            is_text = ot["plugin-id"] == "Text"
            inst = {"type": h, "properties": {}, "uid": uid(), "sid": 910000000000000 + next_uid[0],
                    "tags": "", "instanceVariables": {}, "behaviors": {}, "showing": True, "locked": False,
                    "world": {"x": -2000, "y": -2000, "width": 100, "height": 24, "originX": 0, "originY": 0,
                              "color": [1, 1, 1, 1], "z": 0, "angle": 0}}
            if is_text:
                inst["properties"] = {"text": "", "enable-bbcode": True, "font": "Arial", "size": 14,
                    "line-height": 0, "bold": False, "italic": False, "color": [1, 1, 1, 1],
                    "horizontal-alignment": "left", "vertical-alignment": "top", "wrapping": "word",
                    "text-direction": "ltr", "icon-set": -1, "initially-visible": True,
                    "origin": "top-left", "read-aloud": False}
        ui["instances"].append(inst)
        print(f"[instance] {h} on {UI_LAYER}")

    # HUD belongs on the screen-fixed UI layer, not the scrolling world layer
    for layer in layout["layers"]:
        kept = []
        for inst in layer["instances"]:
            if inst["type"] == "HUD" and layer["name"] != UI_LAYER:
                ui["instances"].append(inst)
                print("[instance] HUD moved to UI layer")
            else:
                kept.append(inst)
        layer["instances"] = kept

    # ---- 8. deploy ported units on the battlefield ------------------------------
    UNITS = [("TroopsFreindly", 700, 1050), ("TroopsFreindly", 800, 1130), ("TroopsFreindly", 700, 1210),
             ("GruntTroopsFreindly", 900, 1040), ("GruntTroopsFreindly", 1000, 1140),
             ("LightTank", 880, 1280), ("spr_hero_tank", 1080, 1250),
             # phase 2: your base, production, and territory
             ("OurFort", 300, 1150),
             ("RobotFactory", 520, 820),
             ("Flag", 1280, 400), ("Flag", 1280, 1100),
             # enemy presence for capture/AI systems
             ("TroopsEnemy", 1950, 620), ("TroopsEnemy", 2080, 700), ("HeadBot", 2170, 580),
             # camera rig: their scroll/zoom/pan code drives this instance
             ("Camera", 800, 1100)]
    src_unit_inst = {}
    for lp in sorted((SRC / "layouts").glob("*.json")):
        if lp.name.endswith(".uistate.json"):
            continue
        try:
            L = jload(lp)
        except Exception:
            continue
        for layer in L.get("layers", []):
            for inst in layer.get("instances", []):
                if inst["type"] in {u[0] for u in UNITS} and inst["type"] not in src_unit_inst:
                    src_unit_inst[inst["type"]] = inst
    main_layer = layout["layers"][0]
    for t, x, y in UNITS:
        if t not in src_unit_inst:
            print(f"  WARN no source instance found for {t}; skipping placement")
            continue
        inst = json.loads(json.dumps(src_unit_inst[t]))
        inst["uid"] = uid()
        inst["world"]["x"], inst["world"]["y"] = x, y
        main_layer["instances"].append(inst)
        print(f"[unit] {t} at ({x},{y})")

    # ---- 9. prune orphan instance data ------------------------------------------
    # Source instances carry variable values / behavior blocks from families we
    # didn't port (e.g. EasyIsometricFamily's y_). The editor refuses to open a
    # project whose instances reference undefined variables/behaviors, so trim
    # every instance to what its type (+ ported families) actually defines.
    fam_objs = []
    for f in fam_names:
        fp = DEST / f"families/{f}.json"
        if fp.exists():
            fam_objs.append(jload(fp))
    def valid_sets(tname):
        otp = DEST / f"objectTypes/{tname}.json"
        if not otp.exists():
            return set(), set(), set()
        ot = jload(otp)
        iv = {v["name"] for v in ot.get("instanceVariables", [])}
        bh = {b["name"] for b in ot.get("behaviorTypes", [])}
        fx = {e["name"] for e in ot.get("effectTypes", [])}
        for f in fam_objs:
            if tname in f.get("members", []):
                iv |= {v["name"] for v in f.get("instanceVariables", [])}
                bh |= {b["name"] for b in f.get("behaviorTypes", [])}
                fx |= {e["name"] for e in f.get("effectTypes", [])}
        return iv, bh, fx
    pruned_iv = pruned_bh = pruned_fx = pruned_tpl = 0
    for layer in layout["layers"]:
        for inst in layer["instances"]:
            iv_ok, bh_ok, fx_ok = valid_sets(inst["type"])
            for k in [k for k in (inst.get("instanceVariables") or {}) if k not in iv_ok]:
                del inst["instanceVariables"][k]
                pruned_iv += 1
            for k in [k for k in (inst.get("behaviors") or {}) if k not in bh_ok]:
                del inst["behaviors"][k]
                pruned_bh += 1
            for k in [k for k in (inst.get("effects") or {}) if k not in fx_ok]:
                del inst["effects"][k]
                pruned_fx += 1
            # saved effect states (red tint, warp ripple, ...) are driven by
            # source groups we haven't ported — start them all disabled
            for fx in (inst.get("effects") or {}).values():
                if isinstance(fx, dict):
                    fx["isEnabled"] = False
            # replica links point at template instances that live in source
            # layouts we didn't port — sever them
            if "template" in inst:
                del inst["template"]
                pruned_tpl += 1
    print(f"[prune] {pruned_iv} orphan instance vars, {pruned_bh} behaviors, {pruned_fx} effects, {pruned_tpl} template links removed")

    # ---- write everything -------------------------------------------------------
    (DEST / "families").mkdir(exist_ok=True)
    jdump(DEST / "project.c3proj", manifest)
    jdump(DEST / f"layouts/{LAYOUT}.json", layout)
    jdump(DEST / f"eventSheets/{SHEET}.json", sheet)
    print("\nPORT COMPLETE")


if __name__ == "__main__":
    main()
