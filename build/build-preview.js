#!/usr/bin/env node
/* Bundles the whole app into one self-contained HTML page (in-browser demo mode).
 * Usage: node build/build-preview.js [out.html]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'public');
const out = process.argv[2] || path.resolve(__dirname, '..', 'dist', 'fintax-preview.html');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const scripts = ['core/core.js', 'core/seed.js', 'js/icons.js', 'js/lib.js', 'js/ui.js', 'js/main.js', 'js/site.js', 'js/admin.js', 'js/app.js', 'js/app2.js', 'js/portal.js'];
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const fonts = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Noto+Nastaliq+Urdu:wght@500&family=Source+Serif+4:opsz,wght@8..60,400..600&display=swap';
const html = [
  '<title>FinTax</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="theme-color" content="#0E7A4F">',
  '<link rel="stylesheet" href="' + fonts + '">',
  '<style>' + read('css/app.css') + '</style>',
  '<div id="root"></div>',
  '<script>window.FINTAX_PREVIEW = true;</script>',
].concat(scripts.map((s) => '<script>/* ' + s + ' */\n' + safe(read(s)) + '\n</script>'))
  .concat(['<script>window.FT.boot();</script>']).join('\n');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
