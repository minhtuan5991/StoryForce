// Canonical provider URLs contain no account/query data or transient clip route.
export function providerPage(provider,value){
  try{
    const u=new URL(value),hosts={gemini:['gemini.google.com'],aistudio:['aistudio.google.com'],flow:['flow.google.com','labs.google']}[provider];
    if(u.protocol!=='https:'||!hosts?.includes(u.hostname)||u.username||u.password||u.port)return;
    let path=u.pathname.replace(/\/$/,'')||'/';
    if(provider==='flow'){
      const match=path.match(/\/projects?\/[^/]+/);if(!match)return;
      path=path.slice(0,match.index+match[0].length);
    }
    if(provider==='gemini'&&!/\/app\/[\w-]+$/.test(path))return;
    if(provider==='aistudio'&&['/','/app'].includes(path))return;
    return u.origin+path;
  }catch{}
}
export const projectSessionKey=job=>(job.media?.project_id||job.project_id||'legacy:'+job.media.folder)+':'+job.provider;
