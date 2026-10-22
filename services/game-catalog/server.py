# -*- coding: utf-8 -*-
"""کاتالوگ بازی‌ها با عکس - بدون نیاز به اینترنت (فقط Python 3، بدون نصب چیز اضافه)
اجرا:  python server.py
"""
import base64, io, json, os, re, shutil, socket, sqlite3, tempfile, threading, time, uuid, webbrowser, zipfile
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PORT = 8080
BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
IMG = os.path.join(DATA, 'img')          # فقط برای انتقال از نسخهٔ قدیمی (JSON)
DBF = os.path.join(DATA, 'catalog.db')   # دیتابیس اصلی (SQLite) - عکس‌ها هم داخلش هستند
DEF = 'بدون دسته'
PLATS = ('ps4', 'ps5')
os.makedirs(DATA, exist_ok=True)
lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL DEFAULT 'ps4',
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(platform, name)
);
CREATE TABLE IF NOT EXISTS games(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  image BLOB NOT NULL,
  image_type TEXT NOT NULL DEFAULT 'image/jpeg',
  created_at INTEGER,
  updated_at INTEGER,
  platform TEXT NOT NULL DEFAULT 'ps4'
);
"""

# ارتقا از نسخهٔ ۱ (بدون پلتفرم): همهٔ بازی‌ها و دسته‌های قبلی به PS4 می‌روند
MIGRATE2 = """
BEGIN;
CREATE TABLE categories_new(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL DEFAULT 'ps4',
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(platform, name)
);
INSERT INTO categories_new(id, platform, name, position) SELECT id, 'ps4', name, position FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE games ADD COLUMN platform TEXT NOT NULL DEFAULT 'ps4';
COMMIT;
"""


def plat_of(v):
    return v if v in PLATS else 'ps4'


def db():
    c = sqlite3.connect(DBF, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c


def cat_id(c, plat, name):
    name = (name or '').strip()[:40] or DEF
    r = c.execute('SELECT id FROM categories WHERE platform=? AND name=?', (plat, name)).fetchone()
    if r:
        return r['id']
    return c.execute('INSERT INTO categories(platform,name,position) VALUES(?,?,(SELECT COALESCE(MAX(position),0)+1 FROM categories WHERE platform=?))',
                     (plat, name, plat)).lastrowid


def init():
    c = db()
    c.execute('PRAGMA foreign_keys=OFF')
    has = c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='categories'").fetchone()
    ver = c.execute('PRAGMA user_version').fetchone()[0]
    if has and ver < 2:
        c.executescript(MIGRATE2)
    c.executescript(SCHEMA)
    c.execute('PRAGMA user_version=2')
    c.execute('PRAGMA foreign_keys=ON')
    for p in PLATS:
        cat_id(c, p, DEF)
    c.commit()
    old = os.path.join(DATA, 'games.json')
    if os.path.exists(old) and c.execute('SELECT COUNT(*) FROM games').fetchone()[0] == 0:
        try:
            with open(old, encoding='utf-8') as f:
                games = json.load(f)
            try:
                with open(os.path.join(DATA, 'categories.json'), encoding='utf-8') as f:
                    oldc = json.load(f)
            except Exception:
                oldc = []
            for n in oldc:
                cat_id(c, 'ps4', n)
            for g in games:
                fp = os.path.join(IMG, g['id'] + '.jpg')
                if not os.path.exists(fp):
                    continue
                with open(fp, 'rb') as f:
                    blob = f.read()
                t = int(g.get('v') or time.time())
                c.execute('INSERT INTO games(id,name,category_id,image,image_type,created_at,updated_at,platform) VALUES(?,?,?,?,?,?,?,?)',
                          (g['id'], g.get('name', ''), cat_id(c, 'ps4', g.get('category')), blob, 'image/jpeg', t, t, 'ps4'))
            c.commit()
            for fn in ('games.json', 'categories.json'):
                p = os.path.join(DATA, fn)
                if os.path.exists(p):
                    os.replace(p, p + '.bak')
            print('اطلاعات نسخهٔ قبلی به دیتابیس منتقل شد.')
        except Exception as e:
            print('انتقال اطلاعات قبلی ناموفق بود:', e)
    c.close()


def img_bytes(data_url):
    m = re.match(r'data:image/jpeg;base64,(.+)$', data_url or '', re.S)
    return base64.b64decode(m.group(1)) if m else None


def games_list(plat):
    c = db()
    try:
        return [{'id': r['id'], 'name': r['name'], 'category': r['category'], 'v': r['v']} for r in c.execute(
            'SELECT g.id, g.name, k.name AS category, COALESCE(g.updated_at,0) AS v FROM games g '
            'JOIN categories k ON k.id=g.category_id WHERE g.platform=? ORDER BY g.rowid', (plat,))]
    finally:
        c.close()


def cats_list(plat):
    c = db()
    try:
        res = []
        for r in c.execute('SELECT k.name, (SELECT COUNT(*) FROM games WHERE category_id=k.id) AS n FROM categories k '
                           'WHERE k.platform=? ORDER BY (k.name=?), k.position, k.id', (plat, DEF)):
            if r['name'] == DEF and r['n'] == 0:
                continue
            res.append({'name': r['name'], 'locked': r['name'] == DEF, 'count': r['n']})
        return res
    finally:
        c.close()


def export_db():
    fd, tmp = tempfile.mkstemp(suffix='.db', dir=DATA)
    os.close(fd)
    src = db()
    dst = sqlite3.connect(tmp)
    src.backup(dst)
    dst.close()
    src.close()
    with open(tmp, 'rb') as f:
        b = f.read()
    os.remove(tmp)
    return b


def export_zip():
    c = db()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        out = []
        for r in c.execute('SELECT g.id, g.name, g.platform, k.name AS category, g.image FROM games g '
                           'JOIN categories k ON k.id=g.category_id ORDER BY g.rowid'):
            fn = 'images/%s.jpg' % r['id']
            z.writestr(fn, r['image'])
            out.append({'id': r['id'], 'name': r['name'], 'platform': r['platform'], 'category': r['category'], 'image': fn})
        cats = [{'platform': x['platform'], 'name': x['name']} for x in c.execute('SELECT platform, name FROM categories ORDER BY platform, position, id')]
        z.writestr('catalog.json', json.dumps({'categories': cats, 'games': out}, ensure_ascii=False, indent=1))
    c.close()
    return buf.getvalue()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))  # بسته‌ای ارسال نمی‌شود
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def local(self):
        return self.client_address[0] in ('127.0.0.1', '::1', '::ffff:127.0.0.1')

    def out(self, code, body, ctype='application/json; charset=utf-8', cache='no-store', extra=None):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', cache)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        p = u.path
        q = parse_qs(u.query)
        plat = plat_of((q.get('p') or ['ps4'])[0])
        html = 'text/html; charset=utf-8'
        if p == '/':
            return self.out(200, HOME, html)
        if p in ('/ps4', '/ps5'):
            return self.out(200, VIEW.replace('__PLATNAME__', p[1:].upper()).replace('__PLAT__', p[1:]), html)
        if p == '/admin':
            return self.out(200, ADMIN, html) if self.local() else self.out(403, 'فقط روی همان کامپیوتر', html)
        if p == '/api/games':
            return self.out(200, json.dumps(games_list(plat), ensure_ascii=False))
        if p == '/api/categories' and self.local():
            return self.out(200, json.dumps(cats_list(plat), ensure_ascii=False))
        if p == '/api/info' and self.local():
            return self.out(200, json.dumps({'url': 'http://%s:%d' % (lan_ip(), PORT)}))
        if p == '/api/export/db' and self.local():
            return self.out(200, export_db(), 'application/octet-stream', extra={
                'Content-Disposition': 'attachment; filename="atom-catalog-%s.db"' % time.strftime('%Y%m%d')})
        if p == '/api/export/zip' and self.local():
            return self.out(200, export_zip(), 'application/zip', extra={
                'Content-Disposition': 'attachment; filename="atom-catalog-%s.zip"' % time.strftime('%Y%m%d')})
        if p == '/logo.png':
            try:
                with open(os.path.join(BASE, 'logo.png'), 'rb') as f:
                    return self.out(200, f.read(), 'image/png', 'max-age=86400')
            except OSError:
                pass
        m = re.match(r'^/img/([0-9a-f]{12})\.jpg$', p)
        if m:
            c = db()
            try:
                r = c.execute('SELECT image, image_type FROM games WHERE id=?', (m.group(1),)).fetchone()
            finally:
                c.close()
            if r:
                return self.out(200, bytes(r['image']), r['image_type'] or 'image/jpeg', 'max-age=86400')
        self.out(404, 'not found', 'text/plain')

    def do_import(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > 1_000_000_000:
            return self.out(413, '{"ok":false}')
        fd, tmp = tempfile.mkstemp(suffix='.db', dir=DATA)
        with os.fdopen(fd, 'wb') as f:
            left = n
            while left > 0:
                b = self.rfile.read(min(1 << 20, left))
                if not b:
                    break
                f.write(b)
                left -= len(b)
        ok = False
        try:
            t = sqlite3.connect(tmp)
            try:
                tabs = {r[0] for r in t.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                ok = {'games', 'categories'} <= tabs and t.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
                if ok:
                    t.execute('SELECT id,name,category_id,image,updated_at FROM games LIMIT 1').fetchall()
                    t.execute('SELECT id,name FROM categories LIMIT 1').fetchall()
            finally:
                t.close()
        except Exception:
            ok = False
        if not ok:
            os.remove(tmp)
            return self.out(400, '{"ok":false}')
        with lock:
            if os.path.exists(DBF):
                shutil.copyfile(DBF, os.path.join(DATA, 'catalog.before-import.db'))
            os.replace(tmp, DBF)
            init()
        self.out(200, '{"ok":true}')

    def do_POST(self):
        if not self.local():
            return self.out(403, '{"ok":false}')
        if self.path == '/api/import':
            return self.do_import()
        n = int(self.headers.get('Content-Length') or 0)
        if n > 6_000_000:
            return self.out(413, '{"ok":false}')
        try:
            d = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self.out(400, '{"ok":false}')
        bad = lambda code=400: self.out(code, '{"ok":false}')
        plat = plat_of(d.get('platform'))
        with lock:
            c = db()
            try:
                now = int(time.time())
                if self.path == '/api/add':
                    blob = img_bytes(d.get('image'))
                    if not blob:
                        return bad()
                    c.execute('INSERT INTO games(id,name,category_id,image,image_type,created_at,updated_at,platform) VALUES(?,?,?,?,?,?,?,?)',
                              (uuid.uuid4().hex[:12], str(d.get('name', '')).strip()[:80], cat_id(c, plat, d.get('category')),
                               blob, 'image/jpeg', now, now, plat))
                elif self.path == '/api/update':
                    gid = d.get('id')
                    g = c.execute('SELECT platform FROM games WHERE id=?', (gid,)).fetchone()
                    if not g:
                        return bad(404)
                    if d.get('name') is not None:
                        c.execute('UPDATE games SET name=? WHERE id=?', (str(d['name']).strip()[:80], gid))
                    if d.get('category') is not None:
                        c.execute('UPDATE games SET category_id=? WHERE id=?', (cat_id(c, g['platform'], d['category']), gid))
                    blob = img_bytes(d.get('image'))
                    if blob:
                        c.execute('UPDATE games SET image=?, updated_at=? WHERE id=?', (blob, now, gid))
                    if d.get('platform') in PLATS and d['platform'] != g['platform']:  # انتقال به پلتفرم دیگر
                        cn = c.execute('SELECT k.name FROM games g JOIN categories k ON k.id=g.category_id WHERE g.id=?', (gid,)).fetchone()[0]
                        c.execute('UPDATE games SET platform=?, category_id=? WHERE id=?', (d['platform'], cat_id(c, d['platform'], cn), gid))
                elif self.path == '/api/delete':
                    c.execute('DELETE FROM games WHERE id=?', (d.get('id'),))
                elif self.path == '/api/cat/add':
                    nm = str(d.get('name', '')).strip()[:40]
                    if nm and nm != DEF:
                        cat_id(c, plat, nm)
                elif self.path == '/api/cat/rename':
                    old = c.execute('SELECT id FROM categories WHERE platform=? AND name=?', (plat, str(d.get('old', '')))).fetchone()
                    new = str(d.get('new', '')).strip()[:40]
                    if not old or not new or str(d.get('old')) == DEF or new == DEF:
                        return bad()
                    ex = c.execute('SELECT id FROM categories WHERE platform=? AND name=?', (plat, new)).fetchone()
                    if ex and ex['id'] != old['id']:
                        c.execute('UPDATE games SET category_id=? WHERE category_id=?', (ex['id'], old['id']))
                        c.execute('DELETE FROM categories WHERE id=?', (old['id'],))
                    else:
                        c.execute('UPDATE categories SET name=? WHERE id=?', (new, old['id']))
                elif self.path == '/api/cat/delete':
                    old = c.execute('SELECT id FROM categories WHERE platform=? AND name=?', (plat, str(d.get('name', '')))).fetchone()
                    if not old or str(d.get('name')) == DEF:
                        return bad()
                    c.execute('UPDATE games SET category_id=? WHERE category_id=?', (cat_id(c, plat, DEF), old['id']))
                    c.execute('DELETE FROM categories WHERE id=?', (old['id'],))
                else:
                    return bad(404)
                c.commit()
            finally:
                c.close()
        self.out(200, '{"ok":true}')


HOME = r"""<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Atom Game Club</title><link rel="icon" href="/logo.png">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;min-height:100vh;color:#f1f2f6;font-family:Tahoma,system-ui,sans-serif;padding:18px 14px 40px;
background:radial-gradient(900px 500px at 85% -10%,#00d66440,transparent),radial-gradient(700px 400px at 0% 10%,#ffdd0026,transparent),#0d0e12}
.w{max-width:900px;margin:auto}
.br{display:flex;align-items:center;gap:14px;margin:6px 0 26px}.br img{width:68px;height:68px;border-radius:50%;box-shadow:0 0 0 2px #ffffff22,0 4px 22px #00d66466}
h1{margin:0;font-size:24px;letter-spacing:1px;background:linear-gradient(90deg,#00e676,#ffdd00);-webkit-background-clip:text;background-clip:text;color:transparent}
.br p{margin:4px 0 0;font-size:13px;color:#9aa1ad}
h2{font-size:15px;color:#cfd2dc;font-weight:400;margin:0 0 14px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.pl{display:block;text-decoration:none;color:#fff;border-radius:24px;padding:22px;min-height:210px;position:relative;overflow:hidden;
border:1px solid #ffffff1f;box-shadow:0 14px 36px #0008;transition:transform .2s,box-shadow .2s;animation:in .5s both}
.pl:hover{transform:translateY(-5px)}.pl:active{transform:scale(.98)}
.p4{background:radial-gradient(420px 220px at 100% 0%,#2f6bff66,transparent),linear-gradient(160deg,#16213f,#0b0e18)}
.p4:hover{box-shadow:0 18px 44px #2f6bff55}
.p5{background:radial-gradient(420px 220px at 100% 0%,#cfe3ff55,transparent),linear-gradient(160deg,#242a3a,#0b0e18)}
.p5:hover{box-shadow:0 18px 44px #cfe3ff44}
.t{font-size:58px;font-weight:900;letter-spacing:2px;line-height:1}
.p4 .t{color:#6f9bff}.p5 .t{color:#e6f0ff}
.n{margin:8px 0 18px;font-size:14px;color:#aeb4c2}
.th{display:flex}.th img{width:58px;height:78px;object-fit:cover;border-radius:10px;border:2px solid #0b0e18;box-shadow:0 6px 14px #0009;margin-inline-end:-14px}
.go{position:absolute;left:18px;bottom:18px;width:44px;height:44px;border-radius:50%;background:linear-gradient(90deg,#00d664,#ffdd00);color:#04140a;font-size:22px;display:flex;align-items:center;justify-content:center;font-weight:700;direction:ltr}
@keyframes in{from{opacity:0;transform:translateY(14px)}}
</style></head><body><div class="w">
<div class="br"><img src="/logo.png" alt=""><div><h1>ATOM GAME CLUB</h1><p>کاتالوگ بازی‌ها</p></div></div>
<h2>یک پلتفرم را انتخاب کن</h2>
<div class="g">
<a class="pl p4" href="/ps4"><div class="t">PS4</div><div class="n" id="n4">&nbsp;</div><div class="th" id="t4"></div><div class="go">‹</div></a>
<a class="pl p5" href="/ps5" style="animation-delay:.1s"><div class="t">PS5</div><div class="n" id="n5">&nbsp;</div><div class="th" id="t5"></div><div class="go">‹</div></a>
</div></div>
<script>
['ps4','ps5'].forEach(function(p){
  fetch('/api/games?p='+p).then(function(r){return r.json()}).then(function(a){
    document.getElementById('n'+p[2]).textContent=a.length?a.length+' بازی':'هنوز بازی‌ای اضافه نشده';
    var t=document.getElementById('t'+p[2]);
    a.slice(-4).forEach(function(x){var i=document.createElement('img');i.src='/img/'+x.id+'.jpg?v='+x.v;i.alt='';t.appendChild(i)});
  }).catch(function(){});
});
</script></body></html>"""


VIEW = r"""<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>__PLATNAME__ | Atom Game Club</title><link rel="icon" href="/logo.png">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;min-height:100vh;color:#f1f2f6;font-family:Tahoma,system-ui,sans-serif;
background:radial-gradient(900px 500px at 85% -10%,#00d66440,transparent),radial-gradient(700px 400px at 0% 10%,#ffdd0026,transparent),#0d0e12}
.top{position:sticky;top:0;z-index:5;padding:14px 14px 10px;background:#0d0e12cc;backdrop-filter:blur(14px);border-bottom:1px solid #ffffff12}
h1{margin:0;font-size:21px;background:linear-gradient(90deg,#00e676,#ffdd00);-webkit-background-clip:text;background-clip:text;color:transparent}
#q{width:100%;font:inherit;color:#fff;background:#ffffff10;border:1px solid #ffffff1a;border-radius:14px;padding:11px 14px;outline:0}
#q:focus{border-color:#00d664}
.ch{display:flex;gap:8px;overflow-x:auto;padding:10px 0 2px;scrollbar-width:none}.ch::-webkit-scrollbar{display:none}
.chip{flex:none;font:inherit;font-size:13px;color:#cfd2dc;background:#ffffff0d;border:1px solid #ffffff1a;border-radius:999px;padding:6px 14px}
.chip b{opacity:.6;font-weight:400;margin-inline-start:5px}
.chip.on{color:#04140a;font-weight:700;border-color:transparent;background:linear-gradient(90deg,#00d664,#ffdd00)}
main{padding:6px 14px 40px;max-width:1000px;margin:auto}
h2{font-size:16px;margin:22px 0 12px;display:flex;align-items:center;gap:8px}
h2:before{content:"";width:4px;height:18px;border-radius:4px;background:linear-gradient(#00d664,#ffdd00)}
h2 span{font-size:12px;color:#9aa1ad;font-weight:400}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px}
.c{position:relative;border-radius:16px;overflow:hidden;aspect-ratio:3/4;background:#1b1d22;cursor:pointer;
box-shadow:0 8px 22px #0007;transition:transform .2s,box-shadow .2s;animation:in .4s both}
.c:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 14px 30px #00d66455}
.c img{width:100%;height:100%;object-fit:cover;display:block}
.c span{position:absolute;inset:auto 0 0 0;padding:28px 10px 10px;font-size:13px;font-weight:700;text-align:center;
background:linear-gradient(transparent,#000d)}
@keyframes in{from{opacity:0;transform:translateY(10px)}}
.e{color:#8b909c;text-align:center;margin-top:70px;font-size:15px}
#lb{position:fixed;inset:0;z-index:20;background:#000e;backdrop-filter:blur(10px);display:none;flex-direction:column;touch-action:pan-y}
.lt{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;padding-top:max(12px,env(safe-area-inset-top))}
#lx{font-size:20px;width:44px;height:44px;border-radius:50%;border:0;background:#ffffff1c;color:#fff;cursor:pointer}
#lc{direction:ltr;font-size:14px;color:#cfd2dc;background:#ffffff14;padding:6px 14px;border-radius:999px}
#ls{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 8px;overflow:hidden}
#li{max-width:100%;max-height:calc(100vh - 200px);min-width:0;object-fit:contain;border-radius:16px;box-shadow:0 20px 60px #000;user-select:none;-webkit-user-drag:none;animation:sl .25s}
.nv{direction:ltr;flex:none;width:44px;height:44px;border-radius:50%;border:0;background:#ffffff1c;color:#fff;font-size:28px;line-height:1;cursor:pointer}
#lcap{text-align:center;padding:14px 14px 22px;padding-bottom:max(22px,env(safe-area-inset-bottom))}
#lnm{font-size:19px;font-weight:700}#lct{display:block;color:#ffdd00;font-size:13px;margin-top:4px}
@keyframes sl{from{opacity:0;transform:translateX(var(--dx,30px))}}
@media(max-width:600px){.nv{width:38px;height:38px;font-size:24px}}
.br{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}.br img{width:54px;height:54px;border-radius:50%;box-shadow:0 0 0 2px #ffffff22,0 4px 18px #00d66466}.br h1{font-size:19px;letter-spacing:1px;white-space:nowrap}@media(max-width:480px){.br h1{font-size:16px;letter-spacing:.5px}.br img{width:46px;height:46px}.bk{padding:6px 10px;font-size:11px}}.br p{margin:3px 0 0;font-size:12px;color:#9aa1ad}.in{max-width:1000px;margin:auto}.bk{margin-inline-start:auto;text-decoration:none;color:#e6e8ef;font-size:12px;background:#ffffff12;border:1px solid #ffffff1f;border-radius:999px;padding:7px 12px;white-space:nowrap}.bk b{color:#ffdd00;font-size:13px}@media(min-width:900px){.g{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}}
</style></head><body>
<div class="top"><div class="in"><div class="br"><img src="/logo.png" alt=""><div><h1>ATOM GAME CLUB</h1><p>کاتالوگ بازی‌های __PLATNAME__</p></div><a class="bk" href="/"><b>__PLATNAME__</b> ‹ صفحهٔ اصلی</a></div><input id="q" placeholder="🔍 جستجوی بازی..."><div class="ch" id="ch"></div></div></div>
<main id="m"></main><div id="lb"></div>
<script>
var data=[],last='',cat='',q=document.getElementById('q'),m=document.getElementById('m'),ch=document.getElementById('ch'),lb=document.getElementById('lb');
function cn(x){return x.category||'بدون دسته'}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
function render(){
  var cnt={},names=[];data.forEach(function(x){var c=cn(x);if(!cnt[c]){cnt[c]=0;names.push(c)}cnt[c]++});
  if(cat&&!cnt[cat])cat='';
  ch.innerHTML='';
  [''].concat(names).forEach(function(c){
    var b=el('button','chip'+(c===cat?' on':''),c||'همه');
    b.appendChild(el('b','',c?cnt[c]:data.length));
    b.onclick=function(){cat=c;render()};ch.appendChild(b);
  });
  var s=q.value.trim().toLowerCase();m.innerHTML='';var any=false;
  names.forEach(function(c){
    if(cat&&c!==cat)return;
    var f=data.filter(function(x){return cn(x)===c&&x.name.toLowerCase().indexOf(s)>-1});
    if(!f.length)return;any=true;
    var h=el('h2','',c);h.appendChild(el('span','',f.length+' بازی'));m.appendChild(h);
    var g=el('div','g');
    f.forEach(function(x,i){
      var d=el('div','c');d.style.animationDelay=Math.min(i*40,400)+'ms';
      var im=el('img');im.src='/img/'+x.id+'.jpg?v='+x.v;im.alt=x.name;im.loading='lazy';
      d.appendChild(im);d.appendChild(el('span','',x.name));
      d.onclick=function(){openLb(f,i,c)};
      g.appendChild(d);
    });m.appendChild(g);
  });
  if(!any)m.appendChild(el('div','e',data.length?'چیزی پیدا نشد 🤷':'هنوز بازی‌ای اضافه نشده'));
}
lb.innerHTML='<div class="lt"><button id="lx" aria-label="بستن">✕</button><span id="lc"></span></div><div id="ls"><button class="nv" id="lp" aria-label="قبلی">›</button><img id="li" alt=""><button class="nv" id="ln" aria-label="بعدی">‹</button></div><div id="lcap"><div id="lnm"></div><span id="lct"></span></div>';
var cur=[],ix=0,ccat='',li=document.getElementById('li'),ls=document.getElementById('ls');
function show(dir){var x=cur[ix];li.style.transform='';li.style.setProperty('--dx',(dir>0?-40:40)+'px');
  li.style.animation='none';void li.offsetWidth;li.style.animation='';
  li.src='/img/'+x.id+'.jpg?v='+x.v;document.getElementById('lnm').textContent=x.name;
  document.getElementById('lct').textContent=ccat;document.getElementById('lc').textContent=(ix+1)+' / '+cur.length;
  var one=cur.length<2;document.getElementById('lp').style.visibility=document.getElementById('ln').style.visibility=one?'hidden':'visible';}
function go(d){ix=(ix+d+cur.length)%cur.length;show(d)}
function openLb(list,i,c){cur=list;ix=i;ccat=c;show(0);lb.style.display='flex';document.body.style.overflow='hidden'}
function closeLb(){lb.style.display='none';document.body.style.overflow=''}
document.getElementById('lx').onclick=closeLb;
document.getElementById('lp').onclick=function(){go(-1)};
document.getElementById('ln').onclick=function(){go(1)};
ls.onclick=function(e){if(e.target===ls)closeLb()};
document.addEventListener('keydown',function(e){if(lb.style.display!=='flex')return;
  if(e.key==='Escape')closeLb();else if(e.key==='ArrowLeft')go(1);else if(e.key==='ArrowRight')go(-1)});
var tx=null,dx=0;
ls.addEventListener('touchstart',function(e){tx=e.touches[0].clientX;dx=0;li.style.animation='none'},{passive:true});
ls.addEventListener('touchmove',function(e){if(tx===null)return;dx=e.touches[0].clientX-tx;li.style.transition='none';li.style.transform='translateX('+dx+'px)'},{passive:true});
ls.addEventListener('touchend',function(){if(tx===null)return;tx=null;li.style.transition='transform .2s';
  if(dx<-60&&cur.length>1)go(1);else if(dx>60&&cur.length>1)go(-1);else li.style.transform='';dx=0});
function load(){fetch('/api/games?p=__PLAT__').then(function(r){return r.text()}).then(function(t){
  if(t===last)return;last=t;data=JSON.parse(t);render();}).catch(function(){});}
q.oninput=render;load();setInterval(load,3000);
</script></body></html>"""


ADMIN = r"""<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>مدیریت کاتالوگ</title><link rel="icon" href="/logo.png">
<style>
*{box-sizing:border-box}
body{margin:0;color:#f1f2f6;font-family:Tahoma,system-ui,sans-serif;padding:16px;
background:radial-gradient(800px 450px at 90% -10%,#00d66440,transparent),radial-gradient(600px 400px at 0% 0%,#ffdd0022,transparent),#0d0e12}
.w{max-width:680px;margin:auto}
h1{margin:0;font-size:21px;background:linear-gradient(90deg,#00e676,#ffdd00);-webkit-background-clip:text;background-clip:text;color:transparent}
.card{background:#ffffff0a;border:1px solid #ffffff14;border-radius:18px;padding:16px;margin-bottom:14px;backdrop-filter:blur(8px)}
.card h3{margin:0 0 12px;font-size:15px}
input[type=text]{width:100%;font:inherit;color:#fff;background:#ffffff0d;border:1px solid #ffffff1a;border-radius:12px;padding:11px 13px;margin-bottom:10px;outline:0}
input[type=text]:focus{border-color:#00d664}
.file{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}.file input{display:none}
.file label{flex:none;cursor:pointer;background:#ffffff14;border:1px dashed #ffffff40;border-radius:12px;padding:10px 14px;font-size:14px}
.file span{font-size:12px;color:#9aa1ad;flex:1;min-width:0}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:-2px 0 12px}
.tag{font:inherit;font-size:12px;color:#cfd2dc;background:#ffffff0d;border:1px solid #ffffff1a;border-radius:999px;padding:5px 11px}
button{font:inherit;cursor:pointer;color:#fff;border:0;border-radius:11px;padding:9px 14px}
.p{color:#04140a;background:linear-gradient(90deg,#00d664,#ffdd00);width:100%;padding:12px;font-weight:700}
.s,.d{padding:7px 10px;font-size:12px;background:#ffffff14}.d{background:#b4231855;color:#ffb4ab}
.qr{text-align:center}.qr canvas{width:100%;max-width:240px;background:#fff;border-radius:14px;padding:0;image-rendering:pixelated;box-shadow:0 10px 30px #00d66455}
.u{direction:ltr;font-size:15px;margin:10px 0 2px;color:#ffdd00;word-break:break-all}
.m{font-size:12px;color:#9aa1ad}
a.btn{display:inline-block;text-decoration:none;color:#fff;background:#ffffff14;border-radius:11px;padding:10px 14px;font-size:13px;margin:0 0 8px 8px}
.cr{display:flex;align-items:center;gap:8px;border-top:1px solid #ffffff12;padding:10px 0}.cr:first-child{margin-top:8px}
.tabs{display:flex;gap:10px;margin-bottom:14px}.tb{flex:1;font:inherit;font-size:17px;font-weight:700;padding:13px;color:#cfd2dc;background:#ffffff0d;border:1px solid #ffffff1a;border-radius:14px;cursor:pointer}.tb.on{color:#04140a;border-color:transparent;background:linear-gradient(90deg,#00d664,#ffdd00)}.cr b{flex:1;font-size:14px}.cr small{color:#9aa1ad;font-size:12px}
.r{display:flex;flex-wrap:wrap;gap:12px;align-items:center;border-top:1px solid #ffffff12;padding:12px 0}.r:first-of-type{border:0}
.r img{width:54px;height:72px;object-fit:cover;border-radius:10px}
.n{flex:1;min-width:0}.n b{display:block;font-size:14px}.n i{font-style:normal;font-size:11px;color:#ffdd00;background:#00d66422;border-radius:999px;padding:2px 9px;display:inline-block;margin-top:5px}
.a{display:flex;gap:6px;flex-wrap:wrap;flex-basis:100%;order:3}@media(min-width:600px){.a{flex-basis:auto;order:0;flex-wrap:nowrap}}
.br{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}.br img{width:54px;height:54px;border-radius:50%;box-shadow:0 0 0 2px #ffffff22,0 4px 18px #00d66466}.br h1{font-size:19px;letter-spacing:1px;white-space:nowrap}@media(max-width:480px){.br h1{font-size:16px;letter-spacing:.5px}.br img{width:46px;height:46px}.bk{padding:6px 10px;font-size:11px}}.br p{margin:3px 0 0;font-size:12px;color:#9aa1ad}.in{max-width:1000px;margin:auto}.bk{margin-inline-start:auto;text-decoration:none;color:#e6e8ef;font-size:12px;background:#ffffff12;border:1px solid #ffffff1f;border-radius:999px;padding:7px 12px;white-space:nowrap}.bk b{color:#ffdd00;font-size:13px}@media(min-width:900px){.g{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}}
</style></head><body><div class="w">
<div class="br"><img src="/logo.png" alt=""><div><h1>ATOM GAME CLUB</h1><p>مدیریت کاتالوگ</p></div></div>
<div class="card qr"><div class="m">دوستان باید به همین وای‌فای (یا هات‌اسپات) وصل باشند و QR را اسکن کنند</div><br>
<canvas id="qr"></canvas><div class="u" id="u"></div></div>
<div class="tabs"><button class="tb" data-p="ps4">PS4</button><button class="tb" data-p="ps5">PS5</button></div>
<div class="card" id="box"><h3>➕ بازی جدید به <span class="pn"></span></h3>
<input type="text" id="n" placeholder="اسم بازی (برای آپلود چندتایی لازم نیست)">
<input type="text" id="c" placeholder="دسته (مثلاً اکشن، ورزشی، ماشین)">
<div class="tags" id="tg"></div>
<div class="file"><label for="f">📷 انتخاب عکس</label><span id="fn">یا عکس‌ها را اینجا رها کنید</span><input type="file" id="f" accept="image/*" multiple></div>
<button class="p" id="add">افزودن به کاتالوگ</button><div class="m" id="msg" style="margin-top:8px"></div></div>
<div class="card"><h3>📁 دسته‌های <span class="pn"></span></h3>
<div style="display:flex;gap:8px;margin-bottom:6px"><input type="text" id="cn" placeholder="نام دستهٔ جدید" style="margin:0"><button class="p" style="width:auto;padding:0 18px;flex:none" id="ca">افزودن</button></div>
<div id="cl"></div></div>
<div class="card" id="l"></div>
<div class="card"><h3>💾 دیتابیس و پشتیبان‌گیری</h3>
<div class="m" style="margin-bottom:10px;line-height:1.8">همهٔ بازی‌ها، دسته‌ها و عکس‌ها داخل یک فایل <b>data/catalog.db</b> ذخیره می‌شود. اگر روزی سایت را عوض کردی، همین فایل را ببر.</div>
<a class="btn" href="/api/export/db" download>⬇️ دانلود دیتابیس (.db)</a>
<a class="btn" href="/api/export/zip" download>⬇️ خروجی ZIP (JSON + عکس‌ها)</a><br>
<button class="s" style="padding:10px 14px;font-size:13px" onclick="document.getElementById('rs').click()">⬆️ بازیابی از فایل .db</button>
<input type="file" id="rs" accept=".db,.sqlite" style="display:none"><span class="m" id="bm" style="margin-inline-start:8px"></span></div></div>
<script>
var QRLib=(function(){var M={},C={};
function req(p){var n=p.split('/').pop().replace('.js','');if(!C[n]){var m={exports:{}};C[n]=m;M[n](m,req)}return C[n].exports}
M["QR8bitByte"]=function(module,require){var exports=module.exports;
var QRMode = require('./QRMode');

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

};
M["QRBitBuffer"]=function(module,require){var exports=module.exports;
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

};
M["QRErrorCorrectLevel"]=function(module,require){var exports=module.exports;
module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


};
M["QRMaskPattern"]=function(module,require){var exports=module.exports;
module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

};
M["QRMath"]=function(module,require){var exports=module.exports;
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

};
M["QRMode"]=function(module,require){var exports=module.exports;
module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

};
M["QRPolynomial"]=function(module,require){var exports=module.exports;
var QRMath = require('./QRMath');

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

};
M["QRRSBlock"]=function(module,require){var exports=module.exports;
var QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

};
M["QRUtil"]=function(module,require){var exports=module.exports;
var QRMode = require('./QRMode');
var QRPolynomial = require('./QRPolynomial');
var QRMath = require('./QRMath');
var QRMaskPattern = require('./QRMaskPattern');

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

};
M["index"]=function(module,require){var exports=module.exports;
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------

var QR8bitByte = require('./QR8bitByte');
var QRUtil = require('./QRUtil');
var QRPolynomial = require('./QRPolynomial');
var QRRSBlock = require('./QRRSBlock');
var QRBitBuffer = require('./QRBitBuffer');

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

};

return {QRCode:req('index'),L:req('QRErrorCorrectLevel').L};})();
</script>
<script>
var plat='ps4';try{plat=localStorage.getItem('plat')==='ps5'?'ps5':'ps4'}catch(e){}
function post(u,d){if(!d.platform)d.platform=plat;return fetch(u,{method:'POST',body:JSON.stringify(d)}).then(function(r){return r.json()})}
function shrink(file){return createImageBitmap(file).then(function(b){
  var w=Math.min(480,b.width),h=Math.round(b.height*w/b.width),c=document.createElement('canvas');
  c.width=w;c.height=h;c.getContext('2d').drawImage(b,0,0,w,h);return c.toDataURL('image/jpeg',0.82);});}
function pick(cb){var i=document.createElement('input');i.type='file';i.accept='image/*';
  i.onchange=function(){if(i.files[0])shrink(i.files[0]).then(cb)};i.click();}
function qr(url){var q=new QRLib.QRCode(-1,QRLib.L);q.addData(url);q.make();
  var n=q.getModuleCount(),sc=8,z=3,s=(n+2*z)*sc,c=document.getElementById('qr');c.width=c.height=s;
  var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,s,s);x.fillStyle='#000';
  for(var r=0;r<n;r++)for(var k=0;k<n;k++)if(q.isDark(r,k))x.fillRect((k+z)*sc,(r+z)*sc,sc,sc);
  document.getElementById('u').textContent=url;}
fetch('/api/info').then(function(r){return r.json()}).then(function(d){qr(d.url)});
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
var L=document.getElementById('l'),cin=document.getElementById('c'),tg=document.getElementById('tg'),fin=document.getElementById('f');
function fnl(){var k=fin.files.length;document.getElementById('fn').textContent=k?(k>1?k+' عکس انتخاب شد':fin.files[0].name):'یا عکس‌ها را اینجا رها کنید'}
fin.onchange=fnl;
var bx=document.getElementById('box');
bx.ondragover=function(e){e.preventDefault()};
bx.ondrop=function(e){e.preventDefault();var dt=new DataTransfer();Array.prototype.forEach.call(e.dataTransfer.files,function(f){if(/^image\//.test(f.type))dt.items.add(f)});fin.files=dt.files;fnl()};
function cats(){fetch('/api/categories?p='+plat).then(function(r){return r.json()}).then(function(a){
  var cl=document.getElementById('cl');cl.innerHTML='';tg.innerHTML='';
  if(!a.length)cl.appendChild(el('div','m','هنوز دسته‌ای نیست'));
  a.forEach(function(c){
    if(!c.locked){var t=el('button','tag',c.name);t.onclick=function(){cin.value=c.name};tg.appendChild(t)}
    var r=el('div','cr');r.appendChild(el('b','',c.name));r.appendChild(el('small','',c.count+' بازی'));
    if(!c.locked){
      var e=el('button','s','ویرایش');e.onclick=function(){var v=prompt('نام جدید دسته',c.name);if(v&&v.trim()&&v.trim()!==c.name)post('/api/cat/rename',{old:c.name,new:v}).then(list)};
      var d=el('button','d','حذف');d.onclick=function(){if(confirm('دستهٔ «'+c.name+'» حذف شود؟'+(c.count?'\n'+c.count+' بازی داخلش به «بدون دسته» منتقل می‌شود (بازی‌ها پاک نمی‌شوند).':'')))post('/api/cat/delete',{name:c.name}).then(list)};
      r.appendChild(e);r.appendChild(d);
    }
    cl.appendChild(r);
  });});}
document.getElementById('ca').onclick=function(){var i=document.getElementById('cn');if(!i.value.trim())return;post('/api/cat/add',{name:i.value}).then(function(){i.value='';cats()})};
function list(){fetch('/api/games?p='+plat).then(function(r){return r.json()}).then(function(a){
  L.innerHTML='<h3>🎮 بازی‌های '+plat.toUpperCase()+' ('+a.length+')</h3>';
  cats();
  if(!a.length)L.appendChild(el('div','m','هنوز بازی‌ای نیست'));
  a.forEach(function(x){
    var r=el('div','r'),i=el('img');i.src='/img/'+x.id+'.jpg?v='+x.v;
    var n=el('div','n');n.appendChild(el('b','',x.name));n.appendChild(el('i','',x.category||'بدون دسته'));
    var ac=el('div','a');
    function bt(t,c,f){var b=el('button',c,t);b.onclick=f;ac.appendChild(b)}
    bt('نام','s',function(){var v=prompt('اسم جدید',x.name);if(v!==null)post('/api/update',{id:x.id,name:v}).then(list)});
    bt('دسته','s',function(){var v=prompt('دستهٔ جدید',x.category||'');if(v!==null)post('/api/update',{id:x.id,category:v}).then(list)});
    bt('عکس','s',function(){pick(function(d){post('/api/update',{id:x.id,image:d}).then(list)})});
    bt('به '+(plat==='ps4'?'PS5':'PS4'),'s',function(){post('/api/update',{id:x.id,platform:plat==='ps4'?'ps5':'ps4'}).then(list)});
    bt('حذف','d',function(){if(confirm('حذف شود؟'))post('/api/delete',{id:x.id}).then(list)});
    r.appendChild(i);r.appendChild(n);r.appendChild(ac);L.appendChild(r);
  });});}
document.getElementById('rs').onchange=function(){var f=this.files[0],m=document.getElementById('bm'),i=this;if(!f)return;
  if(!confirm('همهٔ اطلاعات فعلی با این فایل جایگزین می‌شود (از اطلاعات فعلی یک نسخهٔ پشتیبان ساخته می‌شود). ادامه؟')){i.value='';return}
  m.textContent='در حال بازیابی...';
  fetch('/api/import',{method:'POST',body:f}).then(function(r){return r.json()}).then(function(d){m.textContent=d.ok?'✓ بازیابی شد':'فایل دیتابیس معتبر نیست';list()},function(){m.textContent='خطا در ارسال فایل'});i.value=''};
document.getElementById('add').onclick=function(){
  var nm=document.getElementById('n'),m=document.getElementById('msg'),fs=Array.prototype.slice.call(fin.files);
  if(!fs.length){m.textContent='عکس انتخاب کنید';return}
  if(fs.length==1&&!nm.value.trim()){}
  var ok=0,bad=0,i=0,cat=cin.value,one=fs.length==1&&nm.value.trim();
  function next(){
    if(i>=fs.length){nm.value='';fin.value='';fnl();m.textContent='✓ '+ok+' بازی اضافه شد'+(bad?' ('+bad+' فایل نامعتبر)':'');list();return}
    var f=fs[i++];m.textContent='در حال افزودن '+i+' از '+fs.length+' ...';
    var name=one?nm.value:f.name.replace(/\.[^.]+$/,'').replace(/[_\-]+/g,' ').trim();
    shrink(f).then(function(d){return post('/api/add',{name:name,category:cat,image:d})}).then(function(){ok++},function(){bad++}).then(next);
  }
  next();
};
function setPlat(p){plat=p;try{localStorage.setItem('plat',p)}catch(e){}
  document.querySelectorAll('.tb').forEach(function(b){b.classList.toggle('on',b.dataset.p===p)});
  document.querySelectorAll('.pn').forEach(function(e){e.textContent=p.toUpperCase()});list();}
document.querySelectorAll('.tb').forEach(function(b){b.onclick=function(){setPlat(b.dataset.p)}});
setPlat(plat);
</script></body></html>"""


if __name__ == '__main__':
    init()
    try:
        srv = ThreadingHTTPServer(('0.0.0.0', PORT), H)
    except OSError:
        raise SystemExit('پورت %d در حال استفاده است. برنامه قبلی را ببندید.' % PORT)
    print('\nپنل مدیریت (فقط همین کامپیوتر): http://127.0.0.1:%d/admin' % PORT)
    print('آدرس برای دوستان: http://%s:%d' % (lan_ip(), PORT))
    print('دیتابیس: %s' % DBF)
    print('برای خروج Ctrl+C\n')
    threading.Timer(1, lambda: webbrowser.open('http://127.0.0.1:%d/admin' % PORT)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
