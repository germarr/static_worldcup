# Guide Bracket + Data Science Plan

## Goals
- Provide a "guide bracket" that recommends picks for each match (home win, draw, away win).
- Use a repeatable data science workflow that blends market odds with team and player signals.
- Track model performance and update picks as new data arrives.

## Core idea
Start with prediction markets as the backbone (they already encode collective information). Then adjust match-level probabilities using team strength and player availability to create a final pick recommendation.

## Data to collect (priority order)
1) Prediction markets (already pulling)
- Match odds (1X2), implied probabilities, timestamped snapshots.
- Outright odds (win World Cup) per team, timestamped snapshots.
- Source metadata: market, exchange, liquidity/volume, last update.

2) Team-level performance
- FIFA/Elo ratings (current and historical).
- Recent form: last N matches, weighted by recency and opponent strength.
- Goal metrics: xG for/against if available, or goals for/against.
- Home/away splits and neutral venue adjustment.

3) Player-level data
- Expected minutes by player (injuries, suspensions, rotation risk).
- Player impact: minutes-weighted xG/xA, defensive actions, goalkeeper metrics.
- Team lineup strength metric derived from projected starters.

4) Context/competition
- Travel distance, rest days, climate, altitude (if available).
- Tournament phase (group vs knockout), tie-break considerations.

## Data quality and storage
- Build a simple data schema with sources, timestamps, and normalization.
- Store raw snapshots in a "raw" folder; derived features in "features".
- Keep a versioned dataset for reproducibility.

## Process overview (end-to-end)
1) Ingest
- Pull market odds and convert to implied probabilities (de-vig markets).
- Ingest team ratings, match results, and player availability.
- Normalize team and player identifiers across sources.

2) Feature engineering
- Team strength: blend Elo, recent form, and tournament performance.
- Player availability: compute lineup strength delta vs baseline.
- World Cup win probability: use outright markets and/or a tournament simulation.

3) Match probability model
- Baseline: market implied probabilities (1X2) for each match.
- Adjustments:
  - Team strength differential.
  - Player availability delta.
  - Rest/travel/context factors.
- Calibrate with a simple logistic model or Bayesian update.

4) Guide pick decision rule
- Choose outcome with highest adjusted probability.
- If draw probability within a small margin of top outcome, mark as "volatile".
- Provide confidence score and top 2 outcomes.

5) Tournament win weighting
- Apply a weighting factor when choosing picks:
  - If Team A has higher tournament win probability, increase its match win probability slightly.
  - Use a cap to avoid overpowering match-level odds.
- Example: adjusted_prob = match_prob * (1 + alpha * (team_wc_prob - opponent_wc_prob))

6) Evaluation
- Backtest on past tournaments or friendly data.
- Compare guide picks vs market favorites and vs simple Elo-only model.
- Metrics: log loss, Brier score, accuracy, ROI vs market.

7) Automation and updates
- Schedule daily data refresh (more often during tournament).
- Log changes to picks with timestamps and reason codes.

## Recommended starting tasks
1) Define data schema and storage layout
- Raw data: `game_intelligence/data/raw/`
- Features: `game_intelligence/data/features/`
- Model outputs: `game_intelligence/data/outputs/`

2) Build a market odds normalization step
- Convert odds to implied probabilities.
- Normalize to sum to 1 per match (de-vig).

3) Add team strength baseline
- Import Elo ratings and compute team strength features.
- Build a simple merge pipeline to match team IDs.

4) Add player availability pipeline
- Decide on data provider (e.g., publicly available injury reports).
- Build a first-cut lineup strength metric.

5) Create a simple guide pick generator
- Apply the decision rule and generate a bracket pick table.
- Include confidence and volatility flags.

## Immediate design decisions to make
- Pick a primary market source for odds (stable API or scraping).
- Pick a team rating source (Elo or FIFA) and update cadence.
- Decide if player data will be manual, scraped, or API-driven.
- Decide how much weight tournament win odds should carry.

## Notes on weighting by World Cup win probability
- Use the market outright odds as a proxy for tournament strength.
- Normalize across teams and apply a small alpha (e.g., 0.05 to 0.15).
- Use a maximum adjustment cap (e.g., +/- 5 percentage points).

## Next steps (for this repo)
- Add a `game_intelligence/README.md` documenting data sources and pipeline steps.
- Create a minimal pipeline script to generate pick recommendations from odds + Elo.
