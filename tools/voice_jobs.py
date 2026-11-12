"""Finds dictations the app wants recorded and that have no recording yet.

The app publishes its upcoming dictations (text already split into sentences and
dictation pieces, plus the chosen voice) in a public gist file
`pokelearn-voice-jobs.json` of the repository owner. This script compares that list
with audio/v/index.json and writes the open jobs to jobs.json.
Output for GitHub Actions: todo=<number of open jobs>.
"""
import json, os, sys, urllib.request

OWNER = os.environ.get("PL_OWNER") or os.environ.get("GITHUB_REPOSITORY_OWNER", "Domala-ch")
FILE = "pokelearn-voice-jobs.json"
TOKEN = os.environ.get("GH_TOKEN", "")


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "pokelearn-voice"})
    if TOKEN and url.startswith("https://api.github.com/"):
        req.add_header("Authorization", "Bearer " + TOKEN)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def find_jobs():
    for page in range(1, 6):
        lst = json.loads(get(f"https://api.github.com/users/{OWNER}/gists?per_page=100&page={page}"))
        for g in lst:
            f = (g.get("files") or {}).get(FILE)
            if f:
                return json.loads(get(f["raw_url"]))
        if len(lst) < 100:
            break
    return None


def key(j):
    return f'{j["lang"]}-{j["v"]}-{j["id"]}-{j["h"]}'


def main():
    out = os.environ.get("GITHUB_OUTPUT")
    data = find_jobs()
    idx = {"version": 1, "texts": {}, "punct": {}}
    if os.path.exists("audio/v/index.json"):
        idx = json.load(open("audio/v/index.json"))
    todo = []
    if data:
        for j in data.get("jobs", []):
            if j.get("lang") not in ("de", "fr", "en") or j.get("v") not in ("f", "m"):
                continue
            if key(j) in idx["texts"]:
                continue
            todo.append(j)
    json.dump({"punct": (data or {}).get("punct", {}), "jobs": todo}, open("jobs.json", "w"), ensure_ascii=False)
    print(f"{len(todo)} dictation(s) to record", [key(j) for j in todo][:10])
    if out:
        with open(out, "a") as f:
            f.write(f"todo={len(todo)}\n")


if __name__ == "__main__":
    main()
