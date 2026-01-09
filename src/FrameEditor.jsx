import React, { useEffect, useRef, useState } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import frameImg from "./frame.png";

const CANVAS_SIZE = 1080;
const OUTPUT_SIZE = 521;

const CIRCLE_X = 536;
const CIRCLE_Y = 355;
const RADIUS = OUTPUT_SIZE / 2;

export default function FrameEditor() {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const captureCanvasRef = useRef(null);
    const finalCanvasRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const latestFrameRef = useRef(null);

    const [mode, setMode] = useState("camera"); // camera | loading | preview

    // 🎥 Init camera + AI ONCE
    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "user" } })
            .then((stream) => {
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            });

        const fd = new FaceDetection({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        });

        fd.setOptions({
            model: "short",
            minDetectionConfidence: 0.6,
        });

        fd.onResults((results) => {
            const srcCanvas = latestFrameRef.current;
            if (!srcCanvas) return;

            let cropSize = Math.min(srcCanvas.width, srcCanvas.height);
            let cx = srcCanvas.width / 2;
            let cy = srcCanvas.height / 2;

            if (results.detections?.length) {
                const box = results.detections[0].boundingBox;
                cx = box.xCenter * srcCanvas.width;
                cy = box.yCenter * srcCanvas.height;
                cropSize *= 0.75;
            }

            let x = cx - cropSize / 2;
            let y = cy - cropSize / 2;

            x = Math.max(0, Math.min(x, srcCanvas.width - cropSize));
            y = Math.max(0, Math.min(y, srcCanvas.height - cropSize));

            const out = document.createElement("canvas");
            out.width = OUTPUT_SIZE;
            out.height = OUTPUT_SIZE;

            out
                .getContext("2d")
                .drawImage(
                    srcCanvas,
                    x,
                    y,
                    cropSize,
                    cropSize,
                    0,
                    0,
                    OUTPUT_SIZE,
                    OUTPUT_SIZE
                );

            autoApplyFrame(out);
        });

        faceDetectorRef.current = fd;
    }, []);

    // 📸 Capture
    const capturePhoto = async () => {
        setMode("loading");

        const video = videoRef.current;
        const canvas = captureCanvasRef.current;
        const ctx = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        latestFrameRef.current = canvas;
        await faceDetectorRef.current.send({ image: canvas });
    };

    // 🖼️ Auto apply frame
    const autoApplyFrame = (photoCanvas) => {
        const canvas = finalCanvasRef.current;
        if (!canvas) return; // 🛡️ safety guard

        const ctx = canvas.getContext("2d");

        const frame = new Image();
        frame.src = frameImg;

        frame.onload = () => {
            ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            ctx.drawImage(frame, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

            ctx.save();
            ctx.beginPath();
            ctx.arc(CIRCLE_X, CIRCLE_Y, RADIUS, 0, Math.PI * 2);
            ctx.clip();

            ctx.drawImage(
                photoCanvas,
                CIRCLE_X - RADIUS,
                CIRCLE_Y - RADIUS,
                OUTPUT_SIZE,
                OUTPUT_SIZE
            );

            ctx.restore();

            setMode("preview");
        };
    };

    // 🔁 Retake
    const retake = () => {
        setMode("camera");

        requestAnimationFrame(() => {
            if (videoRef.current && streamRef.current) {
                videoRef.current.srcObject = streamRef.current;
                videoRef.current.play();
            }
        });
    };

    // ⬇️ Download
    const download = () => {
        const link = document.createElement("a");
        link.download = "framed-photo.png";
        link.href = finalCanvasRef.current.toDataURL("image/png");
        link.click();
    };

    return (
        <div style={{ textAlign: "center" }}>
            <h2>Camera Capture</h2>

            {mode === "camera" && (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: 260, borderRadius: 12 }}
                    />
                    <br /><br />
                    <button onClick={capturePhoto}>Capture</button>
                </>
            )}

            {mode === "loading" && <p>Processing photo…</p>}

            {/* ✅ ALWAYS mounted canvas */}
            <canvas
                ref={finalCanvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={{
                    width: 300,
                    display: mode === "preview" ? "block" : "none",
                }}
            />

            {mode === "preview" && (
                <>
                    <br />
                    <button onClick={retake}>Retake</button>
                    <button onClick={download}>Download</button>
                </>
            )}

            <canvas ref={captureCanvasRef} style={{ display: "none" }} />
        </div>
    );
}
