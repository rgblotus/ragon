import os

os.environ["PHONEMIZER_ESPEAK_NG_PATH"] = "/usr/bin/espeak-ng"
os.environ["USE_TORCH"] = "1"

# For AMD GPUs with ROCm
if os.path.exists("/sys/module/amdgpu"):
    os.environ["ROCM_HOME"] = "/opt/rocm"
    os.environ["HIP_VISIBLE_DEVICES"] = "0"

from transformers import (
    pipeline,
    VitsModel,
    VitsTokenizer,
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
)
import torch


# GPU Optimizations for CUDA
def _setup_gpu_optimizations():
    """Configure PyTorch for optimal GPU performance."""
    if torch.cuda.is_available():
        # Enable cudnn benchmarking for faster convolutions
        torch.backends.cudnn.benchmark = True
        # Enable TF32 for faster matrix operations on Ampere GPUs (RTX 30xx+)
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        # Enable faster algorithms
        torch.backends.cudnn.enabled = True
        # Set memory allocation strategy
        torch.cuda.empty_cache()
        print(f"--- AI UTILS: GPU optimizations enabled ---")
        print(f"--- AI UTILS: CUDA Device: {torch.cuda.get_device_name(0)} ---")
        print(
            f"--- AI UTILS: CUDA Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB ---"
        )
        # Check if torch.compile is available (PyTorch 2.0+)
        if hasattr(torch, "compile"):
            print(f"--- AI UTILS: torch.compile available for model optimization ---")


_setup_gpu_optimizations()


def _compile_model_if_supported(model):
    """Compile model with torch.compile for faster inference if supported."""
    # DISABLED: torch.compile requires Python development headers (python3-dev)
    # which are not installed in this environment
    return model


import scipy.io.wavfile
import io
import os
import numpy as np
import re
import hashlib
from collections import OrderedDict
from app.core.cache_service import cache_service, fast_hash


def strip_markdown(text):
    text = re.sub(r"[*_]{1,3}", "", text)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    text = re.sub(r"`{1,3}.*?`{1,3}", "", text, flags=re.DOTALL)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    return text.strip()


class AIUtilityService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIUtilityService, cls).__new__(cls)
            # Use CUDA if available for better performance
            if torch.cuda.is_available():
                cls._instance.device_str = "cuda"
                cls._instance.device_idx = 0
                cls._instance.cuda_device = torch.device("cuda:0")
            else:
                cls._instance.device_str = "cpu"
                cls._instance.device_idx = -1
                cls._instance.cuda_device = torch.device("cpu")

            cls._instance._translator = None
            cls._instance._translator_tokenizer = None
            cls._instance._tts_models = OrderedDict()
            cls._instance._tts_tokenizers = OrderedDict()
            cls._instance._max_tts_models = 3
        return cls._instance

    @property
    def translator_model_path(self):
        """Path to translation model - uses Helsinki-NLP"""
        helsinki = "models/translation/Helsinki-NLP_opus-mt-en-hi"
        if os.path.exists(helsinki):
            return helsinki
        return "Helsinki-NLP/opus-mt-en-hi"

    def load_translator(self):
        """Load translation model - uses Facebook NLLB with GPU if available"""
        model_path = self.translator_model_path

        if model_path:
            device = 0 if self.device_str == "cuda" else -1
            try:
                print(
                    f"--- AI UTILS: Loading NLLB Translator on {'GPU' if self.device_str == 'cuda' else 'CPU'} ---"
                )
                self._translator = pipeline(
                    "translation",
                    model=model_path,
                    device=device,
                    torch_dtype=torch.float32,
                )
                print(f"--- AI UTILS: NLLB Translator loaded successfully ---")
                return
            except Exception as e:
                print(f"--- AI UTILS: Failed to load translator: {e} ---")
                raise RuntimeError(f"Failed to load translator: {e}")

    @property
    def translator(self):
        if self._translator is None:
            self.load_translator()
        return self._translator

    def translate(self, text: str) -> str:
        print(f"--- AI UTILS: Translating text ({len(text)} chars) ---")

        text_hash = hashlib.md5(text.encode()).hexdigest()
        lang_pair = "en-hi"

        if cache_service.is_available:
            try:
                cached_translation = cache_service.get_translation(text_hash, lang_pair)
                if (
                    cached_translation
                    and isinstance(cached_translation, str)
                    and cached_translation.strip()
                ):
                    print(f"--- AI UTILS: Using cached translation ---")
                    return cached_translation
            except Exception as cache_err:
                print(
                    f"--- AI UTILS: Cache lookup failed, translating fresh: {cache_err} ---"
                )

        if not self.translator_model_path:
            print("--- AI UTILS: No translation model found ---")
            return text

        try:
            # Use NLLB format: tgt_lang, src_lang
            translated = self.translator(text, tgt_lang="hin_Deva", src_lang="eng_Latn")
            translated = translated[0]["translation_text"]
        except Exception as trans_err:
            error_msg = str(trans_err)
            print(f"--- AI UTILS: Translation failed: {error_msg} ---")
            raise RuntimeError(f"Translation failed: {error_msg}")

        if cache_service.is_available:
            try:
                if cache_service.set_translation(text_hash, lang_pair, translated):
                    print(f"--- AI UTILS: Translation cached ---")
                else:
                    print(f"--- AI UTILS: Failed to cache translation ---")
            except Exception as cache_err:
                print(f"--- AI UTILS: Cache set failed: {cache_err} ---")

        print(f"--- AI UTILS: Translation complete ---")
        return translated

    def _translate_helsinki(self, text: str) -> str:
        """Translate using Helsinki-NLP model - CPU optimized"""
        # Use moderate chunk size for CPU efficiency
        chunk_size = 512
        chunks = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]

        # Process chunks sequentially on CPU
        translated_chunks = []
        for chunk in chunks:
            result = self.translator(chunk)[0]["translation_text"]
            translated_chunks.append(result)

        return " ".join(translated_chunks)

    def get_tts_model(self, voice_id="en_female"):
        voice_map = {
            "en_female": "kakao-enterprise/vits-ljs",
            "en_male": "kakao-enterprise/vits-ljs",
            "hi_female": "kakao-enterprise/vits-ljs",
            "hi_male": "kakao-enterprise/vits-ljs",
        }

        # Get the HuggingFace model ID
        hf_model_id = voice_map.get(voice_id, "kakao-enterprise/vits-ljs")

        # Check for local model first (download script uses underscores in path)
        local_model_name = hf_model_id.replace("/", "_")
        local_path = f"models/voice/{local_model_name}"

        # Use local path if it exists, otherwise use HuggingFace model ID
        mid = local_path if os.path.exists(local_path) else hf_model_id

        print(f"--- AI UTILS: Using TTS model path: {mid} ---")

        if mid not in self._tts_models:
            if len(self._tts_models) >= self._max_tts_models:
                oldest_mid, _ = self._tts_models.popitem(last=False)
                self._tts_tokenizers.pop(oldest_mid, None)
                print(f"--- AI UTILS: Evicted oldest TTS model: {oldest_mid} ---")

            try:
                device_str = str(self.device_str)
                print(
                    f"--- AI UTILS: Loading VITS TTS Model {voice_id} ({mid}) on {device_str.upper()} ---"
                )

                self._tts_tokenizers[mid] = VitsTokenizer.from_pretrained(mid)
                self._tts_models[mid] = VitsModel.from_pretrained(
                    mid,
                    torch_dtype=torch.float32,
                )

                if self.device_str == "cuda":
                    self._tts_models[mid] = self._tts_models[mid].to(self.cuda_device)
                self._tts_models[mid].eval()

                print(
                    f"--- AI UTILS: TTS model loaded successfully on {device_str.upper()} ---"
                )
                self._tts_models.move_to_end(mid)
                self._tts_tokenizers.move_to_end(mid)
                return self._tts_models[mid], self._tts_tokenizers[mid]
            except Exception as e:
                print(f"--- AI UTILS: Failed to load TTS model: {e} ---")
                self._tts_models.pop(mid, None)
                self._tts_tokenizers.pop(mid, None)
                raise RuntimeError(f"Failed to load TTS model: {e}")
        else:
            self._tts_models.move_to_end(mid)
            self._tts_tokenizers.move_to_end(mid)

        return self._tts_models[mid], self._tts_tokenizers[mid]

    def text_to_speech(self, text: str, voice_id: str = "en_female") -> io.BytesIO:
        print(f"--- AI UTILS: Synthesizing speech ({voice_id}, {len(text)} chars) ---")

        try:
            text = self._clean_text_for_tts(text)
            chunks = self._split_text_for_tts(text)
            print(f"--- AI UTILS: Split into {len(chunks)} chunks ---")

            all_waveforms = []
            model, tokenizer = self.get_tts_model(voice_id)

            device = "cuda" if self.device_str == "cuda" else "cpu"
            print(
                f"--- AI UTILS: Processing {len(chunks)} chunks on {device.upper()} ---"
            )

            for i, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                try:
                    inputs = tokenizer(
                        chunk,
                        return_tensors="pt",
                        padding=True,
                        truncation=False,
                    ).to(device)

                    with torch.no_grad():
                        output = model(**inputs).waveform
                        waveform = output.cpu().numpy().squeeze()
                    all_waveforms.append(waveform)
                    print(f"--- AI UTILS: Chunk {i + 1}/{len(chunks)} processed ---")
                except Exception as chunk_error:
                    print(f"Error processing chunk {i}: {chunk_error}")
                    continue

            if not all_waveforms:
                print(f"--- AI UTILS: No waveforms generated, using fallback ---")
                waveform = np.zeros(16000)
            else:
                print(f"--- AI UTILS: Concatenating {len(all_waveforms)} waveforms ---")
                waveform = np.concatenate(all_waveforms)
                print(f"--- AI UTILS: Final waveform shape: {waveform.shape} ---")

            waveform = np.clip(waveform, -1.0, 1.0)
            waveform_int16 = (waveform * 32767).astype(np.int16)

            byte_io = io.BytesIO()
            scipy.io.wavfile.write(
                byte_io, rate=model.config.sampling_rate, data=waveform_int16
            )
            byte_io.seek(0)
            print(
                f"--- AI UTILS: Speech synthesis complete - {byte_io.tell()} bytes ---"
            )
            return byte_io

        except Exception as e:
            print(f"TTS Error: {e}")
            return self._create_fallback_audio()

    def _clean_text_for_tts(self, text: str) -> str:
        text = strip_markdown(text)
        text = re.sub(r"\s+", " ", text)

        # Remove or replace problematic characters for TTS
        text = re.sub(r"[^\w\s.,!?;:\-'\"।]", "", text)  # Keep basic punctuation
        text = re.sub(r'[()"\'\[\]{}]', "", text)
        text = re.sub(r"[.]{2,}", ".", text)
        text = re.sub(r"[!]{2,}", "!", text)
        text = re.sub(r"[?]{2,}", "?", text)

        # Remove numbers (phonemizer struggles with these)
        text = re.sub(r"\d+", "", text)

        # Replace multiple spaces with single
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    def _split_text_for_tts(self, text: str) -> list:
        if len(text) <= 200:
            return [text] if text.strip() else ["Hello"]

        sentences = re.split(r"([.!?।।\n]+)", text)
        chunks = []
        current_chunk = ""

        for i in range(0, len(sentences) - 1, 2):
            sentence = sentences[i] + (
                sentences[i + 1] if i + 1 < len(sentences) else ""
            )
            sentence = sentence.strip()

            if not sentence:
                continue

            if len(current_chunk) + len(sentence) > 500:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        if not chunks:
            chunks = ["Hello, how are you?"]

        return chunks

    def _create_fallback_audio(self) -> io.BytesIO:
        sample_rate = 16000
        duration = 1.0
        frequency = 440
        t = np.linspace(0, duration, int(sample_rate * duration))
        waveform = 0.3 * np.sin(2 * np.pi * frequency * t)
        waveform_int16 = (waveform * 32767).astype(np.int16)
        byte_io = io.BytesIO()
        scipy.io.wavfile.write(byte_io, rate=sample_rate, data=waveform_int16)
        byte_io.seek(0)
        return byte_io


ai_utils = AIUtilityService()
