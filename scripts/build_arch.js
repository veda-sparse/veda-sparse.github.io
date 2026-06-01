// Re-extract the (updated) vector diagram, split into 3 responsive panels,
// wrap each box+label into a .node group, add ids, inject into index.html.
const fs = require('fs');
const VEC = '/Users/bytedance/Downloads/veda_sparse_attn_latex/visuals/cdp-whiteboard-v3-vector.html';
const IDX = '/Users/bytedance/Documents/ICML Paper/Webpage/index.html';

const vec = fs.readFileSync(VEC, 'utf8');
// inner of the big svg
const svgInnerAll = vec.slice(vec.indexOf('<svg viewBox="0 0 1024 451"'));
const content = svgInnerAll.slice(svgInnerAll.indexOf('>') + 1, svgInnerAll.indexOf('</svg>'));
const defs = content.match(/<defs>[\s\S]*?<\/defs>/)[0].replace(/^<defs>|<\/defs>$/g, '');

const iSvg = content.indexOf('<g id="svg-panel">');
const iVsa = content.indexOf('<g id="vsa-panel">');
const iVeda = content.indexOf('<g id="veda-panel">');
const stripLastG = (s) => s.slice(0, s.lastIndexOf('</g>'));
let svgInner = stripLastG(content.slice(iSvg + '<g id="svg-panel">'.length, iVsa));
let vsaInner = stripLastG(content.slice(iVsa + '<g id="vsa-panel">'.length, iVeda));
let vedaInner = stripLastG(content.slice(iVeda + '<g id="veda-panel">'.length));

// fix the var(--gold) literal that has no definition on the page
vedaInner = vedaInner.replace(/fill="var\(--gold\)"/g, 'fill="#d7b34f"');

// add ids to the Veda blocks we link from the component cards
const idMap = [
  ['class="box whitebox" x="633" y="165"', 'id="vd-attn" class="box whitebox" x="633" y="165"'],
  ['class="box greenbox" x="633" y="214"', 'id="vd-maxpool" class="box greenbox" x="633" y="214"'],
  ['class="box blue" x="642" y="96"',      'id="vd-search" class="box blue" x="642" y="96"'],
  ['class="box gray" x="806" y="99"',      'id="vd-tile" class="box gray" x="806" y="99"'],
  ['class="box greenbox" x="770" y="165"', 'id="vd-triplet" class="box greenbox" x="770" y="165"'],
  ['class="box peach" x="770" y="215"',    'id="vd-qk" class="box peach" x="770" y="215"'],
  ['class="box whitebox" x="770" y="264"', 'id="vd-block" class="box whitebox" x="770" y="264"'],
  ['class="box blue" x="770" y="310"',     'id="vd-topk" class="box blue" x="770" y="310"'],
  ['class="box whitebox" x="905" y="302"', 'id="vd-sparse" class="box whitebox" x="905" y="302"'],
];
idMap.forEach(([a, b]) => { vedaInner = vedaInner.replace(a, b); });
vedaInner = vedaInner.replace('<text class="loss" x="657" y="282">', '<text id="vd-loss" class="loss" x="657" y="282">');

// id the connecting flow lines so component cards can highlight them too
const lineMap = [
  ['class="line dash" d="M685 190 V211"', 'id="vl-attn-maxpool" class="line dash" d="M685 190 V211"'],
  ['class="pool dash" d="M685 239 V264"', 'id="vl-maxpool-loss" class="pool dash" d="M685 239 V264"'],
  ['class="pool" d="M821 190 V212"', 'id="vl-triplet-qk" class="pool" d="M821 190 V212"'],
  ['class="pool" d="M821 240 V261"', 'id="vl-qk-block" class="pool" d="M821 240 V261"'],
  ['class="pool" d="M821 289 V307"', 'id="vl-block-topk" class="pool" d="M821 289 V307"'],
  ['class="line dash" d="M727 109 H802"', 'id="vl-search" class="line dash" d="M727 109 H802"'],
  ['class="line dash" d="M821 143 H690 Q685 143 685 148 V162"', 'id="vl-tile-est" class="line dash" d="M821 143 H690 Q685 143 685 148 V162"'],
  ['class="line" d="M879 123 V135 Q879 143 887 143 H940 Q948 143 948 151 V299"', 'id="vl-to-sparse" class="line" d="M879 123 V135 Q879 143 887 143 H940 Q948 143 948 151 V299"'],
  ['class="pool dash" d="M770 276 H715"', 'id="vl-block-grad" class="pool dash" d="M770 276 H715"'],
  ['class="grad dash" d="M716 258 H806 Q814 258 814 250 V247"', 'id="vl-gradflow" class="grad dash" d="M716 258 H806 Q814 258 814 250 V247"'],
];
lineMap.forEach(([a, b]) => { vedaInner = vedaInner.replace(a, b); });
vedaInner = vedaInner.replace('<text x="746" y="254" fill="#d7b34f"', '<text id="vl-gradtext" x="746" y="254" fill="#d7b34f"');

// wrap each box rect + its following label into a .node group
const wrapNodes = (s) => s.replace(
  /(<rect [^>]*class="box[^"]*"[^>]*><\/rect>)\s*(<text class="label[^>]*>[\s\S]*?<\/text>)/g,
  '<g class="node">$1$2</g>'
);
svgInner = wrapNodes(svgInner);
vsaInner = wrapNodes(vsaInner);
vedaInner = wrapNodes(vedaInner);

// per-panel marker ids to keep references valid inside each separate <svg>
const suffixDefs = (sfx) => defs.replace(/id="arrow-(black|green|gold)"/g, `id="arrow-$1-${sfx}"`);
const suffixRefs = (s, sfx) => s.replace(/url\(#arrow-(black|green|gold)\)/g, `url(#arrow-$1-${sfx})`);

const panel = (cls, sfx, vb, label, inner) =>
  `<div class="arch3__panel arch3__panel--${cls}">` +
  `<svg class="arch3__svg" viewBox="${vb}" role="img" aria-label="${label}">` +
  `<defs>${suffixDefs(sfx)}</defs>${suffixRefs(inner, sfx)}</svg></div>`;

const block =
  '<div class="arch" id="archDiagram"><div class="arch3">' +
  panel('svg', 'a', '-8 0 252 451', 'SVG: static sparse-attention pipeline', svgInner) +
  panel('vsa', 'b', '248 0 356 451', 'VSA: dynamic learned-mask pipeline', vsaInner) +
  panel('veda', 'c', '598 0 430 451', 'Veda (ours): distilled sparse-attention pipeline', vedaInner) +
  '</div></div>';

let idx = fs.readFileSync(IDX, 'utf8');
// idempotent: replace everything from the arch div up to the arch__scroll close + figcaption,
// regardless of how many <svg> panels currently exist.
const re = /<div class="arch" id="archDiagram">[\s\S]*?<\/div>\s*<figcaption/;
if (!re.test(idx)) { console.error('arch block not found'); process.exit(1); }
idx = idx.replace(re, block + '\n      </div>\n      <figcaption');
fs.writeFileSync(IDX, idx);
console.log('arch injected. nodes:',
  (block.match(/class="node"/g) || []).length, 'panels: 3');
