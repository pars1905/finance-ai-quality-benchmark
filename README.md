# Finance AI Quality Benchmark

A small, reproducible benchmark for evaluating AI answers to financial-statement questions. Built as a portfolio demonstration of finance domain expertise, expert rubrics, and AI evaluation operations.

**Status:** Working pilot with a synthetic control and three curated excerpts from public annual reports. Not a validated full-document finance benchmark. No confidential employer or client data.

## What it measures

- 30 questions: six fictional companies × five financial calculations (gross margin, revenue growth, operating margin, current ratio, debt-to-equity).
- Separately scores numeric answers (absolute tolerance 0.01) and exact source-field references; strict pass requires both. Percentage questions accept a numeric value or a numeric string ending in `%`; ratios reject `%`. API errors are reported as coverage failures, not incorrect model answers.
- Produces per-case failure codes and JSON/Markdown reports. Every nonempty explanation is flagged for expert review; the script **does not claim to verify the truth of prose**.
- Includes deliberately flawed sample answers to demonstrate failure detection.

All values in `data/statements.json` are fictional and in consistent arbitrary units. The benchmark tests arithmetic and traceability, not accounting interpretation, financial advice or investment performance.

## Interactive public-equity valuation demo

[Open the public valuation interface](https://finance-ai-quality-demo-osman.affableeucalyptus1.chatgpt.site). The visitor starts with a fictional ready-to-use example. For a real company, choose **My company's data** and load a single [financial summary JSON template](web/sample-input.json), or open the advanced manual fields. Only the source choice, company and market price, and country condition are visible initially. Missing growth, discount and peer-multiple assumptions in an uploaded file use clearly labeled illustrative defaults that should be reviewed before interpreting results. The browser reads the file locally and does not upload it. The interface shows **five per-share methods** across bearish, base and bullish assumptions:

1. FCFF DCF: five years of firm free cash flow and a terminal value, discounted at WACC; subtract net debt.
2. FCFE DCF: five years of equity free cash flow and a terminal value, discounted at cost of equity.
3. Comparable P/E applied to normalized net income.
4. Comparable EV/EBITDA applied to EBITDA, then subtract net debt.
5. Comparable P/B applied to book equity.

A country-conditions control offers illustrative **ordinary conditions, conflict, ceasefire and peace agreement** shifts to growth, discount rates and comparable multiples; every effect is visible and editable. These presets are hypothetical, not observations or forecasts about a real country. Bear/base/bull adjustments are separate. The page displays a median for navigation only; correlated models are not independent confirmations. Methods with nonpositive earnings, EBITDA, book equity, or invalid DCF discount spreads show unavailable rather than a fabricated value.

[Browser source](web/index.html) · [Calculation module](web/valuation.mjs) · [Model tests](web/tests/valuation.test.mjs). To run locally:

```bash
python -m http.server 8000 --directory web
node --test web/tests/valuation.test.mjs
```

Open http://localhost:8000. The sample company is fictional. The page does **not** fetch market data, validate uploaded filings, call an AI model, store form entries, or provide a verified price target. All inputs must come from consistently dated, denominated and reviewed company filings and peer data. The Python benchmark below remains the separate AI-answer evaluation product.

## Three runnable customer conversation demos

The [Turkish demo walkthrough](docs/three-customer-demos-tr.md) covers three fictional client scenarios: management reporting (correct answer), credit analysis (wrong number), and research review (wrong source reference). Sample responses are hand-authored to demonstrate the scorer; they are **not actual model outputs or customer engagements**.

```bash
python -m finance_benchmark evaluate examples/demo-fpna-predictions.json --dataset demo-fpna-v1 --output results/demo-fpna
python -m finance_benchmark evaluate examples/demo-credit-predictions.json --dataset demo-credit-v1 --output results/demo-credit
python -m finance_benchmark evaluate examples/demo-research-predictions.json --dataset demo-research-v1 --output results/demo-research
```

Each demo has one case. The expected strict pass rates are 100%, 0%, and 0% respectively. The second case demonstrates a numeric failure with correct references; the third demonstrates a source failure despite a correct number. To test a live model on any of them, use the existing `run --provider gemini --dataset ...` command with a key set in your environment.

## Three public-filing examples

`data/real_filings_v1.json` contains one independently checkable arithmetic question per company. Values are manually transcribed from fixed SEC annual filings; each case stores its accession number, filing URL, table location, reporting units, source IDs, and reference answer.

| Company | Annual report | Question | Reference answer |
| --- | --- | --- | ---: |
| [Microsoft](https://www.sec.gov/Archives/edgar/data/789019/000095017025100235/msft-20250630.htm) | FY2025 10-K | Revenue growth, FY2024 to FY2025 | 14.93% |
| [Apple](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm) | FY2025 10-K | Services share of total FY2025 net sales | 26.23% |
| [Turkcell](https://www.sec.gov/Archives/edgar/data/1071321/000110465926044740/tkc-20251231x20f.htm) | FY2025 20-F | Revenue growth using the FY2024 comparable amount from the **same FY2025 report** | 10.69% |

Turkcell applies IAS 29 inflation accounting; comparing the FY2025 figure with the previously published FY2024 report's unadjusted amount would be invalid. Both figures here come from the FY2025 filing and use TRY thousands. These are three curated **filing excerpts**, so the model is tested on cited financial reasoning, not retrieval from complete reports. The reference control copies answers and should not be presented as a model result.

To run the three-case Gemini pilot after setting the Codespaces secret `GEMINI_API_KEY`:

```bash
python -m finance_benchmark run --provider gemini --dataset real-filings-v1 --delay-seconds 20 --output results/real-filings-gemini
```

If quota errors occur, repeat with `--resume results/real-filings-gemini/predictions.json` and a different output directory after the quota resets. Review `predictions.json` explanations manually; the scorer checks numbers and reference IDs, not whether prose is fully supported by the filing.

A [manual review of the three Gemini explanations](reviews/real-filings-v1-gemini-review.md) records the filing evidence, independent calculations, and scope of the 3/3 pilot result. The automatic report still flags all explanations for expert review because it does not read this note.

Transient HTTP 500/503/504 responses are retried twice with short exponential waits. HTTP 429 quota errors are saved for a later `--resume` run; the result report shows the HTTP status separately from model quality.

For a prospective customer's first call, demo, model connection, tailored dataset and acceptance steps, see the [Turkish customer pilot guide](docs/customer-pilot-guide-tr.md).

## Run without API keys

```bash
python -m unittest discover -s tests -v
python -m finance_benchmark run --provider baseline
python -m finance_benchmark evaluate examples/sample_predictions.json --output results/sample
```

The baseline copies gold arithmetic and citations as a **harness control**; its 100% result is not an AI performance claim. The sample yields errors and missing predictions by design. Accuracy is computed over evaluated responses; coverage shows how many requested cases received a usable response. Reports are written to `results/report.json`, `results/report.md`, and `results/predictions.json` (or the chosen output directory).

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

If you see HTTP 429, inspect the rate limits for your project in Google AI Studio. A slower trial can help with per-minute limits:

```bash
python -m finance_benchmark run --provider gemini --limit 10 --delay-seconds 20 --output results/gemini-slow
```

If a daily quota is exhausted, wait for the quota reset. API failures remain in `predictions.json` but are shown separately from model accuracy. To re-score a previous run created with the older version of this project **without sending new API requests**, use:

```bash
python -m finance_benchmark evaluate results/gemini-10/predictions.json --limit 10 --output results/gemini-10-rescored
```

After the quota allows more requests, keep the six successful answers and retry only the four API errors:

```bash
python -m finance_benchmark run --provider gemini --limit 10 --resume results/gemini-10/predictions.json --delay-seconds 20 --output results/gemini-10-complete
```

`--resume` accepts previous predictions from the same first N cases, validates their IDs, and reuses genuine model responses (including genuine abstentions). It retries missing cases and both old and new API errors. The delay applies between actual API requests only.

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
