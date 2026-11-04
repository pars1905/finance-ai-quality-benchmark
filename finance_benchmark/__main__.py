"""Run an arithmetic control, evaluate JSON predictions, or call a compatible model API."""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from .core import baseline_prediction, cases, evaluate, markdown_report


def api_prediction(case, model, base_url, key):
    prompt = ("You are evaluating a fictional financial statement. Use ONLY the supplied facts. "
              "Return one JSON object with keys value (number or string), source_refs (list of exact IDs), "
              "explanation (brief), and abstained (boolean). Do not invent sources. "
              "If evidence is insufficient, abstain.\n"
              + json.dumps({"question": case["question"], "facts": [
                  {"source_ref": case["case_id"].split("-")[0] + ":" + k, "value": v}
                  for k, v in case["facts"].items()]}, ensure_ascii=False))
    url = base_url.rstrip("/") + "/chat/completions"
    request = urllib.request.Request(url, data=json.dumps({
        "model": model, "temperature": 0,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
    }).encode(), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = json.load(response)
    answer = json.loads(payload["choices"][0]["message"]["content"])
    if not isinstance(answer, dict):
        raise ValueError("Model did not return a JSON object")
    answer["case_id"] = case["case_id"]
    return answer


def main():
    parser = argparse.ArgumentParser(description="Finance AI Quality Benchmark (synthetic-v1)")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="Generate and score predictions")
    run.add_argument("--provider", choices=("baseline", "api", "gemini"), default="baseline")
    run.add_argument("--model", help="API model ID; Gemini defaults to gemini-2.5-flash")
    run.add_argument("--limit", type=int, default=30, help="Maximum cases to send to API (1–30)")
    run.add_argument("--delay-seconds", type=float, default=0, help="Pause between API requests to respect rate limits")
    run.add_argument("--output", type=Path, default=Path("results"))
    check = sub.add_parser("evaluate", help="Score a JSON list of predictions")
    check.add_argument("predictions", type=Path)
    check.add_argument("--limit", type=int, help="Score only the first N benchmark cases (1–30)")
    check.add_argument("--output", type=Path, default=Path("results"))
    args = parser.parse_args()
    if args.command == "run":
        if not 1 <= args.limit <= 30:
            parser.error("--limit must be between 1 and 30")
        if args.delay_seconds < 0:
            parser.error("--delay-seconds must not be negative")
        if args.provider == "baseline":
            predictions = [baseline_prediction(case) for case in cases()[:args.limit]]
        else:
            if args.provider == "gemini":
                key = os.getenv("GEMINI_API_KEY")
                base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
                model = args.model or "gemini-2.5-flash"
                if not key:
                    parser.error("Gemini runs require GEMINI_API_KEY")
            else:
                key = os.getenv("AI_API_KEY")
                base_url = os.getenv("AI_API_BASE_URL", "https://api.openai.com/v1")
                model = args.model
                if not model or not key:
                    parser.error("API runs require --model and AI_API_KEY")
            predictions = []
            for index, case in enumerate(cases()[:args.limit]):
                if index and args.delay_seconds:
                    time.sleep(args.delay_seconds)
                try:
                    predictions.append(api_prediction(case, model, base_url, key))
                except (ValueError, KeyError, urllib.error.URLError) as exc:
                    print(f"{case['case_id']}: {type(exc).__name__}: {exc}", file=sys.stderr)
                    status = exc.code if isinstance(exc, urllib.error.HTTPError) else None
                    predictions.append({"case_id": case["case_id"], "request_error": {
                        "type": "http" if status is not None else "transport_or_parse",
                        "status": status}})
    else:
        if args.limit is not None and not 1 <= args.limit <= 30:
            parser.error("--limit must be between 1 and 30")
        predictions = json.loads(args.predictions.read_text(encoding="utf-8"))
        if not isinstance(predictions, list):
            parser.error("Prediction file must contain a JSON list")
    selected = cases()[:args.limit] if args.limit is not None else None
    report = evaluate(predictions, selected_cases=selected)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "predictions.json").write_text(json.dumps(predictions, indent=2) + "\n", encoding="utf-8")
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (args.output / "report.md").write_text(markdown_report(report), encoding="utf-8")
    print(markdown_report(report))
    print(f"Reports: {args.output.resolve()}")


if __name__ == "__main__":
    main()
