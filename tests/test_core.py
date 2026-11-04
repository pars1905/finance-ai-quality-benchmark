import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from decimal import Decimal
from urllib.error import HTTPError

from finance_benchmark.core import baseline_prediction, cases, evaluate, score_case
from finance_benchmark.__main__ import api_prediction_with_retry, main


class BenchmarkTests(unittest.TestCase):
    def test_30_cases_and_reference_control(self):
        items = cases()
        self.assertEqual(len(items), 30)
        self.assertEqual(len({x["case_id"] for x in items}), 30)
        report = evaluate([baseline_prediction(x) for x in items])
        self.assertEqual(report["strict_pass_rate"], 1)

    def test_limited_run_uses_limited_denominator(self):
        subset = cases()[:3]
        report = evaluate([baseline_prediction(x) for x in subset], selected_cases=subset)
        self.assertEqual(report["case_count"], 3)
        self.assertEqual(report["strict_pass_rate"], 1)

    def test_wrong_value_and_right_sources_fail_separately(self):
        case = cases()[0]
        p = baseline_prediction(case)
        p["value"] = "999"
        result = score_case(case, p)
        self.assertFalse(result["numeric_correct"])
        self.assertTrue(result["sources_correct"])
        self.assertEqual(result["error_codes"], ["incorrect_numeric_value"])

    def test_correct_number_but_wrong_source_fails(self):
        case = cases()[0]
        p = baseline_prediction(case)
        p["source_refs"] = ["invented:source"]
        result = score_case(case, p)
        self.assertTrue(result["numeric_correct"])
        self.assertFalse(result["pass"])
        p["source_refs"] = [["malformed"]]
        self.assertFalse(score_case(case, p)["sources_correct"])

    def test_malformed_and_missing_predictions(self):
        case = cases()[0]
        self.assertIn("missing_prediction", score_case(case, None)["error_codes"])
        p = baseline_prediction(case)
        p["value"] = "NaN"
        self.assertFalse(score_case(case, p)["numeric_correct"])
        p["value"] = "not a number"
        self.assertFalse(score_case(case, p)["numeric_correct"])

    def test_percentage_suffix_in_real_filing_answers(self):
        items = cases("real-filings-v1")
        predictions = [baseline_prediction(case) for case in items]
        predictions[0]["value"] = "14.93%"
        predictions[2]["value"] = "10.69%"
        report = evaluate(predictions, dataset="real-filings-v1")
        self.assertEqual(report["strict_pass_rate"], 1)
        self.assertEqual(report["numeric_accuracy"], 1)

    def test_percentage_suffix_rejected_for_ratio_and_malformed_values(self):
        ratio_case = next(case for case in cases() if case["task"] == "current_ratio")
        p = baseline_prediction(ratio_case)
        p["value"] = f'{p["value"]}%'
        self.assertFalse(score_case(ratio_case, p)["numeric_correct"])
        percentage_case = cases("real-filings-v1")[0]
        p = baseline_prediction(percentage_case)
        for malformed in ("14.93%%", "14,93%", "NaN%", True):
            p["value"] = malformed
            self.assertFalse(score_case(percentage_case, p)["numeric_correct"])

    def test_duplicate_and_unknown_ids_rejected(self):
        p = baseline_prediction(cases()[0])
        with self.assertRaises(ValueError):
            evaluate([p, p])
        with self.assertRaises(ValueError):
            evaluate([{"case_id": "made-up"}])

    def test_sample_predictions_are_imperfect(self):
        p = json.loads((Path(__file__).resolve().parent.parent / "examples" / "sample_predictions.json").read_text())
        report = evaluate(p)
        self.assertEqual(report["submitted"], 3)
        self.assertLess(report["strict_pass_rate"], 1)

    def test_api_errors_do_not_reduce_model_accuracy(self):
        subset = cases()[:3]
        predictions = [baseline_prediction(subset[0]), baseline_prediction(subset[1]),
                       {"case_id": subset[2]["case_id"], "request_error": {"type": "http", "status": 429}}]
        report = evaluate(predictions, selected_cases=subset)
        self.assertEqual(report["evaluated_count"], 2)
        self.assertEqual(report["api_error_count"], 1)
        self.assertAlmostEqual(report["coverage"], 2 / 3)
        self.assertEqual(report["strict_pass_rate"], 1)
        legacy = {"case_id": subset[2]["case_id"], "abstained": True,
                  "source_refs": [], "explanation": "API or parsing failure"}
        self.assertEqual(score_case(subset[2], legacy)["error_codes"], ["api_error"])

    def test_no_model_responses_reports_unavailable_accuracy(self):
        subset = cases()[:1]
        report = evaluate([], selected_cases=subset)
        self.assertIsNone(report["strict_pass_rate"])

    def test_temporary_503_retries_but_quota_429_does_not(self):
        case = cases("real-filings-v1")[0]
        unavailable = HTTPError("https://example.invalid", 503, "Service Unavailable", {}, None)
        with patch("finance_benchmark.__main__.api_prediction",
                   side_effect=[unavailable, unavailable, baseline_prediction(case)]) as request, \
             patch("finance_benchmark.__main__.time.sleep") as sleep:
            result = api_prediction_with_retry(case, "model", "https://example.invalid", "fake-test-key")
        self.assertEqual(result["case_id"], case["case_id"])
        self.assertEqual(request.call_count, 3)
        self.assertEqual([x.args[0] for x in sleep.call_args_list], [5, 10])
        limited = HTTPError("https://example.invalid", 429, "Too Many Requests", {}, None)
        with patch("finance_benchmark.__main__.api_prediction", side_effect=limited) as request, \
             patch("finance_benchmark.__main__.time.sleep") as sleep:
            with self.assertRaises(HTTPError):
                api_prediction_with_retry(case, "model", "https://example.invalid", "fake-test-key")
        self.assertEqual(request.call_count, 1)
        sleep.assert_not_called()

    def test_real_filing_pilot_has_three_source_backed_calculations(self):
        items = cases("real-filings-v1")
        self.assertEqual(len(items), 3)
        self.assertEqual({x["company"] for x in items},
                         {"Microsoft Corporation", "Apple Inc.", "Turkcell Iletisim Hizmetleri A.S."})
        for case in items:
            self.assertTrue(case["source_url"].startswith("https://www.sec.gov/Archives/edgar/data/"))
            self.assertEqual({e["source_ref"] for e in case["evidence"]}, set(case["required_source_refs"]))
            numbers = [Decimal(e["text"].split(": ")[1].split(" ")[1].replace(",", "")) for e in case["evidence"]]
            if case["case_id"] == "aapl-2025-services-share":
                expected = numbers[0] / numbers[1] * 100
            else:
                expected = (numbers[1] / numbers[0] - 1) * 100
            self.assertAlmostEqual(float(expected), float(case["expected_value"]), delta=0.005)
        report = evaluate([baseline_prediction(x) for x in items], dataset="real-filings-v1")
        self.assertEqual(report["case_count"], 3)
        self.assertEqual(report["strict_pass_rate"], 1)

    def test_gemini_uses_its_key_endpoint_and_three_case_denominator(self):
        seen = []

        def mock_prediction(case, model, base_url, key):
            seen.append((model, base_url, key))
            return baseline_prediction(case)

        with tempfile.TemporaryDirectory() as temp:
            with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-test-key"}), \
                 patch("sys.argv", ["finance_benchmark", "run", "--provider", "gemini", "--limit", "3", "--output", temp]), \
                 patch("finance_benchmark.__main__.api_prediction", side_effect=mock_prediction):
                main()
            report = json.loads((Path(temp) / "report.json").read_text())
        self.assertEqual(report["case_count"], 3)
        self.assertEqual(report["strict_pass_rate"], 1)
        self.assertEqual(seen, [("gemini-2.5-flash", "https://generativelanguage.googleapis.com/v1beta/openai", "fake-test-key")] * 3)

    def test_resume_retries_only_four_previous_api_errors(self):
        subset = cases()[:10]
        previous = [baseline_prediction(x) for x in subset[:6]]
        previous += [{"case_id": x["case_id"], "abstained": True,
                      "source_refs": [], "explanation": "API or parsing failure"} for x in subset[6:]]
        with tempfile.TemporaryDirectory() as temp:
            prior_path = Path(temp) / "prior.json"
            prior_path.write_text(json.dumps(previous))
            output = Path(temp) / "continued"
            with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-test-key"}), \
                 patch("sys.argv", ["finance_benchmark", "run", "--provider", "gemini", "--limit", "10",
                                    "--resume", str(prior_path), "--delay-seconds", "20", "--output", str(output)]), \
                 patch("finance_benchmark.__main__.api_prediction", side_effect=lambda case, *_: baseline_prediction(case)) as call, \
                 patch("finance_benchmark.__main__.time.sleep") as sleep:
                main()
            report = json.loads((output / "report.json").read_text())
        self.assertEqual(call.call_count, 4)
        self.assertEqual(sleep.call_count, 3)
        self.assertEqual(report["evaluated_count"], 10)
        self.assertEqual(report["strict_pass_rate"], 1)


if __name__ == "__main__":
    unittest.main()
