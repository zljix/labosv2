export const STUDENT_NAME_LIMIT=120;
export const CLASS_NAME_LIMIT=80;
// Match PHP's UTF-8 /./us character count (Unicode code points, not UTF-16
// units or grapheme clusters). A supplementary character counts once.
export const unicodeLength=(value:string)=>Array.from(value).length;
export const identityText=(value:unknown,limit:number)=>typeof value==='string'&&unicodeLength(value)<=limit;
