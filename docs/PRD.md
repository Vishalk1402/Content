# Product Requirements: Q&A Image-to-Video Generator

## Goal
Create a tiny local tool that converts a static template image and a Question/Answer pair into a finished MP4 with two distinct voices and typewriter text synchronized to the corresponding audio. The target is a usable personal MVP in one day.

## User workflow
1. Choose/upload a template image.
2. Enter Question text.
3. Enter Answer text.
4. Click Generate Video.
5. Generate Question audio with a male voice and Answer audio with a female voice.
6. Render the selected image, animated text, and both audio segments into one MP4.
7. Preview and download the MP4.

## Inputs
- One PNG, JPG/JPEG, or WebP template image.
- Non-empty Question.
- Non-empty Answer.

### Template model
The uploaded image is a **template instance**, not a single fixed template for the application. Different templates can be supplied, and each may have different text areas, positions, fonts, sizes, and styling.

For the MVP, template-specific layout is represented by a small configuration file rather than a visual editor. The renderer should be built around a `TemplateConfig` concept.

A template configuration may define:
- Canvas/output dimensions and aspect ratio.
- Question and Answer text-box positions and widths.
- Font family, size, weight, color, line spacing, and alignment.
- Typewriter behavior and transition gap.
- Question and Answer voice IDs.
- TTS rate and volume.

The user does not need to edit these values in the UI for V1.

### Reference template
The supplied reference image is 1080×1920 (9:16), with a dark background, `devwithvk` branding near the top, and two character illustrations in the lower portion. The central area is available for Question/Answer content. It is a **reference for the visual style and layout approach**, not a fixed asset requirement. Other templates must work through their own configurations.

## Output
- Playable MP4.
- Selected template image remains behind the text.
- Question uses typewriter animation with a male voice.
- Answer uses typewriter animation with a female voice.
- Question plays first, followed by a short configurable pause, then Answer.
- No template audio exists because the template is an image.
- Output has synchronized audio, readable text, and no unintended blank frames.
- Preserve the selected template aspect ratio by default; crop/pad must be an explicit configuration choice.

## Functional requirements

### FR-1: Image input
- Select a local template image.
- Preview the image.
- Reject unsupported or unreadable images.
- The same generation pipeline supports different template images through template-specific configuration.

### FR-2: Q&A input
- Separate multiline Question and Answer inputs.
- Reject empty content.
- Preserve supplied wording and punctuation.

### FR-3: Distinct voice generation
- Generate Question audio separately using a male-sounding voice.
- Generate Answer audio separately using a female-sounding voice.
- Keep the two audio artifacts separate internally.
- Voice selection can be fixed in V1 configuration.
- Report TTS failures clearly.

### FR-4: Typewriter animation
- Render Question and Answer progressively at their configured positions.
- Wrap text inside configured boxes.
- Start each animation with its corresponding audio segment.
- Use duration-based reveal for V1; perfect word-level alignment is not required.
- Ensure full text appears by the end of its speech segment.
- Do not animate Answer during Question audio.

### FR-5: Timeline and rendering
- Timeline: Question → short pause → Answer.
- Use actual generated audio durations.
- Render selected template and text overlays into video and combine the two audio segments.
- Use 30 FPS by default.
- Use FFmpeg or similarly simple rendering for MP4 encoding.

### FR-6: Preview/download
- Show generation progress.
- Show success/failure state.
- Provide video preview and download.
- Safely clean temporary files.

## Non-functional requirements
- Run locally for MVP.
- No database, authentication, accounts, analytics, cloud storage, marketplace, subscriptions, or social publishing.
- Keep dependencies minimal.
- Never expose TTS secrets in the browser.
- Handle input, TTS, FFmpeg, and output-file errors.
- Never overwrite uploaded assets.

## Out of scope
- Template editor or drag-and-drop positioning.
- Template marketplace/complex template management UI.
- Batch generation.
- Background music, sound effects, or advanced editing.
- AI-generated Q&A.
- Word-level forced alignment/speech recognition.
- Accounts, database, deployment, public API, or social publishing.
- Advanced typography controls in the UI.

## Acceptance criteria
All items in [TESTING.md](./TESTING.md) pass using a representative template image and Question/Answer pair.

## Product principle
Build one reliable path end-to-end before adding options. Template layout configuration and duration-based typewriter timing are intentional V1 simplifications.
