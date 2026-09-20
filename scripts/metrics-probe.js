#!/usr/bin/env node
// QA probe: print the live cardio panel's readouts from an agent-device snapshot.
// Kept as a file rather than an inline `node -e` because the regexes need `$`
// anchors, and shell quoting around `-e` turns those into literal dollars.
const fs = require('node:fs');

const file = process.argv[2] ?? '/tmp/live.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8')).data;

const texts = data.nodes.filter((n) => n.type === 'StaticText' && n.rect);
const find = (re) => {
  const n = texts.find((t) => re.test(t.label ?? ''));
  return n ? n.label : '-';
};

const clock = find(/^(\d{1,2}:)?\d{2}:\d{2}$/); // h:mm:ss | mm:ss
const dist = find(/^[\d.,]+ ?(m|km)$/);
const kcal = find(/^\d[\d,]* kcal$/);
const pace = find(/^[\d.:]+ ?(\/km|km\/h)$/);
const pos = find(/^\d+$/);
  // The control is a `Button` node, not `StaticText` — scanning only text nodes
  // made this column read empty on a panel that plainly showed "Pause".
  const ctlNode = data.nodes.find(
    (n) => /^(Pause|Resume|Stop and save|Saving…)$/.test(n.label ?? '') && n.rect,
  );
  const ctl = ctlNode ? ctlNode.label : '-';
const banner = data.nodes.some((n) => n.label === 'Discard it');

console.log(
  [
    new Date().toISOString().slice(11, 19),
    `elapsed=${clock}`,
    `dist=${dist}`,
    `pace=${pace}`,
    `kcal=${kcal}`,
    `pos=${pos}`,
    `ctl=${ctl}`,
    banner ? 'BANNER' : '',
  ]
    .filter(Boolean)
    .join('  '),
);
