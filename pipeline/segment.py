"""Step 1 of the pipeline: per-frame person mask, keep the main figure only. Saves masks + anchors."""
import sys, glob, json, time
import numpy as np, cv2
from PIL import Image
from rembg import new_session, remove

frames = sorted(glob.glob("work/frames/*.jpg"))
sess = new_session("u2netp")
anchors = []
t0 = time.time()
for i, f in enumerate(frames):
    im = Image.open(f).convert("RGB")
    m = np.array(remove(im, session=sess, only_mask=True))
    n, lab, stats, _ = cv2.connectedComponentsWithStats((m > 127).astype(np.uint8), 8)
    if n > 1:
        k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        keep = cv2.dilate((lab == k).astype(np.uint8), np.ones((5, 5), np.uint8))
        m = (m * keep).astype(np.uint8)
        x, y, w, h = (int(stats[k, c]) for c in (cv2.CC_STAT_LEFT, cv2.CC_STAT_TOP, cv2.CC_STAT_WIDTH, cv2.CC_STAT_HEIGHT))
        band = (lab[y + int(h * 0.86): y + h] == k)
        cols = np.where(band.any(0))[0]
        cx = float((cols.min() + cols.max()) / 2) if len(cols) else x + w / 2
        anchors.append(dict(x=x, y=y, w=w, h=h, cx=cx, bottom=y + h))
    else:
        anchors.append(None)
    cv2.imwrite(f.replace("frames", "out").replace(".jpg", "_m.png"), m)
    if i % 100 == 0:
        print(i, len(frames), f"{time.time()-t0:.0f}s", flush=True)
json.dump(anchors, open("work/anchors.json", "w"))
print("done", len(frames), f"{time.time()-t0:.0f}s", flush=True)
