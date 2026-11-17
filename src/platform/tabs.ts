import type {KeyboardEvent} from 'react';

/** Automatic tab activation; Tab leaves the list, arrows/Home/End stay in it. */
export function tabKeys(e:KeyboardEvent<HTMLElement>) {
 const tabs=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
 const index=tabs.indexOf(e.target as HTMLButtonElement);
 if(index<0)return;
 const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;
 if(next<0)return;
 e.preventDefault();tabs[next].focus();tabs[next].click();
}
