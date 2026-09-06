import os
import json
import asyncio
import edge_tts

VOICE = "en-US-JennyNeural"
VOCAB_PATH = os.path.join(os.path.dirname(__file__), "..", "tsmc-vocabulary.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "audio")

SPEECH_OVERRIDES = {
    "AI": "A I",
    "EUV / extreme ultraviolet": "E U V, extreme ultraviolet",
    "S.O.P / Standard Operating Procedures": "S O P, Standard Operating Procedures",
    "Spec. / specification": "spec, specification",
}

async def generate_word_audio(sem, item, total):
    word_id = item["id"]
    raw_word = item["word"]
    speech_text = SPEECH_OVERRIDES.get(raw_word, raw_word)
    out_file = os.path.join(OUTPUT_DIR, f"{word_id}.mp3")

    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        return True

    async with sem:
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(speech_text, VOICE)
                await communicate.save(out_file)
                if os.path.exists(out_file) and os.path.getsize(out_file) > 500:
                    print(f"[{word_id}/{total}] Generated: {raw_word} -> {out_file}")
                    return True
            except Exception as e:
                print(f"[{word_id}/{total}] Attempt {attempt + 1} failed for {raw_word}: {e}")
                await asyncio.sleep(1)
        return False

async def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        words = json.load(f)

    total = len(words)
    print(f"Total vocabulary items: {total}")
    sem = asyncio.Semaphore(5)
    tasks = [generate_word_audio(sem, item, total) for item in words]
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r)
    print(f"\nDone! Successfully generated {success_count}/{total} audio files.")

if __name__ == "__main__":
    asyncio.run(main())
