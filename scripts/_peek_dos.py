import json
from sqlalchemy import create_engine, text

e = create_engine("sqlite:///ground_control.db")
with e.connect() as c:
    for et in ("dos_settings", "spoof_prevention"):
        r = c.execute(
            text(
                "select payload_json from firewall_config_entries "
                "where entity_type=:et limit 1"
            ),
            {"et": et},
        ).fetchone()
        print("===", et, "===")
        if r:
            print(json.dumps(json.loads(r[0]), indent=2))
        else:
            print("(no rows)")
