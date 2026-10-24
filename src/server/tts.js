import { spawn } from "node:child_process";

const pythonBin = process.env.PYTHON_BIN || "python";
const questionVoice = process.env.QUESTION_VOICE || "en-US-GuyNeural";
const answerVoice = process.env.ANSWER_VOICE || "en-US-JennyNeural";

function generateWithEdgeTts({ text, voice, outputPath }) {
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      "edge_tts",
      "--voice",
      voice,
      "--text",
      text,
      "--write-media",
      outputPath,
      "--no-progress"
    ];

    const child = spawn(pythonBin, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Could not start Python/edge-tts. Set PYTHON_BIN if Python is not on PATH. ${error.message}`
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
          `edge-tts failed for voice ${voice}. ${stderr.trim() || `Process exited with code ${code}.`}`
        )
      );
    });
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
    answerVoice
  };
}
