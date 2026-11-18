# Shaped Player

A video player with no box around it: the video's edge follows the person, and everything outside that edge is the page underneath.

## What is here

- `step1/` plays one clip over text and images with no visible rectangle. The outline was made ahead of time and is stored inside the video file.
- `step2/` cuts the person out of any clip live in the browser. Choose your own file; it stays on your device.
- `pipeline/` holds the two scripts that made the step 1 clip from a phone recording.
- `index.html` links to both steps.

## Run it

The pages must be served over http, not opened as files:

    python3 -m http.server 8000

Then open http://localhost:8000/. GitHub Pages also works: Settings, Pages, deploy from the main branch root.

## How step 1 works

`step1/shaped.mp4` is an ordinary H.264 file with two pictures stacked in each frame: colour on top, a black and white outline of the figure underneath. A small WebGL shader reads both halves and uses the outline as the alpha channel. This plays on iPhone, Android and desktop, where transparent WebM does not play on iPhone.

Touches are tested against the outline, so only the figure can be dragged and clicks beside it reach the page.

## How step 2 works

A person-segmentation model (MediaPipe Selfie Segmentation) runs on the page and returns a mask for each video frame, which is used to draw only the person. The outline is softer than step 1 because it is made in real time.

Two of the model's binary files are stored as base64 text (`*_binarypb.txt`, `*_tflite.txt`) and unpacked by a small fetch shim in `step2/index.html`, so the page also runs on hosts that only serve common file types.

## Rebuilding the step 1 clip

    pip install "rembg[cpu]" opencv-python-headless numpy pillow
    mkdir -p work/frames work/out src            # put the recording at src/clip.mov
    ffmpeg -ss 5 -t 29.6 -i src/clip.mov -vf "crop=1080:860:0:80,scale=720:-2" -q:v 2 work/frames/%05d.jpg
    python3 pipeline/segment.py                  # mask for every frame
    python3 pipeline/compose.py step1/shaped.mp4 # steady the figure, pack colour + outline

The crop and trim values in those commands and in `compose.py` are specific to the original recording.

## Build order

1. Done: one clip with no visible rectangle.
2. Done: background removal inside the browser.
3. Next: a shaped embed, one snippet that drops the figure onto any website.
4. Then: live webcam, cut out in real time.

## Third-party files

The `selfie_segmentation*` files in `step2/` are from the `@mediapipe/selfie_segmentation` npm package (version 0.1.1675465747), licensed Apache-2.0.
