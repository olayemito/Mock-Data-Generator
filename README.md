# M&E Mock Data Generator for KoboToolbox

A synthetic data generation tool for Monitoring & Evaluation (M&E) teams, field researchers, and developers. It parses KoboToolbox form schemas, generates realistic multi-row survey datasets through LLM routing, and submits records directly to Kobo servers as OpenRosa-compliant XML.

---

## System Architecture

```text
                    ┌──────────────────────────────┐
                    │  OpenRouter                  │
                    │  (Gemini 2.5 Flash / Llama   │
                    │   3.3 70B fallback)          │
                    └──────────────▲───────────────┘
                                   │
┌────────────────────┐   ┌─────────┴──────────────┐   ┌──────────────────────┐
│ React / Next.js 14 │──>│ Next.js Serverless     │──>│ Upstash Redis        │
│ Frontend           │<──│ Routes (/api/schema,   │<──│ (Rate Limiting)      │
│ (Chunking)         │   │ /api/generate, /push)  │   │                      │
└─────────┬──────────┘   └────────────────────────┘   └──────────────────────┘
          │
          │ OpenRosa XML submission
          ▼
┌──────────────────────────────────────────────────────────────┐
│ KoboToolbox API (kf / kc / eu.kobotoolbox.org)               │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Features

- **Dynamic Kobo schema parsing**: Connects to the global (`kf.kobotoolbox.org`) and humanitarian (`eu.kobotoolbox.org`) servers to extract question types, choice lists, and field constraints.
- **Client-side request chunking**: Avoids Vercel free-tier 10-second serverless timeouts (`FUNCTION_INVOCATION_TIMEOUT`) by generating data in sequential chunks of 5 to 10 records.
- **OpenRouter AI engine**: Uses `google/gemini-2.5-flash`, with `meta-llama/llama-3.3-70b-instruct` as fallback, to produce survey responses that match a strict JSON schema.
- **Regional and distribution modeling**: Tailors data to a target region (e.g. Nigeria, East Africa) and a statistical distribution (*Realistic*, *Outlier-Heavy*, *Uniform*).
- **OpenRosa XML engine**: Converts internal JSON records into OpenRosa XML for direct submission to Kobo.
- **Rate limiting**: Upstash Redis sliding-window limits protect the AI endpoints from abuse and cost overruns.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 14.2.35](https://nextjs.org/) (App Router) |
| Styling | Tailwind CSS |
| Rate limiting | [Upstash Redis](https://upstash.com/) |
| AI router | [OpenRouter](https://openrouter.ai/) |
| Survey integration | [KoboToolbox v2 REST API](https://www.kobotoolbox.org/) and OpenRosa ingestion |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- OpenRouter API key
- Upstash Redis REST URL and token
- KoboToolbox account API token

### Environment Variables

Create a `.env.local` file in the project root:

```env
# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# KoboToolbox defaults
KOBO_SERVER_URL=https://kf.kobotoolbox.org
KOBO_API_TOKEN=your_default_kobo_token
```

> **Never commit `.env.local`.** Confirm it is listed in `.gitignore`.

### Installation

```bash
git clone https://github.com/olayemito/Mock-Data-Generator.git
cd Mock-Data-Generator/kobo-filler-main
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## API Endpoints

| Endpoint | Method | Description | Parameters |
| --- | --- | --- | --- |
| `/api/schema` | `GET` | Extracts form questions and choice lookup tables from Kobo. | `assetId`, `koboToken`, `server` |
| `/api/generate` | `POST` | Generates a 5 to 10 row chunk of synthetic survey records. | `fields`, `count`, `model`, `region`, `distribution` |
| `/api/push` | `POST` | Converts records to OpenRosa XML and submits them to Kobo. | `assetId`, `records`, `koboToken`, `server` |

---

## Deployment on Vercel

1. Set the **Root Directory** to `kobo-filler-main` in Project Settings.
2. Add `OPENROUTER_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` under **Settings → Environment Variables**.
3. Deploy from the `main` branch.

---

## Responsible Use

Intended for testing, training, and demos. Generated records are synthetic; do not submit them to production Kobo projects containing real respondent data.

---

## License

Released under the MIT License.
