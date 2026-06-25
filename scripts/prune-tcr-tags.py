#!/usr/bin/env python3
"""Clean TCR tags for aimarket-api, keep newest 10 SHA tags + latest."""
import json, subprocess, sys

AUTH = subprocess.check_output([
    "python3", "-c",
    'import json; d=json.load(open("/root/.docker/config.json")); print(d["auths"]["ccr.ccs.tencentyun.com"]["auth"])'
]).decode().strip()

REG = "ccr.ccs.tencentyun.com"
NS = "aimarket"
REPO = sys.argv[1] if len(sys.argv) > 1 else "aimarket-api"
KEEP = int(sys.argv[2]) if len(sys.argv) > 2 else 10

def get_token():
    scope = f"repository:{NS}/{REPO}:pull,repository:{NS}/{REPO}:delete"
    r = subprocess.run(["curl", "-fsS", f"https://{REG}/service/token?service=token-service&scope={scope}", "-H", f"Authorization: Basic {AUTH}"], capture_output=True, text=True)
    return json.loads(r.stdout).get("token", "")

def list_tags(tok):
    r = subprocess.run(["curl", "-fsS", f"https://{REG}/v2/{NS}/{REPO}/tags/list", "-H", f"Authorization: Bearer {tok}"], capture_output=True, text=True)
    return sorted(json.loads(r.stdout).get("tags") or [])

def get_digest(tok, tag):
    r = subprocess.run(["curl", "-sS", "-D", "-", "-o", "/dev/null", f"https://{REG}/v2/{NS}/{REPO}/manifests/{tag}", "-H", f"Authorization: Bearer {tok}", "-H", "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json"], capture_output=True, text=True)
    for line in r.stdout.split("\n"):
        if line.lower().startswith("docker-content-digest:"):
            return line.split(":", 1)[1].strip()
    return None

def del_tag(tok, digest):
    r = subprocess.run(["curl", "-fsS", "-X", "DELETE", f"https://{REG}/v2/{NS}/{REPO}/manifests/{digest}", "-H", f"Authorization: Bearer {tok}"], capture_output=True, text=True)
    return r.returncode == 0

tok = get_token()
tags = list_tags(tok)
print(f"[{REPO}] Total: {len(tags)}")
sha = [t for t in tags if len(t) == 40 and all(c in "0123456789abcdef" for c in t)]
keep = set(sha[-KEEP:] + ["latest", "buildcache"])
todel = [t for t in tags if t not in keep]
print(f"Keep: {len(keep)}, Delete: {len(todel)}")
d = 0
for i, t in enumerate(todel):
    dig = get_digest(tok, t)
    if dig and del_tag(tok, dig):
        d += 1
        if d % 10 == 0:
            print(f"  deleted {d}/{len(todel)}")
    else:
        print(f"  FAIL {t[:12]}")
print(f"Done! Deleted {d}/{len(todel)}")
