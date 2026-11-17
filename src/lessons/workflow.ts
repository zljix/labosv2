import {forkProject,type Project} from '../project/model';
import {readSchoolBinding,SCHOOL_BINDING_FILE} from '../platform/schoolSync';

export const investigationAdvice='Istraživački pokus radi u zasebnoj kopiji projekta. Prije promjene zapiši što očekuješ i zašto; mijenjaj jednu veličinu, usporedi rezultat s predviđanjem i nakon pogreške pokaži oporavak.';
export const schoolInvestigationAdvice='Za školske bodove vrijedi objavljena rubrika uz pokušaj. Promjena teksta, koordinata ili pragova u istraživačkoj kopiji nije novi uvjet bodovanja. Osnovni školski rad zadrži s uvjetima objavljene rubrike.';
export function finishAdvice(p:Project):string {
 return readSchoolBinding(p)
  ? 'Školska predaja: u panelu Spremanje školskog rada provjeri potvrđenu reviziju i službeni rezultat za tu reviziju. Odaberi Završi i zaključaj vježbu, pregledaj sažetak i potvrdi zaključavanje. ZIP je dodatna kopija; njegovo preuzimanje ne zaključava školsku predaju.'
  : 'Lokalna predaja: preuzmi ZIP, ponovno ga uvezi kao kopiju i provjeri kod, sklop i odgovore. ZIP sam predaj nastavniku dogovorenim putem. Lokalno spremanje čuva rad samo u ovom pregledniku.';
}

export function investigationProject(p:Project):Project {
 const copy=forkProject(p,' — istraživanje');
 delete copy.files[SCHOOL_BINDING_FILE];
 return copy;
}
