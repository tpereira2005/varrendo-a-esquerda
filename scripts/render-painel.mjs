import {readFileSync,writeFileSync} from 'node:fs';
const previous=readFileSync('public/painel.html','utf8');
const map=previous.match(/^const MAP = .+;$/m)?.[0];
if(!map)throw new Error('Mapa original não encontrado');
writeFileSync('public/painel.html',readFileSync('scripts/painel-template.html','utf8').replace('/*__MAP__*/',map));
