import {browserInput, validateArtifact} from '../../public/s3-contract.mjs';
import {sha256} from '../../public/avr-contract.mjs';
self.onmessage = async ({data: project}) => {
  try {
    const progress=message=>postMessage({progress:message});
    progress('Učitavanje S3 prevoditelja…');
    const input = browserInput(project);
    const {compileFiles} = await import('./compiler.mjs');
    const core = await (await fetch('./core.json')).json();
    const libraries = await Promise.all(input.toolchain.libraries.map(async lib => {
      const response = await fetch('./lib-'+lib.name+'.json');
      if (!response.ok) throw Error('Nedostaje biblioteka '+lib.name);
      const pack = await response.json();
      if (pack.digest !== lib.digest) throw Error('Neodgovarajuća verzija biblioteke '+lib.name);
      return {...pack,name:lib.name};
    }));
    const bytes = await compileFiles(input.files,core,libraries,progress);
    const artifact = {
      format:'esp32-lab-s3-build', version:3, boardId:input.boardId, boardProfile:input.boardProfile,
      fqbn:input.fqbn, toolchain:input.toolchain, inputHash:await sha256(JSON.stringify(input)),
      wasmHash:await sha256(bytes), wasmBytes:bytes.length, memoryBytes:2097152,
      wasm:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')), compiledAt:new Date().toISOString(),
      diagnostics:'', messages:[]
    };
    await validateArtifact(project,artifact);
    postMessage({artifact});
  } catch (error) { postMessage({error:String(error.message || error)}); }
};
