# Q&A Image-to-Video Generator

Documentation for the small, single-purpose tool that turns a static image template and a Question/Answer pair into a short MP4 video.

## Product flow

1. Upload one template image.
2. Enter the Question and Answer in separate blocks.
3. Generate Question audio with a male voice.
4. Generate Answer audio with a female voice.
5. Animate each text block with a typewriter effect, aligned to its own audio.
6. Render and download the final MP4.

## Documents

- [MVP Requirements (PRD)](./PRD.md) — scope, inputs, outputs, and explicit non-goals.
- [Technical Design](./TECHNICAL_DESIGN.md) — smallest practical architecture and rendering approach.
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) — one-day build sequence and checkpoints.
- [Testing & Acceptance](./TESTING.md) — manual tests and Definition of Done.

## Project constraints

- Target: a usable personal MVP in one day.
- No database, authentication, cloud storage, template editor, or publishing integration.
- The uploaded asset is an image, not a video.
- Question and Answer use separate audio files and different voice styles.
- Template layout coordinates can be fixed for the first template.

## Current status

- [x] Requirements documented
- [x] Technical approach documented
- [x] One-day implementation plan documented
- [x] Acceptance tests documented
- [ ] Implementation started
- [ ] First MP4 generated and manually verified

## Decisions that must be validated during implementation

- TTS provider and available male/female voice IDs.
- Question/answer text positions, font, size, colors, and line wrapping for the actual image.
- Whether the final export should always be 9:16 or use the uploaded image's aspect ratio. The current default is 9:16 when the image is portrait; the renderer should preserve the image aspect ratio unless the first template's layout requires an explicit 720×1280 canvas.
- Speech-to-text word timestamps are not required for the MVP. Use duration-based typewriter timing first.
