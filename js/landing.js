/**
 * World Cup 2026 Pool - Landing Page JavaScript
 * Handles bracket retrieval via URL, QR scan, and QR upload
 */

(function () {
  "use strict";

  // State
  let cameraStream = null;
  let scanAnimationFrame = null;
  let isScanning = false;

  // DOM Elements
  const elements = {
    // Tabs
    tabs: () => document.querySelectorAll(".retrieve-tab"),
    tabUrl: () => document.getElementById("tab-url"),
    tabScan: () => document.getElementById("tab-scan"),
    tabUpload: () => document.getElementById("tab-upload"),

    // URL input
    urlInput: () => document.getElementById("bracket-url-input"),
    pasteBtn: () => document.getElementById("paste-clipboard-btn"),
    loadUrlBtn: () => document.getElementById("load-url-btn"),
    urlFeedback: () => document.getElementById("url-feedback"),

    // Camera scan
    cameraContainer: () => document.getElementById("camera-container"),
    cameraPreview: () => document.getElementById("camera-preview"),
    scanCanvas: () => document.getElementById("scan-canvas"),
    cameraPlaceholder: () => document.getElementById("camera-placeholder"),
    scanOverlay: () => document.getElementById("scan-overlay"),
    startCameraBtn: () => document.getElementById("start-camera-btn"),
    stopCameraBtn: () => document.getElementById("stop-camera-btn"),
    scanFeedback: () => document.getElementById("scan-feedback"),

    // Upload
    dropzone: () => document.getElementById("dropzone"),
    fileInput: () => document.getElementById("qr-file-input"),
    uploadPreview: () => document.getElementById("upload-preview"),
    previewImage: () => document.getElementById("preview-image"),
    uploadFeedback: () => document.getElementById("upload-feedback"),
  };

  // =====================================================
  // Tab Navigation
  // =====================================================

  const switchTab = (tabName) => {
    // Update tab buttons
    elements.tabs().forEach((tab) => {
      const isActive = tab.dataset.tab === tabName;
      if (isActive) {
        tab.classList.add("active", "border-slate-900", "bg-slate-900", "text-white");
        tab.classList.remove("border-slate-200", "bg-white", "text-slate-600");
      } else {
        tab.classList.remove("active", "border-slate-900", "bg-slate-900", "text-white");
        tab.classList.add("border-slate-200", "bg-white", "text-slate-600");
      }
    });

    // Show/hide content
    elements.tabUrl().classList.toggle("hidden", tabName !== "url");
    elements.tabScan().classList.toggle("hidden", tabName !== "scan");
    elements.tabUpload().classList.toggle("hidden", tabName !== "upload");

    // Stop camera when switching away from scan tab
    if (tabName !== "scan" && cameraStream) {
      stopQRScanning();
    }
  };

  // =====================================================
  // URL Input Functions
  // =====================================================

  /**
   * Parse picks URL and extract the encoded hash
   * Supports: full URL, hash only, or just the encoded data
   */
  const parsePicksUrl = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try to extract from full URL
    try {
      const url = new URL(trimmed);
      const hash = url.hash.replace(/^#/, "");
      if (hash.startsWith("p=")) {
        return hash.slice(2);
      }
    } catch {
      // Not a valid URL, continue with other formats
    }

    // Check for hash format: #p=encoded or p=encoded
    if (trimmed.startsWith("#p=")) {
      return trimmed.slice(3);
    }
    if (trimmed.startsWith("p=")) {
      return trimmed.slice(2);
    }

    // Assume it's just the encoded data
    // Validate it looks like base64url
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  };

  /**
   * Validate picks data by attempting to decode it
   */
  const validatePicksData = async (encoded) => {
    if (!encoded) return { valid: false, error: "No data found" };

    try {
      const decoded = await WorldCupPool.decodePicks(encoded);
      if (decoded && typeof decoded === "object") {
        return { valid: true, data: decoded };
      }
      return { valid: false, error: "Invalid bracket data" };
    } catch (error) {
      console.error("Decode error:", error);
      return { valid: false, error: "Could not decode bracket data" };
    }
  };

  /**
   * Navigate to bracket page with the hash
   */
  const navigateToBracket = (encoded) => {
    window.location.href = `group-grid.html#p=${encoded}`;
  };

  /**
   * Show feedback for URL input
   */
  const showUrlFeedback = (message, isError = false) => {
    const feedback = elements.urlFeedback();
    feedback.textContent = message;
    feedback.classList.remove("hidden", "text-emerald-600", "text-red-600");
    feedback.classList.add(isError ? "text-red-600" : "text-emerald-600");
  };

  /**
   * Handle URL load button click
   */
  const handleLoadUrl = async () => {
    const input = elements.urlInput().value;
    const encoded = parsePicksUrl(input);

    if (!encoded) {
      showUrlFeedback("Please enter a valid bracket URL or hash", true);
      return;
    }

    elements.loadUrlBtn().disabled = true;
    elements.loadUrlBtn().textContent = "Validating...";

    const result = await validatePicksData(encoded);

    if (result.valid) {
      showUrlFeedback("Bracket found! Redirecting...");
      setTimeout(() => navigateToBracket(encoded), 500);
    } else {
      showUrlFeedback(result.error, true);
      elements.loadUrlBtn().disabled = false;
      elements.loadUrlBtn().textContent = "Load Bracket";
    }
  };

  /**
   * Handle paste from clipboard
   */
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      elements.urlInput().value = text;
      elements.urlInput().focus();
    } catch (error) {
      console.error("Clipboard read failed:", error);
      showUrlFeedback("Could not access clipboard. Please paste manually.", true);
    }
  };

  // =====================================================
  // QR Camera Scanning Functions
  // =====================================================

  /**
   * Request camera access
   */
  const requestCameraAccess = async () => {
    const constraints = {
      video: {
        facingMode: "environment", // Prefer rear camera on mobile
        width: { ideal: 640 },
        height: { ideal: 640 },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      console.error("Camera access error:", error);
      throw new Error("Could not access camera. Please check permissions.");
    }
  };

  /**
   * Scan a single frame for QR code
   */
  const scanFrame = () => {
    const video = elements.cameraPreview();
    const canvas = elements.scanCanvas();
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    return code;
  };

  /**
   * Start QR scanning loop
   */
  const startQRScanning = async () => {
    try {
      cameraStream = await requestCameraAccess();

      const video = elements.cameraPreview();
      video.srcObject = cameraStream;
      await video.play();

      // Show video and overlay
      elements.cameraPlaceholder().classList.add("hidden");
      video.classList.remove("hidden");
      elements.scanOverlay().classList.remove("hidden");

      // Update buttons
      elements.startCameraBtn().classList.add("hidden");
      elements.stopCameraBtn().classList.remove("hidden");

      showScanFeedback("Scanning for QR code...", false);
      isScanning = true;

      // Start scan loop
      const scanLoop = async () => {
        if (!isScanning) return;

        const code = scanFrame();
        if (code && code.data) {
          // Found a QR code
          const encoded = parsePicksUrl(code.data);
          if (encoded) {
            isScanning = false;
            showScanFeedback("QR code found! Validating...", false);

            const result = await validatePicksData(encoded);
            if (result.valid) {
              showScanFeedback("Bracket found! Redirecting...", false);
              setTimeout(() => {
                stopQRScanning();
                navigateToBracket(encoded);
              }, 500);
              return;
            } else {
              showScanFeedback("QR code found but not a valid bracket. Keep scanning...", true);
              isScanning = true;
            }
          }
        }

        scanAnimationFrame = requestAnimationFrame(scanLoop);
      };

      scanLoop();
    } catch (error) {
      showScanFeedback(error.message, true);
    }
  };

  /**
   * Stop QR scanning
   */
  const stopQRScanning = () => {
    isScanning = false;

    if (scanAnimationFrame) {
      cancelAnimationFrame(scanAnimationFrame);
      scanAnimationFrame = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    const video = elements.cameraPreview();
    video.srcObject = null;
    video.classList.add("hidden");

    elements.cameraPlaceholder().classList.remove("hidden");
    elements.scanOverlay().classList.add("hidden");
    elements.startCameraBtn().classList.remove("hidden");
    elements.stopCameraBtn().classList.add("hidden");
    elements.scanFeedback().classList.add("hidden");
  };

  /**
   * Show scan feedback
   */
  const showScanFeedback = (message, isError = false) => {
    const feedback = elements.scanFeedback();
    feedback.textContent = message;
    feedback.classList.remove("hidden", "text-emerald-600", "text-red-600");
    feedback.classList.add(isError ? "text-red-600" : "text-emerald-600");
  };

  // =====================================================
  // QR Upload Functions
  // =====================================================

  /**
   * Read file as Image element
   */
  const readFileAsImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  /**
   * Decode QR from image
   */
  const decodeQRFromImage = (img) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    return code;
  };

  /**
   * Handle file selection
   */
  const handleFileSelect = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      showUploadFeedback("Please select an image file", true);
      return;
    }

    try {
      showUploadFeedback("Reading image...", false);

      const img = await readFileAsImage(file);

      // Show preview
      elements.previewImage().src = img.src;
      elements.uploadPreview().classList.remove("hidden");

      showUploadFeedback("Scanning for QR code...", false);

      const code = decodeQRFromImage(img);

      if (!code || !code.data) {
        showUploadFeedback("No QR code found in image", true);
        return;
      }

      const encoded = parsePicksUrl(code.data);
      if (!encoded) {
        showUploadFeedback("QR code found but not a bracket URL", true);
        return;
      }

      showUploadFeedback("Validating bracket...", false);

      const result = await validatePicksData(encoded);
      if (result.valid) {
        showUploadFeedback("Bracket found! Redirecting...", false);
        setTimeout(() => navigateToBracket(encoded), 500);
      } else {
        showUploadFeedback(result.error, true);
      }
    } catch (error) {
      console.error("Upload error:", error);
      showUploadFeedback("Failed to process image", true);
    }
  };

  /**
   * Show upload feedback
   */
  const showUploadFeedback = (message, isError = false) => {
    const feedback = elements.uploadFeedback();
    feedback.textContent = message;
    feedback.classList.remove("hidden", "text-emerald-600", "text-red-600");
    feedback.classList.add(isError ? "text-red-600" : "text-emerald-600");
  };

  // =====================================================
  // Drag and Drop Handling
  // =====================================================

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone().classList.add("border-emerald-500", "bg-emerald-50/50");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone().classList.remove("border-emerald-500", "bg-emerald-50/50");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone().classList.remove("border-emerald-500", "bg-emerald-50/50");

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // =====================================================
  // Initialization
  // =====================================================

  const init = async () => {
    // Initialize compression for decodePicks
    await Compression.initCompression();

    // Tab navigation
    elements.tabs().forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // URL input
    elements.urlInput().addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleLoadUrl();
    });
    elements.loadUrlBtn().addEventListener("click", handleLoadUrl);
    elements.pasteBtn().addEventListener("click", handlePasteClipboard);

    // Camera scan
    elements.startCameraBtn().addEventListener("click", startQRScanning);
    elements.stopCameraBtn().addEventListener("click", stopQRScanning);
    elements.cameraPlaceholder().addEventListener("click", startQRScanning);

    // File upload
    elements.fileInput().addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });

    // Drag and drop
    const dropzone = elements.dropzone();
    dropzone.addEventListener("dragover", handleDragOver);
    dropzone.addEventListener("dragleave", handleDragLeave);
    dropzone.addEventListener("drop", handleDrop);

    // Check for URL hash on load (maybe user came from shared link)
    const hash = window.location.hash;
    if (hash && hash.startsWith("#p=")) {
      // Already has picks, redirect to grid
      window.location.href = `group-grid.html${hash}`;
    }
  };

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
