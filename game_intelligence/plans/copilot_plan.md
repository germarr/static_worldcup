# Guide Bracket + Data Science Project - Comprehensive Plan

## Executive Summary
Build a probabilistic guide bracket recommendation system that combines prediction market odds, team strength metrics, player availability, and World Cup tournament odds. The system will generate picks for each match with confidence scores and enable continuous improvement through performance tracking.

---

## Phase 1: Data Acquisition & Pipeline Setup

### 1.1 Prediction Market Odds (CURRENTLY BEING PULLED VIA KALSHI)
**Status:** You're already pulling from Kalshi API

**What to capture:**
- **Match-level odds (1X2 format):**
  - Home Win, Draw, Away Win implied probabilities
  - Odds timestamps (critical for tracking line movement)
  - Liquidity/volume metrics (indicator of market confidence)
  - Bidask spread (information about market uncertainty)
  
- **Outright World Cup winner odds:**
  - Per-team win probabilities (from your current Kalshi pull)
  - Track these daily to detect momentum shifts
  - Use as ultimate "tournament strength" signal

**Current setup in your codebase:**
- You have `KalshiClient` pulling candlestick data
- Store odds snapshots with timestamps in `fastapi_server/data/cache/`

**Recommendations:**
- Create a dedicated `odds_archiver.py` script that:
  - Runs every 4-6 hours during tournament
  - Stores normalized 1X2 probabilities + outright odds
  - Computes de-vigged probabilities (remove overround from bookmaker margins)
  - Logs liquidity metadata

**Data schema:**
```json
{
  "match_id": "group_a_mexico_vs_korea",
  "timestamp": "2026-06-15T14:30:00Z",
  "odds": {
    "home_win": 0.45,
    "draw": 0.28,
    "away_win": 0.27
  },
  "raw_odds": { "home": 2.22, "draw": 3.57, "away": 3.70 },
  "liquidity": { "volume_usd": 125000, "spread_pct": 0.8 },
  "source": "kalshi"
}
```

---

### 1.2 Team Strength & Performance Data

**Data sources to integrate:**

#### A. **FIFA Ratings** (Easiest to start with)
- **Where:** https://www.fifa.com/fifa-world-ranking/ or Kaggle (for historical)
- **What to capture:**
  - Current rating per team
  - Movement from previous month
  - Confidence interval (turnover rate in Elo-like systems)
  
- **Update frequency:** Monthly (or weekly during tournament prep)
  
**Recommendation:**
- Scrape FIFA rankings monthly OR
- Use Kaggle historical FIFA rankings dataset (already includes 2024-2026 data)
- Store in `game_intelligence/data/raw/team_ratings/fifa_elo.csv`

#### B. **Elo Ratings** (Optional but powerful)
- **Where:** https://www.eloratings.net/ or build your own
- **Why:** More responsive than FIFA, great for recency
- **Captures:** Head-to-head win probability elegantly

- **If building your own:**
  - Use historical match results (from your `data/matches.json`)
  - Implement Elo update rule: `K=32` for friendlies, `K=60` for competitive
  - Recompute ratings after each match completion

**Recommendation:**
- Start with eloratings.net data (publicly available, easy to scrape)
- Consider building your own for live updates during tournament

#### C. **Recent Form & xG Data**
- **Where:**
  - xG data: StatsBomb (API), Understat (requires subscription), or FBRef (free)
  - Match results: Your `data/matches.json` (extends as tournament progresses)

- **What to capture:**
  - Last 8-10 matches: results, goals, xG for/against
  - Weighted by recency (recent matches count more)
  - Split by home/away/neutral

- **Example calculation:**
  ```
  Form Score = Σ(weight_i * result_i) / Σ(weight_i)
  where weight_i = 0.9^(days_ago) for exponential decay
  ```

**Recommendation:**
- Minimum viable product: Use actual goals (2024 World Cup data readily available)
- Future: Integrate xG for deeper analysis
- Store in `game_intelligence/data/raw/team_performance/recent_form.csv`

**Schema:**
```csv
team,match_date,opponent,goals_for,goals_against,xg_for,xg_against,result,venue
Mexico,2026-06-15,South Korea,1,0,1.2,0.3,W,Home
```

---

### 1.3 Player-Level Data (Strategic Optional, but High-Impact)

**Approach:** Start lightweight, scale up later

**MVP (Minimum Viable Product):**
1. **Injury/Suspension Data**
   - **Source:** ESPN, official team announcements, or crowd-sourced
   - **Capture:** Player name, team, expected absence dates, severity
   - **Frequency:** Update 48 hours before each match
   - **Impact:** Adjust team strength if key players out
   
2. **Starting Lineup Composition**
   - **Source:** Official team sheets (pre-match)
   - **Capture:** Starter status, position, player rating
   - **Impact:** Compute lineup strength deviation from baseline

**Advanced (Post-MVP):**
1. **Player impact metrics:**
   - xG + xA (expected goals + assists) per 90 minutes
   - Expected minutes (how much player will play)
   - Defensive contribution (tackles, blocks, interceptions)
   - Goalkeeper save percentage

2. **Aggregated team lineup value:**
   - Sum of starter ratings vs bench strength
   - Projected minutes per key player
   - Injury risk score (is star player prone to injury?)

**Data schema:**
```json
{
  "team": "Argentina",
  "match_id": "group_c_argentina_vs_peru",
  "expected_lineup": [
    {
      "player_name": "Lionel Messi",
      "position": "RW",
      "expected_minutes": 90,
      "impact_rating": 0.92,
      "xg_per_90": 0.45,
      "xa_per_90": 0.28
    }
  ],
  "injuries": [
    {
      "player_name": "Alejandro Garnacho",
      "expected_return": "2026-06-20",
      "severity": "moderate"
    }
  ],
  "lineup_strength_delta": 0.08  // +8% vs average starting XI
}
```

**Recommendation:**
- **Phase 1:** Manual injury scraping from ESPN 48h before each match
- **Phase 2:** Add player rating aggregation (use Sofascore or Whoscored data)
- **Phase 3:** Historical xG/xA integration for predictive modeling

---

## Phase 2: Feature Engineering & Model Building

### 2.1 Core Features for Each Match

**Create a feature matrix per match:**

```python
{
  "match_id": "group_a_mexico_vs_korea",
  "home_team": "Mexico",
  "away_team": "South Korea",
  "timestamp": "2026-06-15T18:00:00Z",
  
  # Market-derived
  "market_home_win_prob": 0.45,
  "market_draw_prob": 0.28,
  "market_away_win_prob": 0.27,
  
  # Team strength
  "home_elo": 1850,
  "away_elo": 1720,
  "elo_differential": 130,
  "elo_win_prob": 0.62,  # Elo-implied probability
  
  # Tournament odds
  "home_wc_win_prob": 0.08,  // Mexico 8% to win World Cup
  "away_wc_win_prob": 0.02,  // S. Korea 2% to win World Cup
  "wc_prob_differential": 0.06,
  
  # Recent form
  "home_form_score": 0.72,  // Last 5 matches weighted
  "away_form_score": 0.55,
  
  # Player availability
  "home_lineup_strength_delta": 0.05,  // +5% vs baseline
  "away_lineup_strength_delta": -0.02, // -2% vs baseline
  "home_key_injuries": 0,  // Number of key players out
  "away_key_injuries": 1,
  
  # Context
  "rest_days_home": 3,
  "rest_days_away": 3,
  "travel_distance_km": 2100,
  "altitude_m": 1240,
  "is_neutral_venue": false
}
```

### 2.2 Tournament Win Probability Weighting

**Key insight:** Weaker teams play better against stronger opponents (regression to mean), but tournament favorites have edge

**Formula for adjusted match probability:**

```
1. Start with market odds:
   p_market(H wins) = 0.45

2. Apply World Cup strength adjustment:
   strength_factor = 1 + α * (wc_prob_home - wc_prob_away)
   α = 0.10 (tune this: range 0.05-0.15)
   
   strength_factor = 1 + 0.10 * (0.08 - 0.02) = 1.006
   p_adjusted(H wins) = p_market(H wins) * strength_factor = 0.453

3. Alternative: Multiplicative blend
   p_final = β * p_market + (1-β) * p_elo + γ * wc_adjustment
   β = 0.50 (market weight)
   γ = 0.10 (tournament strength modifier)
```

**Recommendation:**
- **Start simple:** Use linear adjustment with α=0.10
- **Constraint:** Cap adjustment at ±5 percentage points (don't let it override market)
- **Philosophy:** Market is usually right, but tournament favorites deserve slight boost

---

### 2.3 Pick Generation Logic

**Decision rule for each match:**

```python
def generate_pick(match_features):
    home_prob = match_features['adjusted_home_prob']
    draw_prob = match_features['adjusted_draw_prob']
    away_prob = match_features['adjusted_away_prob']
    
    # Confidence threshold
    max_prob = max(home_prob, draw_prob, away_prob)
    second_prob = sorted([home_prob, draw_prob, away_prob])[-2]
    
    confidence = max_prob - second_prob
    
    # Decision
    if confidence > 0.15:  # Strong signal
        volatility = "LOW"
    elif confidence > 0.05:  # Moderate signal
        volatility = "MEDIUM"
    else:
        volatility = "HIGH"  # Too close, risky
    
    primary_pick = argmax(home_prob, draw_prob, away_prob)
    secondary_pick = second best outcome
    
    return {
        "match_id": match_features['match_id'],
        "primary_pick": primary_pick,
        "primary_prob": max_prob,
        "secondary_pick": secondary_pick,
        "secondary_prob": second_prob,
        "confidence": confidence,
        "volatility": volatility,
        "reasoning": {
            "market_opinion": "...",
            "team_strength_view": "...",
            "tournament_odds_view": "..."
        }
    }
```

---

## Phase 3: Data Collection Implementation

### 3.1 Directory Structure (Add to `game_intelligence/`)

```
game_intelligence/
├── data/
│   ├── raw/
│   │   ├── odds/                    # Kalshi snapshots
│   │   │   ├── 2026-06-15.jsonl
│   │   │   └── 2026-06-16.jsonl
│   │   ├── team_ratings/            # FIFA Elo, historical
│   │   │   ├── fifa_elo.csv
│   │   │   └── historical_elo.csv
│   │   ├── team_performance/        # Match results, xG data
│   │   │   ├── matches.csv
│   │   │   └── player_stats.csv
│   │   └── players/                 # Injuries, lineups
│   │       ├── injuries_2026.csv
│   │       └── lineups_2026.csv
│   ├── features/                    # Engineered features
│   │   ├── match_features.csv
│   │   └── team_strength_signals.csv
│   └── outputs/                     # Model predictions & picks
│       ├── picks_2026.jsonl
│       └── performance_log.csv
├── scripts/
│   ├── 01_ingest_odds.py           # Kalshi -> raw
│   ├── 02_fetch_team_ratings.py    # FIFA/Elo -> raw
│   ├── 03_process_form.py          # Matches -> features
│   ├── 04_fetch_injuries.py        # Web scrape -> raw
│   ├── 05_engineer_features.py     # Raw -> features
│   ├── 06_generate_picks.py        # Features -> picks
│   └── scheduler.py                 # Orchestrates pipeline
├── models/
│   ├── pick_model.py               # Core logic & weighting
│   └── evaluation.py               # Backtesting & metrics
└── README.md                        # Pipeline documentation
```

### 3.2 Immediate Action Items (MVP - Weeks 1-2)

**Week 1:**
- [ ] Create data directory structure
- [ ] Write `01_ingest_odds.py` - extend your Kalshi archiver
  - Normalize to 1X2 probabilities
  - De-vig the odds (overround removal)
  - Store with metadata
  
- [ ] Write `02_fetch_team_ratings.py`
  - Scrape FIFA rankings OR download Kaggle dataset
  - Normalize team names to match your DB
  - Store as `team_ratings/fifa_elo.csv`

- [ ] Manually collect tournament win probabilities
  - Use current Kalshi data
  - Store in `data/raw/tournament_odds.csv`

**Week 2:**
- [ ] Write `05_engineer_features.py`
  - Merge odds + team ratings + form data
  - Compute Elo-based win probability
  - Create feature matrix CSV
  
- [ ] Write `06_generate_picks.py`
  - Implement pick generation with WC-probability weighting
  - Include confidence/volatility flags
  - Output picks as JSON for frontend consumption

- [ ] Create a simple evaluation script
  - Compare picks vs market favorites
  - Backtest on historical data (if available)

---

## Phase 4: Frontend Integration

### 4.1 Guide Bracket Page (`guide-bracket.html`)

**Display:**
- Matchup per row with:
  - Teams and group/stage info
  - **Guide pick** (primary + confidence)
  - **Market favorite** (for comparison)
  - **Team strength signal** (Elo differential)
  - **Tournament odds signal** (WC win prob ratio)
  - **Volatility flag** (LOW/MEDIUM/HIGH)
  
**Example row:**
```
[Group A] Mexico (8% WC) vs South Korea (2% WC)
├─ Guide Pick: Mexico (65% confidence: HIGH)
├─ Market Consensus: Mexico (45%)
├─ Elo says: Mexico +62 rating → 62% win probability
├─ Tournament strength: Mexico 4x more likely to win WC
└─ Volatility: LOW (clear signal)
```

### 4.2 Data Flow to Frontend

Add a new FastAPI endpoint:
```python
@app.get("/api/guide-bracket")
async def get_guide_bracket(stage: str = "groups"):
    # Read latest picks from game_intelligence/data/outputs/picks.jsonl
    # Filter by stage
    # Return with all signals and reasoning
```

---

## Phase 5: Continuous Improvement

### 5.1 Performance Tracking

**Track after each match:**
```csv
match_id,primary_pick,primary_prob,actual_result,log_loss,brier_score,won
group_a_mexico_korea,H,0.65,H,0.43,0.1225,1
```

**Metrics to compute:**
- **Log Loss:** `-Σ y*log(p) + (1-y)*log(1-p)` (lower is better)
- **Brier Score:** `Σ(predicted_prob - actual)²` (lower is better)
- **Accuracy:** % of picks correct
- **ROI vs market:** If you bet at market odds, how much would you gain/lose?

### 5.2 Model Refinement

**After tournament (post-mortem):**
1. Analyze which features contributed most to errors
2. Test different α (WC weighting) values
3. Try ensemble: 50% market, 30% Elo, 20% WC odds
4. Evaluate if player data improved predictions

---

## Data Sources Reference

| Data | Source | Update Frequency | Effort | Cost |
|------|--------|------------------|--------|------|
| **Match odds (1X2)** | Kalshi API | 4-6h during tournament | ✅ Already doing | Free |
| **Tournament odds** | Kalshi API | Daily | ✅ Extract from current pull | Free |
| **FIFA Rankings** | fifa.com or Kaggle | Monthly | Easy (scrape/CSV) | Free |
| **Elo Ratings** | eloratings.net | Weekly | Easy (scrape) | Free |
| **Match results** | Your DB + official | Post-match | Easy (your DB) | Free |
| **xG/xA data** | StatsBomb/FBRef | Post-match | Medium (API/scrape) | Free-$$ |
| **Injuries** | ESPN, official teams | 48h pre-match | Manual or scrape | Free |
| **Player stats** | Whoscored/Sofascore | Weekly | API/scrape | Free-$ |

---

## Recommended Data Collection Priority

### **Tier 1 (Start immediately):**
1. Market odds archiving (you're doing this)
2. Tournament win probabilities (extract from Kalshi)
3. FIFA or Elo team ratings (monthly scrape)
4. Match results as they happen (likely already in your DB)

**Effort:** Low | **Impact:** High ⭐⭐⭐⭐⭐

### **Tier 2 (Weeks 2-3):**
1. Recent form (W/L records, goals)
2. Injury reports (ESPN/official scraping)
3. Basic lineup strength (starter vs bench)

**Effort:** Medium | **Impact:** High ⭐⭐⭐⭐

### **Tier 3 (Post-MVP):**
1. xG/xA player data (requires API integration)
2. Expected minutes per player (advanced projection)
3. Historical tournament simulations (Monte Carlo)

**Effort:** High | **Impact:** Medium ⭐⭐⭐

---

## World Cup Win Probability Weighting - Practical Examples

### Example 1: Strong Favorite vs Dark Horse
```
Match: France (40% WC) vs Hungary (0.5% WC)

Market odds: France 65% win
Elo: France 70% win

WC adjustment:
  α = 0.10
  strength_factor = 1 + 0.10 * (0.40 - 0.005) = 1.0395
  
Adjusted probability:
  p_adjusted = 0.65 * 1.0395 = 0.677 (boost by 2.7%)

Pick: France with HIGH confidence
```

### Example 2: Two Tournament Contenders
```
Match: Argentina (20% WC) vs Germany (18% WC)

Market odds: Argentina 48%, Germany 32%, Draw 20%
WC adjustment: 0.20 - 0.18 = 0.02 (small differential)

Argentina adjusted: 0.48 * 1.002 = 0.481 (minimal impact)
Germany adjusted: 0.32 * 0.998 = 0.319

Pick: Argentina with MEDIUM confidence (market tight, WC odds agree)
```

### Example 3: Upset Situation
```
Match: Belgium (8% WC) vs Czech Republic (0.1% WC)

Market odds: Belgium 55%, Czech 20%, Draw 25%
Elo: Belgium 58% (stronger recent form)

WC adjustment: 0.08 - 0.001 = 0.079
  strength_factor = 1.0079
  
Belgium adjusted: 0.55 * 1.0079 = 0.554

Pick: Belgium with HIGH confidence (market + Elo + WC all agree)
```

---

## Key Design Decisions to Make Now

1. **Odds baseline:** Should market odds be 50% or 70% of final weight?
   - Recommendation: Start at 50%, tune based on backtests
   
2. **WC weighting strength (α):** How much should tournament odds move match odds?
   - Recommendation: Start at 0.10, test 0.05-0.15 range
   
3. **Player data timeline:** When to switch from MVP (injuries only) to advanced (xG)?
   - Recommendation: After first month of tournament, if picks need improvement
   
4. **Confidence thresholds:** At what margin between top 2 outcomes do we flag as risky?
   - Recommendation: 15% = LOW volatility, 5% = HIGH volatility
   
5. **Update frequency:** How often to recompute picks?
   - Recommendation: Daily (or 4h before each match day)

---

## Success Metrics

**By end of tournament:**
- [ ] Picks generated for all 64 matches
- [ ] Guide bracket 5-10% better than simple market consensus
- [ ] Player data reduced error by 3-5% (if integrated)
- [ ] Reproducible pipeline (can reuse for next tournament)
- [ ] Full audit trail of reasoning (why each pick was made)

---

## FAQ & Considerations

**Q: Should I trust the market or my model?**
A: Market is usually right as baseline. Use your model to identify mispricings (arbitrage) at edges. Start conservatively (small α).

**Q: What if player data is hard to find?**
A: MVP without it—injuries + rotation risk only. xG/xA is nice-to-have, not essential.

**Q: How to handle matches where odds change dramatically?**
A: Log all snapshots. Use median/IQR (interquartile range) to detect outliers. Document line movement.

**Q: What about live betting during matches?**
A: Phase 2 problem. For now, focus on pre-match picks.

**Q: How to validate model works?**
A: Backtest on 2022 World Cup data (publicly available). Compare vs simple Elo-only baseline.

---

## Next Steps

1. **This week:** Create directory structure, write odds archiver script
2. **Week 2:** Integrate FIFA ratings, compute match features
3. **Week 3:** Implement pick generation + confidence scoring
4. **Week 4:** Build frontend display + FastAPI endpoint
5. **Week 5+:** Continuous refinement & player data integration

---

**Owner:** You  
**Created:** 2026-01-21  
**Last Updated:** 2026-01-21  
**Status:** Planning phase → Implementation phase
