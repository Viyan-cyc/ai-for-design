import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

/** Only map-enabled projects resolve these optional dependencies. */
export async function mapRenderer(root){
 if(!existsSync(join(root,'src/3d/map/create-map-scene.ts')))return [];
 const require=createRequire(join(root,'package.json'));
 const adapter=await import(pathToFileURL(require.resolve('@a3d/a3d-components/map-adapter')).href);
 const source=readFileSync(require.resolve('maplibre-gl/dist/maplibre-gl-dev.js'),'utf8');
 const patched=adapter.patchMapLibre(source)
  // Blob previews can be sandboxed and cannot read their parent's Location.
  .replace("(window.location.protocol === 'blob:' ? window.parent : window).location.href",
   "(document.URL.startsWith('blob:') ? document.referrer : document.URL)")
  .replace(/^\/\/# sourceMappingURL=.*$/gm,'');
 const digest=createHash('sha256').update(patched).digest('hex').slice(0,16);
 const folder=join(root,'.cache/map-renderer');mkdirSync(folder,{recursive:true});
 const file=join(folder,'maplibre-heat-'+digest+'.cjs');
 if(!existsSync(file)||readFileSync(file,'utf8')!==patched)writeFileSync(file,patched);
 return [{find:/^maplibre-gl$/,replacement:file}];
}
