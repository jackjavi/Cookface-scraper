### Puppeteer adblocker

[PUPPETEER STEALTH AD BLOCKER](https://stackoverflow.com/questions/75264181/how-to-fix-the-issue-puppeteer-use-isnt-a-function)

### WSEndpoint_url

// OPTION 1 - Launch new.
// const browser = await puppeteer.launch({
// headless: false, // Puppeteer is 'headless' by default.
// });

// OPTION 2 - Connect to existing.
// MAC: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')
// PC: start chrome.exe –remote-debugging-port=9222
// Note: this url changes each time the command is run.

### Chromium-start

```bash
chromium-browser --remote-debugging-port=9222 --start-maximized
```

### Microsoft Edge

#### Windows on Git bash

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --remote-debugging-port=9333 --disable-web-security --user-data-dir="C:\temp\edge-debug"
```

```bash
microsoft-edge-stable --remote-debugging-port=9222 --start-maximized
```

### Browser Url to access the endpoint url

```bash
http://127.0.0.1:9222/json/version
```

### FFMPEG SETUP (WINDOWS, MAC, LINUX)

Docs - [FFMPEG](https://www.npmjs.com/package/fluent-ffmpeg)

### Run

```bash
npm run all
```

### Usage Examples with Proxies

```bash
# Production usage (after compiling)
npm run proxy-stats              # View proxy statistics
npm run proxy-fetch              # Get fresh proxies now
npm run proxy-clean              # Remove failed proxies
npm run proxy-all                # Full workflow: clean, compile, fetch, stats, start

# Development usage (direct TypeScript execution)
npm run dev-proxy-fetch          # Fetch during development
npm run dev-proxy-stats          # Quick stats check

# Your existing workflows still work
npm run all                      # Your existing full workflow
npm run start                    # Start with auto proxy management
```

### Daily Usage

```bash
npm run proxy-all    # Handles everything: compile, fetch proxies, start app
```

### Development

```bash
npm run dev-proxy-fetch    # Quick proxy refresh during development
npm run compile            # Compile when ready
npm run start             # Start with fresh proxies
```

### Monitoring

```bash
npm run proxy-stats       # Check proxy health anytime
npm run proxy-list-working # See which proxies are working
```

### FETCH

```bash
# This will now clear old proxies and fetch completely fresh ones
npm run proxy-fetch

# Or use the new method specifically designed for fresh proxies
# (You'd need to add this to your CLI if you want it as a separate command)
```
