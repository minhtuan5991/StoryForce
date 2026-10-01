import {ViewText,ViewTranslationScope,ViewTranslationToolbar,useVietnameseView} from './ViewTranslation';
import {sourceViewLanguage,splitTranslationText} from './translationEngine';

type SourceMaterial={id:string,title?:string,transcript?:string,summary?:string,notes?:string,tags?:string[],language?:string};

function SourcePreview({source,language}:{source:SourceMaterial,language:string}){
  if(!useVietnameseView())return null;
  const fields:[string,string][]=[['Tiêu đề',source.title||''],['Bản chép lời',source.transcript||''],['Tóm tắt',source.summary||''],['Ghi chú',source.notes||''],['Thẻ',(source.tags||[]).join(', ')]];
  return <div className="draft-view-translation" role="region" aria-label="Bản dịch tư liệu nguồn">
    <strong>Bản dịch Tiếng Việt · chỉ để xem</strong>
    {fields.filter(([,text])=>text.trim()).map(([label,text])=><div key={label} className="source-translation-field">
      <h3>{label}</h3><div className="narration-text">{splitTranslationText(text,language).map((part,i)=><span key={i} style={{display:'block'}}><ViewText text={part}/></span>)}</div>
    </div>)}
    <p className="muted">Nội dung gốc ở bên dưới vẫn dùng cho mọi công việc.</p>
  </div>;
}

export function SourceTranslation({source}:{source:SourceMaterial}){
  const language=sourceViewLanguage(source.transcript||source.summary||source.notes||source.title||'',source.language);
  return <ViewTranslationScope key={`${source.id}:${language}`} active sourceLanguage={language} originalLabel="Bản gốc">
    <ViewTranslationToolbar/><SourcePreview source={source} language={language}/>
  </ViewTranslationScope>;
}
