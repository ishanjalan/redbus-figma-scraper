# RedBus Figma Plugin - Internal API Specification

This document specifies the API requirements for the Figma plugin to fetch live bus search data directly from RedBus internal services.

## Overview

The Figma plugin needs an internal API endpoint that returns bus search results in a structured JSON format. This eliminates the need for web scraping and provides reliable, complete data including fields not available through analytics (duration, departure/arrival times, amenities, etc.).

## API Endpoint

### Bus Search

**Endpoint:** `POST /api/v1/figma/bus-search`

**Description:** Returns bus listings for a given route and date, formatted for the Figma plugin.

### Request

```json
{
  "fromCityId": 122,
  "toCityId": 71756,
  "fromCityName": "Bangalore",
  "toCityName": "Tirupati",
  "journeyDate": "2026-01-23",
  "maxResults": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fromCityId | number | Yes | Source city ID |
| toCityId | number | Yes | Destination city ID |
| fromCityName | string | No | Source city name (for display) |
| toCityName | string | No | Destination city name (for display) |
| journeyDate | string | Yes | Journey date in `YYYY-MM-DD` format |
| maxResults | number | No | Maximum results to return (default: 10, max: 50) |

### Response

```json
{
  "success": true,
  "meta": {
    "fromCity": "Bangalore",
    "toCity": "Tirupati",
    "journeyDate": "2026-01-23",
    "totalResults": 45,
    "returnedResults": 10
  },
  "buses": [
    {
      "id": "bus_123456",
      "operator": "FRESHBUS",
      "busType": "A/C Sleeper (2+1)",
      "departureTime": "22:30",
      "arrivalTime": "05:45",
      "duration": "7h 15m",
      "durationMinutes": 435,
      "price": 850,
      "priceFormatted": "₹850",
      "rating": "4.5",
      "totalRatings": 2340,
      "seatsAvailable": 23,
      "route": "Bangalore to Tirupati",
      "boardingPoints": ["Majestic", "Silk Board", "Electronic City"],
      "droppingPoints": ["Tirupati Bus Stand", "Railway Station"],
      "amenities": ["WiFi", "Charging Point", "Water Bottle", "Blanket"],
      "isPrimarySeller": true,
      "cancellationPolicy": "Free cancellation until 6 hours before departure"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique bus identifier |
| operator | string | Bus operator name |
| busType | string | Bus type description (e.g., "A/C Sleeper (2+1)") |
| departureTime | string | Departure time in HH:MM format |
| arrivalTime | string | Arrival time in HH:MM format |
| duration | string | Human-readable duration (e.g., "7h 15m") |
| durationMinutes | number | Duration in minutes (for sorting) |
| price | number | Base price in INR |
| priceFormatted | string | Formatted price with currency symbol |
| rating | string | Average rating (1-5 scale) |
| totalRatings | number | Total number of ratings |
| seatsAvailable | number | Available seats count |
| route | string | Route description |
| boardingPoints | string[] | List of boarding point names |
| droppingPoints | string[] | List of dropping point names |
| amenities | string[] | List of amenities |
| isPrimarySeller | boolean | Whether RedBus is the primary seller |
| cancellationPolicy | string | Cancellation policy text |

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DATE",
    "message": "Journey date must be in the future"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_DATE | 400 | Journey date is invalid or in the past |
| INVALID_CITY | 400 | City ID not found |
| NO_RESULTS | 200 | No buses found for the route (success: true, buses: []) |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Authentication

The plugin will need to authenticate with the internal API. Recommended options:

### Option A: API Key (Simple)

Include API key in request header:
```
X-Figma-Plugin-Key: <api_key>
```

### Option B: OAuth2 / SSO (Secure)

Use RedBus SSO for designer authentication:
1. Plugin redirects to SSO login
2. Returns with auth token
3. Token included in requests

## CORS Requirements

The API must allow requests from Figma plugin origins:
- `https://www.figma.com`
- `https://figma.com`

Required headers:
```
Access-Control-Allow-Origin: https://www.figma.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Figma-Plugin-Key
```

## Rate Limiting

Suggested limits for the Figma plugin use case:
- **100 requests/hour per API key**
- **10 requests/minute burst limit**

This is sufficient for a UX design team's typical usage patterns.

## Implementation Notes

### For Engineering Team

1. **Data Source:** Connect to the existing bus search service/database
2. **Filtering:** Apply same business logic as the website (exclude cancelled, sold out, etc.)
3. **Sorting:** Return results sorted by popularity/relevance (same as website default)
4. **Caching:** Consider 5-minute cache for identical queries
5. **Logging:** Log requests for usage analytics (no PII)

### Security Considerations

- API should be internal-only (VPN/internal network) OR protected by API key
- No customer PII in responses
- Audit logging for compliance

## Example Usage

### From Figma Plugin

```typescript
const response = await fetch('https://api-internal.redbus.in/api/v1/figma/bus-search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Figma-Plugin-Key': 'figma_plugin_xxxx'
  },
  body: JSON.stringify({
    fromCityId: 122,
    toCityId: 71756,
    journeyDate: '2026-01-23',
    maxResults: 10
  })
});

const data = await response.json();
// data.buses contains array of bus listings
```

## Timeline

| Phase | Deliverable | Owner |
|-------|-------------|-------|
| Week 1 | API endpoint implementation | Backend Team |
| Week 1 | API key provisioning | Platform Team |
| Week 2 | Plugin integration | UX Tooling |
| Week 2 | Testing & deployment | All |

## Contact

For questions about this specification:
- **Plugin Development:** [UX Tooling Team]
- **API Implementation:** [Backend Team]
