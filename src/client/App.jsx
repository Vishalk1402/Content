import { useEffect, useMemo, useState } from "react";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function App() {
  const [templateFile, setTemplateFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

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
    () => Boolean(templateFile && question.trim() && answer.trim()),
    [templateFile, question, answer]
  );

  function handleTemplateChange(event) {
    const file = event.target.files?.[0];
    setError("");

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

  function handleGenerate(event) {
    event.preventDefault();
    setError("");

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

    setError("Video generation is the next implementation step.");
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
            Generate Video
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
