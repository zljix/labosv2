export default function LessonSteps({steps}:{steps:string[]}) {
  return <nav className="lesson-steps" aria-label="Koraci vježbe">{steps.map((label,i)=><button key={label} onClick={e=>{
    const target=e.currentTarget.closest('article')?.querySelector<HTMLElement>('[data-lesson-step="'+(i+1)+'"]');
    target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});
  }}>{i+1}. {label}</button>)}</nav>;
}
