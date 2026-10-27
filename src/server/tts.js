import { spawn } from "node:child_process";

const pythonBin =
  process.env.PYTHON_BIN ||
  (process.platform === "win32" ? "python" : "python3");

const questionVoice =
  process.env.QUESTION_VOICE || "en-US-AndrewNeural";

const answerVoice =
  process.env.ANSWER_VOICE || "en-US-AvaNeural";

const ttsRate =
  process.env.TTS_RATE || "-10%";

function generateWithEdgeTts({
  text,
  voice,
  outputPath
}) {
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      "edge_tts",
      "--voice",
      voice,
      `--rate=${ttsRate}`,
      "--text",
      text,
      "--write-media",
      outputPath,
      "--no-progress"
    ];

    console.log(
      `[TTS] Python: ${pythonBin}`
    );

    console.log(
      `[TTS] Voice: ${voice}`
    );

    console.log(
      `[TTS] Output: ${outputPath}`
    );

    const child = spawn(
      pythonBin,
      args,
      {
        windowsHide: true,
        stdio: [
          "ignore",
          "pipe",
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
            `Could not start Python/edge-tts using "${pythonBin}". ${error.message}`
          )
        );
      }
    );

    child.on(
      "close",
      async (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `edge-tts failed for voice ${voice}. ${
                stderr.trim() ||
                `Process exited with code ${code}.`
              }`
            )
          );

          return;
        }

        try {
          const fs =
            await import("node:fs/promises");

          const stats =
            await fs.stat(outputPath);

          if (stats.size === 0) {
            reject(
              new Error(
                `edge-tts completed but created an empty file: ${outputPath}`
              )
            );

            return;
          }

          console.log(
            `[TTS] Generated ${stats.size} bytes`
          );

          resolve();
        } catch (error) {
          reject(
            new Error(
              `edge-tts completed successfully but did not create the expected audio file: ${outputPath}. ${
                error instanceof Error
                  ? error.message
                  : error
              }`
            )
          );
        }
      }
    );
  });
}

export async function generateQuestionAndAnswerAudio({
  question,
  answer,
  questionPath,
  answerPath
}) {
  await generateWithEdgeTts({
    text: question,
    voice: questionVoice,
    outputPath: questionPath
  });

  await generateWithEdgeTts({
    text: answer,
    voice: answerVoice,
    outputPath: answerPath
  });

  return {
    questionVoice,
    answerVoice,
    ttsRate
  };
}