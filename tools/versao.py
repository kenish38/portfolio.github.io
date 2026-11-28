#!/usr/bin/env python3
# Carimba o endereço do CSS, dos scripts e do ícone nas páginas (index.html e admin/index.html) com um código que muda quando o
# arquivo muda: css/site.css?v=1a2b3c4d. Sem o carimbo, o navegador de quem já visitou o site guarda o CSS e os scripts
# antigos por até 10 minutos depois de uma publicação e mostra a página nova com o visual velho (ou tudo velho).
# Com ele, basta recarregar a página (F5) para ver a versão publicada.
#
# Uso, na raiz do repositório, depois de mexer em css/, js/ ou admin/ e antes de publicar:
#     python3 tools/versao.py
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ['index.html', 'admin/index.html']
ASSET = re.compile(r'((?:href|src)=")((?:\.\./)?(?:css/|js/)?[\w./-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')
# o ícone do site (a aba do navegador): o painel troca os três arquivos e carimba os endereços do mesmo jeito (admin.js)
ICON = re.compile(r'(href=")((?:\.\.)?/img/(?:favicon\.svg|favicon-32\.png|apple-touch-icon\.png))(?:\?v=[0-9a-f]+)?(")')


def stamp(page):
    path = os.path.join(ROOT, page)
    html = open(path, encoding='utf-8').read()
    changed = []

    def swap(m):
        url = m.group(2)
        # um endereço que começa com / parte da raiz do site (o repositório); os outros, da pasta da página
        base = ROOT if url.startswith('/') else os.path.dirname(path)
        target = os.path.normpath(os.path.join(base, url.lstrip('/')))
        if not target.startswith(ROOT + os.sep) or not os.path.isfile(target):
            return m.group(0)                      # endereço de fora ou arquivo que não existe: fica como está
        code = hashlib.sha1(open(target, 'rb').read()).hexdigest()[:8]
        new = m.group(1) + url + '?v=' + code + m.group(3)
        if new != m.group(0):
            changed.append(url)
        return new

    out = ICON.sub(swap, ASSET.sub(swap, html))
    if out != html:
        open(path, 'w', encoding='utf-8', newline='').write(out)
    return changed


if __name__ == '__main__':
    total = 0
    for page in PAGES:
        done = stamp(page)
        total += len(done)
        print(page + ': ' + (', '.join(done) if done else 'nada mudou'))
    sys.exit(0)
