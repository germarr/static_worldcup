"""
Polymarket API Interaction Guide:
1. Access: This script uses the Gamma API (gamma-api.polymarket.com), which is the public read-layer.
2. Authentication: No account, wallet, or API key is required for read-only market discovery.
3. Process: It fetches 'Events' (groups of related markets) using HTTP GET.
4. Filtering: It uses query parameters and client-side keyword matching to find World Cup data.
"""
import requests
import json

def fetch_polymarket_events(
    query: str = None,
    closed: bool = False,
    limit: int = 20,
    offset: int = 0,
    order: str = "volume",
    ascending: bool = False
):
    """
    Fetches events from the Polymarket Gamma API with modular filtering.
    
    Parameters:
    - query (str): Search term for the 'q' parameter (e.g., "World Cup").
    - closed (bool): If True, fetches closed/resolved events. Default False (active only).
    - limit (int): Number of events to return (default 20, max usually 100).
    - offset (int): Pagination offset (default 0).
    - order (str): Field to sort by. Common values: 'volume', 'createdAt', 'startDate', 'liquidity'.
    - ascending (bool): Sort direction. False for Descending (default), True for Ascending.
    """
    base_url = "https://gamma-api.polymarket.com/events"
    
    # Construct query parameters
    params = {
        "closed": str(closed).lower(),
        "limit": limit,
        "offset": offset,
        "order": order,
        "ascending": str(ascending).lower()
    }
    
    if query:
        params["q"] = query

    print(f"Fetching data from: {base_url} with params {params}")
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        events = response.json()
        
        print(f"Successfully fetched {len(events)} events.\n")
        
        # Display results
        if events:
            print(f"Top 3 events found (Sorted by {order}):")
            for ev in events[:3]:
                 print(f"- {ev.get('title')} (Volume: ${ev.get('volume', 'N/A')})")
        else:
            print("No events found matching the criteria.")

        return events

    except Exception as e:
        print(f"Error: {e}")
        return []

if __name__ == "__main__":
    # Example usage: Find top 5 active World Cup events sorted by volume
    fetch_polymarket_events(query="World Cup", limit=5, order="volume")
