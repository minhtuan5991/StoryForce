"""Bounded render resources and hardware encoding with a tested CPU fallback."""
import os
import subprocess
from functools import lru_cache
from pathlib import Path
from .media import run_process


def cpu_threads():
    return max(2,min(8,(os.cpu_count() or 4)-2))


@lru_cache(maxsize=8)
def detect_encoder(binary, modified):
    # Listing an encoder does not prove that this machine's driver supports it.
    for encoder in ('h264_nvenc','h264_qsv'):
        try:
            run_process([binary,'-hide_banner','-v','error','-f','lavfi','-i','color=size=320x180:rate=30',
                         '-frames:v','3','-an','-c:v',encoder,'-f','null','-'],timeout=12)
            return encoder
        except (ValueError,subprocess.TimeoutExpired):
            continue
    return 'libx264'


def choose_encoder(binary, settings):
    if settings.get('render_encoder','auto') == 'cpu':return 'libx264'
    return detect_encoder(binary,Path(binary).stat().st_mtime_ns)


def video_encoding(encoder, intermediate=False):
    bitrate, maximum, buffer = ('12M','18M','24M') if intermediate else ('5M','7.5M','10M')
    args=['-c:v',encoder]
    if encoder == 'h264_nvenc':args+=['-preset','p4','-rc','vbr','-b:v',bitrate,'-maxrate',maximum,'-bufsize',buffer]
    elif encoder == 'h264_qsv':args+=['-preset','veryfast','-b:v',bitrate,'-maxrate',maximum,'-bufsize',buffer]
    else:
        args+=['-preset','ultrafast' if intermediate else 'veryfast','-crf','18' if intermediate else '20']
        if not intermediate:args+=['-maxrate',maximum,'-bufsize',buffer]
    return args+['-threads',str(cpu_threads())]
