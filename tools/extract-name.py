# Gera os contornos vetoriais do nome (Archivo 900) para a parede do site.
# Só é preciso rodar de novo se o nome mudar.
#
# Preparo (uma vez):
#   pip install fonttools brotli uharfbuzz
#   npm pack @fontsource-variable/archivo   (e copie para esta pasta o arquivo
#   files/archivo-latin-wdth-normal.woff2 de dentro do pacote)
# Uso, de dentro de tools:
#   python3 extract-name.py "HENRIQUE" "ROCHA" > ../js/name-data.js
import sys, json
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import ControlBoundsPen

SRC = 'archivo-latin-wdth-normal.woff2'
tt = TTFont(SRC); tt.flavor = None; tt.save('archivo.ttf')
print([ (a.axisTag, a.minValue, a.maxValue) for a in tt['fvar'].axes ], file=sys.stderr)
face = hb.Face(hb.Blob.from_file_path('archivo.ttf'))
UPM = face.upem
CAP = tt['OS/2'].sCapHeight

def shape(text, wdth):
    font = hb.Font(face); font.set_variations({'wght': 900, 'wdth': wdth})
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True})
    return font, buf.glyph_infos, buf.glyph_positions

def line(text, wdth):
    font, infos, pos = shape(text, wdth)
    x = 0; glyphs = []
    for info, p in zip(infos, pos):
        bp = ControlBoundsPen(None)
        font.draw_glyph_with_pen(info.codepoint, TransformPen(bp, (1, 0, 0, 1, x + p.x_offset, p.y_offset)))
        glyphs.append((info.codepoint, x + p.x_offset, bp.bounds))
        x += p.x_advance
    xmin = min(b[0] for _, _, b in glyphs); xmax = max(b[2] for _, _, b in glyphs)
    sp = SVGPathPen(None, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    boxes = []
    for (gid, gx, b), ch in zip(glyphs, text):
        # y para baixo, origem no canto superior esquerdo da tinta (topo das maiúsculas)
        font.draw_glyph_with_pen(gid, TransformPen(sp, (1, 0, 0, -1, gx - xmin, CAP)))
        boxes.append({'ch': ch, 'x': round(b[0] - xmin, 1), 'w': round(b[2] - b[0], 1), 'y': round(CAP - b[3], 1), 'h': round(b[3] - b[1], 1)})
    return {'d': sp.getCommands(), 'w': round(xmax - xmin, 1), 'boxes': boxes, 'wdth': round(wdth, 1)}

def inkw(text, wdth): return line(text, wdth)['w']

def match(text, target, lo=62, hi=125):
    for _ in range(40):
        mid = (lo + hi) / 2
        if inkw(text, mid) < target: lo = mid
        else: hi = mid
    return (lo + hi) / 2

A, B = sys.argv[1], sys.argv[2]
variants = {}
# largo: sobrenome na largura máxima, nome ajustado para fechar na mesma medida
wB = 125; variants['wide'] = [line(A, match(A, inkw(B, wB))), line(B, wB)]
# alto (telas em pé): nome bem condensado, sobrenome ajustado
wA = 62; variants['tall'] = [line(A, wA), line(B, match(B, inkw(A, wA)))]
# meio-termo
wA = 72; variants['mid'] = [line(A, wA), line(B, match(B, inkw(A, wA)))]
out = {'upm': UPM, 'cap': CAP, 'variants': variants}
for k, v in variants.items():
    print(k, [(l['wdth'], l['w']) for l in v], 'aspect w/cap', round(v[0]['w'] / CAP, 2), file=sys.stderr)
print('// Gerado por extract.py: contornos de "%s %s" em Archivo 900 (OFL). Não edite à mão.' % (A, B))
print('window.HR_NAME = ' + json.dumps(out, separators=(',', ':')) + ';')
