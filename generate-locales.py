"""Generate saved website translations with LibreTranslate's local Argos models."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from filelock import FileLock

ROOT = Path(__file__).resolve().parent
WORK = Path(os.environ.get("SAFARI_WORK_DIR", ROOT / "work")).resolve()
ENGINE = WORK / "translation-engine"
for variable, folder in {
    "XDG_DATA_HOME": "data",
    "XDG_CONFIG_HOME": "config",
    "XDG_CACHE_HOME": "cache",
    "ARGOS_PACKAGES_DIR": "models",
}.items():
    directory = ENGINE / folder
    directory.mkdir(parents=True, exist_ok=True)
    os.environ[variable] = str(directory)
os.environ["ARGOS_DEVICE_TYPE"] = "cpu"
os.environ["ARGOS_CHUNK_TYPE"] = "MINISBD"
os.environ["HF_HOME"] = str(ENGINE / "huggingface")

INPUT = WORK / "translation-input.json"
OUTPUT = ROOT / "generated-locales.json"
CODE_ALIASES = {"zh": "zh-CN", "zt": "zh-TW", "he": "iw", "nb": "no", "pb": "pt-BR"}
PLACEHOLDER = re.compile(r"({[a-z]+})")
PIPELINE_VERSION = b"argos-tourism-v4"
PLACEHOLDER_VALUES = {"start":"11", "end":"22", "total":"33", "number":"11", "currency":"USD", "price":"1234", "reference":"112233", "message":"445566", "suffix":"778899"}


def model_input(text):
    prepared = text.strip().strip("↗↓Ⅱ▶✦←").strip()
    prepared = re.sub(r"English speaking guide", "English-speaking tour guide", prepared, flags=re.I)
    prepared = re.sub(r"balloon safari", "hot air balloon ride", prepared, flags=re.I)
    prepared = re.sub(r"walking safari", "wildlife walk", prepared, flags=re.I)
    prepared = re.sub(r"boat safari", "wildlife boat tour", prepared, flags=re.I)
    prepared = re.sub(r"game drives?", "wildlife viewing drive", prepared, flags=re.I)
    prepared = re.sub(r"safaris?", "wildlife tour", prepared, flags=re.I)
    prepared = prepared.replace("Wildlife wildlife tour", "wildlife tour")
    if prepared.startswith("Showing "):
        prepared = re.sub(r"tours?", "wildlife trips", prepared)
    prepared = prepared.replace("Carnivores wildlife tour", "Carnivores Safaris")
    for placeholder in ("{message}", "{suffix}", "{currency}"):
        prepared = prepared.replace(placeholder, "")
    prepared = re.sub(r" +", " ", prepared).strip()
    for placeholder in PLACEHOLDER.findall(prepared):
        prepared = prepared.replace(placeholder, PLACEHOLDER_VALUES[placeholder[1:-1]], 1)
    return prepared


def read_json(file, default):
    return json.loads(file.read_text(encoding="utf-8-sig")) if file.exists() else default


def save_json(file, data):
    temporary = file.with_suffix(file.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    for attempt in range(12):
        try:
            os.replace(temporary, file)
            return
        except PermissionError:
            if attempt == 11:
                raise
            time.sleep(0.1)


def validate_record(record, code):
    overrides = read_json(ROOT / 'translation-overrides.json', {}).get(code, {})
    for group in ('ui','tours'):
        record[group].update(overrides.get(group, {}))
        for source, value in record[group].items():
            repeated = re.search(r'(.{10,40})\1\1\1', value) or re.search(r'(.)\1{7,}', value)
            if len(value) > max(180,len(source)*8) or repeated:
                raise RuntimeError(f'{code}: translation needs wording review: {source}')
    return record


def translate_language(code):
    if code == 'zt':
        from opencc import OpenCC
        converter = OpenCC('s2t')
        with FileLock(str(ENGINE / 'publish.lock')):
            generated = read_json(OUTPUT, {})
            simplified = generated.get('zh-CN')
            if not simplified:
                raise RuntimeError('Prepare Simplified Chinese before Traditional Chinese')
            record = dict(simplified)
            record['name'] = 'Traditional Chinese'
            record['engine'] = 'Argos Translate / OpenCC script conversion'
            record['ui'] = {key: converter.convert(value) for key,value in simplified['ui'].items()}
            record['tours'] = {key: converter.convert(value) for key,value in simplified['tours'].items()}
            record = validate_record(record,'zh-TW')
            generated['zh-TW'] = record
            save_json(OUTPUT,generated)
        print('zt: published Traditional Chinese using OpenCC',flush=True)
        return
    import argostranslate.package as packages
    import ctranslate2

    source = read_json(INPUT, {})
    input_hash = hashlib.sha256(INPUT.read_bytes() + PIPELINE_VERSION).hexdigest()
    web_code = CODE_ALIASES.get(code, code)
    generated = read_json(OUTPUT, {})
    if generated.get(web_code, {}).get("sourceHash") == input_hash:
        with FileLock(str(ENGINE / 'publish.lock')):
            generated = read_json(OUTPUT, {})
            generated[web_code] = validate_record(generated[web_code],web_code)
            save_json(OUTPUT,generated)
        print(f"{code}: saved translations already current", flush=True)
        return
    available = [p for p in packages.get_available_packages() if p.from_code == "en" and p.to_code == code]
    if not available:
        raise RuntimeError(f"No English-to-{code} model available")
    selected = available[-1]
    with FileLock(str(ENGINE / "model-install.lock")):
        installed = [p for p in packages.get_installed_packages() if p.from_code == "en" and p.to_code == code]
        if not installed:
            print(f"{code}: downloading translation model", flush=True)
            selected.install()
            installed = [p for p in packages.get_installed_packages() if p.from_code == "en" and p.to_code == code]
    model = installed[-1]
    translator = ctranslate2.Translator(
        str(model.package_path / "model"),
        device="cpu",
        compute_type="int8",
        inter_threads=1,
        intra_threads=2,
    )
    cache_file = ENGINE / f"translations-v2-{code}.json"
    cache = read_json(cache_file, {})
    preserved = set(source["preserve"])
    full_texts = list(dict.fromkeys(source["ui"] + source["tours"]))
    # Synthetic numbers preserve dynamic placeholders while retaining sentence context.
    needed = {model_input(text) for text in full_texts if text not in preserved}
    for text in source["ui"]:
        if PLACEHOLDER.search(text):
            needed.update(model_input(part) for part in PLACEHOLDER.split(text) if re.search(r"[A-Za-z]",part) and not PLACEHOLDER.fullmatch(part))
    missing = sorted(text for text in needed if text not in cache)
    started = time.monotonic()
    for start in range(0, len(missing), 24):
        batch = missing[start:start + 24]
        tokens = [model.tokenizer.encode(text) for text in batch]
        prefix = [[model.target_prefix]] * len(batch) if model.target_prefix else None
        results = translator.translate_batch(
            tokens,
            target_prefix=prefix,
            beam_size=4,
            num_hypotheses=1,
            replace_unknowns=True,
            max_batch_size=24,
            max_decoding_length=192,
            repetition_penalty=1.1,
            no_repeat_ngram_size=3,
        )
        for text, result in zip(batch, results):
            translated = model.tokenizer.decode(result.hypotheses[0]).strip()
            if model.target_prefix and translated.startswith(model.target_prefix):
                translated = translated[len(model.target_prefix):].strip()
            if not translated:
                raise RuntimeError(f"{code}: model returned empty text")
            cache[text] = translated
        save_json(cache_file, cache)
        print(f"{code}: {min(start + len(batch),len(missing))}/{len(missing)} phrases", flush=True)

    def translated(text):
        if text in preserved:
            return text
        if text.startswith("Showing {start}"):
            return "{start}–{end} / {total}"
        result = cache[model_input(text)]
        if PLACEHOLDER.search(text):
            result = "".join(str(unicodedata.digit(character)) if character.isdecimal() else character for character in result)
            result = re.sub(r"(?<=\d)[,.\u066c](?=\d{3}(?:\D|$))", "", result)
        for placeholder in PLACEHOLDER.findall(text):
            if placeholder == "{currency}":
                continue
            if placeholder in ("{message}", "{suffix}"):
                result += " " + placeholder
                continue
            sentinel = PLACEHOLDER_VALUES[placeholder[1:-1]]
            if sentinel not in result:
                # If the model changes synthetic numbers, compose translated labels
                # around untouched placeholders instead of risking a changed reference.
                result = ""
                for part in PLACEHOLDER.split(text):
                    if PLACEHOLDER.fullmatch(part) or not re.search(r"[A-Za-z]",part):
                        result += part
                    else:
                        result += part.replace(part.strip(), cache[model_input(part)])
                return result
            replacement = "{currency} {price}" if placeholder == "{price}" and "{currency}" in text else placeholder
            result = result.replace(sentinel, replacement, 1)
        for icon in "↗↓Ⅱ▶✦←":
            if text.strip().startswith(icon):
                result = icon + " " + result
            elif text.strip().endswith(icon):
                result += " " + icon
        return result

    record = {
        "name": selected.to_name,
        "engine": "Argos Translate / CTranslate2",
        "complete": True,
        "sourceHash": input_hash,
        "tourCount": source["tourCount"],
        "itineraryDayCount": source["itineraryDayCount"],
        "ui": {text: translated(text) for text in source["ui"]},
        "tours": {text: translated(text) for text in source["tours"]},
    }
    for text, value in record["ui"].items():
        if sorted(PLACEHOLDER.findall(text)) != sorted(PLACEHOLDER.findall(value)):
            raise RuntimeError(f"{code}: invalid dynamic placeholders")
    record = validate_record(record,web_code)
    with FileLock(str(ENGINE / "publish.lock")):
        generated = read_json(OUTPUT, {})
        generated[web_code] = record
        save_json(OUTPUT, generated)
    print(f"{code}: published complete language in {time.monotonic()-started:.1f}s", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--languages", default="all")
    parser.add_argument("--worker")
    options = parser.parse_args()
    if options.worker:
        translate_language(options.worker)
        return
    if not INPUT.exists():
        raise RuntimeError("Run node prepare-translation-input.cjs first")
    import argostranslate.package as packages
    packages.update_package_index()
    available = sorted({p.to_code for p in packages.get_available_packages() if p.from_code == "en"})
    wanted = available if options.languages == "all" else options.languages.split(",")
    # Existing saved translations already cover these languages.
    wanted = [code for code in wanted if code not in {"en","de","fr","it","sw"}]
    print("Preparing "+str(len(wanted))+" language models: "+", ".join(wanted), flush=True)
    def run(code):
        result = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--worker", code], env=os.environ)
        return code if result.returncode else None
    with ThreadPoolExecutor(max_workers=2) as workers:
        failures = [code for code in workers.map(run,wanted) if code]
    if failures:
        raise RuntimeError("Languages requiring retry: "+", ".join(failures))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr, flush=True)
        sys.exit(1)
