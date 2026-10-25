import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

const ffmpegBin =
  process.env.FFMPEG_BIN ||
  ffmpegStatic ||
  "ffmpeg";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const FPS = 30;

const GAP_SECONDS = 0.45;

const QUESTION_CONFIG = {
  x: 90,
  y: 250,
  width: 900,
  fontSize: 58,
  bold: 1
};

const ANSWER_CONFIG = {
  x: 90,
  y: 440,
  width: 900,
  fontSize: 50,
  bold: 0
};

function assTime(seconds) {
  const safeSeconds = Math.max(0, seconds);

  const hours = Math.floor(safeSeconds / 3600);

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60
  );

  let remaining =
    safeSeconds -
    hours * 3600 -
    minutes * 60;

  let wholeSeconds = Math.floor(remaining);

  let centiseconds = Math.round(
    (remaining - wholeSeconds) * 100
  );

  if (centiseconds >= 100) {
    wholeSeconds += 1;
    centiseconds = 0;
  }

  return `${hours}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(wholeSeconds).padStart(
    2,
    "0"
  )}.${String(centiseconds).padStart(
    2,
    "0"
  )}`;
}

function escapeAssText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function addTypewriterEvents({
  events,
  text,
  startTime,
  duration,
  style
}) {
  if (!text) {
    return;
  }

  const length = text.length;

  for (let index = 1; index <= length; index += 1) {
    const eventStart =
      startTime +
      ((index - 1) / length) * duration;

    const eventEnd =
      startTime +
      (index / length) * duration;

    const visibleText = escapeAssText(
      text.slice(0, index)
    );

    events.push(
      `Dialogue: 0,${assTime(
        eventStart
      )},${assTime(
        eventEnd
      )},${style},${visibleText}`
    );
  }
}

function createAssContent({
  question,
  answer,
  questionDuration,
  answerDuration
}) {
  const questionText = `Q. ${question.trim()}`;
  const answerText = answer.trim();

  const gapStart = questionDuration;

  const answerStart =
    questionDuration +
    GAP_SECONDS;

  const totalDuration =
    questionDuration +
    GAP_SECONDS +
    answerDuration;

  const events = [];

  // Question typewriter.
  addTypewriterEvents({
    events,
    text: questionText,
    startTime: 0,
    duration: questionDuration,
    style: "Question"
  });

  // Keep the completed question visible
  // during the gap and while the answer plays.
  events.push(
    `Dialogue: 0,${assTime(
      gapStart
    )},${assTime(
      totalDuration
    )},Question,${escapeAssText(
      questionText
    )}`
  );

  // Answer typewriter.
  addTypewriterEvents({
    events,
    text: answerText,
    startTime: answerStart,
    duration: answerDuration,
    style: "Answer"
  });

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${CANVAS_WIDTH}
PlayResY: ${CANVAS_HEIGHT}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Question,Arial,${QUESTION_CONFIG.fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,${QUESTION_CONFIG.bold},0,0,0,100,100,0,0,1,2,0,7,${QUESTION_CONFIG.x},${CANVAS_WIDTH - QUESTION_CONFIG.x - QUESTION_CONFIG.width},0,1
Style: Answer,Arial,${ANSWER_CONFIG.fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,${ANSWER_CONFIG.bold},0,0,0,100,100,0,0,1,2,0,7,${ANSWER_CONFIG.x},${CANVAS_WIDTH - ANSWER_CONFIG.x - ANSWER_CONFIG.width},0,1

[Events]
Format: Layer, Start, End, Style, Text
${events.join("\n")}
`;
}

function escapeFilterPath(filePath) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function getDurationFromFfmpeg(inputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegBin,
      [
        "-hide_banner",
        "-i",
        inputPath
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", () => {
      const match = stderr.match(
        /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i
      );

      if (!match) {
        reject(
          new Error(
            `Could not determine audio duration for ${path.basename(
              inputPath
            )}.`
          )
        );

        return;
      }

      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3]);

      resolve(
        hours * 3600 +
        minutes * 60 +
        seconds
      );
    });
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegBin,
      args,
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Could not start FFmpeg. ${error.message}`
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `FFmpeg rendering failed.\n${
            stderr.trim() ||
            `Process exited with code ${code}.`
          }`
        )
      );
    });
  });
}

export async function renderVideo({
  templatePath,
  questionPath,
  answerPath,
  outputPath,
  assPath,
  question,
  answer
}) {
  const [
    questionDuration,
    answerDuration
  ] = await Promise.all([
    getDurationFromFfmpeg(questionPath),
    getDurationFromFfmpeg(answerPath)
  ]);

  const assContent = createAssContent({
    question,
    answer,
    questionDuration,
    answerDuration
  });

  await fs.writeFile(
    assPath,
    assContent,
    "utf8"
  );

  const totalDuration =
    questionDuration +
    GAP_SECONDS +
    answerDuration;

  const escapedAssPath =
    escapeFilterPath(assPath);

  /*
   * IMPORTANT:
   *
   * All audio streams are normalized to:
   *   48000 Hz
   *   stereo
   *
   * before concat.
   *
   * This prevents MP3/TTS audio and silence
   * from having incompatible formats.
   */
  const filterComplex = [
    /*
     * Video
     */
    `[0:v]scale=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:force_original_aspect_ratio=decrease,` +
      `pad=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:(ow-iw)/2:(oh-ih)/2,` +
      `setsar=1,` +
      `subtitles='${escapedAssPath}'[v]`,

    /*
     * Question audio
     */
    `[1:a]aresample=48000,` +
      `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[q]`,

    /*
     * Gap / silence
     */
    `[2:a]aresample=48000,` +
      `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[g]`,

    /*
     * Answer audio
     */
    `[3:a]aresample=48000,` +
      `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a]`,

    /*
     * Question -> silence -> answer
     */
    `[q][g][a]concat=n=3:v=0:a=1[outa]`
  ].join(";");

  await runFfmpeg([
    "-y",

    /*
     * Template
     */
    "-loop",
    "1",
    "-i",
    templatePath,

    /*
     * Question audio
     */
    "-i",
    questionPath,

    /*
     * Gap audio
     */
    "-f",
    "lavfi",
    "-t",
    String(GAP_SECONDS),
    "-i",
    "anullsrc=r=48000:cl=stereo",

    /*
     * Answer audio
     */
    "-i",
    answerPath,

    /*
     * Filters
     */
    "-filter_complex",
    filterComplex,

    /*
     * Video + audio
     */
    "-map",
    "[v]",

    "-map",
    "[outa]",

    /*
     * Exact final duration
     */
    "-t",
    String(totalDuration),

    /*
     * Video
     */
    "-r",
    String(FPS),

    "-c:v",
    "libx264",

    "-preset",
    "veryfast",

    "-pix_fmt",
    "yuv420p",

    /*
     * Audio
     */
    "-c:a",
    "aac",

    "-b:a",
    "192k",

    "-ar",
    "48000",

    "-ac",
    "2",

    /*
     * MP4 compatibility
     */
    "-movflags",
    "+faststart",

    outputPath
  ]);

  return {
    questionDuration,
    answerDuration,
    gapSeconds: GAP_SECONDS,
    totalDuration
  };
}