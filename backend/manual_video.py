"""Flow clips are user-created assets, never browser automation jobs."""

FLOW_MANUAL_NOTICE = ('Create Flow videos manually, then import scene_NNN.mp4 in Assets. '
                      'Images, thumbnails and audio remain automatic.')


def is_manual_video(item):
    return item.get('provider') == 'flow' or item.get('kind') == 'video_generation'
