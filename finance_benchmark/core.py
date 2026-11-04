"""Dataset, reference calculations and deterministic scoring."""
from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "statements.json"

TASKS = {
    "gross_margin": ("2025 gross margin, percent", ("revenue_2025", "cost_of_sales_2025")),
    "revenue_growth": ("Revenue growth from 2024 to 2025, percent", ("revenue_2024", "revenue_2025")),
    "operating_margin": ("2025 operating margin, percent", ("operating_income_2025", "revenue_2025")),
    "current_ratio": ("2025 current ratio", ("current_assets_2025", "current_liabilities_2025")),
    "debt_to_equity": ("2025 debt-to-equity ratio", ("total_debt_2025", "total_equity_2025")),
}


def statements():
    return json.loads(DATA.read_text(encoding="utf-8"))


def calculate(task, f):
    d = lambda key: Decimal(str(f[key]))
    if task == "gross_margin":
        return (d("revenue_2025") - d("cost_of_sales_2025")) / d("revenue_2025") * 100
    if task == "revenue_growth":
        return (d("revenue_2025") / d("revenue_2024") - 1) * 100
    if task == "operating_margin":
        return d("operating_income_2025") / d("revenue_2025") * 100
    if task == "current_ratio":
        return d("current_assets_2025") / d("current_liabilities_2025")
    if task == "debt_to_equity":
        return d("total_debt_2025") / d("total_equity_2025")
    raise ValueError(f"Unknown task: {task}")


def cases():
    result = []
    for company in statements():
        for task, (question, refs) in TASKS.items():
            result.append({
                "case_id": f"{company['id']}-{task}",
                "company": company["name"],
                "task": task,
                "question": f"For {company['name']}, calculate {question}. Round to two decimal places.",
                "facts": {key: company["facts"][key] for key in refs},
                "required_source_refs": [f"{company['id']}:{key}" for key in refs],
                "expected_value": str(calculate(task, company["facts"]).quantize(Decimal("0.01"))),
            })
    return result


def baseline_prediction(case):
    # A deterministic arithmetic control, not an AI model score.
    return {
        "case_id": case["case_id"],
        "value": case["expected_value"],
        "source_refs": case["required_source_refs"],
        "explanation": "Calculated using the cited financial statement fields.",
        "abstained": False,
    }


def is_request_error(prediction):
    return ("request_error" in prediction or
            (prediction.get("abstained") is True and prediction.get("explanation") == "API or parsing failure"))


def score_case(case, prediction):
    if prediction is None:
        return {"case_id": case["case_id"], "numeric_correct": False, "sources_correct": False,
                "pass": False, "error_codes": ["missing_prediction"], "needs_expert_review": False,
                "evaluated": False}
    if is_request_error(prediction):
        return {"case_id": case["case_id"], "numeric_correct": False, "sources_correct": False,
                "pass": False, "error_codes": ["api_error"], "needs_expert_review": False,
                "evaluated": False, "request_error": prediction.get("request_error", {"type": "legacy_api_error", "status": None})}
    errors = []
    abstained = prediction.get("abstained") is True
    numeric = False
    if abstained:
        errors.append("unnecessary_abstention")
    else:
        try:
            value = Decimal(str(prediction.get("value")))
            numeric = value.is_finite() and abs(value - Decimal(case["expected_value"])) <= Decimal("0.01")
        except (InvalidOperation, TypeError, ValueError):
            pass
        if not numeric:
            errors.append("incorrect_numeric_value")
    refs = prediction.get("source_refs")
    sources = (isinstance(refs, list) and all(isinstance(ref, str) for ref in refs)
               and len(refs) == len(set(refs)) and set(refs) == set(case["required_source_refs"]))
    if not sources:
        errors.append("missing_or_incorrect_sources")
    explanation = prediction.get("explanation")
    needs_review = isinstance(explanation, str) and bool(explanation.strip()) and not abstained
    return {"case_id": case["case_id"], "numeric_correct": numeric, "sources_correct": sources,
            "pass": numeric and sources and not abstained, "error_codes": errors,
            "needs_expert_review": needs_review, "evaluated": True}


def evaluate(predictions, selected_cases=None):
    by_id = {}
    for prediction in predictions:
        if not isinstance(prediction, dict) or not isinstance(prediction.get("case_id"), str):
            raise ValueError("Each prediction needs a string case_id")
        if prediction["case_id"] in by_id:
            raise ValueError(f"Duplicate case_id: {prediction['case_id']}")
        by_id[prediction["case_id"]] = prediction
    all_cases = cases() if selected_cases is None else selected_cases
    valid_ids = {case["case_id"] for case in all_cases}
    unknown = sorted(set(by_id) - valid_ids)
    if unknown:
        raise ValueError(f"Unknown case_id(s): {', '.join(unknown)}")
    results = [score_case(case, by_id.get(case["case_id"])) for case in all_cases]
    n = len(results)
    evaluated = [r for r in results if r["evaluated"]]
    count = len(evaluated)
    return {"dataset": "synthetic-v1", "case_count": n, "submitted": len(by_id),
            "evaluated_count": count, "api_error_count": sum("api_error" in r["error_codes"] for r in results),
            "coverage": count / n if n else None,
            "numeric_accuracy": sum(r["numeric_correct"] for r in evaluated) / count if count else None,
            "source_accuracy": sum(r["sources_correct"] for r in evaluated) / count if count else None,
            "strict_pass_rate": sum(r["pass"] for r in evaluated) / count if count else None,
            "expert_review_required": sum(r["needs_expert_review"] for r in results),
            "results": results,
            "limitations": "Synthetic statements; explanation truthfulness requires human review. No real-world model performance claim."}


def markdown_report(report):
    failures = [r for r in report["results"] if r["evaluated"] and not r["pass"]]
    unevaluated = [r for r in report["results"] if not r["evaluated"]]
    percent = lambda value: f"{value:.1%}" if value is not None else "N/A"
    lines = ["# Finance AI Quality Benchmark — evaluation", "",
             f"Dataset: `{report['dataset']}` · Cases: {report['case_count']} · Submitted: {report['submitted']}", "",
             f"- Evaluated model responses: {report['evaluated_count']}/{report['case_count']} (coverage: {percent(report['coverage'])})",
             f"- API errors: {report['api_error_count']}",
             f"- Numeric accuracy (evaluated responses): {percent(report['numeric_accuracy'])}",
             f"- Source accuracy (evaluated responses): {percent(report['source_accuracy'])}",
             f"- Strict pass rate (evaluated responses): {percent(report['strict_pass_rate'])}",
             f"- Explanations requiring expert review: {report['expert_review_required']}", "",
             "## Failures", ""]
    lines += [f"- `{r['case_id']}`: {', '.join(r['error_codes'])}" for r in failures] or ["No deterministic failures."]
    lines += ["", "## Not evaluated", ""]
    lines += [f"- `{r['case_id']}`: {', '.join(r['error_codes'])}" for r in unevaluated] or ["None."]
    lines += ["", "## Interpretation", "", report["limitations"], ""]
    return "\n".join(lines)
