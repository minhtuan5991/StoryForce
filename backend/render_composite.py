"""Equivalent delivery graphs with GPU frames or the portable CPU path."""


def delivery_graph(base, joined, audio, options, wave, logo, *, cuda=False, width=1920, height=1080):
    args = list(base)
    if cuda:
        args += ['-init_hw_device', 'cuda=render:0', '-filter_hw_device', 'render',
                 '-hwaccel', 'cuda', '-hwaccel_device', 'render', '-hwaccel_output_format', 'cuda']
    args += ['-i', str(joined), '-i', str(audio)]
    if options['subtitles']:
        args += ['-i', 'captions.srt']
    next_input = 2 + int(options['subtitles'])
    if wave:
        wave_index = next_input
        next_input += 1
        args += ['-stream_loop', '-1', '-noautorotate', '-protocol_whitelist', 'file,pipe', '-i', str(wave)]
    if logo:
        logo_index = next_input
        # Decode a static PNG once. Overlay repeats that frame for the whole
        # timeline; looping the image decoder wastes work and can reset CUDA.
        args += ['-i', str(logo)]
    graph = ['[0:v]settb=AVTB,setpts=PTS-STARTPTS' +
             (',scale_cuda=format=yuv420p' if cuda else '') + '[v0]']
    previous = 'v0'
    if options['subtitles']:
        graph.append(f"[{previous}]subtitles=filename=captions.srt:force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=24'[captioned]")
        previous = 'captioned'
    overlay = 'overlay_cuda' if cuda else 'overlay'
    color = 'setparams=range=limited:colorspace=bt709:color_primaries=bt709:color_trc=bt709'
    upload = f',{color},hwupload' if cuda else ''
    if wave:
        # Green has already been keyed once into a lossless, native-size cycle.
        # Its own audio is excluded and its original frame cadence is retained.
        graph.append(f'[{wave_index}:v]setpts=PTS-STARTPTS,format=yuva420p{upload}[wave]')
        graph.append(f'[{previous}][wave]{overlay}=x=0:y=0:shortest=1[waved]')
        previous = 'waved'
    if logo:
        convert = 'scale=out_range=tv:out_color_matrix=bt709,format=yuva420p' if cuda else 'format=rgba'
        graph.append(f'[{logo_index}:v]{convert}{upload}[logo]')
        graph.append(f'[{previous}][logo]{overlay}=x=0:y=0:eof_action=repeat:repeatlast=1[branded]')
        previous = 'branded'
    if cuda:
        # Some compatible drivers expose the decoder's padded coded surface
        # (1088 rows for a 1080 video) to NVENC after overlay. Download once and
        # crop only the unused padding before encoding; never resize the logo,
        # waveform or visible scene pixels. All overlays above run on CUDA.
        graph.append(f'[{previous}]hwdownload,format=yuv420p,crop={width}:{height}:0:0[delivery]')
        previous = 'delivery'
    subtitle_args = ['-map', '2:s', '-c:s', 'mov_text', '-disposition:s:0', '0',
                     '-metadata:s:s:0', 'language=eng'] if options['subtitles'] else []
    args += ['-filter_complex_threads', '1' if cuda else '4', '-filter_complex', ';'.join(graph),
             '-map', f'[{previous}]', '-map', '1:a', *subtitle_args]
    return args + ['-pix_fmt', 'yuv420p']
