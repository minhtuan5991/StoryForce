// Poll quickly only while preparing ChatGPT/Gemini. Result collection and
// the other media providers keep their existing polling cadence.
export const AI_PAGE_SETTLE_MS=1000;

export function bridgePollDelay(text={},media={}) {
  const preparing=state=>state.jobId&&['opening','prepared'].includes(state.phase);
  if(preparing(text))return 500;
  if((!text.jobId||text.phase==='paused')&&media.provider==='gemini'&&preparing(media))return 500;
  return text.jobId||media.jobId?2000:5000;
}
