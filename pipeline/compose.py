"""Step 2 of the pipeline: steady the figure, then pack colour (top) + matte (bottom) into one H.264 file."""
import glob, json, subprocess, sys
import numpy as np, cv2

START, END = 62, 880          # drop the first second (figure cut off by the camera framing) and the last few glitched frames
frames = sorted(glob.glob("work/frames/*.jpg"))[START:END]
anch = json.load(open("work/anchors.json"))[START:END]
n = len(frames)
ok = [a for a in anch if a]
def series(key):
    v = np.array([a[key] if a else np.nan for a in anch], float)
    idx = np.arange(n); good = ~np.isnan(v)
    v = np.interp(idx, idx[good], v[good])
    med = np.array([np.median(v[max(0, i-7):i+8]) for i in range(n)])       # kill short mask glitches (up to ~7 frames)
    k = np.ones(7) / 7
    return np.convolve(np.pad(med, 3, mode="edge"), k, mode="valid")
cx, bottom = series("cx"), series("bottom")
maxw = np.percentile([a["w"] for a in ok], 99); maxh = np.percentile([a["h"] for a in ok], 99)
W = int(np.ceil((maxw * 1.16) / 16) * 16); H = int(np.ceil((maxh * 1.10) / 16) * 16)
print("figure max w,h:", maxw, maxh, "-> canvas", W, H, "frames", n, flush=True)
json.dump(dict(w=W, h=H, fps=30, frames=n), open("work/meta.json", "w"))

ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{2*H}", "-r", "30", "-i", "-",
    "-ss", f"{5 + START/30:.3f}", "-t", f"{n/30:.3f}", "-i", "src/clip.mov", "-map", "0:v", "-map", "1:a:0",
    "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-g", "30",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-c:a", "aac", "-b:a", "96k", "-ac", "1", "-shortest", "-movflags", "+faststart", sys.argv[1]], stdin=subprocess.PIPE)
for i, f in enumerate(frames):
    img = cv2.imread(f); m = cv2.imread(f.replace("frames", "out").replace(".jpg", "_m.png"), 0)
    m[int(round(bottom[i])):] = 0                                            # nothing below the shoulders line (stops leaks into the app UI under him)
    m = cv2.erode(m, np.ones((3, 3), np.uint8)); m = cv2.GaussianBlur(m, (5, 5), 0)
    x0 = int(round(cx[i] - W / 2)); y0 = int(round(bottom[i] - H))
    M = np.float32([[1, 0, -x0], [0, 1, -y0]])
    col = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    mat = cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    ff.stdin.write(np.vstack([col, cv2.cvtColor(mat, cv2.COLOR_GRAY2BGR)]).tobytes())
    if i in (5, 101, 505, 712):
        prev = (col.astype(float) * (mat[..., None] / 255.0) + np.array([90, 200, 0.0]) * (1 - mat[..., None] / 255.0)).astype(np.uint8)
        cv2.imwrite(f"work/prev_{i}.jpg", prev)
ff.stdin.close(); print("ffmpeg exit", ff.wait())
