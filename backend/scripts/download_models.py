#!/usr/bin/env python3
"""
Script to download all required models for the application using Hugging Face Hub.
Models are downloaded to the local 'models' directory within the backend folder,
organized by type: embedding/, voice/, translation/
"""

import os
from huggingface_hub import snapshot_download


def download_models():
    """Download all required models to the local models directory organized by type."""

    # Define model categories
    embedding_models = [
        "sentence-transformers/all-MiniLM-L6-v2",
    ]

    voice_models = [
        "kakao-enterprise/vits-ljs",
    ]

    translation_models = [
        "Helsinki-NLP/opus-mt-en-hi",
    ]

    # Create models directory and subdirectories
    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(os.path.join(models_dir, "embedding"), exist_ok=True)
    os.makedirs(os.path.join(models_dir, "voice"), exist_ok=True)
    os.makedirs(os.path.join(models_dir, "translation"), exist_ok=True)

    def download_category(models, category_name, skip_existing=True):
        """Download models in a specific category."""
        category_dir = os.path.join(models_dir, category_name)
        for model_repo in models:
            local_dir = os.path.join(category_dir, model_repo.replace("/", "_"))
            if skip_existing and os.path.exists(local_dir):
                print(f"Model already exists: {local_dir}")
                continue
            print(f"Downloading {model_repo} to {category_name}/...")
            try:
                snapshot_download(
                    repo_id=model_repo,
                    local_dir=local_dir,
                    local_dir_use_symlinks=False,
                    resume_download=True,
                )
                print(f"Successfully downloaded {model_repo}")
            except Exception as e:
                print(f"Error downloading {model_repo}: {e}")

    print(f"Downloading models to {os.path.abspath(models_dir)}...")
    print("(Existing models will be skipped)")

    print("\n=== Downloading Embedding Models ===")
    download_category(embedding_models, "embedding")

    print("\n=== Downloading Voice Models ===")
    download_category(voice_models, "voice")

    print("\n=== Downloading Translation Models ===")
    download_category(translation_models, "translation")

    print("\nAll model downloads completed.")
    print("\nExisting models were skipped. Run with --force to re-download all.")


if __name__ == "__main__":
    download_models()
