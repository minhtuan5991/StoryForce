// Runs in the provider's MAIN world for one Bridge-owned Upload click. Flow
// can create a detached file input, so a DOM query cannot reach that chooser.
// Feed only the already-approved local image bytes; never open/read OS paths.
export function uploadFlowReferences(ticket, files) {
  if(!['flow.google.com','labs.google'].includes(location.hostname)||!/\/projects?\/[^/]+/.test(location.pathname))
    throw new Error('Không đúng dự án Google Flow để tải ảnh tham chiếu');
  if(!/^[a-f0-9-]{36}$/.test(ticket)||!Array.isArray(files)||!files.length||files.length>3||
    files.some(file=>!/^sf_ref_[a-f0-9]{16}\.jpg$/.test(file.name)||file.mime!=='image/jpeg'||
      typeof file.data!=='string'||!file.data.length||file.data.length>16*1024*1024))
    throw new Error('Ảnh tham chiếu hoặc lượt tải không hợp lệ');
  const saved=globalThis.storyForgeReferenceUploads||=Object.create(null);
  const signature=files.map(file=>file.name).join('|');
  if(saved[ticket]){
    if(saved[ticket].signature!==signature)throw new Error('Ảnh của lượt tải tham chiếu đã thay đổi');
    return saved[ticket].result;
  }
  const targets=[...document.querySelectorAll('[data-storyforge-reference-upload]')]
    .filter(element=>element.getAttribute('data-storyforge-reference-upload')===ticket);
  if(targets.length!==1)throw new Error('Nút tải ảnh Flow đã thay đổi; chưa gửi ảnh');
  const target=targets[0],dialog=target.closest('[role="dialog"]');
  if(!dialog||!target.matches('button,[role="button"],[role="menuitem"]')||!target.getClientRects().length||
    target.disabled||target.getAttribute('aria-disabled')==='true'||target.closest('[inert],[aria-hidden="true"]'))
    throw new Error('Nút tải ảnh Flow chưa sẵn sàng');
  const images=files.map(file=>new File([Uint8Array.from(atob(file.data),c=>c.charCodeAt(0))],file.name,{type:file.mime}));
  const proto=HTMLInputElement.prototype,originalClick=Object.getOwnPropertyDescriptor(proto,'click')||
    Object.getOwnPropertyDescriptor(HTMLElement.prototype,'click');
  const ownClick=Object.getOwnPropertyDescriptor(proto,'click');
  const showPicker=Object.getOwnPropertyDescriptor(proto,'showPicker');
  const openPicker=Object.getOwnPropertyDescriptor(globalThis,'showOpenFilePicker');
  const fileSetter=Object.getOwnPropertyDescriptor(proto,'files').set;
  const before=new Set(document.querySelectorAll('input[type="file"]'));
  let active=false,result;
  const acceptsImages=input=>!input.accept||/image|\.jpe?g|\.png|\*/i.test(input.accept);
  function choose(input){
    if(result)throw new Error('Flow mở nhiều ô chọn tệp; chưa tải thêm ảnh');
    if(input.disabled||!acceptsImages(input))throw new Error('Ô tải Flow không nhận ảnh tham chiếu');
    const selected=input.multiple?images:images.slice(0,1),transfer=new DataTransfer();
    selected.forEach(file=>transfer.items.add(file));fileSetter.call(input,transfer.files);
    result={ticket,names:selected.map(file=>file.name),mode:input.isConnected?'file-input':'detached-file-input'};
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function chooser(original){return function(...args){
    if(active&&this.type==='file'){choose(this);return}
    return original.apply(this,args);
  }}
  try {
    Object.defineProperty(proto,'click',{configurable:true,writable:true,value:chooser(originalClick.value)});
    if(showPicker?.value)Object.defineProperty(proto,'showPicker',{...showPicker,value:chooser(showPicker.value)});
    if(typeof globalThis.showOpenFilePicker==='function')Object.defineProperty(globalThis,'showOpenFilePicker',{
      configurable:true,writable:true,value:function(options={}){
        if(!active)return openPicker.value.call(this,options);
        if(result||options.mode&&options.mode!=='read')throw new Error('Flow mở ô chọn tệp không phù hợp');
        const types=options.types||[];
        if(types.length&&!types.some(type=>Object.keys(type.accept||{}).some(mime=>/image|\*/i.test(mime))))
          throw new Error('Ô tải Flow không nhận ảnh tham chiếu');
        const selected=options.multiple?images:images.slice(0,1);
        result={ticket,names:selected.map(file=>file.name),mode:'file-picker'};
        // In-memory read-only handles for these explicit files. No permission
        // grant or access to the user's filesystem is created.
        return Promise.resolve(selected.map(file=>({kind:'file',name:file.name,getFile:async()=>file})));
      }});
    active=true;target.click();active=false;
    if(!result){
      // Also handle providers that mount an input but leave it to the caller,
      // including existing layouts supported by the content adapter.
      const created=[...dialog.querySelectorAll('input[type="file"]')].filter(input=>!before.has(input)&&!input.disabled&&acceptsImages(input));
      if(created.length===1)choose(created[0]);
    }
    if(!result)throw new Error('Flow chưa mở ô chọn ảnh được hỗ trợ. Reload Bridge rồi thử lại scene; chưa gửi prompt tạo video.');
    saved[ticket]={signature,result};
    Object.keys(saved).slice(0,-32).forEach(key=>delete saved[key]);
    return result;
  } finally {
    active=false;
    if(ownClick)Object.defineProperty(proto,'click',ownClick);else delete proto.click;
    if(showPicker)Object.defineProperty(proto,'showPicker',showPicker);
    if(openPicker)Object.defineProperty(globalThis,'showOpenFilePicker',openPicker);
    else delete globalThis.showOpenFilePicker;
    target.removeAttribute('data-storyforge-reference-upload');
  }
}
