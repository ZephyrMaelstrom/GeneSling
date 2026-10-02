#!/usr/bin/env python3
"""Assemble the single-file prototype: src/shell.html + src/*.js (in load order) -> index.html."""
from pathlib import Path
here = Path(__file__).resolve().parent
ORDER = ['data', 'state', 'sprites', 'audio', 'map', 'ui', 'raid', 'draw']
shell = (here / 'src' / 'shell.html').read_text()
js = ''.join((here / 'src' / f'{n}.js').read_text() + '\n' for n in ORDER)
(here / 'index.html').write_text(shell + '<script>\n' + js + '</script>\n')
print('built', here / 'index.html')
