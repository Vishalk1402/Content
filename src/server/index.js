import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { generateQuestionAndAnswerAudio } from "./tts.js";
import { renderVideo } from "./render.js";

const app = express();
const port = Number(process.env.PORT || 3001);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const tempRoot = path.resolve(process.cwd(), "temp");

const allowedOrigin = "http://127.0.0.1:5173";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "false");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "100kb" }));
app.use("/generated", express.static(tempRoot));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "qa-video-generator"
  });
});

function getTemplateExtension(mimetype) {
  switch (mimetype) {
    case "image/png":
      return ".png";

    case "image/jpeg":
      return ".jpg";

    case "image/webp":
      return ".webp";

    default:
      return ".img";
  }
}

/*
 * Generate question/answer audio.
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

    const templatePath =
      path.join(
        runDirectory,
        `template${getTemplateExtension(
          req.file.mimetype
        )}`
      );

    const metadataPath =
      path.join(
        runDirectory,
        "metadata.json"
      );

    try {
      await fs.mkdir(
        runDirectory,
        {
          recursive: true
        }
      );

      /*
       * Save the uploaded template.
       */
      await fs.writeFile(
        templatePath,
        req.file.buffer
      );

      /*
       * Store everything required
       * to render the exact same video later.
       */
      await fs.writeFile(
        metadataPath,
        JSON.stringify(
          {
            question,
            answer,
            gapSeconds: 0.45
          },
          null,
          2
        ),
        "utf8"
      );

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
 * Render the final MP4.
 *
 * The frontend calls this when
 * the user clicks "Download MP4".
 */
app.post(
  "/api/render",
  async (req, res) => {
    const runId =
      req.body.runId?.trim();

    if (!runId) {
      return res.status(400).json({
        error:
          "A generated run is required."
      });
    }

    /*
     * UUID validation.
     */
    if (
      !/^[a-f0-9-]{36}$/i.test(
        runId
      )
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

    const metadataPath =
      path.join(
        runDirectory,
        "metadata.json"
      );

    const outputPath =
      path.join(
        runDirectory,
        "video.mp4"
      );

    const assPath =
      path.join(
        runDirectory,
        "animation.ass"
      );

    try {
      /*
       * Read generation metadata.
       */
      const metadataRaw =
        await fs.readFile(
          metadataPath,
          "utf8"
        );

      const metadata =
        JSON.parse(
          metadataRaw
        );

      /*
       * Find uploaded template.
       */
      const entries =
        await fs.readdir(
          runDirectory
        );

      const templateFile =
        entries.find(
          (file) =>
            file ===
              "template.png" ||
            file ===
              "template.jpg" ||
            file ===
              "template.webp"
        );

      if (!templateFile) {
        throw new Error(
          "Template image was not found for this run."
        );
      }

      const templatePath =
        path.join(
          runDirectory,
          templateFile
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

      /*
       * Render using the exact
       * question/answer/gap data.
       */
      const result =
        await renderVideo({
          templatePath,
          questionPath,
          answerPath,
          outputPath,
          assPath,

          question:
            metadata.question,

          answer:
            metadata.answer,

          gapSeconds:
            Number(
              metadata.gapSeconds ||
                0.45
            )
        });

      const videoStats =
        await fs.stat(
          outputPath
        );

      if (
        videoStats.size === 0
      ) {
        throw new Error(
          "FFmpeg created an empty video file."
        );
      }

      return res.json({
        status:
          "video-ready",

        runId,

        videoUrl:
          `/generated/${runId}/video.mp4`,

        videoBytes:
          videoStats.size,

        questionDuration:
          result.questionDuration,

        answerDuration:
          result.answerDuration,

        gapSeconds:
          result.gapSeconds,

        totalDuration:
          result.totalDuration
      });
    } catch (error) {
      console.error(
        "Video rendering failed:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Video rendering failed."
      });
    }
  }
);

app.listen(
  port,
  "127.0.0.1",
  () => {
    console.log(
      `Q&A video server running at http://127.0.0.1:${port}`
    );
  }
);