import {useEffect,useRef,type ReactNode} from 'react';

export default function ActionGroup({title,children}:{title:string;children:ReactNode}) {
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const outside=(e:PointerEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))ref.current.open=false;};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[]);
 return <details ref={ref} className="action-group" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}
  onClick={e=>{if((e.target as Element).closest('button')){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}>
  <summary>{title}</summary><div className="action-group-items">{children}</div>
 </details>;
}
