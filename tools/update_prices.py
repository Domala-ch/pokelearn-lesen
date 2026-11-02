"""Weekly price refresh for PokeLearn (runs in GitHub Actions).

Rebuilds cards/prices.json from the public TCGplayer price lists on tcgcsv.com:
lowest listing + market price (USD) for every card in tools/cardmap.json and every sealed product in
cards/sealed/sealed.json, plus the current USD→CHF rate (frankfurter.app, ECB data).
"""
import json, sys, datetime, urllib.request, concurrent.futures, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "cards", "prices.json")
PREF = ["Normal", "Holofoil", "Unlimited", "Unlimited Holofoil", "1st Edition", "1st Edition Holofoil", "1st Edition Normal", "Reverse Holofoil"]


def get(url, tries=3):
    last = None
    for _ in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "PokeLearn price refresh"}), timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def main():
    old = {}
    try:
        old = json.load(open(OUT))
    except Exception:  # noqa: BLE001
        pass
    wanted = set(str(v) for v in json.load(open(os.path.join(ROOT, "tools", "cardmap.json"))).values())
    try:
        sealed = json.load(open(os.path.join(ROOT, "cards", "sealed", "sealed.json")))
        wanted |= set(str(pr["i"]) for st in sealed["sets"] for pr in st["p"])
    except Exception:  # noqa: BLE001
        pass
    wanted |= set(old.get("p", {}).keys())

    rate = float(old.get("usdchf") or 0.82)
    try:
        fx = get("https://api.frankfurter.app/latest?from=USD&to=CHF")
        r = float(fx["rates"]["CHF"])
        if 0.5 < r < 1.5:
            rate = round(r, 4)
    except Exception as e:  # noqa: BLE001
        print("exchange rate not updated:", e)

    groups = get("https://tcgcsv.com/tcgplayer/3/groups")["results"]
    gids = [g["groupId"] for g in groups]
    print("groups", len(gids))
    prices = {}

    def one(gid):
        try:
            return get(f"https://tcgcsv.com/tcgplayer/3/{gid}/prices").get("results", [])
        except Exception as e:  # noqa: BLE001
            print("group failed", gid, e)
            return []

    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for res in ex.map(one, gids):
            for r in res:
                prices.setdefault(str(r["productId"]), []).append(r)

    def best(pid):
        L = prices.get(pid)
        if not L:
            return None
        L = sorted(L, key=lambda r: PREF.index(r["subTypeName"]) if r.get("subTypeName") in PREF else 99)
        for r in L:
            lo, mk = r.get("lowPrice"), r.get("marketPrice")
            if lo or mk:
                return [round(lo or mk, 2), round(mk or lo, 2)]
        return None

    p = {}
    for pid in wanted:
        b = best(pid)
        if b:
            p[pid] = b
    if len(p) < 0.8 * len(old.get("p", {})):
        print("too few prices, keeping old file", len(p), len(old.get("p", {})))
        sys.exit(1)
    out = {"usdchf": rate, "at": datetime.date.today().isoformat(), "src": "TCGplayer (tiefstes Angebot, Marktpreis), USD – via tcgcsv.com", "p": dict(sorted(p.items(), key=lambda kv: int(kv[0])))}
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print("prices", len(p), "rate", rate)


if __name__ == "__main__":
    main()
