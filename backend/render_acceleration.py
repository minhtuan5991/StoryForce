"""Bounded render resources and hardware encoding with a tested CPU fallback."""
import os
import subprocess
from functools import lru_cache
from pathlib import Path
from .media import run_process
from .config import APP_ROOT, RESOURCE_ROOT


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


def render_binary(binary, settings):
    """Use the compatibility renderer only if it restores NVIDIA acceleration.

    Imports/probing keep the latest bundled FFmpeg. Explicit user paths and CPU
    mode are respected. No driver installation or external download at runtime.
    """
    if settings.get('render_encoder','auto') == 'cpu' or settings.get('ffmpeg_path'):
        return binary
    if choose_encoder(binary, settings) == 'h264_nvenc':
        return binary
    for root in (RESOURCE_ROOT, APP_ROOT):
        compatible = root/'tools/ffmpeg-compatible.exe'
        if compatible.is_file() and choose_encoder(str(compatible), settings) == 'h264_nvenc':
            return str(compatible)
    return binary


def cuda_compositing(binary):
    return _cuda_compositing(binary, Path(binary).stat().st_mtime_ns)


@lru_cache(maxsize=8)
def _cuda_compositing(binary, modified):
    try:
        output = run_process([binary,'-hide_banner','-filters'], timeout=15).stdout
        return all(name in output for name in ('scale_cuda', 'overlay_cuda', 'hwupload'))
    except (ValueError, subprocess.TimeoutExpired):
        return False


def video_encoding(encoder, intermediate=False):
    bitrate, maximum, buffer = ('12M','18M','24M') if intermediate else ('5M','7.5M','10M')
    args=['-c:v',encoder]
    if encoder == 'h264_nvenc':args+=['-preset','p4','-rc','vbr','-b:v',bitrate,'-maxrate',maximum,'-bufsize',buffer]
    elif encoder == 'h264_qsv':args+=['-preset','veryfast','-b:v',bitrate,'-maxrate',maximum,'-bufsize',buffer]
    else:
        args+=['-preset','ultrafast' if intermediate else 'veryfast','-crf','18' if intermediate else '20']
        if not intermediate:args+=['-maxrate',maximum,'-bufsize',buffer]
    if encoder == 'h264_nvenc' and intermediate:args+=['-forced-idr','1']
    return args+['-threads',str(cpu_threads())]
