# Testing and Acceptance

## Definition of Done

The one-day MVP is done when a user can select the real template image, enter Question and Answer text, generate a male-sounding Question voice and female-sounding Answer voice, and download a readable MP4 whose typewriter animations occur in the correct order while the corresponding audio plays.

## Manual test cases

### T-01 — Happy path
- Select the real template image.
- Enter a short Question and a 1–3 sentence Answer.
- Generate the video.
- Expected: generation succeeds; MP4 preview and download are available.

### T-02 — Voice separation and order
- Play the exported video from beginning to end.
- Expected: Question is read first by the configured male-sounding voice; Answer is read second by the configured female-sounding voice; there is no overlap.

### T-03 — Typewriter order
- Watch the exported video.
- Expected: Question text reveals progressively during Question audio. Answer text does not appear early. Answer text reveals progressively during Answer audio. The full text is visible by the end of each segment.

### T-04 — Text preservation
- Use punctuation, numbers, parentheses, and common technical terms.
- Expected: displayed text preserves the supplied wording and punctuation; audio text is not silently rewritten by the application.

### T-05 — Long Answer / wrapping
- Use an Answer long enough to wrap onto multiple lines.
- Expected: text wraps within the configured text box, remains readable, and does not go beyond the canvas. If the text cannot fit readably, validation or a clear warning is shown rather than silently clipping it.

### T-06 — Empty inputs
- Leave the image, Question, or Answer empty, one at a time.
- Expected: generation is blocked with a clear error for the missing field.

### T-07 — Unsupported/corrupt image
- Select an unsupported or unreadable image file.
- Expected: the application displays a useful validation error and does not start rendering.

### T-08 — TTS failure
- Simulate or cause one TTS generation to fail.
- Expected: app reports failure; no false success or broken final download is shown; temporary files are cleaned safely.

### T-09 — Render failure
- Simulate an unavailable FFmpeg executable or invalid render output.
- Expected: readable error is shown and diagnostic details are available in local logs.

### T-10 — Duration and playback
- Compare final video duration with Question audio + gap + Answer audio.
- Expected: duration is within approximately one frame or a small documented encoding tolerance; both speech segments play completely.

### T-11 — Layout/aspect ratio
- Use the actual supplied template.
- Expected: image does not stretch; Question and Answer appear in the intended regions; no unexpected crop, overlay, or clipped text.

### T-12 — Repeated generation
- Generate two videos in a row with different text.
- Expected: the second result does not use the first video's audio/text, filenames do not collide, and no stale preview is shown.

### T-13 — Output integrity
- Open the MP4 in a standard media player and inspect the first, middle, and final frames.
- Expected: video and audio both play; the exported video is not zero bytes; no unintended black/blank frames appear.

## Quick manual checklist

- [ ] Image loads and preview looks right.
- [ ] Question/Answer validation works.
- [ ] Question voice is the configured male voice.
- [ ] Answer voice is the configured female voice.
- [ ] Voices play in the correct sequence without overlap.
- [ ] Text animation timing roughly follows each audio segment.
- [ ] Wrapping is readable and text does not clip.
- [ ] MP4 preview works.
- [ ] Downloaded MP4 opens outside the app.
- [ ] Repeated generation works.
- [ ] No uploaded/generated media or secrets are accidentally committed.
