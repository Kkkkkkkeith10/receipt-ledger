<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte";

    const dispatch = createEventDispatcher<{
        capture: { blob: Blob; dataUrl: string };
        error: { message: string };
        cancel: void;
    }>();

    // Props
    export let facingMode: "user" | "environment" = "environment"; // environment = back camera
    export let quality: number = 0.92; // JPEG quality 0-1
    export let maxWidth: number = 1920;
    export let maxHeight: number = 1080;

    // State
    let videoElement: HTMLVideoElement;
    let canvasElement: HTMLCanvasElement;
    let stream: MediaStream | null = null;
    let isReady = false;
    let hasMultipleCameras = false;
    let capturedImage: string | null = null;
    let errorMessage: string | null = null;
    let isCapturing = false;

    // Check camera availability and start
    onMount(async () => {
        try {
            // Check for multiple cameras
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter((d) => d.kind === "videoinput");
            hasMultipleCameras = videoDevices.length > 1;

            await startCamera();
        } catch (err: any) {
            handleError(err);
        }
    });

    onDestroy(() => {
        stopCamera();
    });

    async function startCamera() {
        errorMessage = null;

        try {
            // Stop existing stream if any
            stopCamera();

            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: maxWidth },
                    height: { ideal: maxHeight },
                },
                audio: false,
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoElement) {
                videoElement.srcObject = stream;
                await videoElement.play();
                isReady = true;
            }
        } catch (err: any) {
            handleError(err);
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
        }
        isReady = false;
    }

    function handleError(err: Error) {
        console.error("Camera error:", err);

        if (err.name === "NotAllowedError") {
            errorMessage =
                "Camera access denied. Please allow camera access in your browser settings.";
        } else if (err.name === "NotFoundError") {
            errorMessage = "No camera found on this device.";
        } else if (err.name === "NotReadableError") {
            errorMessage = "Camera is in use by another application.";
        } else {
            errorMessage = `Camera error: ${err.message}`;
        }

        dispatch("error", { message: errorMessage });
    }

    async function switchCamera() {
        facingMode = facingMode === "environment" ? "user" : "environment";
        await startCamera();
    }

    async function capturePhoto() {
        if (!videoElement || !canvasElement || !isReady) return;

        isCapturing = true;

        try {
            const ctx = canvasElement.getContext("2d");
            if (!ctx) throw new Error("Could not get canvas context");

            // Set canvas size to video size
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;

            // Draw video frame to canvas
            ctx.drawImage(videoElement, 0, 0);

            // Convert to blob
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvasElement.toBlob(
                    (b) => {
                        if (b) resolve(b);
                        else reject(new Error("Failed to create image blob"));
                    },
                    "image/jpeg",
                    quality,
                );
            });

            // Create data URL for preview
            const dataUrl = canvasElement.toDataURL("image/jpeg", quality);
            capturedImage = dataUrl;

            // Stop camera while previewing
            stopCamera();
        } catch (err: any) {
            handleError(err);
        } finally {
            isCapturing = false;
        }
    }

    function retake() {
        capturedImage = null;
        startCamera();
    }

    function confirm() {
        if (!capturedImage || !canvasElement) return;

        // Convert data URL to blob
        canvasElement.toBlob(
            (blob) => {
                if (blob) {
                    dispatch("capture", { blob, dataUrl: capturedImage! });
                }
            },
            "image/jpeg",
            quality,
        );
    }

    function cancel() {
        stopCamera();
        capturedImage = null;
        dispatch("cancel");
    }
</script>

<div class="camera-capture">
    {#if errorMessage}
        <!-- Error State -->
        <div class="error-container">
            <div class="error-icon">📷</div>
            <p class="error-message">{errorMessage}</p>
            <div class="error-actions">
                <button
                    type="button"
                    class="btn btn-primary"
                    on:click={startCamera}>Try Again</button
                >
                <button
                    type="button"
                    class="btn btn-secondary"
                    on:click={cancel}>Cancel</button
                >
            </div>
        </div>
    {:else if capturedImage}
        <!-- Preview State -->
        <div class="preview-container">
            <img
                src={capturedImage}
                alt="Captured receipt"
                class="preview-image"
            />
            <div class="preview-overlay">
                <p class="preview-hint">Review your photo</p>
            </div>
            <div class="preview-actions">
                <button
                    type="button"
                    class="btn btn-secondary"
                    on:click={retake}
                >
                    <span class="btn-icon">🔄</span>
                    Retake
                </button>
                <button
                    type="button"
                    class="btn btn-primary"
                    on:click={confirm}
                >
                    <span class="btn-icon">✓</span>
                    Use Photo
                </button>
            </div>
        </div>
    {:else}
        <!-- Camera State -->
        <div class="camera-container">
            <!-- svelte-ignore a11y-media-has-caption -->
            <video
                bind:this={videoElement}
                autoplay
                playsinline
                class="camera-video"
            />

            <!-- Camera guide overlay -->
            <div class="camera-overlay">
                <div class="guide-frame">
                    <div class="guide-corner top-left"></div>
                    <div class="guide-corner top-right"></div>
                    <div class="guide-corner bottom-left"></div>
                    <div class="guide-corner bottom-right"></div>
                </div>
                <p class="guide-text">Position receipt within frame</p>
            </div>

            <!-- Loading state -->
            {#if !isReady}
                <div class="loading-overlay">
                    <div class="loading-spinner"></div>
                    <p>Starting camera...</p>
                </div>
            {/if}

            <!-- Camera controls -->
            <div class="camera-controls">
                <button
                    type="button"
                    class="btn btn-secondary btn-icon-only"
                    on:click={cancel}
                >
                    ✕
                </button>

                <button
                    type="button"
                    class="capture-button"
                    on:click={capturePhoto}
                    disabled={!isReady || isCapturing}
                >
                    <span class="capture-ring"></span>
                </button>

                {#if hasMultipleCameras}
                    <button
                        type="button"
                        class="btn btn-secondary btn-icon-only"
                        on:click={switchCamera}
                    >
                        🔄
                    </button>
                {:else}
                    <div class="spacer"></div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Hidden canvas for capture -->
    <canvas bind:this={canvasElement} class="hidden-canvas" />
</div>

<style>
    .camera-capture {
        position: relative;
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
    }

    .camera-container,
    .preview-container,
    .error-container {
        position: relative;
        aspect-ratio: 3 / 4;
        display: flex;
        flex-direction: column;
    }

    .camera-video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .preview-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
    }

    /* Camera overlay with guide frame */
    .camera-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .guide-frame {
        position: relative;
        width: 85%;
        height: 70%;
        border: 2px dashed rgba(255, 255, 255, 0.4);
        border-radius: 8px;
    }

    .guide-corner {
        position: absolute;
        width: 20px;
        height: 20px;
        border-color: #fff;
        border-style: solid;
    }

    .guide-corner.top-left {
        top: -2px;
        left: -2px;
        border-width: 3px 0 0 3px;
        border-radius: 4px 0 0 0;
    }

    .guide-corner.top-right {
        top: -2px;
        right: -2px;
        border-width: 3px 3px 0 0;
        border-radius: 0 4px 0 0;
    }

    .guide-corner.bottom-left {
        bottom: -2px;
        left: -2px;
        border-width: 0 0 3px 3px;
        border-radius: 0 0 0 4px;
    }

    .guide-corner.bottom-right {
        bottom: -2px;
        right: -2px;
        border-width: 0 3px 3px 0;
        border-radius: 0 0 4px 0;
    }

    .guide-text {
        margin-top: 16px;
        color: #fff;
        font-size: 14px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    }

    /* Loading overlay */
    .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Camera controls */
    .camera-controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px 32px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
    }

    .capture-button {
        position: relative;
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: #fff;
        border: 4px solid rgba(255, 255, 255, 0.5);
        cursor: pointer;
        transition: transform 0.1s;
    }

    .capture-button:hover:not(:disabled) {
        transform: scale(1.05);
    }

    .capture-button:active:not(:disabled) {
        transform: scale(0.95);
    }

    .capture-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .capture-ring {
        position: absolute;
        inset: 4px;
        border-radius: 50%;
        background: #fff;
    }

    .spacer {
        width: 44px;
    }

    /* Preview actions */
    .preview-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding: 16px;
        background: linear-gradient(rgba(0, 0, 0, 0.5), transparent);
    }

    .preview-hint {
        color: #fff;
        font-size: 14px;
        text-align: center;
    }

    .preview-actions {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        gap: 12px;
        padding: 20px 24px 32px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    }

    /* Error state */
    .error-container {
        align-items: center;
        justify-content: center;
        padding: 32px;
        background: #1a1a1a;
        color: #fff;
        text-align: center;
    }

    .error-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .error-message {
        margin-bottom: 24px;
        color: #ccc;
    }

    .error-actions {
        display: flex;
        gap: 12px;
    }

    /* Buttons */
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 500;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        transition:
            background 0.2s,
            transform 0.1s;
    }

    .btn:active {
        transform: scale(0.98);
    }

    .btn-primary {
        background: #3b82f6;
        color: #fff;
        flex: 1;
    }

    .btn-primary:hover {
        background: #2563eb;
    }

    .btn-secondary {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        flex: 1;
    }

    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .btn-icon-only {
        width: 44px;
        height: 44px;
        padding: 0;
        flex: none;
        font-size: 20px;
    }

    .btn-icon {
        font-size: 18px;
    }

    /* Hidden canvas */
    .hidden-canvas {
        display: none;
    }

    /* Responsive */
    @media (max-width: 480px) {
        .camera-capture {
            max-width: 100%;
            border-radius: 0;
        }

        .camera-container,
        .preview-container,
        .error-container {
            aspect-ratio: auto;
            height: 100vh;
            height: 100dvh;
        }
    }
</style>
