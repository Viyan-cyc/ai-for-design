// Maintenance: preserve native CSS; regenerate selector compatibility and token names.
import fs from 'node:fs';
import path from 'node:path';
import {optionsOf,packageAt,compilerRequire,scripts} from './native-tools.mjs';
import {nativeStyles,writeTokenCatalog} from './native-styles.mjs';
try{
 const options=optionsOf();if(!options.project)throw new Error('Usage: gen-tokens.mjs --project <installed internal project>');
 const pkg=packageAt(options.project,'@hw-seq/sweet-ui-base');if(pkg.info.version!=='5.7.0')throw new Error('Expected page SweetUI 5.7.0');
 const result=nativeStyles({entry:path.join(pkg.dir,'theme-chalk/sweet/index.css'),postcss:compilerRequire()('postcss')});
 fs.writeFileSync(path.join(scripts,'preview/src/assets/themes/native-compat.css'),result.css);
 fs.writeFileSync(path.join(scripts,'verify/whitelists/sweetui-tokens.json'),JSON.stringify(result.tokens,null,2)+'\n');
 writeTokenCatalog(path.join(scripts,'../references/token-catalog.md'),result.tokens,result.values);
 console.log('RESULT: OK\nTOKENS: '+result.tokens.length+'\nNative CSS values preserved. Re-prepare runtime if the package changed.');
}catch(e){console.log('RESULT: FAIL | '+e.message);process.exitCode=1;}
