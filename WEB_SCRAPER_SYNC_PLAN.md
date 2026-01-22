# Web Scraper Sync - Figma Plugin Implementation Plan

## Overview

A Figma plugin that scrapes live website data using CSS selectors and populates Figma designs with real-time content. Similar to Google Sheets Sync, but pulls from websites instead of spreadsheets.

**Two Components:**
1. **Figma Plugin** - UI + sandbox code that updates layers
2. **Vercel Backend** - Serverless API running Puppeteer for JS-rendered scraping

---

## Layer Naming Convention

Inspired by Google Sheets Sync's `#ColumnName` pattern, adapted for CSS selectors:

```
[Description] @{css-selector} [.modifier]
```

### Examples

| Layer Name | What It Scrapes |
|------------|-----------------|
| `Product Title @{h1.product-name}` | First h1 with class "product-name" |
| `@{.price}` | First element with class "price" |
| `Hero Image @{img.hero}` | Image src from img.hero |
| `@{#main-heading}` | Element with id "main-heading" |
| `@{article.card h2}` | h2 inside article.card |

### Modifiers

| Modifier | Purpose |
|----------|---------|
| `.text` | Extract textContent (default for text layers) |
| `.src` | Extract src attribute (default for images) |
| `.href` | Extract href attribute |
| `.attr(name)` | Extract any attribute |
| `.all` | Match all elements (for auto-repeat lists) |

### Nested Data (Context Selectors)

```
Card Container @{.product-card}.all // context
├── Title @{h2}          # Becomes: .product-card h2
├── Price @{.price}      # Becomes: .product-card .price
└── Image @{img}         # Becomes: .product-card img
```

---

## Project Structure

### Figma Plugin

```
figma-plugin/
├── manifest.json              # Plugin config + networkAccess
├── package.json
├── tsconfig.json
├── src/
│   ├── code.ts                # Sandbox - manipulates Figma layers
│   ├── ui.tsx                 # React UI
│   ├── ui.html
│   ├── types/
│   │   └── messages.ts        # postMessage type definitions
│   ├── utils/
│   │   ├── layer-parser.ts    # Parse @{selector} from layer names
│   │   ├── layer-finder.ts    # Traverse document tree
│   │   └── image-handler.ts   # Fetch images as Uint8Array
│   └── services/
│       ├── api-client.ts      # Fetch wrapper for Vercel API
│       └── message-bridge.ts  # UI <-> Code communication
└── dist/
```

### Vercel Backend

```
vercel-backend/
├── package.json               # puppeteer-core, @sparticuz/chromium
├── vercel.json                # CORS headers, function config
├── tsconfig.json
├── api/
│   ├── scrape.ts              # Main scraping endpoint
│   └── health.ts              # Health check
└── lib/
    ├── browser.ts             # Puppeteer initialization
    ├── scraper.ts             # Core scraping logic
    └── selector-extractor.ts  # Extract data via CSS selectors
```

---

## API Contract

### POST `/api/scrape`

**Request:**
```json
{
  "url": "https://example.com/product/123",
  "selectors": [
    { "id": "layer_1", "selector": "h1.product-name", "type": "text" },
    { "id": "layer_2", "selector": ".price", "type": "text" },
    { "id": "layer_3", "selector": "img.hero", "type": "image" }
  ],
  "options": {
    "waitForJs": true,
    "timeout": 15000
  }
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://example.com/product/123",
  "results": [
    { "id": "layer_1", "found": true, "data": "Amazing Product", "type": "text" },
    { "id": "layer_2", "found": true, "data": "$29.99", "type": "text" },
    { "id": "layer_3", "found": true, "data": "https://example.com/hero.jpg", "type": "image" }
  ],
  "errors": []
}
```

**CORS Headers Required:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## Plugin UI

```
┌─────────────────────────────────────────────┐
│  Web Scraper Sync                      [X]  │
├─────────────────────────────────────────────┤
│  Website URL                                │
│  ┌───────────────────────────────────────┐  │
│  │ https://example.com/products          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Sync Scope                                 │
│  [Document] [Page] [Selection]              │
│                                             │
│  Detected Layers (4 found)                  │
│  ┌───────────────────────────────────────┐  │
│  │ ✓ Product Title    @{h1.title}        │  │
│  │ ✓ Price            @{.price}          │  │
│  │ ✓ Hero Image       @{img.hero}        │  │
│  │ ✓ Cards            @{.card}.all       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ☑ Wait for JavaScript                      │
│  ☑ Include images                           │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │           🔄 Sync Content              │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Key Implementation Details

### 1. Figma Plugin Manifest (`manifest.json`)

```json
{
  "name": "Web Scraper Sync",
  "id": "web-scraper-sync",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "networkAccess": {
    "allowedDomains": ["your-vercel-app.vercel.app"],
    "reasoning": "Required to communicate with scraping backend"
  }
}
```

### 2. Vercel Puppeteer Setup

Use `@sparticuz/chromium` for serverless compatibility:

```json
// vercel.json
{
  "functions": {
    "api/scrape.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

### 3. Layer Update Flow

1. UI scans Figma layers for `@{selector}` patterns
2. UI sends selectors to Vercel API
3. API scrapes website with Puppeteer, returns data
4. UI sends results to Code sandbox via postMessage
5. Code updates text layers directly, requests UI to fetch images as bytes
6. Code applies image bytes as fills using `figma.createImage()`

### 4. Image Handling

Images require special handling because:
- Code sandbox can't make network requests
- UI can fetch images but can't access Figma API

**Solution:** UI fetches image → converts to Uint8Array → sends to Code → Code creates image fill

---

## Error Handling

| Error | User Message |
|-------|--------------|
| Invalid URL | "Please enter a valid URL" |
| Timeout | "Website took too long to load" |
| Selector not found | "Could not find element matching '{selector}'" |
| Website blocked | "This website blocks automated access" |
| Image fetch failed | "Could not load image" |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Set up Figma plugin boilerplate with TypeScript + webpack
- [ ] Set up Vercel project with Puppeteer
- [ ] Implement basic `/api/scrape` endpoint (single selector, text only)
- [ ] Implement basic plugin UI (URL input, sync button)
- [ ] Establish postMessage communication

### Phase 2: Core Features
- [ ] Implement layer name parser for `@{selector}` syntax
- [ ] Implement layer traversal with scope options (document/page/selection)
- [ ] Add multiple selector support to API
- [ ] Add detected layers preview in UI
- [ ] Implement text layer updates

### Phase 3: Images & Polish
- [ ] Implement image extraction in API
- [ ] Implement image-to-fill updates in plugin
- [ ] Add modifiers (`.text`, `.src`, `.attr()`, etc.)
- [ ] Add comprehensive error handling
- [ ] Add retry logic for failed items

### Phase 4: Advanced Features
- [ ] Implement context selectors for nested data
- [ ] Implement auto-repeat for lists (`.all` modifier)
- [ ] Add advanced options (custom headers, wait conditions)
- [ ] Polish UI/UX

---

## Verification Plan

1. **Unit tests** for layer parser and selector extraction
2. **Integration test** with sample websites:
   - Static HTML site
   - React SPA (e.g., a demo React app)
   - E-commerce product page
3. **Manual testing** in Figma:
   - Create test frame with various `@{selector}` layer names
   - Run sync against test website
   - Verify text and images update correctly
4. **Edge case testing**:
   - Invalid selectors
   - Missing elements
   - Very long content
   - Large images

---

## Key Files to Create

| File | Purpose |
|------|---------|
| `figma-plugin/manifest.json` | Plugin config with networkAccess |
| `figma-plugin/src/code.ts` | Sandbox code - layer updates |
| `figma-plugin/src/ui.tsx` | React UI |
| `figma-plugin/src/utils/layer-parser.ts` | Parse `@{selector}` syntax |
| `vercel-backend/api/scrape.ts` | Main scraping endpoint |
| `vercel-backend/lib/browser.ts` | Puppeteer initialization |

---

## Limitations (v1)

- No authentication support (can't scrape login-protected pages)
- Some websites may block headless browsers
- Rate limiting on API to prevent abuse
- Maximum ~30 selectors per request

---

## Resources

- [Figma Plugin API Docs](https://developers.figma.com/docs/plugins/)
- [Figma Network Requests](https://developers.figma.com/docs/plugins/making-network-requests/)
- [Google Sheets Sync Docs](https://docs.sheetssync.app/) - reference for naming conventions
- [@sparticuz/chromium](https://github.com/Sparticuz/chromium) - Puppeteer for serverless
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
