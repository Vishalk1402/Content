import { spawn } from "node:child_process";

const outputPath = "temp/test-tts/node-question.mp3";

const args = [
  "-m",
  "edge_tts",
  "--voice",
  "en-US-AndrewNeural",
  "--rate=-10%",
  "--text",
  "What is ALTER?",
  "--write-media",
  outputPath,
  "--no-progress"
];

console.log("Python:", "python");
console.log("Args:", args);

const child = spawn("python", args, {
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";

child.stdout.on("data", (chunk) => {
  console.log("[stdout]", chunk.toString());
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
  console.log("[stderr]", chunk.toString());
});

child.on("error", (error) => {
  console.error("[spawn error]", error);
});

child.on("close", (code) => {
  console.log("[exit code]", code);

  if (code !== 0) {
    console.error("Failed:", stderr);
    return;
  }

  console.log("Edge TTS completed.");
});