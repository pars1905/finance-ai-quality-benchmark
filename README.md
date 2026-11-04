# Finance AI Quality Benchmark

A small, reproducible benchmark for evaluating AI answers to financial-statement questions. Built as a portfolio demonstration of finance domain expertise, expert rubrics, and AI evaluation operations.

**Status:** Synthetic demonstration, not a validated real-world finance benchmark. No confidential employer or client data.

## What it measures

- 30 questions: six fictional companies × five financial calculations (gross margin, revenue growth, operating margin, current ratio, debt-to-equity).
- Separately scores numeric answers (absolute tolerance 0.01) and exact source-field references; strict pass requires both.
- Produces per-case failure codes and JSON/Markdown reports. Every nonempty explanation is flagged for expert review; the script **does not claim to verify the truth of prose**.
- Includes deliberately flawed sample answers to demonstrate failure detection.

All values in `data/statements.json` are fictional and in consistent arbitrary units. The benchmark tests arithmetic and traceability, not accounting interpretation, financial advice or investment performance.

## Run without API keys

```bash
python -m unittest discover -s tests -v
python -m finance_benchmark run --provider baseline
python -m finance_benchmark evaluate examples/sample_predictions.json --output results/sample
```

The baseline copies gold arithmetic and citations as a **harness control**; its 100% result is not an AI performance claim. The sample yields errors and missing predictions by design. Reports are written to `results/report.json`, `results/report.md`, and `results/predictions.json` (or the chosen output directory).

GitHub Actions runs these checks on every push and attaches an `evaluation-reports` artifact with both control and deliberately flawed sample outputs.

## Evaluate your own predictions

Make a JSON list of objects with `case_id`, `value`, `source_refs`, `explanation`, and `abstained`; see `examples/sample_predictions.json`. Run:

```bash
python -m finance_benchmark evaluate path/to/predictions.json --output results/my-model
```

Source references must exactly match the fact IDs, e.g. `atlas:revenue_2025`. Wrong or duplicate IDs fail the source check. Missing predictions count as failures. For the full set, inspect `finance_benchmark.core.cases()`.

## Try an OpenAI-compatible chat completions API

Set credentials locally; never commit keys. The model must support `response_format: {"type":"json_object"}`. Start with three calls to limit cost:

```bash
export AI_API_KEY='your-key'
export AI_API_BASE_URL='https://api.openai.com/v1'
python -m finance_benchmark run --provider api --model YOUR_MODEL_ID --limit 3 --output results/api-trial
```

Omit `AI_API_BASE_URL` to use the shown default. The CLI sends one request per case. API/parsing errors are counted as abstentions and printed to stderr; the report preserves all returned predictions. **Only run with a trusted endpoint** and do not put confidential customer data in this dataset.

### Gemini free-tier trial

Store your Google AI Studio key as a GitHub Codespaces secret named `GEMINI_API_KEY` for this repository. Create a new Codespace (or restart an existing one to load a newly added secret), then run:

```bash
python -m finance_benchmark run --provider gemini --limit 3 --output results/gemini-trial
cat results/gemini-trial/report.md
```

The Gemini provider defaults to `gemini-2.5-flash` and Google's OpenAI-compatible Chat Completions endpoint. You can override the model with `--model`. The key is read from the environment and is never written to the report. `--limit 3` reports scores over three cases. Free-tier availability and quotas depend on your Google AI Studio project. Do not commit `results/` or the key.

## Expert quality rubric (next pilot)

| Dimension | Automated here | Expert review |
| --- | --- | --- |
| Formula and rounding | Numeric value vs. reference answer | Whether the chosen financial metric fits the question |
| Evidence | Exact source-field IDs | Whether cited evidence supports the prose |
| Abstention | Unnecessary abstentions flagged | Whether a genuinely ambiguous question should be declined |
| Explanation | Marked for review | Unsupported claims, overconfidence, helpfulness |

The next dataset should use licensed public filings with exact page/table references, two independent expert annotations for ambiguous examples, a written adjudication log, and error rates by category. Keep it separate from the synthetic control so results are never confused.

## Docker

```bash
docker build -t finance-ai-quality-benchmark .
docker run --rm finance-ai-quality-benchmark
```

The default container runs the arithmetic control and prints the Markdown summary. For persisted results, run the Python command locally or mount a results directory.

## Scope and limitations

This is an evaluation harness, not a finance model. The reference data is invented; numeric accuracy on 30 templated questions does not predict performance on real filings. The scorer does not evaluate hallucinations in explanations, assess legal compliance, or judge whether a company is financially healthy. Human judgment and a separate public-data pilot are required before making those claims.

License: MIT.
