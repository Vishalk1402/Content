import "dotenv/config";

import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";

import {
  generateQuestionAndAnswerAudio
} from "./tts.js";

const app = express();

const port = Number(
  process.env.PORT || 3001
);

const tempRoot = path.resolve(
  process.cwd(),
  "temp"
);

// Temporary artifacts are retained for at most two hours by default.
// Override with TEMP_FILE_TTL_MS if production needs a different window.
const TEMP_FILE_TTL_MS = Math.max(
  15 * 60 * 1000,
  Number(process.env.TEMP_FILE_TTL_MS || 2 * 60 * 60 * 1000)
);

const TEMP_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const activeTempPaths = new Set();

/*
 * Template upload.
 *
 * Templates are kept in memory because they are
 * only received as part of the audio-generation
 * request and are not stored on the server.
 */
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

/*
 * Video upload.
 *
 * IMPORTANT:
 * Do NOT use memoryStorage() here.
 *
 * Recorded videos can be large and keeping them
 * in req.file.buffer can cause the Render service
 * to exceed its memory limit.
 *
 * Multer writes the uploaded video directly to disk.
 */
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: async (
      _req,
      _file,
      cb
    ) => {
      const uploadDirectory =
        path.join(
          tempRoot,
          "uploads"
        );

      try {
        await fs.mkdir(
          uploadDirectory,
          {
            recursive: true
          }
        );

        cb(
          null,
          uploadDirectory
        );
      } catch (error) {
        cb(error);
      }
    },

    filename: (
      _req,
      file,
      cb
    ) => {
      const extension =
        file.mimetype ===
        "video/webm"
          ? ".webm"
          : file.mimetype ===
              "video/mp4"
            ? ".mp4"
            : "";

      cb(
        null,
        `${crypto.randomUUID()}${extension}`
      );
    }
  }),

  limits: {
    fileSize:
      100 * 1024 * 1024
  }
});

/*
 * FFmpeg executable.
 *
 * The Docker image installs the system FFmpeg binary.
 * FFMPEG_BIN remains available for environments with a custom path.
 */
const ffmpegBin =
  process.env.FFMPEG_BIN ||
  "ffmpeg";

/*
 * Remove expired temporary files left by completed or interrupted requests.
 * Active generation/conversion paths are protected from the cleanup sweep.
 */
function isActivePathOrContainsActive(targetPath) {
  const resolvedTarget = path.resolve(targetPath);

  for (const activePath of activeTempPaths) {
    const resolvedActive = path.resolve(activePath);

    if (
      resolvedActive === resolvedTarget ||
      resolvedActive.startsWith(resolvedTarget + path.sep)
    ) {
      return true;
    }
  }

  return false;
}

async function cleanupStaleTempEntries(directory, cutoffTime) {
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (isActivePathOrContainsActive(entryPath)) continue;

    let stats;

    try {
      stats = await fs.lstat(entryPath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    // Never follow symlinks outside the temp directory.
    if (stats.isSymbolicLink()) {
      if (stats.mtimeMs < cutoffTime) {
        await fs.rm(entryPath, { force: true });
      }
      continue;
    }

    if (stats.isDirectory()) {
      await cleanupStaleTempEntries(entryPath, cutoffTime);

      if (isActivePathOrContainsActive(entryPath)) continue;

      const remaining = await fs.readdir(entryPath).catch((error) => {
        if (error?.code === "ENOENT") return [];
        throw error;
      });

      if (remaining.length === 0 && stats.mtimeMs < cutoffTime) {
        await fs.rm(entryPath, { recursive: true, force: true });
      }
    } else if (stats.isFile() && stats.mtimeMs < cutoffTime) {
      await fs.rm(entryPath, { force: true });
    }
  }
}

async function cleanupStaleTempFiles() {
  await fs.mkdir(tempRoot, { recursive: true });

  const cutoffTime = Date.now() - TEMP_FILE_TTL_MS;
  await cleanupStaleTempEntries(tempRoot, cutoffTime);
}

/*
 * CORS
 */
const allowedOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

console.log(
  "[CORS] FRONTEND_URL:",
  process.env.FRONTEND_URL
);

console.log(
  "[CORS] Allowed origins:",
  allowedOrigins
);

app.use(
  (req, res, next) => {
    const origin =
      req.headers.origin;

    if (
      allowedOrigins.includes(
        origin
      )
    ) {
      res.setHeader(
        "Access-Control-Allow-Origin",
        origin
      );

      res.setHeader(
        "Vary",
        "Origin"
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

    if (
      req.method ===
      "OPTIONS"
    ) {
      return res.sendStatus(
        204
      );
    }

    next();
  }
);

app.use(
  express.json({
    limit: "100kb"
  })
);

/*
 * Generated audio files.
 */
app.use(
  "/generated",
  express.static(
    tempRoot
  )
);

/*
 * Health check.
 */
app.get(
  "/api/health",
  (_req, res) => {
    res.json({
      status: "ok",
      service:
        "qa-video-generator"
    });
  }
);

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

  async (
    req,
    res
  ) => {
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
        error:
          "Enter a Question."
      });
    }

    if (!answer) {
      return res.status(400).json({
        error:
          "Enter an Answer."
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

      activeTempPaths.add(runDirectory);

      /*
       * Generate separate voices.
       */
      const voices =
        await generateQuestionAndAnswerAudio(
          {
            question,
            answer,
            questionPath,
            answerPath
          }
        );

      const [
        questionStats,
        answerStats
      ] = await Promise.all([
        fs.stat(
          questionPath
        ),
        fs.stat(
          answerPath
        )
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
        status:
          "audio-ready",

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
      ).catch(
        () => {}
      );

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
    } finally {
      activeTempPaths.delete(runDirectory);
    }
  }
);

/*
 * Delete generated question/answer audio.
 */
app.post(
  "/api/cleanup",

  async (
    req,
    res
  ) => {
    const runId =
      req.body.runId?.trim();

    if (!runId) {
      return res.status(400).json({
        error:
          "A generated run is required."
      });
    }

    /*
     * Validate UUID before using it
     * as part of a filesystem path.
     */
    if (
      !/^[a-f0-9-]{36}$/i.test(
        runId
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid run ID."
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
        status:
          "cleaned",

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
function runFfmpeg(
  args
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const child =
        spawn(
          ffmpegBin,
          args,
          {
            windowsHide:
              true,

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
        (
          chunk
        ) => {
          stderr +=
            chunk.toString();
        }
      );

      child.on(
        "error",
        (
          error
        ) => {
          reject(
            new Error(
              `Could not start FFmpeg: ${error.message}`
            )
          );
        }
      );

      child.on(
        "close",
        (
          code
        ) => {
          if (
            code === 0
          ) {
            resolve();
            return;
          }

          reject(
            new Error(
              `FFmpeg conversion failed: ${
                stderr.slice(
                  -4000
                )
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
 *
 * The uploaded video is written to disk by Multer.
 * FFmpeg reads that file directly.
 *
 * This avoids req.file.buffer and therefore
 * significantly reduces Node.js memory usage.
 */
app.post(
  "/api/convert-video",

  videoUpload.single(
    "video"
  ),

  async (
    req,
    res
  ) => {
    if (!req.file) {
      return res.status(400).json({
        error:
          "Upload a recorded video first."
      });
    }

    /*
     * Multer has already written the uploaded
     * video to disk.
     */
    const uploadedFilePath =
      req.file.path;

    activeTempPaths.add(uploadedFilePath);

    /*
     * Validate the uploaded media type
     * before creating the conversion directory.
     */
    const inputExtension =
      req.file.mimetype ===
      "video/webm"
        ? "webm"
        : req.file.mimetype ===
            "video/mp4"
          ? "mp4"
          : null;

    if (!inputExtension) {
      await fs.rm(
        uploadedFilePath,
        {
          force: true
        }
      ).catch(
        () => {}
      );

      activeTempPaths.delete(uploadedFilePath);

      return res.status(400).json({
        error:
          "Only WebM and MP4 recordings are supported."
      });
    }

    /*
     * Create a separate directory for
     * the FFmpeg output.
     */
    const runDirectory =
      path.join(
        tempRoot,
        `convert-${crypto.randomUUID()}`
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

      activeTempPaths.add(runDirectory);

      /*
       * IMPORTANT:
       *
       * Do NOT do:
       *
       * fs.writeFile(
       *   inputPath,
       *   req.file.buffer
       * );
       *
       * because diskStorage() does not
       * provide req.file.buffer.
       *
       * FFmpeg reads req.file.path directly.
       */
      await runFfmpeg([
        "-y",

        "-i",
        uploadedFilePath,

        /*
         * Select the first video stream.
         */
        "-map",
        "0:v:0",

        /*
         * Select the first audio stream.
         */
        "-map",
        "0:a:0",

        /*
         * Instagram/social-friendly
         * vertical 1080x1920 output.
         */
        "-vf",
        "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",

        /*
         * H.264 video.
         */
        "-c:v",
        "libx264",

        "-preset",
        "ultrafast",

        "-crf",
        "23",

        /*
         * Widely compatible pixel format.
         */
        "-pix_fmt",
        "yuv420p",

        /*
         * Constant 30 FPS.
         */
        "-r",
        "30",

        "-fps_mode",
        "cfr",

        /*
         * AAC audio.
         */
        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-ar",
        "48000",

        "-ac",
        "2",

        /*
         * Put MP4 metadata at the beginning
         * for faster web/social playback.
         */
        "-movflags",
        "+faststart",

        outputPath
      ]);

      const stats =
        await fs.stat(
          outputPath
        );

      if (
        !stats.size
      ) {
        throw new Error(
          "FFmpeg produced an empty MP4."
        );
      }

      /*
       * The original browser recording
       * is no longer needed.
       *
       * Delete it before sending the
       * converted MP4.
       */
      await fs.rm(
        uploadedFilePath,
        {
          force: true
        }
      );

      activeTempPaths.delete(uploadedFilePath);

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
       * Stream the converted file.
       *
       * This avoids loading the finished
       * MP4 into Node.js memory.
       */
      const downloadStream =
        createReadStream(
          outputPath
        );

      downloadStream.on(
        "error",
        (
          error
        ) => {
          console.error(
            "MP4 download stream failed:",
            error
          );

          if (
            !res.headersSent
          ) {
            res
              .status(500)
              .end(
                "Failed to send converted video."
              );
          } else {
            res.destroy(
              error
            );
          }
        }
      );

      /*
       * Once the response stream closes,
       * remove the complete conversion
       * directory.
       */
      downloadStream.on(
        "close",
        () => {
          activeTempPaths.delete(runDirectory);

          fs.rm(
            runDirectory,
            {
              recursive:
                true,

              force:
                true
            }
          ).catch(
            (
              error
            ) => {
              console.error(
                "Temporary conversion cleanup failed:",
                error
              );
            }
          );
        }
      );

      downloadStream.pipe(
        res
      );

    } catch (error) {
      /*
       * Clean up both the uploaded source
       * and the conversion directory when
       * anything goes wrong.
       */
      await fs.rm(
        uploadedFilePath,
        {
          force: true
        }
      ).catch(
        () => {}
      );

      activeTempPaths.delete(uploadedFilePath);
      activeTempPaths.delete(runDirectory);

      await fs.rm(
        runDirectory,
        {
          recursive:
            true,

          force:
            true
        }
      ).catch(
        () => {}
      );

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

// Clean expired temp artifacts at startup and every 15 minutes.
cleanupStaleTempFiles().catch((error) => {
  console.error("Initial temporary-file cleanup failed:", error);
});

const cleanupTimer = setInterval(() => {
  cleanupStaleTempFiles().catch((error) => {
    console.error("Scheduled temporary-file cleanup failed:", error);
  });
}, TEMP_CLEANUP_INTERVAL_MS);

cleanupTimer.unref?.();

app.listen(
  port,
  host,
  () => {
    console.log(
      `Q&A video server running on ${host}:${port}`
    );
    console.log(
      `Temporary files expire after ${Math.round(TEMP_FILE_TTL_MS / 60000)} minutes.`
    );
  }
);