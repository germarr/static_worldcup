# Data Science Plan: Smart Guide Bracket

## 1. Objective
Create a "Smart Guide" feature that helps users fill out their World Cup bracket by providing probabilistic recommendations for every match. This system will evolve from a simple market-implied heuristic to a robust predictive model.

## 2. Methodology & Algorithms

### Phase 1: The "Market Implied" Baseline (Immediate Start)
Since you already have `KalshiTeamChance` (Tournament Winner odds), we can derive a baseline "Power Ranking" to predict match outcomes.

*   **Hypothesis:** The market probability of winning the entire tournament is a proxy for overall team strength.
*   **Formula (Naive Match Prediction):**
    For a match between Team A and Team B:
    $$ P(A_{win}) \approx \frac{P(A_{cup})}{P(A_{cup}) + P(B_{cup})} $$
*   **Logic:** If Brazil has a 20% chance to win the Cup and Serbia has a 1% chance, the relative strength heavily favors Brazil.
*   **Action:** Create a `TeamPowerRanking` service that normalizes the latest Kalshi "yes_bid" prices into a 0-100 strength score.

### Phase 2: Match-Specific Market Integration
Tournament winner odds don't capture specific matchup dynamics (e.g., style of play, injuries, "bogey teams").
*   **Data Requirement:** Ingest **Match Result** markets (Home/Draw/Away or "Moneyline").
*   **Implementation:**
    *   Query Kalshi (or other exchanges like Betfair/Polymarket) for specific match events (e.g., "USA vs Italy").
    *   Store these in a new table `MatchOdds`.
    *   Use these direct probabilities when available, falling back to Phase 1 logic for hypothetical future rounds (e.g., "If USA plays Brazil in the Semis...").

### Phase 3: Player-Level Granularity (The "Data Science" Layer)
To add "player data" as requested, we need to calculate a **Dynamic Team Strength** that changes if a star player is injured or out of form.

*   **Data Sources:**
    1.  **Rosters:** `FBref` or `API-Football` to get current squad lists.
    2.  **Player Value/Rating:** `Transfermarkt` (market value) or `WhoScored` (match ratings).
*   **Feature Engineering:**
    *   **Squad Value:** Sum of market values of the top 15 players.
    *   **Experience:** Average international caps per player.
    *   **Form:** Average player rating over the last 5 club games.
*   **The Model:**
    Use a Poisson Distribution model (common in soccer betting) where:
    *   $\lambda_{goals\_scored} = f(AttackStrength, OpponentDefenseStrength)$
    *   Adjust $AttackStrength$ based on the player metrics above.

## 3. Data Acquisition Strategy

### A. Prediction Markets (Existing + Expansion)
*   **Current:** `KalshiTeamChance` (Futures).
*   **New Needed:**
    *   `MatchWinner`: Probabilities for individual group stage games.
    *   `GroupWinner`: Probability to top the group (helps tie-breaking logic).

### B. Football Data APIs (Recommended)
1.  **API-Football (RapidAPI):** Excellent for rosters, fixtures, and basic player stats.
    *   *Cost:* Freemium.
2.  **FBref (via `soccerdata` python lib):** Great for advanced stats (xG, xA).
    *   *Note:* Strictly for analysis/caching, be careful with rate limits.
3.  **Open Source:**
    *   `statsbombpy`: Free data for past tournaments to train your model.

## 4. Technical Architecture Plan

### Database Schema Updates (`fastapi_server/app/models/`)
1.  **`MatchPrediction`**: Store the generated probabilities for every possible matchup.
    ```python
    class MatchPrediction(SQLModel, table=True):
        team_a_id: int
        team_b_id: int
        prob_a_win: float
        prob_draw: float  # Relevant for group stage
        prob_b_win: float
        method: str       # "market_implied", "poisson_model", etc.
        generated_at: datetime
    ```
2.  **`PlayerStats`**: (Optional for Phase 3)
    ```python
    class PlayerStats(SQLModel, table=True):
        player_name: str
        team_id: int
        position: str
        rating: float
        is_injured: bool
    ```

### New Services (`fastapi_server/app/services/`)
*   `OddsNormalizer`: Converts raw cents/prices into true probabilities (removing the "vig" or overround).
*   `BracketSimulator`: Runs Monte Carlo simulations (e.g., 10,000 runs) using the probabilities to tell the user "Most likely outcome: Argentina beats France in Final".

## 5. Next Steps for Implementation

1.  **Script:** Write a script to compute "Relative Strength" from your existing `KalshiTeamChance` data.
2.  **API Endpoint:** Create `/api/predictions/match?team_a=X&team_b=Y` that returns the calculated win probability.
3.  **UI:** Add a "Smart Pick" button on the bracket card that fetches this probability and highlights the recommended winner.
