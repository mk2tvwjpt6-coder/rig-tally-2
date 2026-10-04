# Rig Tally

First runnable implementation of the planned handwritten tubing tally app. No sample measurements are substituted for photo recognition.

## Run locally

Install Node.js 22 or newer. Copy `.env.example` to `.env`, set a server-side `OPENAI_API_KEY`, then run:

```sh
npm start
```

Open http://localhost:3000. Without the key, manual entry, review, saved batches and exports still work. Do not put the key in the browser, GitHub, or a photo. A ChatGPT subscription does not configure this server's API credentials.

## Workflow

1. Save company, well/job, string and starting joint. Optional tubing sections use `size, total actual joints` per line.
2. Select singles, stands, or mixed (over 40 ft counts as a stand). A stand retains one measured length and counts as two actual joints. Override the type during review when needed.
3. Photograph the 100-position sheet square-on with every corner visible. JPEG, PNG and WebP are supported. The browser honors photo orientation, resizes the longest side to at most 2400 pixels, previews the photo, and permits rotation.
4. Scan: two independent OpenAI vision requests read the actual photograph. Disagreements, missing readings and low model confidence trigger a third targeted reread. Third-pass suggestions do not clear the review requirement. Model-reported framing/focus/glare warnings appear for review; unreadable photos are rejected.
5. Compare handwriting crops, edit any measurement, remove spurious entries, and add missed ones. Every uncertain or unusual entry must be confirmed. Typical per-joint length is 27–34 ft; unusual positive values are allowed after review.
6. Save the verified batch, mark it run when appropriate, and add more sheets. Joint numbering and total footage continue across batches. Copy decimal or no-dot lengths for Excel, download CSV, and download/restore a job backup.

Footage uses integer hundredths of a foot. Split-string sections advance at actual joint boundaries. If a two-joint stand straddles sizes, the app asks for separately measured singles; it never fabricates individual lengths. Sections are specified from joint 1, even when the job starts at a later joint.

## Tests

```sh
npm test
```

Tests cover pass reconciliation, invalid responses, targeted third scans, provider payloads, unusual values, decimal totals, split strings, stands, and local HTTP behavior. Provider calls are mocked in tests. Real handwritten-photo accuracy has **not yet been measured with this code**; an API key and representative labeled photos are required for that validation.

## Scope and deployment

This first version stores one job in this browser's local storage. Backups preserve batches and job metadata; photos are kept only in memory and not included in backups. No multi-user job sharing, cloud database, automatic page rectification, calibrated confidence, or guaranteed complete-cell detection yet. Full-page vision supplies estimated handwriting boxes rather than deterministic grid segmentation. Always compare detected positions against the paper; two agreeing scans can both be wrong.

The server binds to localhost by default and keeps the key on the server. Before internet hosting, add authenticated access, per-user quotas and shared storage. The current global two-scan concurrency limit is not an authentication or distributed rate-limit system. Photo inputs are transmitted to OpenAI; `store:false` is set on Responses requests. Never deploy this endpoint as an unrestricted public service.

Next work: real-photo evaluations, perspective/cell alignment for the universal sheet, stronger capture checks, then shared jobs and additional tool/KB/weight calculations.

## Hosted build

`npm run build:hosted` emits a self-contained Cloudflare Worker in `dist/server/index.js`, serving the same frontend and recognition logic as the local app. Configure `OPENAI_API_KEY` as a hosted secret. Publish with owner-only access; the platform access gate protects the app. Device-local jobs are separate for each browser origin.
