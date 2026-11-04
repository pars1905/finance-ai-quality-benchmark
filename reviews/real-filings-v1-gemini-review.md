# Real-filings-v1 explanation review

Review date: 2026-11-04. Scope: the three Gemini responses shared by the repository owner from `results/real-filings-retry/predictions.json`, compared with the cited SEC filing tables. This is a manual arithmetic and evidence spot check, not an independent audit of the full annual reports. The local predictions file remains in the owner's Codespace; it is not committed to this repository.

| Case | Filing evidence | Independent calculation | Explanation check |
| --- | --- | --- | --- |
| `msft-2025-revenue-growth` | [FY2025 10-K, Item 7, Results of Operations](https://www.sec.gov/Archives/edgar/data/789019/000095017025100235/msft-20250630.htm): FY2025 revenue USD 281,724 million; FY2024 USD 245,122 million. | `(281724 - 245122) / 245122 * 100 = 14.932156...%` → **14.93%** | Pass for the stated calculation, periods and units. |
| `aapl-2025-services-share` | [FY2025 10-K, Products and Services Performance](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm): FY2025 Services net sales USD 109,158 million; total net sales USD 416,161 million. | `109158 / 416161 * 100 = 26.229752...%` → **26.23%** | Pass for the stated calculation and category. |
| `tkc-2025-revenue-growth` | [FY2025 20-F, consolidated statement notes, revenue and segment information](https://www.sec.gov/Archives/edgar/data/1071321/000110465926044740/tkc-20251231x20f.htm): FY2025 total revenue TRY 241,470,821 thousand; FY2024 comparative TRY 218,160,030 thousand. Both are presented in purchasing power as of 31 December 2025. | `(241470821 - 218160030) / 218160030 * 100 = 10.685179...%` → **10.69%** | Pass for the stated calculation and comparable IAS 29 basis. |

The submitted responses name the correct source fields and do not add unsupported causal explanations. Apple's explanation omits the final number in prose, but the structured `value` is 26.23, so its explanation describes the computation without asserting a conflicting result.

The initial 33.3% numeric score was a parser false negative: Microsoft and Turkcell returned numeric strings ending in `%`. The updated scorer accepts that suffix for percentage questions, and the owner's offline rescore of the same predictions reported 3/3 strict passes and zero API errors. No new model call was needed. The report still says "Explanations requiring expert review: 3" because this field is a static flag for nonempty explanations; the scorer does not ingest or certify this manual review.

Limits: these questions supplied curated excerpts and source IDs in the prompt. This review supports only the three published calculations and their quoted explanations, not retrieval from complete filings, accounting judgments, general model accuracy, or performance on unseen companies.
