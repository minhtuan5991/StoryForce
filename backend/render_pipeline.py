"""Small composition graphs and a watchdog that follows actual FFmpeg progress."""
from collections import Counter
from functools import lru_cache
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
import time


def monitored_process(args, log_path=None, cwd=None, on_progress=None, idle_timeout=900):
    # A long, advancing encode is allowed to finish. A stalled process is bounded.
    command = [args[0], '-progress', 'pipe:1', '-nostats', *args[1:]]
    events = queue.Queue()
    flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors,
                                   cwd=cwd, creationflags=flags)
        def read_progress():
            for line in process.stdout:
                events.put(line.decode('utf-8', errors='replace').strip())
            events.put(None)
        reader = threading.Thread(target=read_progress, daemon=True)
        reader.start()
        advanced = time.monotonic()
        frame, timestamp, notified = -1, -1, 0.0
        state, stalled = {}, False
        try:
            while True:
                try:
                    line = events.get(timeout=.1)
                except queue.Empty:
                    line = ''
                if line and '=' in line:
                    key, value = line.split('=', 1)
                    state[key] = value
                    if key in ('frame', 'out_time_us'):
                        try:
                            number = int(value)
                        except ValueError:
                            continue
                        previous = frame if key == 'frame' else timestamp
                        if number > previous:
                            advanced = time.monotonic()
                            if key == 'frame': frame = number
                            else: timestamp = number
                    if key == 'progress' and on_progress and time.monotonic()-notified >= 1:
                        on_progress(max(0, timestamp)/1_000_000, max(0, frame))
                        notified = time.monotonic()
                if process.poll() is not None and (line is None or events.empty()):
                    break
                if time.monotonic()-advanced > idle_timeout:
                    stalled = True
                    process.kill()
                    break
            process.wait()
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            reader.join(timeout=2)
            process.stdout.close()
            errors.seek(0, 2)
            size = errors.tell()
            errors.seek(max(0, size-80_000))
            stderr = errors.read().decode('utf-8', errors='replace')
            if log_path:
                with Path(log_path).open('a', encoding='utf-8') as log:
                    log.write(stderr+'\n')
        if stalled:
            raise ValueError(f'FFmpeg stopped advancing for {idle_timeout:g} seconds '
                             f'(last frame {max(0,frame)}, video time {max(0,timestamp)/1_000_000:.1f}s). '
                             'Previous completed video was preserved.')
        if process.returncode:
            raise ValueError(f'{Path(args[0]).name} failed: {stderr[-2200:]}')
        if on_progress: on_progress(max(0,timestamp)/1_000_000, max(0,frame))
        return subprocess.CompletedProcess(command, process.returncode, '', stderr)


def wave_key_color(binary, path, duration):
    path = Path(path)
    stat = path.stat()
    return _wave_key_color(str(binary), str(path), stat.st_mtime_ns, stat.st_size, float(duration or 0))


@lru_cache(maxsize=16)
def _wave_key_color(binary, path, modified, size, duration):
    # Sample three points: foreground movement must not choose the background color.
    pixels = []
    flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
    for offset in (0, duration*.33, duration*.66):
        result = subprocess.run([binary, '-v', 'error', '-threads', '1', '-ss', str(offset),
                                 '-noautorotate', '-i', path, '-vf', 'scale=160:90',
                                 '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
                                capture_output=True, timeout=30, creationflags=flags)
        if result.returncode:
            raise ValueError('Cannot sample waveform background: '+result.stderr.decode(errors='replace')[-500:])
        pixels.extend(tuple(result.stdout[i:i+3]) for i in range(0,len(result.stdout)-2,3))
    greens = [p for p in pixels if p[1] >= 60 and p[1] > p[0]*1.25 and p[1] > p[2]*1.15]
    if not pixels or len(greens) < len(pixels)*.15:
        raise ValueError('Waveform video has no clear green background. Choose a green-screen waveform video.')
    bins = Counter(tuple(v//8 for v in p) for p in greens)
    common = bins.most_common(1)[0][0]
    cluster = [p for p in greens if tuple(v//8 for v in p) == common]
    rgb = [round(sum(p[i] for p in cluster)/len(cluster)) for i in range(3)]
    return '0x'+''.join(f'{v:02X}' for v in rgb)


def compose_clips(clips, plan, folder, base, encode, notify, group_size=6):
    """Keep at most six decoders/transition inputs active, including long stories.

    Every intermediate carries its outgoing transition. All durations/offsets
    stay on the same frame grid, including transitions at group boundaries.
    """
    fps = plan['fps']
    nodes = [{'path': p, 'frames': s['clip_frames'],
              'transition': round(s['transition_after']*fps)} for p,s in zip(clips,plan['scenes'])]
    total, count = 0, len(nodes)
    while count > 1:
        total += count//group_size + int(count%group_size > 1)
        count = (count+group_size-1)//group_size
    created, done, level = set(), 0, 0
    while len(nodes) > 1:
        next_nodes = []
        for start in range(0,len(nodes),group_size):
            group = nodes[start:start+group_size]
            if len(group) == 1:
                next_nodes.append(group[0])
                continue
            args = list(base)
            for node in group: args += ['-threads','1','-i',str(node['path'])]
            graph = [f'[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[v{i}]' for i in range(len(group))]
            label, frames = 'v0', group[0]['frames']
            for i in range(1,len(group)):
                overlap = group[i-1]['transition']
                if overlap:
                    graph.append(f'[{label}][v{i}]xfade=transition=fade:duration={overlap/fps}:offset={(frames-overlap)/fps}[x{i}]')
                else:
                    graph.append(f'[{label}][v{i}]concat=n=2:v=1:a=0[x{i}]')
                frames += group[i]['frames']-overlap
                label = f'x{i}'
            # xfade promotes chroma to 4:4:4. Specify the conversion matrix;
            # otherwise an extra intermediate may silently change 709 colors.
            graph.append(f'[{label}]scale=in_range=tv:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,'
                         'format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[joined]')
            output = folder/f'join_{level}_{start//group_size:03}.mp4'
            encode(args+['-filter_complex_threads','2','-filter_complex',';'.join(graph),
                         '-map','[joined]','-an','-r',str(fps),'-frames:v',str(frames)],output)
            created.add(output)
            next_nodes.append({'path':output,'frames':frames,'transition':group[-1]['transition']})
            # Only remove intermediate files created here, after their consumer exits.
            for node in group:
                if node['path'] in created:
                    node['path'].unlink(missing_ok=True)
                    created.remove(node['path'])
            done += 1
            notify(78+int(7*done/max(1,total)),f'Joining scene groups {done}/{total}')
        nodes = next_nodes
        level += 1
    return nodes[0]['path'], done, created
