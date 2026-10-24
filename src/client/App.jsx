import { useEffect, useMemo, useState } from "react";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const API_BASE_URL = "http://127.0.0.1:3001";

function App() {
  const [templateFile, setTemplateFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [audioResult, setAudioResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!templateFile) {
      setPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(templateFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [templateFile]);

  const canGenerate = useMemo(
    () => Boolean(templateFile && question.trim() && answer.trim() && !isGenerating),
    [templateFile, question, answer, isGenerating]
  );

  function handleTemplateChange(event) {
    const file = event.target.files?.[0];
    setError("");
    setAudioResult(null);

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

  async function handleGenerate(event) {
    event.preventDefault();
    setError("");
    setAudioResult(null);

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

            <div className="audio-item">
              <div>
                <strong>Question · Male</strong>
                <small>{audioResult.questionVoice}</small>
              </div>
              <audio controls src={audioResult.questionAudioUrl} />
            </div>

            <div className="audio-item">
              <div>
                <strong>Answer · Female</strong>
                <small>{audioResult.answerVoice}</small>
              </div>
              <audio controls src={audioResult.answerAudioUrl} />
            </div>

            <p className="success-message">
              Both audio tracks were generated successfully. Video rendering is the next step.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
