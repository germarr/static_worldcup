# Game Intelligence: World Cup Bracket Prediction Rules

## Overview

A data-driven bracket prediction system that uses prediction markets as the foundation, enhanced with team strength metrics and contextual signals.

---

## Core Architecture

### Signal Weighting (Ensemble Approach)

| Signal | Weight | Source |
|--------|--------|--------|
| Prediction Markets | 40-50% | Kalshi, Polymarket, Odds API |
| Team Strength (Elo/FIFA) | 15-25% | eloratings.net, FIFA Rankings |
| Player Quality/Availability | 20-25% | FBRef, Transfermarkt |
| Recent Form | 15% | Last 6-10 matches |
| Contextual Adjustments | 5% | Rest days, travel, altitude |

---

## Match Prediction Formula

### Tournament Winner Probability Weighting

Use World Cup winner odds to derive head-to-head match probabilities:

```python
def match_probability(team_a_wc_prob, team_b_wc_prob, k=0.7):
    """
    Convert tournament winner odds to match win probability.
    k controls how strongly odds translate to match outcomes (0.5-1.0)
    """
    log_ratio = math.log(team_a_wc_prob / team_b_wc_prob)
    raw_p_a = 1 / (1 + math.exp(-k * log_ratio))

    # Draw probability (higher for evenly matched teams)
    competitiveness = 1 - abs(raw_p_a - 0.5) * 2
    p_draw = 0.26 * competitiveness  # Base ~26% draw rate

    # Normalize win probabilities
    p_a_win = raw_p_a * (1 - p_draw)
    p_b_win = (1 - raw_p_a) * (1 - p_draw)

    return {'team_a': p_a_win, 'draw': p_draw, 'team_b': p_b_win}
```

### Market Adjustment Factor

```python
adjusted_prob = market_prob * (1 + α * (team_wc_prob - opponent_wc_prob))
# α = 0.10 (range: 0.05-0.15)
# Bounded adjustment: ±5 percentage points max
```

---

## Data Sources

### Tier 1: Prediction Markets (Primary Signal)
- **Kalshi** - World Cup winner odds, match odds
- **Polymarket** - Alternative market prices
- **The Odds API** - Free bookmaker aggregator
- **Betfair** - Sharp betting lines

### Tier 2: Team Strength
- **FIFA Rankings** - Official monthly ratings
- **Elo Ratings** (eloratings.net) - More responsive
- **FiveThirtyEight SPI** - Club + international combined

### Tier 3: Player Data
- **FBRef** - xG, xA, progressive actions
- **Transfermarkt** - Squad values, injuries
- **Sofascore** - Player ratings, form

### Tier 4: Contextual
- Injury reports, starting lineups (48h pre-match)
- Travel distance, rest days
- Altitude, climate, neutral venue

---

## Tournament Phases

### Group Stage Rules
- Draw probability: ~25-28%
- Points: Win=3, Draw=1, Loss=0
- Tiebreakers: Goal difference, goals scored, head-to-head

### Knockout Stage Rules
- Draw probability: ~20% (extra time/penalties resolve)
- Single elimination
- Consider penalty shootout history for ties

---

## Implementation Phases

### Phase 1: MVP (Immediate)
- Use existing Kalshi World Cup winner odds
- Apply logistic formula for match probabilities
- Generate baseline bracket picks

### Phase 2: Market Expansion (Week 2-3)
- Add Odds API, Polymarket sources
- Volume-weighted averaging across markets
- Track odds movement (4-6 hour snapshots)

### Phase 3: Team Strength Layer (Week 3-4)
- Integrate FIFA/Elo ratings
- Recent form scoring (exponential decay)
- Blend: `p = 0.50*market + 0.30*elo + 0.20*form`

### Phase 4: Player Integration (Week 5-6)
- Injury/suspension tracking (48h pre-match)
- Key player availability multiplier
- Squad strength via aggregated xG

### Phase 5: Calibration (Week 7-8)
- Backtest on 2014, 2018, 2022 World Cups
- Optimize weights via scipy.optimize
- Brier Score and Log Loss metrics

### Phase 6: Tournament Simulation (Week 9-10)
- Monte Carlo: 10,000 simulations
- Probability of each team reaching each round
- Upset probability and variance analysis

---

## Key Design Parameters

| Parameter | Recommended | Range |
|-----------|-------------|-------|
| Market baseline weight | 50% | 40-70% |
| WC weighting strength (α) | 0.10 | 0.05-0.15 |
| Logistic k-factor | 0.70 | 0.50-1.00 |
| Base draw rate (group) | 26% | 24-28% |
| Base draw rate (knockout) | 20% | 18-22% |

---

## Prediction Output Format

Each prediction should include:

```json
{
  "match": "USA vs Wales",
  "phase": "group_stage",
  "prediction": {
    "usa_win": 0.52,
    "draw": 0.23,
    "wales_win": 0.25
  },
  "confidence": "high",
  "reasoning": {
    "market_signal": "USA 48% (Kalshi consensus)",
    "elo_differential": "+95 → 58% implied",
    "wc_odds_ratio": "USA 4.2% vs Wales 0.8% → 5.25x",
    "form": "USA 4W-1D-1L vs Wales 2W-2D-2L"
  },
  "pick": "USA",
  "timestamp": "2026-06-10T14:00:00Z"
}
```

---

## Performance Tracking

### Metrics to Log
- **Brier Score**: Σ(predicted_prob - actual)² (lower is better)
- **Log Loss**: -Σ y*log(p) for calibration
- **Accuracy**: Correct picks / total picks
- **ROI**: If betting simulation included

### Calibration Check
- 60% confidence picks should win ~60% of time
- Plot reliability diagrams post-tournament

---

## Project Structure

```
game_intelligence/
├── data/
│   ├── raw/odds/           # Market snapshots
│   ├── raw/team_ratings/   # FIFA, Elo
│   └── outputs/            # Predictions
├── signals/
│   ├── market_signal.py
│   ├── elo_signal.py
│   └── form_signal.py
├── predictor/
│   ├── match_predictor.py
│   ├── bracket_generator.py
│   └── tournament_sim.py
└── scripts/
    ├── backtest.py
    └── daily_update.py
```

---

## Summary

**Core Principle**: Prediction markets are efficient and should be the primary signal (40-50%). Layer in team strength and form data to find edge cases where markets may be slightly mispriced. Never override market consensus by more than ±5 percentage points.

**Key Innovation**: Using tournament winner probabilities to derive match-level predictions through logistic transformation, with draw rate adjusted for team competitiveness.

**Philosophy**: Start simple with market data, iterate with additional signals, always backtest and measure performance.
