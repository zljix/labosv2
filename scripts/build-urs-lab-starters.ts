import {readFile, writeFile} from 'node:fs/promises';
import {createUrsLab, labIds} from '../src/lessons/ursLab';
import {compileProject} from './avr-compile.mjs';

globalThis.fetch = async input => new Response(await readFile('public' + String(input), 'utf8'));
for (const id of labIds.filter(id => id !== 'LV16')) {
  const project = await createUrsLab(id, false);
  const built = await compileProject(project);
  const {compiledAt, diagnostics, messages, ...starter} = built;
  await writeFile('public/zbirke/urs-lv/' + id + '/pocetni.avr.json', JSON.stringify(starter) + '\n');
  console.log(id, starter.flashBytes + ' B Flash', starter.staticRamBytes + ' B SRAM');
}
