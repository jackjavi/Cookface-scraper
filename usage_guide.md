# Enhanced Proxy System Usage Guide

## Quick Setup & Usage

### 1. First Time Setup
```bash
# 1. Fetch and test proxies (creates success file)
npm run proxy-fetch-test

# 2. Check status
npm run proxy-stats

# 3. View your working proxies
npm run proxy-list-working
```

### 2. Using Working Proxies in Your Code

```typescript
import {
  getNewWorkingYTSPage,      // Uses random working proxy
  getFastestYTSPage,         // Uses fastest working proxy  
  getMultipleWorkingYTSPages, // Multiple working proxy pages
  createWorkingProxyBrowser,  // Working proxy browser
  createFastestProxyBrowser,  // Fastest proxy browser
  getWorkingProxyCount,      // Count of working proxies
  getWorkingProxies,         // Array of working proxy details
} from './utils/browserManager';

// Example: Use fastest working proxy
const {page, browser, proxy} = await getFastestYTSPage();
await page.goto('https://www.youtube.com/');

// Example: Check proxy health before operations
const workingCount = await getWorkingProxyCount();
if (workingCount === 0) {
  console.log('No working proxies! Run: npm run proxy-fetch-test');
  return;
}
```

## File Structure

```
storage/proxies/
├── proxyList.json        # Main file (untested/failed proxies for testing)
├── proxyListSuccess.json # Success file (validated working proxies)
└── *_backup*.json        # Automatic backups
```

## Key Features

### Enhanced Success Detection
- **CAPTCHA Detection**: Automatically detects and rejects proxies that trigger captchas
- **Content Validation**: Verifies actual page elements load (not just HTTP 200)
- **Real IP Verification**: Optional check to confirm proxy is working
- **Response Time Tracking**: Measures and tracks proxy performance

### Smart Proxy Management
- **Working proxies** automatically moved to success file
- **Failed proxies** completely removed from system
- **Performance sorting** (fastest proxies first)
- **Automatic fallbacks** when working proxies unavailable

### New Browser Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| `getNewWorkingYTSPage()` | Random working proxy page | General scraping |
| `getFastestYTSPage()` | Fastest proxy page | Performance-critical operations |
| `getMultipleWorkingYTSPages(n)` | Multiple working proxy pages | Parallel processing |
| `createWorkingProxyBrowser()` | Working proxy browser | Custom browser setup |
| `createFastestProxyBrowser()` | Fastest proxy browser | Speed-optimized operations |

## CLI Commands Reference

### Main Operations
```bash
npm run proxy-fetch-test    # Complete cycle (recommended)
npm run proxy-stats         # System health check
npm run proxy-list-working  # Show working proxies
```

### File Management
```bash
npm run proxy-clean        # Clean and organize files
npm run proxy-merge        # Merge success back to main for re-testing
npm run proxy-backup       # Create comprehensive backup
```

### Monitoring
```bash
npm run proxy-success      # Quick view of success file
npm run proxy-main         # View main testing file  
npm run proxy-list         # List all proxies
```

## Common Workflows

### Daily Scraping Operations
```bash
# 1. Check proxy health
npm run proxy-stats

# 2. If working proxies < 10, refresh
npm run proxy-fetch-test

# 3. Use in your code
# Uses fastest working proxies automatically
```

### Weekly Maintenance
```bash
# 1. Clean system
npm run proxy-clean

# 2. Get fresh proxies
npm run proxy-fetch-test

# 3. Backup working proxies
npm run proxy-backup
```

### Troubleshooting No Working Proxies
```bash
# 1. Check current status
npm run proxy-stats

# 2. If no working proxies
npm run proxy-fetch-test

# 3. If still failing, try smaller batch
npm run proxy-fetch-only
npm run proxy-test-only
```

## Code Examples

### Basic Usage
```typescript
// Simple working proxy usage
const {page, browser, proxy} = await getNewWorkingYTSPage();
await page.goto('https://www.youtube.com/');

// Always clean up
await closeProxyBrowser(browser, proxy);
```

### Performance Optimized
```typescript
// Use fastest proxy for time-sensitive operations
const {page, browser, proxy} = await getFastestYTSPage();
console.log(`Using fastest proxy: ${proxy}`);

const startTime = Date.now();
await page.goto('https://www.youtube.com/');
console.log(`Page loaded in ${Date.now() - startTime}ms`);
```

### Parallel Processing
```typescript
// Multiple working proxies for parallel operations
const pages = await getMultipleWorkingYTSPages(3);

const results = await Promise.all(
  pages.map(async ({page, browser, proxy}) => {
    try {
      await page.goto('https://www.youtube.com/');
      return {success: true, proxy};
    } catch (error) {
      return {success: false, proxy, error};
    }
  })
);

// Clean up all browsers
await closeAllProxyBrowsers();
```

### Error Handling with Fallbacks
```typescript
let pageData;

try {
  // Try working proxy first
  pageData = await getNewWorkingYTSPage();
  console.log('Using validated working proxy');
} catch (error) {
  // Fallback to any available proxy
  pageData = await getNewYTSPage();
  console.log('Using fallback proxy (untested)');
}

// Your scraping logic here
await page.goto('https://www.youtube.com/');
```

## Environment Variables
```bash
# Required in your .env file
PROXY_LIST=storage/proxies/proxyList.json
PROXY_LIST_SUCCESS=storage/proxies/proxyListSuccess.json
```

## Performance Tips

1. **Use working proxies**: Always prefer `getNewWorkingYTSPage()` over `getNewYTSPage()`
2. **Monitor proxy health**: Run `npm run proxy-stats` regularly
3. **Refresh proxies**: Run `npm run proxy-fetch-test` when success rate drops
4. **Use fastest for critical ops**: Use `getFastestYTSPage()` for time-sensitive operations
5. **Clean regularly**: Run `npm run proxy-clean` to maintain system health

## Success Metrics

The system tracks detailed metrics for each proxy:
- Response time
- Success/failure status  
- CAPTCHA detection
- Real IP information
- Last tested timestamp
- Country/location data

All working proxies are sorted by performance (fastest first) for optimal scraping efficiency.