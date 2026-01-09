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
    const captureCanvasRef = useRef(null);
    const finalCanvasRef = useRef(null);

    const faceDetectorRef = useRef(null);
    const latestFrameRef = useRef(null);

    const [photo, setPhoto] = useState(null);

    // 🎥 Init camera + face detector ONCE
    useEffect(() => {
        // Camera
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "user" } })
            .then((stream) => {
                videoRef.current.srcObject = stream;
            });

        // Face detector
        const fd = new FaceDetection({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        });

        fd.setOptions({
            model: "short",
            minDetectionConfidence: 0.6,
        });

        // 🔑 Register onResults ONCE
        fd.onResults((results) => {
            const canvas = latestFrameRef.current;
            if (!canvas) return;

            let cropSize = Math.min(canvas.width, canvas.height);
            let cx = canvas.width / 2;
            let cy = canvas.height / 2;

            if (results.detections?.length) {
                const box = results.detections[0].boundingBox;
                cx = box.xCenter * canvas.width;
                cy = box.yCenter * canvas.height;
                cropSize *= 0.75;
            }

            let x = cx - cropSize / 2;
            let y = cy - cropSize / 2;

            x = Math.max(0, Math.min(x, canvas.width - cropSize));
            y = Math.max(0, Math.min(y, canvas.height - cropSize));

            const out = document.createElement("canvas");
            out.width = OUTPUT_SIZE;
            out.height = OUTPUT_SIZE;

            out
                .getContext("2d")
                .drawImage(
                    canvas,
                    x,
                    y,
                    cropSize,
                    cropSize,
                    0,
                    0,
                    OUTPUT_SIZE,
                    OUTPUT_SIZE
                );

            const img = new Image();
            img.onload = () => setPhoto(img);
            img.src = out.toDataURL("image/png");
        });

        faceDetectorRef.current = fd;
    }, []);

    // 📸 Capture safely
    const captureFaceCentered = async () => {
        const video = videoRef.current;
        const canvas = captureCanvasRef.current;
        const ctx = canvas.getContext("2d");

        if (!video.videoWidth) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0);

        // store frame for onResults
        latestFrameRef.current = canvas;

        // 🔑 ONLY call send()
        await faceDetectorRef.current.send({ image: canvas });
    };

    // 🖼️ Apply Frame
    const applyFrame = () => {
        const canvas = finalCanvasRef.current;
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
                photo,
                CIRCLE_X - RADIUS,
                CIRCLE_Y - RADIUS,
                OUTPUT_SIZE,
                OUTPUT_SIZE
            );

            ctx.restore();
        };
    };

    const download = () => {
        const link = document.createElement("a");
        link.download = "final-frame.png";
        link.href = finalCanvasRef.current.toDataURL("image/png");
        link.click();
    };

    return (
        <div style={{ textAlign: "center" }}>
            <h2>Camera Preview</h2>

            <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: 260, borderRadius: 10 }}
            />

            <br /><br />

            <button onClick={captureFaceCentered}>
                Take Photo
            </button>

            <canvas ref={captureCanvasRef} style={{ display: "none" }} />

            <br /><br />

            <canvas
                ref={finalCanvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={{ width: 300 }}
            />

            <br /><br />

            {photo && (
                <>
                    <button onClick={applyFrame}>Apply Frame</button>
                    <button onClick={download}>Download</button>
                </>
            )}
        </div>
    );
}
