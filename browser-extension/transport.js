// A renderer can stop responding while its tab still looks fully loaded.
// Only use this deadline for reads: timing out must never retry a Send/Fill.
export function isTabEditBusy(error) {
  // Chromium rejects the operation before changing any tab while its tab strip
  // is being dragged/edited. Do not treat other rejected mutations as safe retries.
  return /Tabs cannot be edited right now(?:\s*\(user may be dragging a tab\))?/i.test(error?.message||String(error));
}

export async function withTabReadDeadline(read, timeoutMs=12000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Object.assign(
          new Error('Tab AI chưa phản hồi thao tác đọc. Đang kết nối lại để lấy kết quả.'),
          {code:'TAB_READ_TIMEOUT'})),timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
