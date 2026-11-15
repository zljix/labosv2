import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }).sort();
}
export function normalizeBase(value = '/') {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(value)) throw Error('LAB_BASE_PATH mora biti apsolutna putanja, npr. /labos/.');
  return value.endsWith('/') ? value : value + '/';
}
export function sourceBuild(root, base = '/') {
  const paths = ['src', 'boards', 'public', 'scripts'].flatMap(name => filesUnder(resolve(root, name)));
  paths.push(...['package.json', 'package-lock.json', 'vite.config.ts', 'index.html'].map(name => resolve(root, name)));
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(relative(root, path)).update('\0').update(readFileSync(path)).update('\0');
  if (base !== '/') hash.update('base\0').update(base);
  return hash.digest('hex').slice(0, 16);
}
export function offlinePlugin(root, build, version, base = '/') {
  return {
    name: 'lab-offline-package',
    apply: 'build',
    closeBundle() {
      const dist = resolve(root, 'dist');
      // Stable runtime URLs remain for the existing verification tools. The app
      // uses release URLs so an open older page cannot mix interpreter versions.
      for (const path of filesUnder(resolve(root, 'public'))) {
        const name = relative(resolve(root, 'public'), path).replaceAll('\\', '/');
        if (!['avr-examples.json','s3-examples.json','radio-examples.json'].includes(name) && !name.endsWith('.mjs') && !name.endsWith('.py') && !name.startsWith('runtime/') && !name.startsWith('drivers/')) continue;
        const output = resolve(dist, 'app', build, name);
        mkdirSync(dirname(output), { recursive: true });
        copyFileSync(path, output);
      }
      // Vite rewrites index.html; copied public HTML and the PWA manifest need
      // the same project prefix. Keep the root build available for local use.
      if (base !== '/') {
        for (const path of filesUnder(dist).filter(path => path.endsWith('.html') && relative(dist, path) !== 'index.html')) {
          writeFileSync(path, readFileSync(path, 'utf8').replace(/((?:href|src)=["'])\/(?!\/)/g, '$1' + base));
        }
        const path = resolve(dist, 'manifest.webmanifest'), manifest = JSON.parse(readFileSync(path, 'utf8'));
        for (const key of ['id', 'start_url', 'scope']) manifest[key] = base;
        for (const icon of manifest.icons) icon.src = base + icon.src.replace(/^\//, '');
        writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
      }
      const files = filesUnder(dist).filter(path => !['sw.js', 'offline-package.json'].includes(relative(dist, path))).map(path => ({
        url: base + relative(dist, path).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
        bytes: statSync(path).size,
      }));
      const config = { build, version, base, files };
      writeFileSync(resolve(dist, 'offline-package.json'), JSON.stringify(config, null, 2) + '\n');
      const template = readFileSync(resolve(root, 'scripts/service-worker.js'), 'utf8');
      writeFileSync(resolve(dist, 'sw.js'), template.replace('/* LAB_PACKAGE */', JSON.stringify(config)));
    },
  };
}
