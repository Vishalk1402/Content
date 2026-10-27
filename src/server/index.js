import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import { generateQuestionAndAnswerAudio } from "./tts.js";

const app = express();
const port = Number(process.env.PORT || 3001);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

const tempRoot = path.resolve(
  process.cwd(),
  "temp"
);

const ffmpegBin =
  process.env.FFMPEG_BIN ||
  ffmpegStatic ||
  "ffmpeg";

const allowedOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);
console.log("[CORS] FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("[CORS] Allowed origins:", allowedOrigins);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  "/generated",
  express.static(tempRoot)
);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "qa-video-generator"
  });
});

/*
 * Generate question and answer audio.
 *
 * The template is accepted because the current
 * frontend sends it with the generation request.
 *
 * The template itself is not stored on the server.
 */
app.post(
  "/api/generate",
  upload.single("template"),
  async (req, res) => {
    const question =
      req.body.question?.trim();

    const answer =
      req.body.answer?.trim();

    if (!req.file) {
      return res.status(400).json({
        error:
          "Upload a template image first."
      });
    }

    if (
      !req.file.mimetype.startsWith(
        "image/"
      )
    ) {
      return res.status(400).json({
        error:
          "The template must be an image."
      });
    }

    if (!question) {
      return res.status(400).json({
        error: "Enter a Question."
      });
    }

    if (!answer) {
      return res.status(400).json({
        error: "Enter an Answer."
      });
    }

    const runId =
      crypto.randomUUID();

    const runDirectory =
      path.join(
        tempRoot,
        runId
      );

    const questionPath =
      path.join(
        runDirectory,
        "question.mp3"
      );

    const answerPath =
      path.join(
        runDirectory,
        "answer.mp3"
      );

    try {
      await fs.mkdir(
        runDirectory,
        {
          recursive: true
        }
      );

      /*
       * Generate separate voices.
       */
      const voices =
        await generateQuestionAndAnswerAudio({
          question,
          answer,
          questionPath,
          answerPath
        });

      const [
        questionStats,
        answerStats
      ] = await Promise.all([
        fs.stat(questionPath),
        fs.stat(answerPath)
      ]);

      if (
        questionStats.size === 0 ||
        answerStats.size === 0
      ) {
        throw new Error(
          "TTS returned an empty audio file."
        );
      }

      return res.json({
        status: "audio-ready",

        runId,

        questionAudioUrl:
          `/generated/${runId}/question.mp3`,

        answerAudioUrl:
          `/generated/${runId}/answer.mp3`,

        questionVoice:
          voices.questionVoice,

        answerVoice:
          voices.answerVoice,

        questionAudioBytes:
          questionStats.size,

        answerAudioBytes:
          answerStats.size
      });
    } catch (error) {
      await fs.rm(
        runDirectory,
        {
          recursive: true,
          force: true
        }
      ).catch(() => {});

      console.error(
        "Audio generation failed:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Audio generation failed."
      });
    }
  }
);

/*
 * Delete generated question/answer audio.
 */
app.post(
  "/api/cleanup",
  async (req, res) => {
    const runId =
      req.body.runId?.trim();

    if (!runId) {
      return res.status(400).json({
        error:
          "A generated run is required."
      });
    }

    if (
      !/^[a-f0-9-]{36}$/i.test(runId)
    ) {
      return res.status(400).json({
        error: "Invalid run ID."
      });
    }

    const runDirectory =
      path.join(
        tempRoot,
        runId
      );

    try {
      await fs.rm(
        runDirectory,
        {
          recursive: true,
          force: true
        }
      );

      return res.json({
        status: "cleaned",
        runId
      });
    } catch (error) {
      console.error(
        "Cleanup failed:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to clean generated files."
      });
    }
  }
);

/*
 * Run FFmpeg.
 */
function runFfmpeg(args) {
  return new Promise(
    (resolve, reject) => {
      const child = spawn(
        ffmpegBin,
        args,
        {
          windowsHide: true,
          stdio: [
            "ignore",
            "ignore",
            "pipe"
          ]
        }
      );

      let stderr = "";

      child.stderr.on(
        "data",
        (chunk) => {
          stderr += chunk.toString();
        }
      );

      child.on(
        "error",
        (error) => {
          reject(
            new Error(
              `Could not start FFmpeg: ${error.message}`
            )
          );
        }
      );

      child.on(
        "close",
        (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              `FFmpeg conversion failed: ${
                stderr.slice(-4000)
              }`
            )
          );
        }
      );
    }
  );
}

/*
 * Convert browser recording into
 * Instagram/social-ready MP4.
 */
app.post(
  "/api/convert-video",
  videoUpload.single("video"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error:
          "Upload a recorded video first."
      });
    }

    const runDirectory =
      path.join(
        tempRoot,
        `convert-${crypto.randomUUID()}`
      );

    const inputExtension =
      req.file.mimetype === "video/webm"
        ? "webm"
        : req.file.mimetype === "video/mp4"
          ? "mp4"
          : null;

    if (!inputExtension) {
      return res.status(400).json({
        error:
          "Only WebM and MP4 recordings are supported."
      });
    }

    const inputPath =
      path.join(
        runDirectory,
        `recording.${inputExtension}`
      );

    const outputPath =
      path.join(
        runDirectory,
        "social-ready.mp4"
      );

    try {
      await fs.mkdir(
        runDirectory,
        {
          recursive: true
        }
      );

      await fs.writeFile(
        inputPath,
        req.file.buffer
      );

      await runFfmpeg([
        "-y",

        "-i",
        inputPath,

        "-map",
        "0:v:0",

        "-map",
        "0:a:0",

        "-vf",
        "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "20",

        "-pix_fmt",
        "yuv420p",

        "-r",
        "30",

        "-fps_mode",
        "cfr",

        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-ar",
        "48000",

        "-ac",
        "2",

        "-movflags",
        "+faststart",

        outputPath
      ]);

      const stats =
        await fs.stat(
          outputPath
        );

      if (!stats.size) {
        throw new Error(
          "FFmpeg produced an empty MP4."
        );
      }

      res.setHeader(
        "Content-Type",
        "video/mp4"
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="qa-video.mp4"'
      );

      res.setHeader(
        "Content-Length",
        stats.size
      );

      /*
       * Stream the finished MP4 to the browser.
       *
       * The temporary conversion directory is
       * deleted automatically when the stream closes.
       */
      const downloadStream =
        createReadStream(
          outputPath
        );

      downloadStream.on(
        "error",
        (error) => {
          console.error(
            "MP4 download stream failed:",
            error
          );

          if (!res.headersSent) {
            res
              .status(500)
              .end(
                "Failed to send converted video."
              );
          } else {
            res.destroy(error);
          }
        }
      );

      downloadStream.on(
        "close",
        () => {
          fs.rm(
            runDirectory,
            {
              recursive: true,
              force: true
            }
          ).catch(
            (error) => {
              console.error(
                "Temporary conversion cleanup failed:",
                error
              );
            }
          );
        }
      );

      downloadStream.pipe(res);
    } catch (error) {
      await fs.rm(
        runDirectory,
        {
          recursive: true,
          force: true
        }
      ).catch(() => {});

      console.error(
        "Video conversion failed:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Video conversion failed."
      });
    }
  }
);

const host =
  process.env.HOST ||
  "0.0.0.0";

app.listen(
  port,
  host,
  () => {
    console.log(
      `Q&A video server running on ${host}:${port}`
    );
  }
);