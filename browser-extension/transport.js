// A renderer can stop responding while its tab still looks fully loaded.
// Only use this deadline for reads: timing out must never retry a Send/Fill.
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
