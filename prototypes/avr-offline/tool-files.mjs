// Keep only the inputs this invocation can actually read. The verified SDK
// stays immutable. In particular, assembler/objcopy need no SDK at all.
export function toolFiles(name,args,sdk,projectFiles) {
  const files=new Map();
  if(name==='cc1'||name==='cc1plus') {
    // Nano's eightanaloginputs header includes ../standard/pins_arduino.h.
    const roots=['/sysroot/gcc-include/','/sysroot/avr/include/','/sysroot/arduino/cores/arduino/','/sysroot/arduino/variants/standard/'];
    for(const arg of args)if(arg.startsWith('-I/sysroot/'))roots.push(arg.slice(2)+'/');
    for(const [path,bytes] of sdk)if(roots.some(root=>path.startsWith(root)))files.set(path,bytes);
    for(const [path,bytes] of projectFiles)if(!path.startsWith('/sysroot/')&&/\.(?:ino|c|cpp|h|hpp)$/.test(path))files.set(path,bytes);
  } else if(name==='avr-ld') {
    const roots=args.filter(a=>a.startsWith('-L/sysroot/')).map(a=>a.slice(2)+'/');
    const archives=new Set(args.filter(a=>a.startsWith('-l')).map(a=>'lib'+a.slice(2)+'.a'));
    for(const [path,bytes] of sdk)if(args.includes(path)||roots.some(root=>path.startsWith(root)&&archives.has(path.slice(root.length))))files.set(path,bytes);
    for(const [path,bytes] of projectFiles)if(args.includes(path))files.set(path,bytes);
  } else if(name==='avr-as'||name==='objcopy') {
    for(const [path,bytes] of projectFiles)if(args.includes(path))files.set(path,bytes);
  } else throw Error('Nepoznat alat prevoditelja.');
  return files;
}
