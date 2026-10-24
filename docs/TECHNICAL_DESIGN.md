# Technical Design

## 1. Architecture principle

Use the smallest implementation that can reliably deliver the required output. This is a local utility, not a video-editing platform.

## 2. Proposed stack

- **UI:** React with JavaScript (not TypeScript).
- **Local API/process:** Node.js with a small Express server, unless a purely local script is demonstrably faster to implement.
- **Text-to-speech:** use a provider with suitable male- and female-sounding voices. A local or free option can be selected during implementation after checking availability and installation friction.
- **Rendering:** FFmpeg for final video composition and MP4 encoding. Use a generated frame sequence or a lightweight HTML/canvas renderer to create the typewriter overlay; avoid building a custom video engine.
- **Temporary files:** one per-generation temporary directory, removed after the final output is ready or when a failed generation is safely cleaned up.

The exact TTS provider is intentionally an implementation decision. Do not promise a voice ID before verifying it exists and works on the target machine.

## 3. Components

```text
React UI
  ├─ Image picker + preview
  ├─ Question textarea
  ├─ Answer textarea
  ├─ Generate status
  └─ Video preview + download
        |
        v
Node local API
  ├─ Validate image and text
  ├─ Create per-run workspace
  ├─ TTS: Question → male voice → question audio
  ├─ TTS: Answer → female voice → answer audio
  ├─ Read actual audio durations
  ├─ Render typewriter overlay timeline
  ├─ FFmpeg compose image + overlay + merged audio
  └─ Return local output URL/path
```

## 4. Rendering strategy

### V1 default: frame-based typewriter overlay + FFmpeg

1. Load the template image and determine its dimensions.
2. Create a canvas with the configured output dimensions. Keep the image aspect ratio unless a deliberate crop/pad option is selected.
3. Define fixed Question and Answer text boxes in a template configuration.
4. Generate each audio file separately.
5. Read the duration of each audio segment.
6. Use the audio duration to calculate a reveal progression. Render at a fixed frame rate (default 30 FPS), exposing progressively more text on each frame.
7. Make the Question overlay visible only during the Question segment. Clear it before/at the configured Answer start. Make the Answer overlay visible only during the Answer segment.
8. Combine the frames/overlay with the static background image and concatenated audio.
9. Encode an H.264 MP4 with AAC audio, or use other compatible codecs supported by the local FFmpeg build.

Avoid rendering all frames at once if a long answer would create a large memory footprint; stream frames or render to temporary images/video where practical.

### Timing

Let:
- `Q` = Question audio duration in seconds.
- `G` = configured gap (initially about 0.3–0.6 seconds).
- `A` = Answer audio duration in seconds.

Then:
- Question begins at `t = 0`.
- Answer begins at `t = Q + G`.
- Total duration is approximately `Q + G + A`.

For each segment, the text reveal fraction at local time `t` is initially:

```text
progress = clamp(t / segmentDuration, 0, 1)
visibleText = reveal(text, progress)
```

A uniform character reveal is the simplest baseline. If it looks unnatural, reveal words instead, add a brief pause for punctuation, and clamp to the audio segment end. Perfect word-level synchronization is explicitly out of scope for V1.

### Audio

- Generate `question.mp3` and `answer.mp3` independently.
- Normalize the audio format/sample rate as needed before concatenation.
- Use a short silence segment between tracks.
- Avoid mixing the two voice files concurrently.
- Final audio must contain Question (male), silence/gap, Answer (female), in that order.

## 5. Template configuration

Template layout is code/config for V1, not a UI editor.

Example only; replace coordinates and style after examining the actual template image:

```json
{
  "name": "first-template",
  "fps": 30,
  "gapSeconds": 0.45,
  "canvas": {
    "width": 720,
    "height": 1280,
    "fit": "contain"
  },
  "question": {
    "x": 48,
    "y": 250,
    "width": 624,
    "fontSize": 44,
    "fontFamily": "Arial",
    "fontWeight": 700,
    "color": "#FFFFFF",
    "lineHeight": 1.2,
    "alignment": "left"
  },
  "answer": {
    "x": 48,
    "y": 430,
    "width": 624,
    "fontSize": 36,
    "fontFamily": "Arial",
    "fontWeight": 500,
    "color": "#FFFFFF",
    "lineHeight": 1.25,
    "alignment": "left"
  }
}
```

These values are placeholders, not assumed measurements from the user's template. Match the actual image and its available empty areas.

## 6. Minimal API shape

A single generation endpoint is sufficient for V1. The implementation may use multipart form-data for the image and text fields.

Example conceptual endpoint:

```text
POST /api/generate
Inputs: image, question, answer
Success: { videoUrl: "/outputs/<id>.mp4" }
Failure: { error: "Human-readable explanation" }
```

A status endpoint, job queue, database, and persistent job model are unnecessary unless the chosen renderer requires asynchronous polling for a practical reason.

## 7. Suggested folder layout

```text
content-video-maker/
├── docs/
├── src/
│   ├── client/             # React UI
│   └── server/             # API and generation pipeline
├── templates/
│   └── first-template.json # fixed style/coordinates (optional)
├── temp/                   # ignored by Git
├── outputs/                # ignored by Git
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Adjust this to the existing repository once implementation starts. This folder layout is a suggestion, not a requirement to create every directory up front.

## 8. Operational and security notes

- Validate uploaded image MIME type and actual decodability, not only the filename extension.
- Limit file size and text length to sensible local MVP values.
- Use a safe temporary-file naming strategy; do not interpolate raw user input into shell commands.
- Spawn FFmpeg with argument arrays (not a shell command assembled from user text).
- If exposing an output over HTTP, serve only files inside the configured output directory.
- Ignore `temp/`, `outputs/`, uploaded media, generated audio, and secrets in Git.
- Store provider credentials in environment variables and document how to configure them.
- Surface stderr/log details for local debugging while showing a readable error in the UI.
