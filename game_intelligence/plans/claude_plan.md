# Game Intelligence: World Cup 2026 Guide Bracket

## Executive Summary

Build a data-driven guide bracket system that recommends match outcomes (win/loss/draw) by combining prediction market probabilities, player statistics, historical team performance, and advanced analytics. The system will weight recommendations based on tournament-winning probability as a foundation, then layer in match-specific factors.

---

## Part 1: Core Philosophy - Probability-Weighted Picks

### The World Cup Winner Probability Foundation

Your Kalshi data provides the most critical input: **implied probability of winning the entire tournament**. This is valuable because:

1. **Market Efficiency**: Prediction markets aggregate wisdom from thousands of participants with money at stake
2. **Forward-Looking**: Unlike historical stats, markets price in current form, injuries, and squad quality
3. **Calibrated Probabilities**: Market prices naturally calibrate to real probabilities over time

### Converting Tournament Odds to Match Predictions

The key insight: **a team's probability of winning the World Cup implicitly encodes their probability of winning each match along the way**.

**Mathematical Framework:**

For a team to win the World Cup, they must:
- Win 3 group stage matches (or enough to advance)
- Win 4 knockout matches (R32, R16, QF, SF, Final)

If Team A has 16% chance to win the World Cup and Team B has 2%, we can derive relative match probabilities:

```
Relative Strength Ratio = P(A wins WC) / P(B wins WC) = 16/2 = 8x

This maps to approximate match win probabilities using a logistic function.
```

**Proposed Formula for Head-to-Head:**

```python
def match_probability(team_a_wc_prob, team_b_wc_prob):
    """
    Convert World Cup winner odds to head-to-head match probability.
    Uses log-odds ratio with empirical calibration.
    """
    import math

    # Avoid division by zero
    a = max(team_a_wc_prob, 0.001)
    b = max(team_b_wc_prob, 0.001)

    # Log-odds ratio
    log_ratio = math.log(a / b)

    # Calibration factor (tune based on historical data)
    # Higher k = more decisive outcomes for favorites
    k = 0.7  # Start here, calibrate with data

    # Logistic transformation
    p_a_wins = 1 / (1 + math.exp(-k * log_ratio))

    # Draw probability (football-specific)
    # More likely when teams are evenly matched
    draw_base = 0.25  # Base draw rate in football
    mismatch = abs(p_a_wins - 0.5)
    p_draw = draw_base * (1 - mismatch)  # Draw less likely in mismatches

    # Normalize
    p_a_wins_adj = p_a_wins * (1 - p_draw)
    p_b_wins_adj = (1 - p_a_wins) * (1 - p_draw)

    return {
        'team_a_win': round(p_a_wins_adj, 3),
        'draw': round(p_draw, 3),
        'team_b_win': round(p_b_wins_adj, 3)
    }
```

---

## Part 2: Data Sources & Collection Strategy

### 2.1 Prediction Markets (Current - Expand)

**Already Have:**
- Kalshi World Cup winner odds
- Historical probability time-series
- Volume data (market confidence indicator)

**Recommended Additions:**

| Source | Data Type | API/Method | Priority |
|--------|-----------|------------|----------|
| Polymarket | WC winner odds | REST API (free) | High |
| Betfair Exchange | Match odds, WC winner | API (requires account) | High |
| Pinnacle | Sharp betting lines | Web scraping | Medium |
| Smarkets | WC winner, match odds | REST API | Medium |
| Odds API | Aggregated bookmaker odds | `the-odds-api.com` (free tier) | High |

**Why Multiple Sources?**
- Arbitrage between sources indicates uncertainty
- Volume-weighted average improves accuracy
- Sharp books (Pinnacle, Betfair) vs soft books divergence signals value

**Data Model Extension:**
```python
class PredictionMarketOdds(SQLModel, table=True):
    id: int
    team_id: int
    source: str  # 'kalshi', 'polymarket', 'betfair', etc.
    market_type: str  # 'tournament_winner', 'match_result', 'group_winner'
    probability: float
    volume: Optional[float]
    timestamp: datetime
```

### 2.2 Player Data (New)

This is where you can differentiate your model. Player-level data captures:
- Current form
- Injury status
- Key player availability
- Squad depth

**Recommended Data Sources:**

| Source | Data Available | Access Method | Cost |
|--------|----------------|---------------|------|
| **FBref** | Comprehensive stats (xG, xA, progressive actions) | Web scraping | Free |
| **Transfermarkt** | Market values, injuries, squad lists | API/Scraping | Free |
| **Sofascore** | Match ratings, form | API | Free tier |
| **Understat** | xG data, shot maps | Scraping | Free |
| **Football-Data.org** | Historical matches, results | REST API | Free |
| **API-Football** | Live data, player stats | RapidAPI | Freemium |
| **StatsBomb** | Advanced analytics | Application | Free for research |

**Priority Order for Implementation:**
1. **FBref** - Best free source for advanced metrics
2. **Transfermarkt** - Injuries and squad composition
3. **Football-Data.org** - Historical match results
4. **API-Football** - If real-time updates needed

**Key Player Metrics to Collect:**

```python
class PlayerStats(SQLModel, table=True):
    id: int
    player_name: str
    team_id: int  # Foreign key to fifa_teams
    position: str

    # Identification
    fbref_id: Optional[str]
    transfermarkt_id: Optional[str]

    # Performance Metrics (per 90 minutes)
    goals_per90: float
    assists_per90: float
    xg_per90: float  # Expected goals
    xa_per90: float  # Expected assists
    npxg_per90: float  # Non-penalty xG

    # Creative/Progressive
    progressive_carries_per90: float
    progressive_passes_per90: float
    shot_creating_actions_per90: float
    goal_creating_actions_per90: float

    # Defensive (for defenders/midfielders)
    tackles_won_per90: float
    interceptions_per90: float
    blocks_per90: float
    clearances_per90: float

    # Possession
    pass_completion_pct: float
    touches_per90: float

    # Form & Status
    minutes_played_season: int
    matches_played_season: int
    current_form_rating: Optional[float]  # Last 5 matches
    is_injured: bool
    injury_return_date: Optional[date]

    # Market Value (proxy for quality)
    market_value_eur: Optional[int]

    updated_at: datetime
```

### 2.3 Team-Level Historical Data

**Historical Match Data:**

```python
class HistoricalMatch(SQLModel, table=True):
    id: int
    date: date
    competition: str  # 'World Cup', 'Euro', 'Copa America', 'Friendly', 'WCQ'

    home_team_id: int
    away_team_id: int

    home_goals: int
    away_goals: int

    # Advanced (if available)
    home_xg: Optional[float]
    away_xg: Optional[float]

    # Context
    is_neutral_venue: bool
    tournament_stage: Optional[str]  # 'group', 'r16', 'qf', 'sf', 'final'
```

**Head-to-Head Records:**

For each team pairing, compute:
- All-time record (W-D-L)
- Recent record (last 10 years)
- Tournament record (World Cup only)
- Goals scored/conceded

### 2.4 FIFA Rankings & Elo Ratings

| Source | Description | Update Frequency |
|--------|-------------|------------------|
| FIFA Ranking | Official FIFA points | Monthly |
| World Football Elo | More predictive than FIFA | After each match |
| FiveThirtyEight SPI | Club + international combined | Weekly |

**Data Model:**

```python
class TeamRating(SQLModel, table=True):
    id: int
    team_id: int
    rating_system: str  # 'fifa', 'elo', 'spi'
    rating_value: float
    rank: int
    as_of: date
```

---

## Part 3: The Prediction Model Architecture

### 3.1 Ensemble Approach

Combine multiple signals rather than relying on a single model:

```
Final Prediction = w1 * Market Signal
                 + w2 * Player Quality Signal
                 + w3 * Historical Signal
                 + w4 * Form Signal
                 + w5 * Contextual Adjustments
```

### 3.2 Signal Definitions

**Signal 1: Market Signal (w1 = 0.40)**
- Primary: Kalshi/Polymarket World Cup winner odds
- Secondary: Match-specific betting odds (if available)
- Transform to head-to-head probability using log-odds formula

**Signal 2: Player Quality Signal (w2 = 0.25)**
- Aggregate squad xG production
- Key player availability (top 3 players by market value)
- Squad depth (bench quality vs starting XI)

```python
def player_quality_signal(team_a_players, team_b_players):
    """
    Compare squad quality based on player statistics.
    """
    def squad_strength(players):
        # Weight by expected contribution
        total_xg = sum(p.xg_per90 * p.minutes_played_season / 90 for p in players)
        total_xa = sum(p.xa_per90 * p.minutes_played_season / 90 for p in players)

        # Injury penalty
        available_value = sum(
            p.market_value_eur for p in players
            if not p.is_injured
        )
        total_value = sum(p.market_value_eur for p in players)
        availability_factor = available_value / total_value

        return (total_xg + total_xa) * availability_factor

    strength_a = squad_strength(team_a_players)
    strength_b = squad_strength(team_b_players)

    # Convert to probability
    total = strength_a + strength_b
    return strength_a / total, strength_b / total
```

**Signal 3: Historical Signal (w3 = 0.15)**
- Head-to-head record (weight recent matches more)
- Performance in similar competitions (World Cup > Friendlies)
- Tournament experience (deep runs count)

**Signal 4: Form Signal (w4 = 0.15)**
- Recent match results (last 6 international matches)
- Goal difference trend
- xG over/under performance (regression candidate?)

**Signal 5: Contextual Adjustments (w5 = 0.05)**
- Home/away (less relevant in World Cup, but host nation matters)
- Travel distance (group stage logistics)
- Rest days between matches
- Knockout pressure (some teams perform better in must-win)

### 3.3 Handling Draws

Football has significant draw rates (~25% in World Cup group stage). Model this explicitly:

```python
def predict_match(team_a, team_b, signals):
    """
    Returns probability distribution: (p_a_win, p_draw, p_b_win)
    """
    # Get combined signal for team_a win probability
    p_a_raw = weighted_signal_combination(signals)

    # Draw probability based on match competitiveness
    competitiveness = 1 - abs(p_a_raw - 0.5) * 2  # 0 to 1, 1 = even match

    # Tournament stage affects draw probability
    if knockout_match:
        p_draw = 0.20 * competitiveness  # Draws lead to extra time
    else:
        p_draw = 0.28 * competitiveness  # Group stage draw more common

    # Distribute remaining probability
    remaining = 1 - p_draw
    p_a_win = p_a_raw * remaining
    p_b_win = (1 - p_a_raw) * remaining

    return (p_a_win, p_draw, p_b_win)
```

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Extend existing infrastructure with match prediction capability

**Tasks:**

1. **Create Match Predictions Model**
   ```python
   class MatchPrediction(SQLModel, table=True):
       id: int
       match_id: int  # Reference to your matches data

       team_a_id: int
       team_b_id: int

       # Raw probabilities
       team_a_win_prob: float
       draw_prob: float
       team_b_win_prob: float

       # Recommended pick
       recommended_pick: str  # 'team_a', 'draw', 'team_b'
       confidence: float  # 0-1

       # Signal breakdown (for explainability)
       market_signal: float
       player_signal: float
       historical_signal: float
       form_signal: float

       model_version: str
       created_at: datetime
   ```

2. **Implement Basic Predictor Using Kalshi Data Only**
   - Parse your existing Kalshi rankings
   - Apply log-odds formula for head-to-head
   - Generate initial bracket predictions

3. **Create API Endpoint**
   ```python
   @router.get("/predictions/{match_id}")
   def get_match_prediction(match_id: int):
       # Return prediction with confidence
       pass

   @router.get("/guide-bracket")
   def get_full_bracket_guide():
       # Return all predictions for complete bracket
       pass
   ```

### Phase 2: Player Data Integration (Week 3-4)

**Goal:** Add player statistics for refined predictions

**Tasks:**

1. **Build FBref Scraper**
   ```python
   # game_intelligence/scrapers/fbref_scraper.py
   class FBrefScraper:
       def get_team_players(self, team_name: str) -> List[PlayerStats]:
           pass

       def get_player_stats(self, player_id: str) -> PlayerStats:
           pass
   ```

2. **Build Transfermarkt Scraper**
   - Squad lists for each World Cup team
   - Injury reports
   - Market values

3. **Create Data Pipeline**
   ```
   Cron Job (daily) → Scrape FBref/Transfermarkt
                    → Update player_stats table
                    → Recalculate squad strength metrics
   ```

4. **Integrate Player Signal into Model**

### Phase 3: Historical Data & Elo (Week 5-6)

**Goal:** Add historical context to predictions

**Tasks:**

1. **Import Historical Match Data**
   - Source: Football-Data.org or Kaggle datasets
   - Focus on: World Cups, Continental tournaments, qualifiers

2. **Build Head-to-Head Calculator**
   ```python
   def get_h2h_record(team_a_id: int, team_b_id: int) -> dict:
       """
       Returns weighted historical record.
       """
       matches = get_historical_matches(team_a_id, team_b_id)

       # Weight by recency and importance
       weighted_wins_a = 0
       weighted_wins_b = 0
       weighted_draws = 0

       for match in matches:
           weight = recency_weight(match.date) * importance_weight(match.competition)
           # ... accumulate

       return {
           'team_a_advantage': weighted_wins_a / total_weight,
           # ...
       }
   ```

3. **Integrate Elo Ratings**
   - Scrape from eloratings.net
   - Update weekly

### Phase 4: Model Calibration & Backtesting (Week 7-8)

**Goal:** Validate and tune the model

**Tasks:**

1. **Backtest on Historical World Cups**
   - 2022 Qatar
   - 2018 Russia
   - 2014 Brazil

   Metrics:
   - Brier Score (probability calibration)
   - Log Loss
   - Accuracy (if picking most likely outcome)
   - ROI (if simulating bets)

2. **Tune Signal Weights**
   ```python
   from scipy.optimize import minimize

   def optimize_weights(historical_matches, actual_results):
       def objective(weights):
           predictions = [predict_match(m, weights) for m in historical_matches]
           return brier_score(predictions, actual_results)

       result = minimize(objective, initial_weights, method='SLSQP',
                        constraints={'type': 'eq', 'fun': lambda w: sum(w) - 1})
       return result.x
   ```

3. **Calibration Plots**
   - Reliability diagram
   - Compare predicted vs actual win rates by probability bucket

### Phase 5: User-Facing Guide Bracket (Week 9-10)

**Goal:** Build the frontend feature

**Tasks:**

1. **Guide Bracket API**
   ```python
   @router.get("/guide-bracket")
   def get_guide_bracket():
       """
       Returns complete bracket with AI recommendations.
       """
       return {
           "group_stage": [
               {
                   "match_id": 1,
                   "team_a": "USA",
                   "team_b": "Morocco",
                   "prediction": {
                       "recommended": "team_a",
                       "probabilities": {
                           "team_a_win": 0.42,
                           "draw": 0.28,
                           "team_b_win": 0.30
                       },
                       "confidence": 0.65,
                       "reasoning": "USA slight favorite based on market odds (16% vs 2% WC winner). Home advantage as host nation."
                   }
               },
               # ... all 104 matches
           ],
           "model_info": {
               "version": "1.0",
               "last_updated": "2026-06-01T00:00:00Z",
               "data_sources": ["Kalshi", "FBref", "Elo Ratings"]
           }
       }
   ```

2. **Frontend Integration**
   - Toggle between "My Picks" and "AI Guide"
   - Visual confidence indicator (color gradient)
   - "Why?" tooltip with reasoning

3. **Bracket Simulation**
   - Monte Carlo simulation of tournament outcomes
   - Show probability each team reaches each round
   - Expected points for pool scoring

---

## Part 5: Data Collection - Getting Started Now

### Immediate Actions (This Week)

**1. Set Up Additional Prediction Market Feeds**

```python
# game_intelligence/scrapers/odds_api.py
import requests

THE_ODDS_API_KEY = "your_key_here"  # Free tier: 500 requests/month

def get_world_cup_odds():
    """Fetch aggregated bookmaker odds."""
    url = "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds"
    params = {
        "apiKey": THE_ODDS_API_KEY,
        "regions": "us,eu",
        "markets": "h2h,outrights",
        "oddsFormat": "decimal"
    }
    response = requests.get(url, params=params)
    return response.json()
```

**2. Start Collecting Player Data**

```python
# game_intelligence/scrapers/fbref_scraper.py
import requests
from bs4 import BeautifulSoup
import pandas as pd

class FBrefScraper:
    BASE_URL = "https://fbref.com"

    # World Cup 2026 team FBref IDs (you'll need to map these)
    TEAM_IDS = {
        "USA": "...",
        "Mexico": "...",
        # ... etc
    }

    def get_squad_stats(self, team_id: str) -> pd.DataFrame:
        """
        Scrape squad statistics for a national team.
        """
        url = f"{self.BASE_URL}/en/squads/{team_id}/stats"
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(response.content, "html.parser")

        # Parse the stats table
        # ... implementation
        pass
```

**3. Download Historical Data**

```bash
# Football-Data.org - Free historical data
curl "https://www.football-data.org/v4/competitions/WC/matches" \
  -H "X-Auth-Token: YOUR_TOKEN" > historical_wc_matches.json

# Alternative: Kaggle datasets
# - International football results from 1872
# - FIFA World Cup historical data
```

### Data Storage Schema

```sql
-- Add these tables to your existing database

CREATE TABLE player_stats (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(100) NOT NULL,
    team_id INTEGER REFERENCES fifa_teams(id),
    position VARCHAR(20),

    -- IDs for cross-referencing
    fbref_id VARCHAR(50),
    transfermarkt_id VARCHAR(50),

    -- Performance metrics (per 90)
    goals_per90 DECIMAL(5,2),
    assists_per90 DECIMAL(5,2),
    xg_per90 DECIMAL(5,2),
    xa_per90 DECIMAL(5,2),

    -- Status
    is_injured BOOLEAN DEFAULT FALSE,
    injury_return_date DATE,
    market_value_eur BIGINT,

    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE historical_matches (
    id SERIAL PRIMARY KEY,
    match_date DATE NOT NULL,
    competition VARCHAR(100),

    home_team_id INTEGER REFERENCES fifa_teams(id),
    away_team_id INTEGER REFERENCES fifa_teams(id),

    home_goals INTEGER,
    away_goals INTEGER,

    home_xg DECIMAL(4,2),
    away_xg DECIMAL(4,2),

    is_neutral_venue BOOLEAN DEFAULT FALSE,
    tournament_stage VARCHAR(50)
);

CREATE TABLE team_ratings (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES fifa_teams(id),
    rating_system VARCHAR(20),  -- 'fifa', 'elo', 'spi'
    rating_value DECIMAL(8,2),
    rank INTEGER,
    as_of DATE,

    UNIQUE(team_id, rating_system, as_of)
);

CREATE TABLE match_predictions (
    id SERIAL PRIMARY KEY,
    match_id INTEGER,  -- Reference to your matches

    team_a_id INTEGER REFERENCES fifa_teams(id),
    team_b_id INTEGER REFERENCES fifa_teams(id),

    team_a_win_prob DECIMAL(4,3),
    draw_prob DECIMAL(4,3),
    team_b_win_prob DECIMAL(4,3),

    recommended_pick VARCHAR(20),
    confidence DECIMAL(4,3),

    -- Signal breakdown
    market_signal DECIMAL(4,3),
    player_signal DECIMAL(4,3),
    historical_signal DECIMAL(4,3),
    form_signal DECIMAL(4,3),

    model_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Part 6: Advanced Analytics & Differentiation

### 6.1 Unique Angles to Explore

**1. Market Inefficiency Detection**
- Compare your model to market odds
- Flag matches where your model disagrees significantly
- These are high-confidence picks

**2. Volume-Weighted Confidence**
- Kalshi volume indicates market conviction
- Low volume = uncertain, high volume = consensus
- Adjust confidence accordingly

**3. Odds Movement Tracking**
- You're already storing time-series data
- Detect momentum (improving/declining odds)
- "Smart money" signals when large volume moves odds

**4. Tournament Simulation**
- Monte Carlo simulation (10,000 runs)
- Probability of each team reaching each round
- Expected bracket points for pool optimization

```python
def simulate_tournament(predictions, n_simulations=10000):
    """
    Run Monte Carlo simulation of tournament.
    """
    results = defaultdict(lambda: defaultdict(int))

    for _ in range(n_simulations):
        bracket = simulate_single_tournament(predictions)
        for team, round_reached in bracket.items():
            results[team][round_reached] += 1

    # Convert to probabilities
    for team in results:
        for round in results[team]:
            results[team][round] /= n_simulations

    return results
```

### 6.2 Explainability Features

Make the model's reasoning transparent:

```python
def explain_prediction(match_id: int) -> dict:
    prediction = get_prediction(match_id)

    return {
        "summary": f"{prediction.team_a} is favored (62%) due to higher tournament odds and stronger recent form.",
        "factors": [
            {
                "name": "Tournament Odds",
                "impact": "+15% for Team A",
                "detail": "Team A has 16% WC winner probability vs Team B's 2%"
            },
            {
                "name": "Recent Form",
                "impact": "+5% for Team A",
                "detail": "Won 5 of last 6 matches vs 3 of 6"
            },
            {
                "name": "Head-to-Head",
                "impact": "Neutral",
                "detail": "2-2-2 in last 6 meetings"
            },
            {
                "name": "Key Player Availability",
                "impact": "-3% for Team A",
                "detail": "Star midfielder injured"
            }
        ]
    }
```

---

## Part 7: Recommended Project Structure

```
game_intelligence/
├── __init__.py
├── config.py                 # API keys, database URLs
├── models/
│   ├── __init__.py
│   ├── player_stats.py
│   ├── historical_match.py
│   ├── team_rating.py
│   └── match_prediction.py
├── scrapers/
│   ├── __init__.py
│   ├── fbref_scraper.py
│   ├── transfermarkt_scraper.py
│   ├── odds_api.py
│   └── elo_scraper.py
├── signals/
│   ├── __init__.py
│   ├── market_signal.py
│   ├── player_signal.py
│   ├── historical_signal.py
│   └── form_signal.py
├── predictor/
│   ├── __init__.py
│   ├── match_predictor.py
│   ├── bracket_generator.py
│   └── tournament_simulator.py
├── api/
│   ├── __init__.py
│   └── routes.py
├── scripts/
│   ├── backtest.py
│   ├── daily_update.py
│   └── seed_historical.py
└── notebooks/
    ├── 01_eda_kalshi_data.ipynb
    ├── 02_player_data_exploration.ipynb
    ├── 03_model_calibration.ipynb
    └── 04_backtesting.ipynb
```

---

## Part 8: Quick Wins - Start Today

### Action 1: Basic Predictor with Kalshi Data (2-3 hours)

Create `game_intelligence/predictor/basic_predictor.py`:

```python
"""
Basic match predictor using only Kalshi World Cup winner odds.
This is your MVP - get this working first.
"""
import math
from sqlmodel import Session, select
from app.models.kalshi_team_ranking import KalshiTeamRanking

def get_latest_rankings(session: Session) -> dict:
    """Get most recent Kalshi rankings as dict."""
    stmt = select(KalshiTeamRanking).order_by(KalshiTeamRanking.as_of.desc())
    rankings = session.exec(stmt).all()

    # Dedupe to latest per team
    latest = {}
    for r in rankings:
        if r.team_name not in latest:
            latest[r.team_name] = r.avg_yes_bid_open / 100  # Convert cents to prob

    return latest

def predict_match(team_a: str, team_b: str, rankings: dict, k: float = 0.7) -> dict:
    """
    Predict match outcome based on World Cup winner odds.

    Args:
        team_a: Name of team A
        team_b: Name of team B
        rankings: Dict of team_name -> WC winner probability
        k: Calibration factor (tune based on backtesting)

    Returns:
        Dict with probabilities and recommendation
    """
    p_a = rankings.get(team_a, 0.01)  # Default 1% for unlisted teams
    p_b = rankings.get(team_b, 0.01)

    # Log-odds ratio
    log_ratio = math.log(max(p_a, 0.001) / max(p_b, 0.001))

    # Logistic transformation
    raw_p_a = 1 / (1 + math.exp(-k * log_ratio))

    # Draw probability (decreases as mismatch increases)
    competitiveness = 1 - abs(raw_p_a - 0.5) * 2
    p_draw = 0.26 * competitiveness

    # Final probabilities
    remaining = 1 - p_draw
    p_a_win = raw_p_a * remaining
    p_b_win = (1 - raw_p_a) * remaining

    # Recommendation
    probs = {'team_a': p_a_win, 'draw': p_draw, 'team_b': p_b_win}
    recommended = max(probs, key=probs.get)
    confidence = max(probs.values())

    return {
        'team_a': team_a,
        'team_b': team_b,
        'probabilities': {
            'team_a_win': round(p_a_win, 3),
            'draw': round(p_draw, 3),
            'team_b_win': round(p_b_win, 3)
        },
        'recommended': recommended,
        'confidence': round(confidence, 3),
        'inputs': {
            'team_a_wc_prob': round(p_a, 3),
            'team_b_wc_prob': round(p_b, 3)
        }
    }
```

### Action 2: Generate Full Bracket Guide (1-2 hours)

```python
# game_intelligence/predictor/bracket_generator.py

def generate_guide_bracket(matches: list, session: Session) -> list:
    """
    Generate AI recommendations for all matches.

    Args:
        matches: List of match dicts with team_a, team_b, match_id
        session: Database session

    Returns:
        List of predictions for each match
    """
    rankings = get_latest_rankings(session)

    predictions = []
    for match in matches:
        pred = predict_match(
            match['team_a'],
            match['team_b'],
            rankings
        )
        pred['match_id'] = match['match_id']
        pred['group'] = match.get('group')
        pred['stage'] = match.get('stage', 'group')
        predictions.append(pred)

    return predictions
```

### Action 3: Sign Up for Data APIs (30 minutes)

1. **The Odds API**: https://the-odds-api.com/ (Free: 500 requests/month)
2. **Football-Data.org**: https://www.football-data.org/ (Free tier available)
3. **API-Football**: https://rapidapi.com/api-sports/api/api-football/ (Free tier: 100/day)

---

## Summary: Recommended Priority Order

| Priority | Task | Data Source | Complexity | Value |
|----------|------|-------------|------------|-------|
| 1 | Basic predictor with Kalshi | Already have | Low | High |
| 2 | Add more prediction markets | Odds API | Low | High |
| 3 | Historical match data | Football-Data.org | Medium | Medium |
| 4 | Player statistics | FBref scraping | High | High |
| 5 | Elo ratings integration | eloratings.net | Low | Medium |
| 6 | Injury tracking | Transfermarkt | Medium | High |
| 7 | Backtesting framework | Your data | High | Critical |
| 8 | Tournament simulation | Your model | Medium | High |

---

## Next Steps

1. **Today**: Create basic predictor using existing Kalshi data
2. **This Week**: Sign up for Odds API, start collecting additional market data
3. **Next Week**: Build FBref scraper for player stats
4. **Week 3**: Import historical World Cup data for backtesting
5. **Month 1**: Full model with all signals integrated
6. **Month 2**: Frontend guide bracket feature live

The key insight is that you already have the most valuable data (prediction market odds). Start with that, prove the concept works, then layer in additional signals to improve accuracy.
