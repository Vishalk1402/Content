import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { generateQuestionAndAnswerAudio } from "./tts.js";

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
  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigin
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Credentials",
    "false"
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
 * The template is still accepted here because
 * the current frontend sends it as part of the
 * generation request.
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

app.listen(
  port,
  "127.0.0.1",
  () => {
    console.log(
      `Q&A video server running at http://127.0.0.1:${port}`
    );
  }
);