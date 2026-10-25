import { useEffect, useMemo, useRef, useState } from "react";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001";

const TEMPLATE_CONFIG = {
  canvas: {
    width: 1080,
    height: 1920
  },

  gapSeconds: 0.45,

  question: {
    x: 90,
    y: 250,
    width: 900,
    fontSize: 42,
    bold: true,
    lineHeight: 58
  },

  answer: {
    x: 90,
    y: 380,
    width: 900,
    fontSize: 42,
    bold: false,
    lineHeight: 58
  }
};

function getVisibleText(text, progress) {
  if (!text) {
    return "";
  }

  const clampedProgress = Math.max(
    0,
    Math.min(1, progress)
  );

  const characterCount = Math.floor(
    text.length * clampedProgress
  );

  return text.slice(0, characterCount);
}

function waitForAudioReady(audio) {
  return new Promise((resolve, reject) => {
    if (
      audio.readyState >=
      HTMLMediaElement.HAVE_METADATA
    ) {
      resolve();
      return;
    }

    const handleLoaded = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(
        new Error(
          "Failed to load audio for video recording."
        )
      );
    };

    const cleanup = () => {
      audio.removeEventListener(
        "loadedmetadata",
        handleLoaded
      );

      audio.removeEventListener(
        "error",
        handleError
      );
    };

    audio.addEventListener(
      "loadedmetadata",
      handleLoaded
    );

    audio.addEventListener(
      "error",
      handleError
    );

    audio.load();
  });
}

function App() {
  const [templateFile, setTemplateFile] =
    useState(null);

  const [question, setQuestion] =
    useState("");

  const [answer, setAnswer] =
    useState("");

  const [error, setError] =
    useState("");

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [audioResult, setAudioResult] =
    useState(null);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [isRecording, setIsRecording] =
    useState(false);

  const [previewState, setPreviewState] =
    useState("idle");

  const [segmentProgress, setSegmentProgress] =
    useState(0);

  const [durations, setDurations] =
    useState({
      question: 0,
      answer: 0
    });

  const [downloadFormat, setDownloadFormat] =
    useState("");

  const questionAudioRef =
    useRef(null);

  const answerAudioRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const canvasContextRef =
    useRef(null);

  const imageRef =
    useRef(null);

  const gapTimerRef =
    useRef(null);

  const animationFrameRef =
    useRef(null);

  const recorderRef =
    useRef(null);

  const recordingResourcesRef =
    useRef(null);

  useEffect(() => {
    if (!templateFile) {
      setPreviewUrl("");
      imageRef.current = null;

      return undefined;
    }

    const url =
      URL.createObjectURL(templateFile);

    setPreviewUrl(url);
    imageRef.current = null;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [templateFile]);

  useEffect(() => {
    return () => {
      clearTimeout(
        gapTimerRef.current
      );

      cancelAnimationFrame(
        animationFrameRef.current
      );

      const resources =
        recordingResourcesRef.current;

      if (resources) {
        resources.questionAudio.pause();
        resources.answerAudio.pause();

        resources.audioContext
          .close()
          .catch(() => { });

        resources.stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        resources.canvasStream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);

  const canGenerate = useMemo(
    () =>
      Boolean(
        templateFile &&
        question.trim() &&
        answer.trim() &&
        !isGenerating &&
        !isRecording
      ),
    [
      templateFile,
      question,
      answer,
      isGenerating,
      isRecording
    ]
  );

  function getCanvasContext() {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return null;
    }

    if (!canvasContextRef.current) {
      canvasContextRef.current =
        canvas.getContext("2d");
    }

    return canvasContextRef.current;
  }

  async function loadTemplateImage() {
    if (imageRef.current) {
      return imageRef.current;
    }

    if (!previewUrl) {
      throw new Error(
        "Template image is not available."
      );
    }

    const image =
      new Image();

    await new Promise(
      (resolve, reject) => {
        image.onload = resolve;

        image.onerror = () =>
          reject(
            new Error(
              "Failed to load template image."
            )
          );

        image.src =
          previewUrl;
      }
    );

    imageRef.current =
      image;

    return image;
  }

  function drawText(
    context,
    text,
    config
  ) {
    if (!text) {
      return;
    }

    const x =
      config.x;

    const y =
      config.y;

    const maxWidth =
      config.width;

    const fontSize =
      config.fontSize;

    const lineHeight =
      config.lineHeight;

    context.save();

    context.font =
      `${config.bold ? "bold " : ""}${fontSize}px Arial`;

    context.fillStyle =
      "#ffffff";

    context.textBaseline =
      "top";

    const words =
      text.split(/\s+/);

    let line = "";

    let lineY =
      y;

    for (const word of words) {
      const testLine =
        line
          ? `${line} ${word}`
          : word;

      const width =
        context.measureText(
          testLine
        ).width;

      if (
        width > maxWidth &&
        line
      ) {
        context.fillText(
          line,
          x,
          lineY
        );

        line =
          word;

        lineY +=
          lineHeight;
      } else {
        line =
          testLine;
      }
    }

    if (line) {
      context.fillText(
        line,
        x,
        lineY
      );
    }

    context.restore();
  }

  function renderCanvasFrame({
    image,
    questionText,
    answerText
  }) {
    const canvas =
      canvasRef.current;

    const context =
      getCanvasContext();

    if (
      !canvas ||
      !context ||
      !image
    ) {
      return;
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    drawText(
      context,
      questionText,
      TEMPLATE_CONFIG.question
    );

    drawText(
      context,
      answerText,
      TEMPLATE_CONFIG.answer
    );
  }

  function stopAnimation() {
    cancelAnimationFrame(
      animationFrameRef.current
    );

    animationFrameRef.current =
      null;
  }

  function animateAudio({
    audio,
    image,
    questionText,
    answerText
  }) {
    stopAnimation();

    const frame =
      () => {
        if (
          !audio ||
          audio.ended
        ) {
          return;
        }

        const duration =
          audio.duration;

        const progress =
          Number.isFinite(duration) &&
            duration > 0
            ? Math.min(
              1,
              audio.currentTime /
              duration
            )
            : 0;

        setSegmentProgress(
          progress
        );

        renderCanvasFrame({
          image,

          questionText:
            questionText(
              progress
            ),

          answerText:
            answerText(
              progress
            )
        });

        if (
          !audio.paused &&
          !audio.ended
        ) {
          animationFrameRef.current =
            requestAnimationFrame(
              frame
            );
        }
      };

    animationFrameRef.current =
      requestAnimationFrame(
        frame
      );
  }

  function handleTemplateChange(
    event
  ) {
    const file =
      event.target.files?.[0];

    setError("");

    setAudioResult(null);

    setPreviewState(
      "idle"
    );

    setSegmentProgress(
      0
    );

    setDownloadFormat("");

    if (!file) {
      setTemplateFile(null);
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setTemplateFile(null);

      setError(
        "Please select an image template."
      );

      return;
    }

    if (
      file.size >
      MAX_IMAGE_SIZE
    ) {
      setTemplateFile(null);

      setError(
        "Template image must be 10 MB or smaller."
      );

      return;
    }

    setTemplateFile(
      file
    );
  }

  async function handlePreview() {
    if (isRecording) {
      return;
    }

    const questionAudio =
      questionAudioRef.current;

    const answerAudio =
      answerAudioRef.current;

    if (
      !questionAudio ||
      !answerAudio
    ) {
      setError(
        "Generate the audio first."
      );

      return;
    }

    clearTimeout(
      gapTimerRef.current
    );

    stopAnimation();

    questionAudio.pause();
    answerAudio.pause();

    questionAudio.currentTime =
      0;

    answerAudio.currentTime =
      0;

    try {
      const image =
        await loadTemplateImage();

      renderCanvasFrame({
        image,

        questionText:
          "",

        answerText:
          ""
      });

      setPreviewState(
        "question"
      );

      setSegmentProgress(
        0
      );

      await questionAudio.play();

      animateAudio({
        audio:
          questionAudio,

        image,

        questionText:
          (progress) =>
            getVisibleText(
              `Q. ${question.trim()}`,
              progress
            ),

        answerText:
          () => ""
      });
    } catch (previewError) {
      setPreviewState(
        "idle"
      );

      setError(
        previewError instanceof Error
          ? previewError.message
          : "Unable to start preview."
      );
    }
  }

  async function handleQuestionEnded() {
    if (isRecording) {
      return;
    }

    stopAnimation();

    clearTimeout(
      gapTimerRef.current
    );

    const answerAudio =
      answerAudioRef.current;

    if (!answerAudio) {
      return;
    }

    try {
      const image =
        await loadTemplateImage();

      setPreviewState(
        "gap"
      );

      setSegmentProgress(
        1
      );

      renderCanvasFrame({
        image,

        questionText:
          `Q. ${question.trim()}`,

        answerText:
          ""
      });

      gapTimerRef.current =
        setTimeout(
          async () => {
            try {
              answerAudio.currentTime =
                0;

              setPreviewState(
                "answer"
              );

              setSegmentProgress(
                0
              );

              renderCanvasFrame({
                image,

                questionText:
                  `Q. ${question.trim()}`,

                answerText:
                  ""
              });

              await answerAudio.play();

              animateAudio({
                audio:
                  answerAudio,

                image,

                questionText:
                  () =>
                    `Q. ${question.trim()}`,

                answerText:
                  (progress) =>
                    getVisibleText(
                      answer.trim(),
                      progress
                    )
              });
            } catch (error) {
              setPreviewState(
                "idle"
              );

              setError(
                error instanceof Error
                  ? error.message
                  : "Unable to start answer audio."
              );
            }
          },

          TEMPLATE_CONFIG.gapSeconds *
          1000
        );
    } catch (error) {
      setPreviewState(
        "idle"
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to continue preview."
      );
    }
  }

  async function handleAnswerEnded() {
    if (isRecording) {
      return;
    }

    stopAnimation();

    setPreviewState(
      "complete"
    );

    setSegmentProgress(
      1
    );

    const image =
      await loadTemplateImage();

    renderCanvasFrame({
      image,

      questionText:
        `Q. ${question.trim()}`,

      answerText:
        answer.trim()
    });
  }

  function handleStopPreview() {
    if (isRecording) {
      return;
    }

    clearTimeout(
      gapTimerRef.current
    );

    stopAnimation();

    questionAudioRef.current?.pause();

    answerAudioRef.current?.pause();

    setPreviewState(
      "idle"
    );

    setSegmentProgress(
      0
    );

    if (imageRef.current) {
      renderCanvasFrame({
        image:
          imageRef.current,

        questionText:
          "",

        answerText:
          ""
      });
    }
  }

  async function handleGenerate(
    event
  ) {
    event.preventDefault();

    setError("");

    setAudioResult(null);

    setPreviewState(
      "idle"
    );

    setSegmentProgress(
      0
    );

    setDownloadFormat(
      ""
    );

    if (!templateFile) {
      setError(
        "Upload a template image first."
      );

      return;
    }

    if (!question.trim()) {
      setError(
        "Enter a Question."
      );

      return;
    }

    if (!answer.trim()) {
      setError(
        "Enter an Answer."
      );

      return;
    }

    const formData =
      new FormData();

    formData.append(
      "template",
      templateFile
    );

    formData.append(
      "question",
      question.trim()
    );

    formData.append(
      "answer",
      answer.trim()
    );

    setIsGenerating(
      true
    );

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/generate`,
          {
            method:
              "POST",

            body:
              formData
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Audio generation failed."
        );
      }

      setDurations({
        question:
          0,

        answer:
          0
      });

      setAudioResult({
        runId:
          data.runId,

        questionAudioUrl:
          `${API_BASE_URL}${data.questionAudioUrl}`,

        answerAudioUrl:
          `${API_BASE_URL}${data.answerAudioUrl}`,

        questionVoice:
          data.questionVoice,

        answerVoice:
          data.answerVoice,

        questionAudioBytes:
          data.questionAudioBytes,

        answerAudioBytes:
          data.answerAudioBytes
      });
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Audio generation failed."
      );
    } finally {
      setIsGenerating(
        false
      );
    }
  }

  async function handleDownloadVideo() {
    if (isRecording) {
      return;
    }

    if (!audioResult) {
      setError(
        "Generate the audio first."
      );

      return;
    }

    if (
      !window.MediaRecorder ||
      !HTMLCanvasElement.prototype.captureStream
    ) {
      setError(
        "Your browser does not support direct video recording. Use the latest Chrome or Edge."
      );

      return;
    }

    const canvas =
      canvasRef.current;

    if (!canvas) {
      setError(
        "Canvas is not available."
      );

      return;
    }

    setError("");

    setIsRecording(
      true
    );

    setDownloadFormat(
      ""
    );

    clearTimeout(
      gapTimerRef.current
    );

    stopAnimation();

    try {
      const image =
        await loadTemplateImage();

      /*
       * Use separate temporary audio elements
       * for recording.
       *
       * This is important because the visible
       * preview audio elements should not be
       * reused as MediaElementSource nodes.
       */

      const recordingQuestionAudio =
        new Audio();

      const recordingAnswerAudio =
        new Audio();

      recordingQuestionAudio.crossOrigin =
        "anonymous";

      recordingAnswerAudio.crossOrigin =
        "anonymous";

      recordingQuestionAudio.src =
        audioResult.questionAudioUrl;

      recordingAnswerAudio.src =
        audioResult.answerAudioUrl;

      recordingQuestionAudio.preload =
        "auto";

      recordingAnswerAudio.preload =
        "auto";

      await Promise.all([
        waitForAudioReady(
          recordingQuestionAudio
        ),

        waitForAudioReady(
          recordingAnswerAudio
        )
      ]);

      const audioContext =
        new AudioContext();

      await audioContext.resume();

      const destination =
        audioContext.createMediaStreamDestination();

      const questionSource =
        audioContext.createMediaElementSource(
          recordingQuestionAudio
        );

      const answerSource =
        audioContext.createMediaElementSource(
          recordingAnswerAudio
        );

      questionSource.connect(
        destination
      );

      answerSource.connect(
        destination
      );

      /*
       * The canvas shown to the user is the
       * exact same canvas that gets recorded.
       */

      const canvasStream =
        canvas.captureStream(
          30
        );

      const combinedStream =
        new MediaStream();

      canvasStream
        .getVideoTracks()
        .forEach(
          (track) => {
            combinedStream.addTrack(
              track
            );
          }
        );

      destination.stream
        .getAudioTracks()
        .forEach(
          (track) => {
            combinedStream.addTrack(
              track
            );
          }
        );

      const mimeTypes = [
        "video/mp4;codecs=h264,aac",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
      ];

      const mimeType =
        mimeTypes.find(
          (type) =>
            MediaRecorder.isTypeSupported(
              type
            )
        );

      if (!mimeType) {
        throw new Error(
          "This browser does not support a compatible video recording format."
        );
      }

      const extension =
        mimeType.startsWith(
          "video/mp4"
        )
          ? "mp4"
          : "webm";

      setDownloadFormat(
        extension.toUpperCase()
      );

      const recorder =
        new MediaRecorder(
          combinedStream,
          {
            mimeType,

            videoBitsPerSecond:
              6_000_000
          }
        );

      recorderRef.current =
        recorder;

      const recordedChunks =
        [];

      recordingResourcesRef.current =
      {
        questionAudio:
          recordingQuestionAudio,

        answerAudio:
          recordingAnswerAudio,

        audioContext,

        destination,

        canvasStream,

        stream:
          combinedStream
      };

      recorder.ondataavailable =
        (event) => {
          if (
            event.data.size >
            0
          ) {
            recordedChunks.push(
              event.data
            );
          }
        };

      recorder.onerror =
        () => {
          setIsRecording(
            false
          );

          setError(
            "Video recording failed."
          );
        };

      recorder.onstop =
        async () => {
          const blob =
            new Blob(
              recordedChunks,
              {
                type:
                  mimeType
              }
            );

          if (!blob.size) {
            setError(
              "The recorded video is empty."
            );
          } else {
            /*
             * Direct download.
             *
             * No second video preview.
             * No server-side rendering.
             */

            const url =
              URL.createObjectURL(
                blob
              );

            const anchor =
              document.createElement(
                "a"
              );

            anchor.href =
              url;

            anchor.download =
              `qa-video-${Date.now()}.${extension}`;

            document.body.appendChild(
              anchor
            );

            anchor.click();

            anchor.remove();

            setTimeout(
              () =>
                URL.revokeObjectURL(
                  url
                ),
              1000
            );

            // The final video Blob is already created locally,
            // so the generated server-side audio files are no
            // longer needed.
            await cleanupGeneratedRun(
              audioResult.runId
            );
          }

          combinedStream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );

          canvasStream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );

          audioContext
            .close()
            .catch(
              () => { }
            );

          recordingQuestionAudio.pause();
          recordingAnswerAudio.pause();

          recordingQuestionAudio.src =
            "";

          recordingAnswerAudio.src =
            "";

          recordingResourcesRef.current =
            null;

          recorderRef.current =
            null;

          setIsRecording(
            false
          );
        };

      /*
       * Start with a completely empty frame.
       */

      renderCanvasFrame({
        image,
        questionText: "",
        answerText: ""
      });

      setPreviewState("question");
      setSegmentProgress(0);

      await new Promise((resolve) =>
        requestAnimationFrame(resolve)
      );

      recorder.start(100);

      await recordingQuestionAudio.play();

      /*
       * QUESTION RECORDING
       */

      const recordQuestion =
        () => {
          if (
            recordingQuestionAudio.paused ||
            recordingQuestionAudio.ended
          ) {
            return;
          }

          const progress =
            recordingQuestionAudio.duration >
              0
              ? Math.min(
                1,

                recordingQuestionAudio.currentTime /
                recordingQuestionAudio.duration
              )
              : 0;

          setSegmentProgress(
            progress
          );

          renderCanvasFrame({
            image,

            questionText:
              getVisibleText(
                `Q. ${question.trim()}`,
                progress
              ),

            answerText:
              ""
          });

          animationFrameRef.current =
            requestAnimationFrame(
              recordQuestion
            );
        };

      animationFrameRef.current =
        requestAnimationFrame(
          recordQuestion
        );

      /*
       * QUESTION END
       */

      recordingQuestionAudio.onended =
        () => {
          stopAnimation();

          setPreviewState(
            "gap"
          );

          setSegmentProgress(
            1
          );

          renderCanvasFrame({
            image,

            questionText:
              `Q. ${question.trim()}`,

            answerText:
              ""
          });

          gapTimerRef.current =
            setTimeout(
              async () => {
                try {
                  recordingAnswerAudio.currentTime =
                    0;

                  setPreviewState(
                    "answer"
                  );

                  setSegmentProgress(
                    0
                  );

                  renderCanvasFrame({
                    image,

                    questionText:
                      `Q. ${question.trim()}`,

                    answerText:
                      ""
                  });

                  await recordingAnswerAudio.play();

                  /*
                   * ANSWER RECORDING
                   */

                  const recordAnswer =
                    () => {
                      if (
                        recordingAnswerAudio.paused ||
                        recordingAnswerAudio.ended
                      ) {
                        return;
                      }

                      const progress =
                        recordingAnswerAudio.duration >
                          0
                          ? Math.min(
                            1,

                            recordingAnswerAudio.currentTime /
                            recordingAnswerAudio.duration
                          )
                          : 0;

                      setSegmentProgress(
                        progress
                      );

                      renderCanvasFrame({
                        image,

                        questionText:
                          `Q. ${question.trim()}`,

                        answerText:
                          getVisibleText(
                            answer.trim(),
                            progress
                          )
                      });

                      animationFrameRef.current =
                        requestAnimationFrame(
                          recordAnswer
                        );
                    };

                  animationFrameRef.current =
                    requestAnimationFrame(
                      recordAnswer
                    );
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Unable to start answer audio."
                  );

                  if (
                    recorder.state !==
                    "inactive"
                  ) {
                    recorder.stop();
                  }
                }
              },

              TEMPLATE_CONFIG.gapSeconds *
              1000
            );
        };

      /*
       * ANSWER END
       */

      recordingAnswerAudio.onended =
        () => {
          stopAnimation();

          setPreviewState(
            "complete"
          );

          setSegmentProgress(
            1
          );

          renderCanvasFrame({
            image,

            questionText:
              `Q. ${question.trim()}`,

            answerText:
              answer.trim()
          });

          /*
           * Give MediaRecorder a moment
           * to capture the final frame.
           */

          setTimeout(
            () => {
              if (
                recorder.state !==
                "inactive"
              ) {
                recorder.stop();
              }
            },
            150
          );
        };
    } catch (recordingError) {
      stopAnimation();

      clearTimeout(
        gapTimerRef.current
      );

      const resources =
        recordingResourcesRef.current;

      if (resources) {
        resources.questionAudio.pause();
        resources.answerAudio.pause();

        resources.audioContext
          .close()
          .catch(() => { });

        resources.stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        resources.canvasStream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        recordingResourcesRef.current =
          null;
      }

      recorderRef.current =
        null;

      setIsRecording(
        false
      );

      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "Video recording failed."
      );
    }
  }

  async function cleanupGeneratedRun(runId) {
    if (!runId) {
      return;
    }

    try {
      await fetch(
        `${API_BASE_URL}/api/cleanup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            runId
          })
        }
      );
    } catch (cleanupError) {
      console.warn(
        "Generated files cleanup failed:",
        cleanupError
      );
    }
  }

  return (
    <main className="app-shell">
      <section className="app-card">
        <header className="header">
          <p className="eyebrow">
            Automated by VISHAL KOLI
          </p>

          <h1>
            Video Generator
          </h1>

          <p className="subtitle">
            Upload a template, enter your
            Question and Answer, then generate
            a short-form video with separate
            voices and typewriter animation.
          </p>
        </header>

        <form
          onSubmit={
            handleGenerate
          }
          className="generator-form"
        >
          <div className="field-group">
            <div className="field-heading">
              <label htmlFor="template">
                Template image
              </label>

              <span>
                PNG, JPG or WebP
              </span>
            </div>

            <label
              className={`upload-box ${previewUrl
                ? "has-preview"
                : ""
                }`}
            >
              <input
                id="template"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={
                  handleTemplateChange
                }
              />

              {previewUrl ? (
                <img
                  src={
                    previewUrl
                  }
                  alt="Selected template preview"
                />
              ) : (
                <span className="upload-placeholder">
                  <strong>
                    Choose template image
                  </strong>

                  <small>
                    Your template controls
                    the visual design.
                  </small>
                </span>
              )}
            </label>
          </div>

          <div className="field-group">
            <div className="field-heading">
              <label htmlFor="question">
                Question
              </label>

              <span>
                Male voice
              </span>
            </div>

            <textarea
              id="question"
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              placeholder="What is ALTER?"
              rows={4}
            />
          </div>

          <div className="field-group">
            <div className="field-heading">
              <label htmlFor="answer">
                Answer
              </label>

              <span>
                Female voice
              </span>
            </div>

            <textarea
              id="answer"
              value={answer}
              onChange={(event) =>
                setAnswer(
                  event.target.value
                )
              }
              placeholder="ALTER is a DDL command used to modify the structure of an existing table."
              rows={7}
            />
          </div>

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            className="generate-button"
            type="submit"
            disabled={
              !canGenerate
            }
          >
            {isGenerating
              ? "Generating Video..."
              : "Generate Video"}
          </button>
        </form>

        {audioResult && (
          <section
            className="audio-result"
            aria-live="polite"
          >
            <h2>
              Audio generated
            </h2>

            <audio
              ref={questionAudioRef}
              src={audioResult.questionAudioUrl}
              crossOrigin="anonymous"
              preload="metadata"
              onLoadedMetadata={(event) => {
                const duration = event.currentTarget?.duration;

                if (Number.isFinite(duration) && duration > 0) {
                  setDurations((current) => ({
                    ...current,
                    question: duration
                  }));
                }
              }}
              onEnded={handleQuestionEnded}
            />

            <audio
              ref={answerAudioRef}
              src={audioResult.answerAudioUrl}
              crossOrigin="anonymous"
              preload="metadata"
              onLoadedMetadata={(event) => {
                const duration = event.currentTarget?.duration;

                if (Number.isFinite(duration) && duration > 0) {
                  setDurations((current) => ({
                    ...current,
                    answer: duration
                  }));
                }
              }}
              onEnded={handleAnswerEnded}
            />

            {/*
              IMPORTANT:
              This canvas is BOTH:
              1. the visible preview
              2. the source used by MediaRecorder

              Therefore the downloaded video
              uses exactly the same animation
              as the preview.
            */}

            <canvas
              ref={
                canvasRef
              }
              width={
                TEMPLATE_CONFIG.canvas.width
              }
              height={
                TEMPLATE_CONFIG.canvas.height
              }
              style={{
                display:
                  "block",

                width:
                  "100%",

                height:
                  "auto",

                borderRadius:
                  "12px"
              }}
            />

            <div className="preview-controls">
              <button
                type="button"
                onClick={
                  handlePreview
                }
                disabled={
                  isRecording
                }
              >
                Preview Animation
              </button>

              <button
                type="button"
                onClick={
                  handleStopPreview
                }
                className="secondary-button"
                disabled={
                  isRecording
                }
              >
                Stop
              </button>

              <button
                type="button"
                onClick={
                  handleDownloadVideo
                }
                disabled={
                  isRecording
                }
              >
                {isRecording
                  ? "Recording Video..."
                  : "Download Video"}
              </button>
            </div>

            {downloadFormat &&
              !isRecording && (
                <p className="success-message">
                  Video downloaded as{" "}
                  {downloadFormat}.
                  The downloaded video uses
                  the same canvas animation as
                  the preview.
                </p>
              )}

            <div className="timing-summary">
              <span>
                Question:{" "}
                {durations.question
                  ? `${durations.question.toFixed(
                    2
                  )}s`
                  : "loading..."}
              </span>

              <span>
                Gap:{" "}
                {TEMPLATE_CONFIG.gapSeconds.toFixed(
                  2
                )}
                s
              </span>

              <span>
                Answer:{" "}
                {durations.answer
                  ? `${durations.answer.toFixed(
                    2
                  )}s`
                  : "loading..."}
              </span>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;