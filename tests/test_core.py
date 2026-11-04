import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from finance_benchmark.core import baseline_prediction, cases, evaluate, score_case
from finance_benchmark.__main__ import main


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


if __name__ == "__main__":
    unittest.main()
