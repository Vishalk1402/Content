# One-Day Implementation Plan

## Objective

Finish one working path: image + Question + Answer → male Question audio + female Answer audio → typewriter text → downloadable MP4.

The timebox is one day. If time is running out, prioritize a correct final MP4 over extra UI polish.

## Progress

**Current status:** Step 2 is complete. Step 3 is implemented and ready for manual validation. Step 0 remains partially validated because the exact final template text layout still needs confirmation during rendering.

**Overall:** 2/5 implementation steps complete.

| Step | Status | Progress |
|---|---|---|
| Step 0 — inspect the real assets | 🟡 In progress | 4/5 validated; final layout is intentionally being validated during the first render |
| Step 1 — project skeleton and UI | 🟢 Complete | 5/5 implementation items; manual validation passed |
| Step 2 — voice generation | 🟢 Complete | 4/4 implementation items; voice quality manually approved |
| Step 3 — timing and text animation | 🟡 In progress | 6/6 implementation items; manual animation validation pending |
| Step 4 — final rendering | ⬜ Not started | 0/4 |
| Step 5 — manual verification and cleanup | ⬜ Not started | 0/4 |

### Status legend

- ⬜ Not started
- 🟡 In progress
- 🟢 Complete
- 🔴 Blocked

Update this section whenever a step is validated. Do not mark a step complete until its checkpoint has been manually verified.

## Step 0 — inspect the real assets (first)

- [x] Inspect the supplied reference template image.
- [x] Confirm the reference image is 1080×1920 and 9:16.
- [x] Confirm that the reference is only one example and that different templates must be supported.
- [ ] Identify the actual first template's dimensions, existing text, and available Question/Answer text regions.
- [ ] Choose text boxes, font sizes, colors, and wrapping based on the actual first template.
- [x] Confirm a usable male/female voice pair is available in the chosen TTS provider.

**Checkpoint:** the actual first template layout and voices are known well enough to render a first output.

**Status:** 🟡 In progress

### Step 0 decision

The renderer will use a reusable `TemplateConfig` rather than hardcoding one image's coordinates. Each template can have its own image and configuration. The supplied reference image is the first implementation target for the visual configuration.

## Step 1 — project skeleton and UI

- [x] Create the smallest React/JavaScript UI.
- [x] Add image picker and image preview.
- [x] Add Question and Answer multiline inputs.
- [x] Add Generate button and clear validation/errors.
- [x] Add loading/success state and final video preview/download placeholder.

**Checkpoint:** inputs validate and display correctly.

**Implementation:** React + Vite client, Node/Express local API skeleton, fixed first-template configuration, and local generated-file ignores are now in the repository.

**Status:** 🟢 Complete — manual validation passed.

## Step 2 — voice generation

- [x] Generate Question audio with the selected male-sounding voice.
- [x] Generate Answer audio with the selected female-sounding voice.
- [x] Save both tracks inside a per-run temporary directory.
- [x] Confirm generated files are non-empty and expose them as playable audio in the UI.

**Checkpoint:** two valid, distinct audio files are generated.

**Implementation:** the MVP uses the `edge-tts` Python package through the Node server. The selected voices are `en-US-ChristopherNeural` for Question and `en-US-JennyNeural` for Answer, with a TTS rate of `-10%` for slower, clearer pacing. Voice IDs and rate are configurable through environment variables.

**Status:** 🟢 Complete — manual voice-quality validation passed.

## Step 3 — timing and text animation

- [x] Read the actual duration of each generated audio track in the browser from the audio metadata.
- [x] Render the Question typewriter text only over the Question audio interval.
- [x] Add a short `0.45s` gap between the two segments.
- [x] Render the Answer typewriter text only over the Answer audio interval.
- [x] Ensure final text is fully visible by the corresponding segment's end.
- [x] Use the configured Question/Answer text regions and verify wrapping/clipping in the preview implementation.

**Implementation:** the UI now loads both audio tracks, reads their real durations, sequences Question → gap → Answer, and reveals each text string proportionally to the current audio progress. The preview uses the first template's `TemplateConfig` coordinates and exposes Preview/Stop controls.

**Checkpoint:** visual order matches the audio order, and text stays in the intended regions.

**Status:** 🟡 In progress — manual animation validation pending.

## Step 4 — final rendering

- [ ] Combine image, animation, and audio with FFmpeg or the selected lightweight renderer.
- [ ] Encode a compatible MP4 using a fixed frame rate.
- [ ] Confirm duration is approximately Question audio + gap + Answer audio.
- [ ] Return the MP4 to the UI and enable preview/download.

**Checkpoint:** one complete MP4 can be opened and played.

**Status:** ⬜ Not started

## Step 5 — manual verification and cleanup

- [ ] Run all required tests in [TESTING.md](./TESTING.md).
- [ ] Fix only blockers to the Definition of Done.
- [ ] Confirm no secrets, uploaded assets, or generated media are committed.
- [ ] Update this document's status and record the final command used to run the app.

**Status:** ⬜ Not started

## Timebox guidance

Suggested allocation (adjust based on the chosen TTS/rendering tools):

| Time | Target |
|---|---|
| 0:00–0:45 | Inspect template, confirm voices, setup |
| 0:45–1:45 | Minimal UI and input validation |
| 1:45–2:45 | Generate separate Question/Answer audio |
| 2:45–4:45 | Typewriter overlay and timeline |
| 4:45–6:30 | FFmpeg composition, MP4 output |
| 6:30–8:00 | Manual tests and fixes |

This is an aggressive one-day target, not a guarantee. The highest-risk items are TTS setup, environment compatibility, text layout on the real template, and renderer/FFmpeg integration.

## If blocked

1. Keep the first layout hardcoded through its `TemplateConfig`.
2. Use duration-based typewriter timing, not forced alignment.
3. Avoid databases, login, deployment, queues, template editors, batch jobs, and extra providers.
4. Prefer an easily installed, tested TTS option over an ideal but complex setup.
5. Produce a complete local MP4 before spending time on styling.
