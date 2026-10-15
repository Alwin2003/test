#!/usr/bin/env python3
"""
FASHN VTON 1.5 - Gradio Interface
Alternative interface suitable for quick tests and Hugging Face Spaces.
"""

import argparse
import os
import sys
from pathlib import Path

# Add src to path
ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


def main():
    parser = argparse.ArgumentParser(description="FASHN VTON 1.5 Gradio App")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host IP to bind to")
    parser.add_argument("--port", type=int, default=7860, help="Port to listen on")
    parser.add_argument("--weights-dir", type=str, default="./weights", help="Model weights directory")
    parser.add_argument("--device", type=str, default=None, help="Device to use ('cuda' or 'cpu')")
    parser.add_argument("--share", action="store_true", help="Create public gradio.live share link")
    args = parser.parse_args()

    try:
        import gradio as gr
    except ImportError:
        print("Gradio is not installed. Run: pip install gradio")
        sys.exit(1)

    from PIL import Image
    from fashn_vton import TryOnPipeline

    print(f"Loading TryOnPipeline from {args.weights_dir}...")
    pipeline = TryOnPipeline(weights_dir=args.weights_dir, device=args.device)

    def run_tryon(person_img, garment_img, category, garment_photo_type, timesteps, guidance, seed, seg_free):
        if person_img is None or garment_img is None:
            raise gr.Error("Please provide both a person image and a garment image.")

        result = pipeline(
            person_image=person_img.convert("RGB"),
            garment_image=garment_img.convert("RGB"),
            category=category,
            garment_photo_type=garment_photo_type,
            num_timesteps=int(timesteps),
            guidance_scale=float(guidance),
            seed=int(seed),
            segmentation_free=seg_free,
        )
        return result.images[0]

    with gr.Blocks(title="FASHN VTON 1.5 - Virtual Try-On") as demo:
        gr.Markdown(
            """
            # 👗 FASHN VTON v1.5: Maskless Virtual Try-On Studio
            Generate photorealistic virtual try-ons directly in pixel space without masks.
            """
        )

        with gr.Row():
            with gr.Column():
                person_input = gr.Image(type="pil", label="Person Image")
                garment_input = gr.Image(type="pil", label="Garment Image")

                with gr.Row():
                    category = gr.Radio(
                        choices=["tops", "bottoms", "one-pieces"],
                        value="tops",
                        label="Garment Category",
                    )
                    photo_type = gr.Radio(
                        choices=["model", "flat-lay"],
                        value="model",
                        label="Garment Type",
                    )

                with gr.Accordion("Advanced Settings", open=False):
                    timesteps = gr.Slider(minimum=15, maximum=50, step=5, value=30, label="Diffusion Steps")
                    guidance = gr.Slider(minimum=1.0, maximum=3.0, step=0.1, value=1.5, label="Guidance Scale")
                    seed = gr.Number(value=42, label="Seed")
                    seg_free = gr.Checkbox(value=True, label="Segmentation-Free Mode")

                submit_btn = gr.Button("Generate Try-On", variant="primary")

            with gr.Column():
                output_image = gr.Image(type="pil", label="Virtual Try-On Output")

        # Example presets
        model_example = "examples/data/model.webp"
        garment_example = "examples/data/garment.webp"
        if os.path.exists(model_example) and os.path.exists(garment_example):
            gr.Examples(
                examples=[
                    [model_example, garment_example, "tops", "model", 30, 1.5, 42, True],
                ],
                inputs=[person_input, garment_input, category, photo_type, timesteps, guidance, seed, seg_free],
                outputs=output_image,
                fn=run_tryon,
                cache_examples=False,
            )

        submit_btn.click(
            fn=run_tryon,
            inputs=[person_input, garment_input, category, photo_type, timesteps, guidance, seed, seg_free],
            outputs=output_image,
        )

    print(f"Launching Gradio on http://{args.host}:{args.port}")
    demo.launch(server_name=args.host, server_port=args.port, share=args.share)


if __name__ == "__main__":
    main()
