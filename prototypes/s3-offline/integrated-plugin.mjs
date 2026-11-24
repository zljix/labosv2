import {readFileSync, mkdirSync, cpSync, copyFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
export function integratedS3Plugin(root, build, files) {
  return {name:'s3-offline-tools', apply:'build', writeBundle() {
    cpSync(join(root,'prototypes/s3-offline/notices'),join(root,'dist/notices/offline-s3'),{recursive:true});
    for (const {path} of files) {
      const to = join(root,'dist/app',build,'offline-s3',path);
      mkdirSync(dirname(to),{recursive:true});
      copyFileSync(join(root,'prototypes/s3-offline/release',path),to);
    }
  }};
}
export function toolManifest(root) {
  return readFileSync(join(root,'prototypes/s3-offline/release/tools.json'),'utf8');
}
