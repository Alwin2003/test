#!/usr/bin/env python3
"""
FASHN VTON 1.5 - Web Studio Server
Hosts a modern, responsive web application for virtual try-on.
Listens on 0.0.0.0 by default, accessible from any device / server IP (e.g. http://172.28.0.12:7860).
"""

import argparse
import base64
import io
import json
import logging
import mimetypes
import os
import subprocess
import sys
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional

# Ensure 'src' is in python path
ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("FashnVTON-Server")

# Global pipeline instance and lock
pipeline_instance = None
pipeline_lock = threading.Lock()
pipeline_loading = False


def check_weights_available(weights_dir: str) -> bool:
    """Check if the essential weight files are downloaded."""
    w_path = Path(weights_dir)
    safetensor_file = w_path / "model.safetensors"
    dwpose_yolo = w_path / "dwpose" / "yolox_l.onnx"
    dwpose_ucoco = w_path / "dwpose" / "dw-ll_ucoco_384.onnx"
    return safetensor_file.exists() and dwpose_yolo.exists() and dwpose_ucoco.exists()


def get_system_info():
    """Retrieve system CUDA / Torch information safely."""
    info = {
        "cuda_available": False,
        "device_name": "CPU Mode",
        "torch_version": "Not Loaded",
    }
    try:
        import torch
        info["torch_version"] = torch.__version__
        if torch.cuda.is_available():
            info["cuda_available"] = True
            info["device_name"] = torch.cuda.get_device_name(0)
    except Exception as e:
        info["device_name"] = f"CPU / {e}"
    return info


def load_pipeline_if_needed(weights_dir: str, device: Optional[str] = None):
    """Lazy-load TryOnPipeline safely."""
    global pipeline_instance, pipeline_loading

    if pipeline_instance is not None:
        return pipeline_instance

    with pipeline_lock:
        if pipeline_instance is not None:
            return pipeline_instance
        pipeline_loading = True
        try:
            logger.info("Initializing TryOnPipeline from %s...", weights_dir)
            from fashn_vton import TryOnPipeline
            pipeline_instance = TryOnPipeline(weights_dir=weights_dir, device=device)
            logger.info("TryOnPipeline loaded successfully!")
            return pipeline_instance
        finally:
            pipeline_loading = False


def decode_base64_image(base64_str: str):
    """Decode base64 string or data URL to PIL Image if available, or return raw bytes."""
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    image_bytes = base64.b64decode(base64_str)
    try:
        from PIL import Image
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except ImportError:
        return image_bytes


def encode_image_base64(pil_image_or_bytes, format="PNG") -> str:
    """Encode PIL Image or raw bytes to base64 data URL."""
    if isinstance(pil_image_or_bytes, (bytes, bytearray)):
        img_b64 = base64.b64encode(pil_image_or_bytes).decode("utf-8")
        return f"data:image/{format.lower()};base64,{img_b64}"
    buffered = io.BytesIO()
    pil_image_or_bytes.save(buffered, format=format)
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{img_b64}"


class VTONRequestHandler(SimpleHTTPRequestHandler):
    """Custom HTTP request handler serving static UI and REST endpoints."""

    def __init__(self, *args, **kwargs):
        # Set web directory as static file directory
        super().__init__(*args, directory=str(ROOT_DIR / "web"), **kwargs)

    def log_message(self, format, *args):
        # Clean logging
        logger.debug("%s - %s", self.address_string(), format % args)

    def do_GET(self):
        """Route GET requests to API or static web files."""
        parsed_path = self.path.split("?")[0]

        if parsed_path == "/api/status":
            self.handle_api_status()
        elif parsed_path == "/api/presets":
            self.handle_api_presets()
        else:
            # Fallback to standard static file handler
            super().do_GET()

    def do_POST(self):
        """Route POST requests to API endpoints."""
        parsed_path = self.path.split("?")[0]

        if parsed_path == "/api/tryon":
            self.handle_api_tryon()
        elif parsed_path == "/api/download_weights":
            self.handle_api_download_weights()
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")

    def _send_json_response(self, data: dict, status_code: int = 200):
        """Helper to send JSON response with proper CORS headers."""
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(HTTPStatus.OK)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def handle_api_status(self):
        """Return server status, GPU details, and model weights presence."""
        sys_info = get_system_info()
        weights_ready = check_weights_available(self.server.weights_dir)
        response_data = {
            "status": "online",
            "weights_ready": weights_ready,
            "weights_dir": self.server.weights_dir,
            "cuda_available": sys_info["cuda_available"],
            "device_name": sys_info["device_name"],
            "torch_version": sys_info["torch_version"],
            "mock_mode": self.server.mock_mode,
        }
        self._send_json_response(response_data)

    def handle_api_presets(self):
        """Return available test presets."""
        presets = {
            "models": [
                {"id": "m1", "title": "Female Studio", "url": "/assets/model_preset_1.webp"},
                {"id": "m2", "title": "Male Studio", "url": "/assets/model_preset_2.jpg"},
            ],
            "garments": [
                {"id": "g1", "title": "Orange Knit Top", "url": "/assets/garment_preset_1.webp", "category": "tops", "photo": "model"},
                {"id": "g2", "title": "Leather Biker Jacket", "url": "/assets/garment_preset_2.jpg", "category": "tops", "photo": "flat-lay"},
            ],
        }
        self._send_json_response(presets)

    def handle_api_download_weights(self):
        """Trigger scripts/download_weights.py in a background thread."""
        def run_downloader():
            cmd = [sys.executable, str(ROOT_DIR / "scripts" / "download_weights.py"), "--weights-dir", self.server.weights_dir]
            logger.info("Starting weights download: %s", " ".join(cmd))
            try:
                subprocess.run(cmd, check=True)
                logger.info("Weights downloaded successfully!")
            except Exception as e:
                logger.error("Weights download failed: %s", e)

        thread = threading.Thread(target=run_downloader, daemon=True)
        thread.start()
        self._send_json_response({"status": "started", "message": "Downloading model weights in background."})

    def handle_api_tryon(self):
        """Execute virtual try-on inference and return generated image."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._send_json_response({"error": "Empty request body"}, 400)
                return

            body_bytes = self.rfile.read(content_length)
            payload = json.loads(body_bytes.decode("utf-8"))

            person_b64 = payload.get("person_image")
            garment_b64 = payload.get("garment_image")
            category = payload.get("category", "tops")
            garment_photo_type = payload.get("garment_photo_type", "model")
            num_timesteps = int(payload.get("num_timesteps", 30))
            guidance_scale = float(payload.get("guidance_scale", 1.5))
            seed = int(payload.get("seed", 42))
            segmentation_free = bool(payload.get("segmentation_free", True))

            if not person_b64 or not garment_b64:
                self._send_json_response({"error": "Both person_image and garment_image are required"}, 400)
                return

            person_img = decode_base64_image(person_b64)
            garment_img = decode_base64_image(garment_b64)

            # Check if weights exist or mock mode enabled
            weights_ready = check_weights_available(self.server.weights_dir)

            if not weights_ready and not self.server.mock_mode:
                err_msg = (
                    f"Model weights not found in '{self.server.weights_dir}'. "
                    f"Run: 'python scripts/download_weights.py --weights-dir {self.server.weights_dir}' "
                    "or click the banner 'Download Weights' button."
                )
                logger.warning(err_msg)
                self._send_json_response({"error": err_msg}, 400)
                return

            # Mock mode or demo mode if requested or if torch/cuda not available
            if self.server.mock_mode:
                logger.info("Running in mock demo mode...")
                time.sleep(1.0)  # Simulate diffusion latency
                try:
                    from PIL import Image
                    res_w, res_h = person_img.size
                    mock_out = person_img.copy()
                    g_thumb = garment_img.copy().resize((int(res_w * 0.45), int(res_h * 0.45)))
                    mock_out.paste(g_thumb, (int(res_w * 0.28), int(res_h * 0.25)))
                    out_b64 = encode_image_base64(mock_out)
                    res_str = f"{res_w}x{res_h}"
                except Exception:
                    out_b64 = person_b64  # Return person image as fallback
                    res_str = "768x1024"

                self._send_json_response({
                    "status": "success",
                    "output_image": out_b64,
                    "resolution": res_str,
                    "note": "Generated via Mock Mode"
                })
                return

            # Real Inference Pipeline Execution
            logger.info("Executing real TryOnPipeline (steps=%d, cfg=%.1f, seed=%d)...", num_timesteps, guidance_scale, seed)
            pipeline = load_pipeline_if_needed(self.server.weights_dir, self.server.device)

            with pipeline_lock:
                result = pipeline(
                    person_image=person_img,
                    garment_image=garment_img,
                    category=category,
                    garment_photo_type=garment_photo_type,
                    num_samples=1,
                    num_timesteps=num_timesteps,
                    guidance_scale=guidance_scale,
                    seed=seed,
                    segmentation_free=segmentation_free,
                )

            output_img = result.images[0]
            out_b64 = encode_image_base64(output_img)
            res_w, res_h = output_img.size

            logger.info("TryOn inference complete (%dx%d)!", res_w, res_h)
            self._send_json_response({
                "status": "success",
                "output_image": out_b64,
                "resolution": f"{res_w}x{res_h}",
            })

        except Exception as e:
            logger.exception("Inference error: %s", e)
            self._send_json_response({"error": f"Inference execution failed: {str(e)}"}, 500)


def main():
    parser = argparse.ArgumentParser(
        description="FASHN VTON 1.5 - Web Studio",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host address to bind (0.0.0.0 listens on all interfaces)")
    parser.add_argument("--port", "-p", type=int, default=7860, help="Port to bind server (default: 7860)")
    parser.add_argument("--weights-dir", type=str, default="./weights", help="Directory containing model weights")
    parser.add_argument("--device", type=str, default=None, help="Device to use ('cuda', 'cpu', or auto-detect)")
    parser.add_argument("--mock-mode", action="store_true", help="Run with simulated preview inference (for rapid testing without GPU)")
    args = parser.parse_args()

    # Create server
    server = ThreadingHTTPServer((args.host, args.port), VTONRequestHandler)
    server.weights_dir = os.path.abspath(args.weights_dir)
    server.device = args.device
    server.mock_mode = args.mock_mode

    banner = f"""
======================================================================
  [FASHN VTON v1.5] Virtual Try-On Studio Server
======================================================================
  * Local URL:           http://localhost:{args.port}
  * Network / Host URL:  http://{args.host}:{args.port}
  * Weights Directory:   {server.weights_dir}
  * Weights Status:      {'Found' if check_weights_available(server.weights_dir) else 'Not Found (Download via scripts/download_weights.py or web UI)'}
  * Mock Mode:           {'Enabled (Fast UI test)' if server.mock_mode else 'Disabled (Real Neural Model)'}

  You can access this web UI over your local network using your server IP:
  -> http://<YOUR_SERVER_IP>:{args.port} (e.g. http://172.28.0.12:{args.port} or http://192.168.50.14:{args.port})
======================================================================
"""
    print(banner)
    logger.info("Serving FASHN VTON Web Studio on port %d...", args.port)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("\nShutting down server gracefully...")
        server.server_close()


if __name__ == "__main__":
    main()
