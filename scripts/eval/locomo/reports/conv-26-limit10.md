# LoCoMo Eval Report

- generated_at: 2026-08-20T09:20:37.639Z
- dry_run: false
- samples: conv-26
- qa_pairs: 10

## Overall

| Metric                   | Value  |
| ------------------------ | ------ |
| Token 节省率             | 99.2%  |
| 质量保持率               | 75.0%  |
| Baseline prompt tokens   | 181593 |
| FreeAnima prompt tokens  | 1417   |
| Baseline quality (mean)  | 0.400  |
| FreeAnima quality (mean) | 0.300  |

## By category

| Cat | Name       | N   | Token savings | Quality retention |
| --- | ---------- | --- | ------------- | ----------------- |
| 1   | single-hop | 3   | 99.3%         | 100.0%            |
| 2   | temporal   | 6   | 99.2%         | 0.0%              |
| 3   | multi-hop  | 1   | 99.2%         | 100.0%            |
