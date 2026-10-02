# Render performance validation — 3.1.13

Local measurements on 2026-10-03. Baseline: 3.1.12, commit `e0eda6c`.

## Fixture and machine

- Intel Core i5-12450HX, 12 logical processors; RTX 3050 Laptop 6 GB; NVIDIA driver 581.86.
- 30-second narration, eight textured stills and two native 2-second video scenes at 12s/24s. Existing image pan/zoom and 0.4-second transitions retained.
- Native 1920×1080 green-screen waveform, 1.1-second cycle, looped throughout. Transparent native-size logo above waveform. Subtitles disabled in this performance fixture.
- Delivery: 1920×1080, 30 fps, H.264 VBR target 5 Mbps, maximum 7.5 Mbps, AAC 160 kbps. Same source files and settings before/after.
- The baseline selected Quick Sync because its newer FFmpeg required a newer NVENC driver API. The optimized renderer restored working NVENC using the separately bundled, checksum-pinned FFmpeg 7.1.1. The driver was unchanged.

## Measurements

| Render attempt | 3.1.12 | 3.1.13 | Time reduction |
| --- | ---: | ---: | ---: |
| First render, no prepared scene cache | 48.39s | 20.38s | 57.9% |
| Rerender, same resources | 40.67s | 4.00s | 90.2% |

The optimized first attempt prepared ten scenes, composed three bounded groups, and used CUDA for overlays. The second attempt reused ten scenes, narration, audio mix, the complete timeline and the keyed waveform. Final composition/encoding still ran: approximately 3.7 seconds. Codec probing is cached in the process.

These are controlled fixture measurements, not promised speedups for every machine or a one-hour project. CPU-only systems, subtitles, different media complexity, cold driver initialization, storage speed and background applications affect elapsed time.

## Output and recovery checks

- Both optimized attempts passed all technical QA checks: video/audio duration, 1920×1080 canvas, 30 fps, stream presence and full scene coverage.
- Eleven sampled frames across both video anchors, transitions and the ending retained background content, keyed waveform placement and logo precedence.
- Full-sequence SSIM against the baseline: **0.998257**. Audio contained the same 2,880,000 stereo PCM samples; decoded audio RMS difference was 3.47 on a signed 16-bit scale. AAC encoders can produce different compressed bytes.
- Regression tests cover native video durations/anchors, image timing, image motion, ending coverage, burned-in/embedded captions, overlay pixels/colors, waveform looping, bounded 48-scene composition, CPU fallback, and corrupt-cache recovery.
- Changing only branding/text reuses the timeline and narration. Audio gain changes invalidate the mix; changed narration/media/timing invalidate dependent stages. Obsolete marked caches are pruned only after successful QA; previous completed videos and original uploads remain intact.

## Implementation notes

CUDA decodes the normalized H.264 timeline and composites alpha overlays. The waveform is keyed once using the existing chromakey parameters and cached losslessly with original dimensions/cadence. A static PNG is decoded once and repeated by the overlay filter.

The compatible driver exposes an H.264 coded surface padded to 1088 rows. The final graph downloads once and crops only unused padding to the existing output canvas before encoding, preserving native overlay position and size. GPU failure retries portable filters with the selected encoder, then CPU encoding if necessary. Captions retain the existing CPU/libass path.

Compatible cuts are joined without re-encoding; transitions retain the existing bounded graph and frame-grid timing. NVIDIA encodes intermediate groups; Quick Sync retains its tested CPU join workaround to prevent chroma shifts. Audio processing and waveform decoding/keying keep the latest main FFmpeg. If the compatibility renderer cannot decode a source format, the main FFmpeg prepares it with CPU encoding before the following GPU stages.

No application settings, provider/Bridge workflows, CapCut export or publication behavior changed. This build is local and has not been published to GitHub.
