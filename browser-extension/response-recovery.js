export const OUTPUT_REASONS=['INVALID_JSON','OUTPUT_CONTRACT','RETENTION_EVIDENCE','THUMBNAIL_CONTRACT'];

// Account/service failures are not malformed replies. Do not consume recovery
// turns by asking a provider to reformat its quota or sign-in notice.
export function responseObstacle(text='') {
  if(text.length>2000)return false;
  return /^(?:you(?:'|’)?ve (?:hit|reached) (?:the |your )?.*limit|too many requests|rate limit exceeded|sign in to continue|please (?:log|sign) in|bạn đã (?:đạt|hết) .*giới hạn)/i.test(text.trim());
}
