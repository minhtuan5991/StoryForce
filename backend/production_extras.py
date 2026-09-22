from pathlib import Path
import os
import textwrap
from .intelligence import words


def outro_chunk(number, voice, language, wpm, previous):
    vietnamese = str(language).lower().startswith(('vi', 'tiếng việt', 'vietnamese'))
    text = ('Cảm ơn bạn đã lắng nghe câu chuyện. Nếu bạn yêu thích video này, một lượt thích và đăng ký kênh sẽ là sự động viên rất quý giá. Hẹn gặp bạn trong câu chuyện tiếp theo.' if vietnamese else
            'Thank you for spending this time with us. If you enjoyed the story, a like or a subscription would mean a great deal. We hope to see you again for the next story.')
    return dict(number=number,text=text,word_count=len(words(text)),estimated_duration=round(len(words(text))*60/wpm+2,3),
                previous_context=previous[-400:],next_context='End of video.',mood='Warm, grateful, understated',
                voice_profile={**voice,'segment_role':'outro'},reasons=['Closing thanks and gentle invitation'])


def tts_scene_context(chunk, project, channel, scenes, start):
    voice=chunk.get('voice_profile') or {}
    related=[s for s in scenes if s['end_word']>start and s['start_word']<start+chunk['word_count']]
    context='\n'.join(f"Scene {s['number']}: {s.get('text','')[:250]}\nSetting: {s.get('continuity',{}).get('location','')}" for s in related)
    if voice.get('segment_role')=='outro':
        context='The story has ended. Address the audience with quiet warmth and gratitude. Invite, never pressure. Pause briefly before the closing thanks.'
    return (f"Narration for {project['title']}, segment {chunk['number']}.\n"
            f"One consistent narrator. Language: {channel.get('language','English')}. Voice: {voice.get('voice_name','Kore')}. "
            f"Delivery: {voice.get('style','Warm, natural')}. Mood: {chunk.get('mood','Measured')}. "
            f"Aim for approximately {project['wpm']} words per minute, natural pauses and clear articulation.\n"
            f"{context or 'Narrative moment: '+chunk['text'][:400]}\n"
            "Read only the transcript in the speech block. Do not read these directions or add dialogue, music or sound effects.")


def thumbnail_prompt(project, scenes):
    title=project.get('publish',{}).get('title') or project['title']
    subject=project.get('publish',{}).get('thumbnail_concept') or (scenes[0]['prompt'] if scenes else project.get('draft','')[:600])
    return (f'Create a 16:9 YouTube thumbnail for this story. Exact headline: "{title}". '
            'Make the title very large, bold, high contrast and readable at small size. '
            'Use at most two focal elements: the headline and one story-related subject. '
            'Minimal background, no collage, no small text, no extra captions, no watermark. '
            'Place headline on the left and the subject on the right, with generous safe margins. '
            f'Story-specific visual direction (reference data): {subject}')


def compose_thumbnail(source:Path, output:Path, title:str):
    from PIL import Image, ImageOps, ImageDraw, ImageFont
    font_candidates=[Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/'arialbd.ttf',
                     Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')]
    font_path=next((p for p in font_candidates if p.is_file()),None)
    if not font_path:raise ValueError('A TrueType font is required for the thumbnail title')
    with Image.open(source) as original:
        picture=ImageOps.fit(ImageOps.exif_transpose(original).convert('RGB'),(1280,720))
    overlay=Image.new('RGBA',picture.size)
    pixels=ImageDraw.Draw(overlay)
    for x in range(1280):
        alpha=235 if x<480 else max(20,235-int((x-480)*.4))
        pixels.line((x,0,x,720),fill=(5,12,22,alpha))
    picture=Image.alpha_composite(picture.convert('RGBA'),overlay)
    draw=ImageDraw.Draw(picture)
    title=' '.join(title.split())
    if not title:raise ValueError('Video title is required')
    for size in range(110,27,-2):
        font=ImageFont.truetype(str(font_path),size)
        lines=[];line=''
        for word in title.split():
            candidate=(line+' '+word).strip()
            if line and draw.textlength(candidate,font=font)>720:lines.append(line);line=word
            else:line=candidate
        if line:lines.append(line)
        if len(lines)<=5 and all(draw.textlength(line,font=font)<=740 for line in lines) and len(lines)*size*1.15<=540:break
    else:raise ValueError('Shorten the video title so it remains legible on the thumbnail')
    y=(720-len(lines)*size*1.15)/2
    draw.rounded_rectangle((55,y-24,65,y+len(lines)*size*1.15+12),radius=4,fill='#ffc95b')
    for index,line in enumerate(lines):
        draw.text((88,y),line,font=font,fill='#ffc95b' if index==0 else '#ffffff',stroke_width=2,stroke_fill='#08101e')
        y+=size*1.15
    output.parent.mkdir(parents=True,exist_ok=True)
    picture.convert('RGB').save(output,'JPEG',quality=94)
