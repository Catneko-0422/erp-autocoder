import urllib.request, json

r = urllib.request.urlopen(urllib.request.Request("http://localhost:5000/api/auth/login",
    data=json.dumps({"identifier":"admin","password":"Admin_Initial_Password_9457"}).encode(),
    headers={"Content-Type":"application/json"}))
token = json.loads(r.read())["data"]["access_token"]

req = urllib.request.Request("http://localhost:5000/api/rule-tree", headers={"Authorization":"Bearer "+token})
tree = json.loads(urllib.request.urlopen(req).read())

for c in tree["data"]["categories"]:
    print(f"{c['name']} (prefix={c.get('prefix','')})")
    for n in c["nodes"]:
        print(f"  [{n['code_segment']}] {n['label']} (id={n['id'][:12]}...)")
        for ch in n.get("children", []):
            kids = ch.get("children", [])
            print(f"    - {ch['label']} [{ch['field_type']}] (id={ch['id'][:12]}...)")
            if ch["field_type"] == "fixed":
                print(f"        fixed_value={ch.get('fixed_value','')}")
            for k in kids:
                print(f"        {k['code_segment']} {k['label']} (id={k['id'][:12]}...)")
