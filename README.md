# CheckMate

A light daily reset app built around one idea: **you do not need to fix your whole life today — just make today 5% better.**

## V1

- Daily mood, stress and energy check-in
- Three-win rule for low-pressure planning
- Ten daily anchors: morning, mental state, alcohol-free, movement, body, family, work, money, future, connection
- Alcohol-free streak tracking without punitive reset language
- End-of-day reflection
- Seven-day trend view
- AI-personalised daily motivation through Vercel AI Gateway
- Fresh daily internet context from a quote source and positive-news feed
- Graceful non-AI fallback
- Browser-local storage in V1, so no account is required

## Privacy

V1 stores check-in data in browser localStorage. No personal check-in data is committed to this repository.

## AI

The serverless endpoint at `/api/motivation` uses Vercel AI Gateway when OIDC or `AI_GATEWAY_API_KEY` is available. It falls back to deterministic supportive copy if AI access is unavailable.

Default model: `openai/gpt-5.4-nano`.

## Product principle

CheckMate measures **direction, not perfection**. Missing a day does not erase previous progress.

## Next

A future version can add Supabase accounts and cross-device sync, longer-term insights, optional reminders, and richer source-backed motivation.
