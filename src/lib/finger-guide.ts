export type Finger = 'little' | 'ring' | 'middle' | 'index' | 'thumb';
export type Hand = 'left' | 'right';
const groups: [string, Hand, Finger][] = [['`1qaz','left','little'],['2wsx','left','ring'],['3edc','left','middle'],['45rtfgvb','left','index'],['67yuhjnm','right','index'],['8ik,','right','middle'],['9ol.','right','ring'],["0-=p[]\\;' /",'right','little']];
const shifted: Record<string,string> = Object.fromEntries([... '~!@#$%^&*()_+{}|:"<>?'].map((char,index) => [char, '`1234567890-=[]\\;\',./'[index]]));
export function fingerTarget(character?: string): {key:string;hand:Hand;finger:Finger;shift:Hand|null} | undefined {
 if (!character) return;
 if (character === ' ') return {key:'space',hand:'right',finger:'thumb',shift:null};
 if (character === '\n') return {key:'enter',hand:'right',finger:'little',shift:null};
 const key = shifted[character] ?? character.toLowerCase();
 const found = groups.find(([keys]) => keys.includes(key));
 if (!found) return;
 const [,hand,finger] = found;
 return {key,hand,finger,shift: shifted[character] || /[A-Z]/.test(character) ? hand === 'left' ? 'right' : 'left' : null};
}
