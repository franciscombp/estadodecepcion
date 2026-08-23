#!/usr/bin/env python3
# ============================================================================
# ADELGAZAR PERSONAJES — quitarle a cada .glb los cinco megas que no se ven
# ============================================================================
# EL PROBLEMA. Los seis modelos nuevos pesan 31 MB entre todos, y el 95% de
# cada archivo es UNA imagen: un atlas de 2048×2048 en PNG, entre 4.3 y 5.2 MB.
# En un juego que se abre desde el móvil por una URL, eso son 31 MB que hay que
# bajar antes de que aparezca el primer personaje, y entre 3.3 y 3.5 s de
# descodificar PNG por modelo en el hilo principal.
#
# QUÉ LLEVA ESE ATLAS. Se miró antes de tocarlo. Es un despiece automático
# (Meshy) con muchas islas pequeñas y colores planos: casi no hay degradados
# ni detalle fotográfico. Lo único que no es color plano —y que por eso vale
# la pena conservar— son las letras de POLICÍA en la espalda y la banda
# tricolor de Roy. Un atlas de colores planos es justo lo que mejor comprime.
#
# QUÉ SE MIDIÓ. No se comparan las imágenes píxel a píxel, porque la mitad del
# atlas son huecos que no toca ninguna cara. Se compara LO QUE VE EL JUGADOR:
# el color en el centroide UV de cada triángulo de la malla, en Lab, original
# contra candidato. Con los seis modelos y sus ~4.200 triángulos cada uno:
#
#     candidato        KB medio   ΔE medio   %ΔE>5   %ΔE>10    peor
#     webp 1024 q90       110.4       1.88     5.9      1.4     51.5
#     webp  512 q90        42.7       2.44     9.6      3.0     58.7   <—
#     webp  512 q80        27.2       2.78    12.3      3.5     59.6
#     png   512 (64c)     108.2       2.73    13.1      5.0     71.4
#     webp  256 q90        17.5       3.58    17.9      6.3     72.4
#
# Se elige 512 q90. Un ΔE de 2.4 de media está en el límite de lo que un ojo
# distingue con las dos muestras pegadas, y aquí no lo están: el personaje
# ocupa 0.30 del alto de la pantalla —unos 320 px en un móvil— así que 512²
# de atlas ya le sobran. El error que queda no está repartido: se concentra en
# los bordes entre islas, que es donde el reescalado mezcla dos colores planos,
# y ese borde en la malla es una arista que la luz ya rompe.
#
# 1024 costaría 2.6× más bytes para bajar el ΔE de 2.44 a 1.88. No se paga.
#
# POR QUÉ WEBP Y NO PNG. A igualdad de tamaño (108 KB) el PNG cuantizado da
# MÁS error que el webp (2.73 contra 2.44 a 512), porque para llegar ahí hay
# que reducir a 64 colores y eso rompe los pocos degradados que hay. El webp
# entra en el .glb por EXT_texture_webp, que GLTFLoader trae de serie.
#
# SE EJECUTA A MANO, no en el build: los .glb versionados ya salen finos.
#     python3 scripts/adelgazar-personajes.py
# ============================================================================

import json, struct, sys, io, os
from pathlib import Path
from PIL import Image

CARPETA = Path(__file__).resolve().parent.parent / 'public' / 'modelos' / 'personajes'
LADO = 512
CALIDAD = 90


def leer_glb(ruta):
    b = ruta.read_bytes()
    magia, version, total = struct.unpack_from('<III', b, 0)
    assert magia == 0x46546C67, f'{ruta.name} no es un .glb'
    off, doc, bin_ = 12, None, b''
    while off < total:
        largo, tipo = struct.unpack_from('<II', b, off)
        trozo = b[off + 8: off + 8 + largo]
        if tipo == 0x4E4F534A:
            doc = json.loads(trozo.decode('utf-8'))
        elif tipo == 0x004E4942:
            bin_ = trozo
        off += 8 + largo
    return doc, bin_


def escribir_glb(ruta, doc, bin_):
    js = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)          # los trozos van alineados a 4
    bn = bin_ + b'\0' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(js) + (8 + len(bn) if bn else 0)
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    if bn:
        out += struct.pack('<II', len(bn), 0x004E4942) + bn
    ruta.write_bytes(bytes(out))


def adelgazar(ruta):
    doc, bin_ = leer_glb(ruta)
    antes = ruta.stat().st_size
    imagenes = doc.get('images', [])
    if not imagenes:
        print(f'{ruta.name}: sin imágenes, se deja como está')
        return

    # Se reconstruye el BIN entero: al encoger una imagen cambian todos los
    # byteOffset que vienen detrás, y remendarlos uno a uno es cómo se cuelan
    # los archivos corruptos.
    nuevo_bin = bytearray()
    nuevas_vistas = []
    remap = {}
    recodificadas = {}

    for i, img in enumerate(imagenes):
        if 'bufferView' not in img:
            continue
        bv = doc['bufferViews'][img['bufferView']]
        ini = bv.get('byteOffset', 0)
        crudo = bin_[ini: ini + bv['byteLength']]
        im = Image.open(io.BytesIO(crudo)).convert('RGB')
        buf = io.BytesIO()
        im.resize((LADO, LADO), Image.LANCZOS).save(buf, 'WEBP', quality=CALIDAD, method=6)
        recodificadas[i] = buf.getvalue()
        print(f'  imagen {i}: {im.size[0]}² {img.get("mimeType")} '
              f'{len(crudo)/1048576:.2f} MB → {LADO}² webp q{CALIDAD} '
              f'{len(recodificadas[i])/1024:.1f} KB')

    for vi, bv in enumerate(doc['bufferViews']):
        datos = None
        for i, img in enumerate(imagenes):
            if img.get('bufferView') == vi and i in recodificadas:
                datos = recodificadas[i]
                break
        if datos is None:
            ini = bv.get('byteOffset', 0)
            datos = bin_[ini: ini + bv['byteLength']]
        while len(nuevo_bin) % 4:
            nuevo_bin += b'\0'
        nueva = dict(bv)
        nueva['byteOffset'] = len(nuevo_bin)
        nueva['byteLength'] = len(datos)
        nuevo_bin += datos
        remap[vi] = len(nuevas_vistas)
        nuevas_vistas.append(nueva)

    doc['bufferViews'] = nuevas_vistas
    doc['buffers'] = [{'byteLength': len(nuevo_bin)}]
    for i in recodificadas:
        imagenes[i]['mimeType'] = 'image/webp'

    # EXT_texture_webp: la textura deja de apuntar a `source` y pasa a apuntar
    # por la extensión. Sin PNG de reserva hay que declararla como REQUERIDA,
    # que es lo honesto: sin webp el archivo no se puede leer, y no hay ningún
    # navegador de los que corren este juego que no lo lea desde 2020.
    for tex in doc.get('textures', []):
        if 'source' in tex and tex['source'] in recodificadas:
            tex.setdefault('extensions', {})['EXT_texture_webp'] = {'source': tex.pop('source')}
    for lista in ('extensionsUsed', 'extensionsRequired'):
        doc.setdefault(lista, [])
        if 'EXT_texture_webp' not in doc[lista]:
            doc[lista].append('EXT_texture_webp')

    escribir_glb(ruta, doc, bytes(nuevo_bin))
    despues = ruta.stat().st_size
    print(f'{ruta.name}: {antes/1048576:.2f} MB → {despues/1024:.0f} KB '
          f'({antes/despues:.0f}× más ligero)\n')
    return antes, despues


if __name__ == '__main__':
    total_antes = total_despues = 0
    for ruta in sorted(CARPETA.glob('*.glb')):
        r = adelgazar(ruta)
        if r:
            total_antes += r[0]
            total_despues += r[1]
    print(f'TOTAL: {total_antes/1048576:.1f} MB → {total_despues/1024:.0f} KB')
