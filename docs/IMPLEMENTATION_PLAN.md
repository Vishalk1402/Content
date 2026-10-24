# One-Day Implementation Plan

## Objective

Finish one working path: image + Question + Answer → male Question audio + female Answer audio → typewriter text → downloadable MP4.

The timebox is one day. If time is running out, prioritize a correct final MP4 over extra UI polish.

## Progress

**Current status:** Documentation complete — implementation not started.

**Overall:** 0/5 implementation steps complete.

| Step | Status | Progress |
|---|---|---|
| Step 0 — inspect the real assets | ⬜ Not started | 0/5 |
| Step 1 — project skeleton and UI | ⬜ Not started | 0/5 |
| Step 2 — voice generation | ⬜ Not started | 0/4 |
| Step 3 — timing and text animation | ⬜ Not started | 0/6 |
| Step 4 — final rendering | ⬜ Not started | 0/4 |
| Step 5 — manual verification and cleanup | ⬜ Not started | 0/4 |

### Status legend

- ⬜ Not started
- 🟡 In progress
- 🟢 Complete
- 🔴 Blocked

Update this section whenever a step is validated. Do not mark a step complete until its checkpoint has been manually verified.

## Step 0 — inspect the real assets (first)

- [ ] Use the actual template image the user will upload.
- [ ] Identify its dimensions, aspect ratio, existing text, and available Question/Answer text regions.
- [ ] Confirm where the Question and Answer should appear and whether they should replace/cover any existing placeholder text.
- [ ] Choose text boxes, font sizes, colors, and wrapping based on the image.
- [ ] Confirm whether a usable male/female voice pair is available in the chosen TTS provider.

**Checkpoint:** the template layout and voices are known well enough to render a first output.

**Status:** ⬜ Not started

## Step 1 — project skeleton and UI

- [ ] Create the smallest React/JavaScript UI.
- [ ] Add image picker and image preview.
- [ ] Add Question and Answer multiline inputs.
- [ ] Add Generate button and clear validation/errors.
- [ ] Add loading/success state and final video preview/download placeholder.

**Checkpoint:** inputs validate and display correctly.

**Status:** ⬜ Not started

## Step 2 — voice generation

- [ ] Generate Question audio with the selected male-sounding voice.
- [ ] Generate Answer audio with the selected female-sounding voice.
- [ ] Save both tracks inside a per-run temporary directory.
- [ ] Confirm both audio files can be played and have non-zero duration.

**Checkpoint:** two valid, distinct audio files are generated.

**Status:** ⬜ Not started

## Step 3 — timing and text animation

- [ ] Read the actual duration of each generated audio track.
- [ ] Render the Question typewriter text only over the Question audio interval.
- [ ] Add a short gap between the two segments.
- [ ] Render the Answer typewriter text only over the Answer audio interval.
- [ ] Ensure final text is fully visible by the corresponding segment's end.
- [ ] Verify wrapping and clipping against a short and longer answer.

**Checkpoint:** visual order matches the audio order, and text stays in the intended regions.

**Status:** ⬜ Not started

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

1. Keep the first layout hardcoded.
2. Use duration-based typewriter timing, not forced alignment.
3. Avoid databases, login, deployment, queues, template editors, batch jobs, and extra providers.
4. Prefer an easily installed, tested TTS option over an ideal but complex setup.
5. Produce a complete local MP4 before spending time on styling.
