import { useEffect, useMemo, useRef, useState } from "react";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const API_BASE_URL = "http://127.0.0.1:3001";
const TEMPLATE_CONFIG = {
  canvas: { width: 1080, height: 1920 },
  gapSeconds: 0.45,
  question: { x: 90, y: 430, width: 900 },
  answer: { x: 90, y: 700, width: 900 }
};

function getVisibleText(text, progress) {
  const count = Math.max(0, Math.min(text.length, Math.round(text.length * progress)));
  return text.slice(0, count);
}

function App() {
  const [templateFile, setTemplateFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [audioResult, setAudioResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [durations, setDurations] = useState({ question: 0, answer: 0 });
  const [previewState, setPreviewState] = useState("idle");
  const [segmentProgress, setSegmentProgress] = useState(0);
  const questionAudioRef = useRef(null);
  const answerAudioRef = useRef(null);
  const gapTimerRef = useRef(null);

  useEffect(() => {
    if (!templateFile) {
      setPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(templateFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [templateFile]);

  useEffect(() => () => clearTimeout(gapTimerRef.current), []);

  const canGenerate = useMemo(
    () => Boolean(templateFile && question.trim() && answer.trim() && !isGenerating),
    [templateFile, question, answer, isGenerating]
  );

  function handleTemplateChange(event) {
    const file = event.target.files?.[0];
    setError("");
    setAudioResult(null);
    setPreviewState("idle");

    if (!file) {
      setTemplateFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setTemplateFile(null);
      setError("Please select an image template.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setTemplateFile(null);
      setError("Template image must be 10 MB or smaller.");
      return;
    }

    setTemplateFile(file);
  }

  function handleQuestionTimeUpdate() {
    const audio = questionAudioRef.current;
    if (!audio?.duration) return;
    setSegmentProgress(Math.min(1, audio.currentTime / audio.duration));
  }

  function handleAnswerTimeUpdate() {
    const audio = answerAudioRef.current;
    if (!audio?.duration) return;
    setSegmentProgress(Math.min(1, audio.currentTime / audio.duration));
  }

  function handleQuestionEnded() {
    const answerAudio = answerAudioRef.current;
    if (!answerAudio) return;

    setPreviewState("gap");
    setSegmentProgress(1);

    gapTimerRef.current = setTimeout(() => {
      setPreviewState("answer");
      setSegmentProgress(0);
      answerAudio.currentTime = 0;
      answerAudio.play().catch(() => setPreviewState("idle"));
    }, TEMPLATE_CONFIG.gapSeconds * 1000);
  }

  function handleAnswerEnded() {
    setSegmentProgress(1);
    setPreviewState("complete");
  }

  async function handlePreview() {
    const questionAudio = questionAudioRef.current;
    const answerAudio = answerAudioRef.current;
    if (!questionAudio || !answerAudio) return;

    clearTimeout(gapTimerRef.current);
    answerAudio.pause();
    answerAudio.currentTime = 0;
    questionAudio.currentTime = 0;
    setSegmentProgress(0);
    setPreviewState("question");

    try {
      await questionAudio.play();
    } catch {
      setPreviewState("idle");
      setError("The browser blocked audio playback. Click Preview again to allow playback.");
    }
  }

  function handleStopPreview() {
    clearTimeout(gapTimerRef.current);
    questionAudioRef.current?.pause();
    answerAudioRef.current?.pause();
    setPreviewState("idle");
    setSegmentProgress(0);
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setError("");
    setAudioResult(null);
    setPreviewState("idle");

    if (!templateFile) {
      setError("Upload a template image first.");
      return;
    }

    if (!question.trim()) {
      setError("Enter a Question.");
      return;
    }

    if (!answer.trim()) {
      setError("Enter an Answer.");
      return;
    }

    const formData = new FormData();
    formData.append("template", templateFile);
    formData.append("question", question.trim());
    formData.append("answer", answer.trim());

    setIsGenerating(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Audio generation failed.");
      }

      setDurations({ question: 0, answer: 0 });
      setAudioResult({
        questionAudioUrl: `${API_BASE_URL}${data.questionAudioUrl}`,
        answerAudioUrl: `${API_BASE_URL}${data.answerAudioUrl}`,
        questionVoice: data.questionVoice,
        answerVoice: data.answerVoice,
        questionAudioBytes: data.questionAudioBytes,
        answerAudioBytes: data.answerAudioBytes
      });
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Audio generation failed."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const questionVisibleText =
    previewState === "answer" || previewState === "complete"
      ? question.trim()
      : getVisibleText(question.trim(), previewState === "question" ? segmentProgress : 0);

  const answerVisibleText =
    previewState === "complete"
      ? answer.trim()
      : getVisibleText(answer.trim(), previewState === "answer" ? segmentProgress : 0);

  return (
    <main className="app-shell">
      <section className="app-card">
        <header className="header">
          <p className="eyebrow">devwithvk</p>
          <h1>Q&A Video Generator</h1>
          <p className="subtitle">
            Upload a template, enter your Question and Answer, then generate a
            short-form video with separate voices and typewriter animation.
          </p>
        </header>

        <form onSubmit={handleGenerate} className="generator-form">
          <div className="field-group">
            <div className="field-heading">
              <label htmlFor="template">Template image</label>
              <span>PNG, JPG or WebP</span>
            </div>

            <label className={`upload-box ${previewUrl ? "has-preview" : ""}`}>
              <input
                id="template"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleTemplateChange}
              />

              {previewUrl ? (
                <img src={previewUrl} alt="Selected template preview" />
              ) : (
                <span className="upload-placeholder">
                  <strong>Choose template image</strong>
                  <small>Your template controls the visual design.</small>
                </span>
              )}
            </label>
          </div>

          <div className="field-group">
            <div className="field-heading">
              <label htmlFor="question">Question</label>
              <span>Male voice</span>
            </div>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What is ALTER?"
              rows={4}
            />
          </div>

          <div className="field-group">
            <div className="field-heading">
              <label htmlFor="answer">Answer</label>
              <span>Female voice</span>
            </div>
            <textarea
              id="answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="ALTER is a DDL command used to modify the structure of an existing table."
              rows={7}
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button className="generate-button" type="submit" disabled={!canGenerate}>
            {isGenerating ? "Generating Audio..." : "Generate Audio"}
          </button>
        </form>

        {audioResult && (
          <section className="audio-result" aria-live="polite">
            <h2>Audio generated</h2>

            <audio
              ref={questionAudioRef}
              src={audioResult.questionAudioUrl}
              onLoadedMetadata={(event) =>
                setDurations((current) => ({ ...current, question: event.currentTarget.duration }))
              }
              onTimeUpdate={handleQuestionTimeUpdate}
              onEnded={handleQuestionEnded}
            />

            <audio
              ref={answerAudioRef}
              src={audioResult.answerAudioUrl}
              onLoadedMetadata={(event) =>
                setDurations((current) => ({ ...current, answer: event.currentTarget.duration }))
              }
              onTimeUpdate={handleAnswerTimeUpdate}
              onEnded={handleAnswerEnded}
            />

            <div className="preview-controls">
              <button type="button" onClick={handlePreview}>
                Preview Animation
              </button>
              <button type="button" onClick={handleStopPreview} className="secondary-button">
                Stop
              </button>
            </div>

            <div className="video-preview" style={{ aspectRatio: `${TEMPLATE_CONFIG.canvas.width} / ${TEMPLATE_CONFIG.canvas.height}` }}>
              <img src={previewUrl} alt="Template animation preview" />
              <div
                className="template-text question-text"
                style={{
                  left: `${(TEMPLATE_CONFIG.question.x / TEMPLATE_CONFIG.canvas.width) * 100}%`,
                  top: `${(TEMPLATE_CONFIG.question.y / TEMPLATE_CONFIG.canvas.height) * 100}%`,
                  width: `${(TEMPLATE_CONFIG.question.width / TEMPLATE_CONFIG.canvas.width) * 100}%`
                }}
              >
                {questionVisibleText}
              </div>
              <div
                className="template-text answer-text"
                style={{
                  left: `${(TEMPLATE_CONFIG.answer.x / TEMPLATE_CONFIG.canvas.width) * 100}%`,
                  top: `${(TEMPLATE_CONFIG.answer.y / TEMPLATE_CONFIG.canvas.height) * 100}%`,
                  width: `${(TEMPLATE_CONFIG.answer.width / TEMPLATE_CONFIG.canvas.width) * 100}%`
                }}
              >
                {answerVisibleText}
              </div>
            </div>

            <div className="timing-summary">
              <span>Question: {durations.question ? `${durations.question.toFixed(2)}s` : "loading..."}</span>
              <span>Gap: {TEMPLATE_CONFIG.gapSeconds.toFixed(2)}s</span>
              <span>Answer: {durations.answer ? `${durations.answer.toFixed(2)}s` : "loading..."}</span>
            </div>

            <p className="success-message">
              Audio and typewriter timing are ready. Final MP4 rendering is the next step.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
