import {beforeEach,expect,test,vi} from 'vitest';

beforeEach(()=>vi.resetModules());

test('Chinese source text overrides default English metadata; paths and Vietnamese stay original',async()=>{
  const {sourceViewLanguage,shouldTranslate,splitTranslationText}=await import('./translationEngine');
  expect(sourceViewLanguage('今天的故事来自学校。一位同学发现了秘密。','English')).toBe('zh');
  expect(sourceViewLanguage('The keeper heard a knock.','English (US)')).toBe('en');
  expect(sourceViewLanguage('Nội dung tiếng Việt.','Vietnamese')).toBe('vi');
  expect(shouldTranslate('学校里的秘密。','zh')).toBe(true);
  expect(shouldTranslate('学校里的秘密。')).toBe(false);
  expect(shouldTranslate('scene_001.png','zh')).toBe(false);
  expect(shouldTranslate('https://example.com/学校','zh')).toBe(false);
  expect(shouldTranslate('Nội dung tiếng Việt.')).toBe(false);
  const story=('今天学校里的学生发现了一个秘密。\n').repeat(400);
  const chunks=splitTranslationText(story,'zh');
  expect(chunks.join('')).toBe(story);
  expect(chunks.every(chunk=>chunk.length<=1600)).toBe(true);
});

test('language pairs have separate translators and caches; cancelling prevents another request',async()=>{
  const calls:{language:string,text:string}[]=[];
  Object.defineProperty(globalThis,'Translator',{configurable:true,value:{create:async({sourceLanguage}:{sourceLanguage:string})=>({translate:async(text:string)=>{calls.push({language:sourceLanguage,text});return `${sourceLanguage}: ${text}`}})}});
  const {startViewTranslator,translateForView}=await import('./translationEngine');
  await startViewTranslator(()=>{});
  await startViewTranslator(()=>{},'zh');
  const text='A school 学校';
  const signal=new AbortController().signal;
  expect(await translateForView(text,signal)).toBe('en: '+text);
  expect(await translateForView(text,signal,'zh')).toBe('zh: '+text);
  expect(await translateForView(text,signal,'zh')).toBe('zh: '+text);
  expect(calls).toEqual([{language:'en',text},{language:'zh',text}]);
  const cancelled=new AbortController();cancelled.abort();
  await expect(translateForView('A different school',cancelled.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(calls).toHaveLength(2);
});
