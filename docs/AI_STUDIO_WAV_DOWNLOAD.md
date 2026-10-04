# AI Studio narration downloads (3.1.19)

AI Studio can play speech using many small WAV/PCM packets. Its AUDIO element's blob URL is therefore not a reliable full-file download: an otherwise valid WAV can contain only 40 milliseconds. The provider's **Download** button assembles the full audio.

Browser Bridge 1.1.23 waits for the new result and a stable visible player duration, arms the existing download capture, then clicks **Download**. It saves the exact assembled output in the approved project folder, waits for Chrome to report completion, and only then submits that file for import. It never downloads the streaming preview directly. The content-script version follows the installed extension so an updated adapter is injected into existing provider tabs after Reload.

The observed AI Studio download uses Google's sandbox message with `blob,filename` and the known pure-download code. Its complete WAV Blob has an empty MIME type. Capture accepts that exact message and `Generated Audio … .wav` filename, supplies `audio/wav` without changing the bytes, and acknowledges the sandbox without starting a second download. Other messages and filenames are left alone. If a provider uses a base64 data URL, capture converts those exact bytes into a page-owned blob URL so a multi-minute PCM file cannot exceed the extension's storage quota.

After playback, the AUDIO source can contain the full base64 WAV. The next scene's persisted baseline uses a compact, cached content identity, and AI Studio result/download messages omit the preview URL. The WAV bytes stay in the page; they are not copied into Bridge's durable state. The original baseline still prevents collecting an older result, while the authorized job and unchanged narration editor identify the current result after playback packet URLs change.

Before assigning narration or advancing to the next scene, the app checks the actual file with ffprobe. If the visible AI Studio total-time counter is available, the measured duration must agree within two seconds or two percent, whichever is larger, allowing rounded counters. Independently, a conservative maximum of 600 spoken words per minute rejects obvious streaming fragments without forcing the voice to match the estimated WPM. Short outro clips remain valid.

An incomplete file pauses the queue. **Tiếp tục tải tài nguyên** downloads the same generated output again without another Run. Starting another narration batch skips valid assigned audio and includes assigned clips that are implausibly short. Existing files are retained during this check.

The fix does not change Enzo/Friendly, narration text, image/video count confirmation, scene timing rules, rendering settings, or other providers. Replacing damaged audio still requires syncing the timeline to the actual, complete narration before rendering.
