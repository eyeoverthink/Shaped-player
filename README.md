# Shaped Player

A video player with no box around it: the video's edge follows the person, and everything outside that edge is the page underneath.

## What is here

- `step1/` plays one clip over text and images with no visible rectangle. The outline was made ahead of time and is stored inside the video file.
- `step2/` cuts the person out of any clip live in the browser. Choose your own file; it stays on your device.
- `step3/` is the embed: `shaped-player.js` plus a demo page. One script tag and one `<shaped-player>` tag put the figure on any page.
- `step4/` is the converter: choose any clip, and it saves a stacked clip the embed can play.
- `step5/` is the live webcam, cut out in real time.
- `step6/` is the studio: record yourself, cut out, over a color, pictures or your screen, and save the video.
- `pipeline/` holds the two scripts that made the step 1 clip from a phone recording.
- `index.html` is the showcase home page. It uses the embed itself and links to all six steps.

Steps 4, 5 and 6 load the model files from `step2/` and the embed from `step3/`, so keep the folders together.

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

## Using the embed (step 3)

Copy `step3/shaped-player.js` and a stacked clip to your site, then:

    <script src="shaped-player.js"></script>
    <shaped-player src="shaped.mp4" corner="bottom-right" width="320" movable controls></shaped-player>

| Attribute | What it does |
|---|---|
| `src` | The stacked clip (required). |
| `corner` | `bottom-right` (default), `bottom-left`, `top-right`, `top-left`, or `inline` to sit in the page where the tag is. |
| `width` | Pixels, or any CSS length. Default 320. |
| `movable` | Visitors can drag the figure. |
| `controls` | Shows a small sound button. |
| `label` | Description for screen readers. |

From script: `play()`, `pause()`, the `muted` property, and a `shapedready` event when the first frame is drawn. The clip starts muted, as browsers require for autoplay. The script is 12 KB and loads no other libraries.

The clip must be served from the same site as the page, or with CORS headers, because the browser has to read its pixels.

## Making a clip in the browser (step 4)

Open `step4/`, choose a video, and press Convert. The clip plays through once while the page records colour on top and the outline underneath into one file, then the result plays through the real embed so the outline can be checked before saving.

- It records in real time, so a 30 second clip takes 30 seconds, and the page must stay on screen.
- Smoothness depends on the device: the page reports the frames per second it managed.
- The file is MP4 where the browser can record MP4 (Safari, recent Chrome), otherwise WebM, which iPhones cannot play.

## Live webcam (step 5)

Open `step5/` and press Start camera. Browsers only allow the camera on https pages or on localhost, so use GitHub Pages or the local server above. Nothing is recorded or sent anywhere.

## Studio (step 6)

Open `step6/`, turn on the camera, pick a background, and press Start recording. The recording is a normal video file with you composited over the background, plus your microphone.

- Backgrounds: a color, a set of pictures you step through with the arrows, or (on computers) a shared screen or window.
- Video shape: tall for phones or wide for screens.
- Phones do not let web pages capture the screen, so on a phone use pictures. Recording the phone's own screen would need a native app.
- It needs https or localhost for the camera and microphone.
- It cannot appear as a camera inside Zoom or Meet by itself. To use it there, share the studio window, or load the page in OBS and use OBS's virtual camera.

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
3. Done: a shaped embed, one snippet that drops the figure onto any website.
4. Done: a converter that turns any clip into the stacked format in the browser.
5. Done: live webcam, cut out in real time.
6. Done: studio recorder with backgrounds, microphone and save.

Known limits: the browser outline (steps 2, 4, 5) is softer than the offline one in step 1, and the converter records in real time instead of frame by frame.

## License

MIT. See `LICENSE`.

## Third-party files

The `selfie_segmentation*` files in `step2/` are from the `@mediapipe/selfie_segmentation` npm package (version 0.1.1675465747), licensed Apache-2.0.
