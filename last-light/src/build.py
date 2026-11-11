"""Bundles src/*.js into www/index.html (the page the Android app and any web host serve)."""
import os, re
G = os.path.dirname(os.path.abspath(__file__)); W = os.path.join(G, "..", "www")
parts = [f"// ===== {f} =====\n" + open(os.path.join(G, f)).read() for f in ["art.js", "art_chars.js", "art_items.js", "audio.js", "fx.js", "ll.js"]]
shell = open(os.path.join(G, "shell.html")).read()
# fonts ship with the app so it works offline
shell = re.sub(r'<link rel="preconnect"[^>]*>\n', "", shell)
shell = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>', '<link rel="stylesheet" href="fonts.css">', shell)
shell = shell.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "")
head, body = shell.split("<div id=\"app\">", 1)
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#0b0920">\n<style>[hidden]{display:none!important}body{margin:0}</style>\n'
        + head + '</head>\n<body>\n<div id="app">' + body.replace("/*BUNDLE*/", "\n".join(parts).replace("</script", "<\\/script")) + "\n</body>\n</html>\n")
os.makedirs(W, exist_ok=True); open(os.path.join(W, "index.html"), "w").write(page); print("www/index.html", len(page), "bytes")
