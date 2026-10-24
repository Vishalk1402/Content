# Product Requirements: Q&A Image-to-Video Generator

## 1. Goal

Create a tiny local tool that converts a static template image and a Question/Answer pair into a finished MP4 with two distinct voices and text that appears progressively while the corresponding audio plays.

The target is a working personal MVP in one day, so all scope must serve the single happy path.

## 2. User workflow

1. Choose/upload a template image.
2. Enter text into a **Question** block.
3. Enter text into an **Answer** block.
4. Click **Generate Video**.
5. The app generates Question audio with a male voice and Answer audio with a female voice.
6. The app renders the image background, animated Question and Answer text, and both audio segments into one video.
7. The user previews and downloads the MP4.

## 3. Inputs

### Required

- One static image file: PNG, JPG/JPEG, or WebP.
- Non-empty Question text.
- Non-empty Answer text.

### Fixed first-version configuration

For the first template, the following can be configured in code rather than through a visual editor:
- Canvas size and output aspect ratio.
- Question and Answer positions and text-box widths.
- Font family, size, weight, color, line spacing, and alignment.
- Typewriter behavior and transition gap.
- Question and Answer voice IDs.
- TTS rate and volume.

The first implementation must be aligned to the real image the user supplies. Do not assume positions from the sample video without inspecting the actual image.

## 4. Output

- A playable MP4 file.
- The static template image remains behind the text.
- Question appears with a typewriter animation while a male voice reads it.
- Answer appears with a typewriter animation while a female voice reads it.
- Question audio plays first, followed by a short configurable pause and then Answer audio.
- No template audio exists because the template is an image.
- Output video has synchronized audio, readable text, and no unintended blank frames.
- Prefer a vertical 9:16 output suitable for Reels/Shorts when the uploaded image is vertical. Preserve the supplied image's aspect ratio by default; explicit canvas cropping/padding must be a deliberate implementation choice.

## 5. Functional requirements

### FR-1: Image input
- User can select a local image.
- Show a preview of the selected image.
- Reject unsupported or unreadable image files with a useful error.

### FR-2: Q&A text input
- Separate multiline text areas for Question and Answer.
- Trim input for validation; reject empty content.
- Preserve punctuation and the user's wording for both displayed text and generated audio.

### FR-3: Distinct voice generation
- Generate the Question voice separately using a male-sounding voice.
- Generate the Answer voice separately using a female-sounding voice.
- Save the audio as two internal artifacts, for example `question.mp3` and `answer.mp3`.
- Voice selection may be fixed in configuration for V1; a voice selector is not required.
- Report TTS failure clearly and do not pretend a video was created.

### FR-4: Typewriter animation
- Question and Answer render progressively over the image at their configured positions.
- Text must wrap inside its configured box and remain within the canvas.
- Timing begins with the corresponding audio segment.
- Use a duration-based reveal for V1. A simple character/word reveal rate is acceptable; punctuation should introduce small natural pauses where practical.
- Ensure the entire text has appeared by the end of the associated speech segment, with a small configurable tolerance.
- Do not animate the Answer during the Question segment.

### FR-5: Timeline and rendering
- Timeline order: Question segment → short pause → Answer segment.
- Use the actual generated audio durations to build the timeline.
- Render the image and overlays into a video and combine the two audio segments.
- Ensure final video duration approximately equals Question audio duration + transition gap + Answer audio duration.
- Use a consistent frame rate (30 FPS is the default).
- Use FFmpeg or a similarly simple renderer for composition and MP4 encoding.

### FR-6: Preview and download
- Display a progress indicator during generation.
- Show a clear success or failure state.
- Provide an HTML video preview and a download action when rendering succeeds.
- Clean up temporary files safely after use; do not delete a file while a render process is still using it.

## 6. Non-functional requirements

- Must run locally on the developer's machine for the MVP.
- No database or authentication.
- No user accounts, analytics, cloud storage, template gallery, subscription system, or social publishing.
- Keep dependencies and setup minimal.
- Do not expose API keys in the browser. If the selected TTS provider uses a secret key, calls must occur on the server and the key must be kept in environment variables.
- Handle errors for missing inputs, unsupported images, TTS failures, FFmpeg failures, and output-file access.
- Generated content must not overwrite the uploaded image or existing user files.

## 7. Out of scope

- Template editor or drag-and-drop positioning.
- Multiple saved templates or template marketplace.
- Batch generation.
- Background music, sound effects, transitions, or advanced video editing.
- Automatic question/answer writing or other AI features.
- Word-level forced alignment, speech recognition, and perfect phoneme synchronization.
- User accounts, database, deployment, public API, and social media auto-publishing.
- Advanced typography controls in the UI.

## 8. Acceptance criteria

The MVP is accepted when all items in [Testing & Acceptance](./TESTING.md) pass, including a real render using the user's actual template image and a representative Question/Answer pair.

## 9. Product principle

Build one reliable path end-to-end before adding options. For the first usable result, hardcoded template layout and duration-based text reveal are intentional simplifications—not unfinished editor features.
