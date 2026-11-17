import {useEffect,useId,useRef,useState} from 'react';
import {unicodeLength} from '../project/identity';

export default function IdentityInput({value,limit,onChange,onValidityChange,required=false,autoComplete}:{value:string;limit:number;onChange:(value:string)=>void;onValidityChange?:(valid:boolean)=>void;required?:boolean;autoComplete?:string}) {
  const [draft,setDraft]=useState(value),id=useId(),input=useRef<HTMLInputElement>(null);
  useEffect(()=>{setDraft(value);const valid=unicodeLength(value)<=limit;input.current?.setCustomValidity(valid?'':`Dopušteno je do ${limit} znakova.`);onValidityChange?.(valid);},[value,limit,onValidityChange]);
  const invalid=unicodeLength(draft)>limit;
  return <><input ref={input} value={draft} required={required} autoComplete={autoComplete} aria-invalid={invalid||undefined} aria-describedby={invalid?id:undefined}
    onChange={e=>{const text=e.target.value;setDraft(text);const valid=unicodeLength(text)<=limit;e.target.setCustomValidity(valid?'':`Dopušteno je do ${limit} znakova.`);onValidityChange?.(valid);if(valid)onChange(text);}}/>
    {invalid&&<small id={id} role="alert">Dopušteno je do {limit} znakova. Skrati unos kako bi se spremio u radni list.</small>}</>;
}
