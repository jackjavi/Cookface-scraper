import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import config from '../../config/index';
import {createProxyBrowser} from '../../utils/browserManager';
import sleep from "../../utils/sleep";

interface ProxyData {
  proxyUrl: string;
  lastTested?: string;
  isWorking?: boolean;
  responseTime?: number;
  protocol?: string;
  anonymity?: string;
  country?: string;
  score?: number;
  source?: string;
  successDetails?: {
    canLoadGoogle?: boolean;
    canLoadHttps?: boolean;
    canLoadYouTube?: boolean;
    realIP?: string;
    captchaDetected?: boolean;
    htmlSnippet?: string;
  };
}

interface ProxyManagerConfig {
  fetchInterval: number;
  testInterval: number;
  maxProxies: number;
  minWorkingProxies: number;
  proxyFilePath: string;
  proxySuccessFilePath: string;
  backupFilePath: string;
  testTimeout: number;
  testConcurrency: number;
}

interface ProxySource {
  name: string;
  url: string;
  type: 'json' | 'txt';
  protocols?: string[];
  parser: (data: any, source: string) => ProxyData[];
}

export class EnhancedProxyManager {
  private config: ProxyManagerConfig;
  private fetchTimer?: NodeJS.Timeout;
  private testTimer?: NodeJS.Timeout;
  private isRunning = false;
  private proxyBrowser: any = null;
  private currentPage: any = null;

  // Comprehensive proxy sources - SOCKS only, no HTTP
  private proxySources: ProxySource[] = [
    // Proxifly sources (JSON format) - SOCKS only
    /** {
      name: 'Proxifly SOCKS5 JSON',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.json',
      type: 'json',
      protocols: ['socks5'],
      parser: this.parseProxiflyJson.bind(this),
    },*/
    {
      name: 'Proxifly SOCKS4 JSON',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks4/data.json',
      type: 'json',
      protocols: ['socks4'],
      parser: this.parseProxiflyJson.bind(this),
    },
    // Proxifly TXT sources
    /** {
      name: 'Proxifly SOCKS5 TXT',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseProxiflyTxt.bind(this),
    }, */
    /** {
      name: 'Proxifly SOCKS4 TXT',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks4/data.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseProxiflyTxt.bind(this),
    }, */
    // TheSpeedX sources
    /** {
      name: 'TheSpeedX SOCKS5',
      url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    }, */
    /** {
      name: 'TheSpeedX SOCKS4',
      url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseSimpleTxt.bind(this),
    }, */
    // HookZof sources
    /** {
      name: 'HookZof SOCKS5',
      url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    }, */
    // Monosans sources
    /** {
      name: 'Monosans SOCKS5',
      url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    }, */
    /** {
      name: 'Monosans SOCKS4',
      url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseSimpleTxt.bind(this),
    }, */
    // Additional SOCKS sources
    /** {
      name: 'ProxyList SOCKS5',
      url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseAdvancedTxt.bind(this),
    },
    {
      name: 'Free Proxy List SOCKS5',
      url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'Free Proxy List SOCKS4',
      url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'ProxySpace SOCKS5',
      url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'ProxySpace SOCKS4',
      url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'ALIILAPRO SOCKS5',
      url: 'https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'ALIILAPRO SOCKS4',
      url: 'https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/socks4.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseSimpleTxt.bind(this),
    },
    // Additional sources for maximum coverage
    {
      name: 'Official HTTP SOCKS5 List',
      url: 'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/socks5/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'Official HTTP SOCKS4 List',
      url: 'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/socks4/socks4.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'Proxy List SOCKS5',
      url: 'https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'Proxy List SOCKS4',
      url: 'https://raw.githubusercontent.com/prxchk/proxy-list/main/socks4.txt',
      type: 'txt',
      protocols: ['socks4'],
      parser: this.parseSimpleTxt.bind(this),
    }, */
  ];

  constructor(customConfig?: Partial<ProxyManagerConfig>) {
    this.config = {
      fetchInterval: 10 * 60 * 1000,
      testInterval: 30 * 60 * 1000,
      maxProxies: 999999, // Remove proxy limit - fetch all available
      minWorkingProxies: 20, // Increase minimum for better reliability
      proxyFilePath: config.proxyList || 'storage/proxies/proxyList.json',
      proxySuccessFilePath:
        config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json',
      backupFilePath: (
        config.proxyList || 'storage/proxies/proxyList.json'
      ).replace('.json', '_backup.json'),
      testTimeout: 30000,
      testConcurrency: 1,
      ...customConfig,
    };
  }

 /**
 * Simplified and more reliable proxy success detection
 */
private async detectProxySuccess(
  page: any,
  proxy: ProxyData,
): Promise<{
  isWorking: boolean;
  successDetails: ProxyData['successDetails'];
  responseTime: number;
}> {
  const startTime = Date.now();
  const successDetails: ProxyData['successDetails'] = {
    canLoadGoogle: false,
    canLoadHttps: false,
    canLoadYouTube: false,
    realIP: undefined,
    captchaDetected: false,
    htmlSnippet: undefined,
  };

  try {
    // Test 1: Try to load Google - simple success criteria
    console.log(`🔍 Testing Google access for ${proxy.proxyUrl}`);
    
    const response = await page.goto('https://www.google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Check if the page loaded successfully (got a response)
    if (!response || !response.ok()) {
      console.log(`❌ Google failed to load for ${proxy.proxyUrl} - No response or bad status`);
      return {
        isWorking: false,
        successDetails,
        responseTime: Date.now() - startTime,
      };
    }

    // If we got here, Google loaded successfully
    successDetails.canLoadGoogle = true;
    successDetails.canLoadHttps = true;
    
    console.log(`✅ Google loaded successfully for ${proxy.proxyUrl}`);

    // Test 2: Try to load YouTube - another major site test
    try {
      console.log(`🔍 Testing YouTube access for ${proxy.proxyUrl}`);
      
      const youtubeResponse = await page.goto('https://www.youtube.com', {
        waitUntil: 'domcontentloaded',
        timeout: 40000, // YouTube might take longer
      });

      await sleep(10000);

      // Wait a few seconds for YouTube to fully load
      await page.waitForTimeout(3000);

      if (youtubeResponse && youtubeResponse.ok()) {
        console.log(`✅ YouTube loaded successfully for ${proxy.proxyUrl}`);
        successDetails.canLoadYouTube = true;
      } else {
        console.log(`⚠️ YouTube failed to load for ${proxy.proxyUrl} - but continuing with other tests`);
        // Don't fail the entire test if YouTube fails - Google already passed
      }
    } catch (youtubeError) {
      console.log(`⚠️ YouTube test failed for ${proxy.proxyUrl}: ${(youtubeError as Error).message}`);
      // Don't fail the entire test if YouTube fails
    }

    // Test 3: Get the actual IP being used through the proxy
    try {
      console.log(`🔍 Checking real IP for ${proxy.proxyUrl}`);
      
      const ipResponse = await page.goto('https://httpbin.org/ip', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      if (ipResponse && ipResponse.ok()) {
        // Get the page content
        const htmlContent = await page.content();
        successDetails.htmlSnippet = htmlContent.substring(0, 500);

        // Try to extract IP from the JSON response
        const ipData = await page.evaluate(() => {
          const preElement = document.querySelector('pre');
          if (preElement) {
            try {
              const jsonData = JSON.parse(preElement.textContent || '{}');
              return jsonData;
            } catch {
              // If JSON parsing fails, try to extract IP with regex
              const text = preElement.textContent || '';
              const ipMatch = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
              return ipMatch ? { origin: ipMatch[0] } : null;
            }
          }
          return null;
        });

        if (ipData?.origin) {
          // Extract the proxy IP from the proxy URL for comparison
          const proxyIP = this.extractIPFromProxyURL(proxy.proxyUrl);
          successDetails.realIP = ipData.origin;
          
          console.log(`✅ Real IP detected: ${ipData.origin} for proxy ${proxy.proxyUrl} (proxy IP: ${proxyIP})`);
          
          // Optional: Verify that we're actually using the proxy
          // (The returned IP should be different from our real IP and ideally match proxy IP)
          if (proxyIP && ipData.origin === proxyIP) {
            console.log(`✅ IP verification successful - using proxy IP ${proxyIP}`);
          } else {
            console.log(`ℹ️ Using different IP ${ipData.origin} (proxy: ${proxyIP}) - proxy may be gateway/different exit`);
          }
        } else {
          console.log(`⚠️ Could not extract IP from httpbin response for ${proxy.proxyUrl}`);
        }
      } else {
        console.log(`⚠️ httpbin.org failed to load for ${proxy.proxyUrl}`);
      }
    } catch (ipError) {
      console.log(`⚠️ IP check failed for ${proxy.proxyUrl}: ${(ipError as Error).message}`);
      // Don't fail the entire test if IP check fails - Google test already passed
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ Proxy ${proxy.proxyUrl} passed tests (${responseTime}ms)`);

    return {
      isWorking: true,
      successDetails,
      responseTime,
    };

  } catch (error) {
    console.log(`❌ Proxy ${proxy.proxyUrl} failed: ${(error as Error).message}`);
    return {
      isWorking: false,
      successDetails,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Helper method to extract IP from proxy URL
 */
private extractIPFromProxyURL(proxyUrl: string): string | null {
  try {
    const url = new URL(proxyUrl);
    return url.hostname;
  } catch {
    // Try to extract IP from format like "socks5://1.2.3.4:1080"
    const match = proxyUrl.match(/(?:socks[45]?:\/\/)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    return match ? match[1] : null;
  }
}

  /**
   * Test all proxies with enhanced success detection
   */
  public async testAllProxiesSystematic(): Promise<void> {
    console.log(`Testing all proxies with enhanced success detection...`);

    try {
      let proxies = await this.loadExistingProxies();

      if (proxies.length === 0) {
        console.log('No proxies to test');
        return;
      }

      console.log(`Testing ${proxies.length} proxies one by one...`);

      await this.initializeBrowser();

      const workingProxies: ProxyData[] = [];
      const failedProxies: ProxyData[] = [];

      for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        const progress = `${i + 1}/${proxies.length}`;

        console.log(`[${progress}] Testing: ${proxy.proxyUrl}`);

        try {
          await this.createNewPage();

          const testResult = await this.detectProxySuccess(
            this.currentPage,
            proxy,
          );

          const testedProxy: ProxyData = {
            ...proxy,
            isWorking: testResult.isWorking,
            responseTime: testResult.responseTime,
            lastTested: new Date().toISOString(),
            successDetails: testResult.successDetails,
          };

          if (testResult.isWorking) {
            workingProxies.push(testedProxy);
            console.log(
              `✅ [${progress}] ${proxy.proxyUrl} - WORKING (${testResult.responseTime}ms)`,
            );
          } else {
            failedProxies.push(testedProxy);
            console.log(`❌ [${progress}] ${proxy.proxyUrl} - FAILED`);
          }

          await this.closePage();

          // Save progress every 10 proxies
          if ((i + 1) % 10 === 0) {
            await this.saveWorkingProxies(workingProxies);
            console.log(
              `Progress saved: ${workingProxies.length} working, ${failedProxies.length} failed`,
            );
          }

          // Small delay between tests
          await this.delay(2000);
        } catch (error) {
          console.log(
            `❌ [${progress}] ${proxy.proxyUrl} - ERROR: ${(error as Error).message}`,
          );
          failedProxies.push({
            ...proxy,
            isWorking: false,
            lastTested: new Date().toISOString(),
          });
          await this.closePage();
        }
      }

      await this.closeBrowser();

      // Save final results
      await this.saveWorkingProxies(workingProxies);
      await this.updateMainProxyList(workingProxies, failedProxies);

      console.log(`Testing complete:`);
      console.log(`✅ Working proxies: ${workingProxies.length}`);
      console.log(`❌ Failed proxies: ${failedProxies.length}`);
      console.log(
        `📊 Success rate: ${((workingProxies.length / proxies.length) * 100).toFixed(1)}%`,
      );

      if (workingProxies.length < this.config.minWorkingProxies) {
        console.warn(
          `⚠️ LOW WORKING PROXIES: Only ${workingProxies.length} working (minimum: ${this.config.minWorkingProxies})`,
        );
      }
    } catch (error) {
      console.error('Error during systematic testing:', error);
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Save working proxies to success file
   */
  private async saveWorkingProxies(workingProxies: ProxyData[]): Promise<void> {
    try {
      const dir = path.dirname(this.config.proxySuccessFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }

      // Sort by response time (fastest first)
      const sortedProxies = workingProxies.sort(
        (a, b) => (a.responseTime || 9999) - (b.responseTime || 9999),
      );

      fs.writeFileSync(
        this.config.proxySuccessFilePath,
        JSON.stringify(sortedProxies, null, 2),
      );

      console.log(
        `💾 Saved ${workingProxies.length} working proxies to ${this.config.proxySuccessFilePath}`,
      );
    } catch (error) {
      console.error('Error saving working proxies:', error);
      throw error;
    }
  }

  /**
   * Update main proxy list (remove working ones, keep failed for potential re-testing)
   */
  private async updateMainProxyList(
    workingProxies: ProxyData[],
    failedProxies: ProxyData[],
  ): Promise<void> {
    try {
      // Option 1: Keep only failed proxies in main list (for potential re-testing)
      fs.writeFileSync(
        this.config.proxyFilePath,
        JSON.stringify(failedProxies, null, 2),
      );

      console.log(
        `📝 Updated main proxy list: removed ${workingProxies.length} working proxies, kept ${failedProxies.length} failed proxies`,
      );
    } catch (error) {
      console.error('Error updating main proxy list:', error);
      throw error;
    }
  }

  /**
   * Load working proxies from success file
   */
  public async loadWorkingProxies(): Promise<ProxyData[]> {
    try {
      if (!fs.existsSync(this.config.proxySuccessFilePath)) {
        return [];
      }

      const data = fs.readFileSync(this.config.proxySuccessFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Error loading working proxies:', error);
      return [];
    }
  }

  /**
   * Get comprehensive proxy statistics including success file
   */
  public async getProxyStats(): Promise<any> {
    try {
      const mainProxies = await this.loadExistingProxies();
      const workingProxies = await this.loadWorkingProxies();

      const mainWorking = mainProxies.filter(p => p.isWorking === true);
      const mainFailed = mainProxies.filter(p => p.isWorking === false);
      const mainUntested = mainProxies.filter(p => p.isWorking === undefined);

      return {
        main: {
          total: mainProxies.length,
          working: mainWorking.length,
          failed: mainFailed.length,
          untested: mainUntested.length,
        },
        success: {
          total: workingProxies.length,
          averageResponseTime:
            workingProxies.length > 0
              ? workingProxies.reduce(
                  (sum, p) => sum + (p.responseTime || 0),
                  0,
                ) / workingProxies.length
              : 0,
        },
        combined: {
          totalWorking: mainWorking.length + workingProxies.length,
          totalProxies: mainProxies.length + workingProxies.length,
        },
        lastUpdated: {
          main: fs.existsSync(this.config.proxyFilePath)
            ? fs.statSync(this.config.proxyFilePath).mtime
            : null,
          success: fs.existsSync(this.config.proxySuccessFilePath)
            ? fs.statSync(this.config.proxySuccessFilePath).mtime
            : null,
        },
      };
    } catch (error) {
      console.error('Error getting proxy stats:', error);
      return null;
    }
  }

  // Browser management methods (keeping existing ones)
  private async initializeBrowser(): Promise<void> {
    try {
      if (!this.proxyBrowser) {
        console.log('Initializing browser for testing...');
        const browserResult = await createProxyBrowser();
        this.proxyBrowser = browserResult.browser;
        console.log('✅ Browser initialized');
      }
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  private async createNewPage(): Promise<void> {
    if (!this.proxyBrowser) {
      throw new Error('Browser not initialized');
    }

    if (this.currentPage) {
      await this.closePage();
    }

    this.currentPage = await this.proxyBrowser.newPage();
    await this.currentPage.setDefaultNavigationTimeout(this.config.testTimeout);
    await this.currentPage.setDefaultTimeout(this.config.testTimeout);
  }

  private async closePage(): Promise<void> {
    if (this.currentPage) {
      try {
        await this.currentPage.close();
      } catch (error) {
        // Ignore close errors
      }
      this.currentPage = null;
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.currentPage) {
      await this.closePage();
    }

    if (this.proxyBrowser) {
      try {
        await this.proxyBrowser.close();
        console.log('🔒 Browser closed');
      } catch (error) {
        // Ignore close errors
      }
      this.proxyBrowser = null;
    }
  }

  // Keep all existing parser methods and utility methods...
  public async fetchProxiesOnly(): Promise<void> {
    console.log('Fetching proxies from all sources (SOCKS only)...');

    try {
      await this.createBackup();
      const allProxies: ProxyData[] = [];
      let totalFetched = 0;
      let successfulSources = 0;

      for (const source of this.proxySources) {
        try {
          console.log(`📥 Fetching from ${source.name}...`);

          const response = await axios.get(source.url, {
            timeout: 30000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept:
                source.type === 'json' ? 'application/json' : 'text/plain',
            },
          });

          const proxies = source.parser(response.data, source.name);

          if (proxies.length > 0) {
            allProxies.push(...proxies);
            totalFetched += proxies.length;
            successfulSources++;
            console.log(`✅ ${source.name}: ${proxies.length} proxies`);
          } else {
            console.log(`⚠️ ${source.name}: No proxies found`);
          }

          await this.delay(1000);
        } catch (error) {
          console.error(`❌ ${source.name} failed:`, (error as Error).message);
          continue;
        }
      }

      if (allProxies.length === 0) {
        throw new Error('No proxies could be fetched from any source');
      }

      const uniqueProxies = this.removeDuplicates(allProxies);
      const limitedProxies = this.shuffleArray(uniqueProxies).slice(
        0,
        this.config.maxProxies,
      );

      await this.saveProxyList(limitedProxies);

      console.log(`✅ Fetch complete:`);
      console.log(
        `📊 Sources accessed: ${successfulSources}/${this.proxySources.length}`,
      );
      console.log(`📦 Total fetched: ${totalFetched}`);
      console.log(`🎯 Unique proxies: ${uniqueProxies.length}`);
      console.log(`💾 Saved to list: ${limitedProxies.length}`);
    } catch (error) {
      console.error('Error fetching proxies:', error);
      await this.restoreBackup();
      throw error;
    }
  }

  // Keep existing parser methods
  private parseProxiflyJson(data: any, sourceName: string): ProxyData[] {
    const proxies: ProxyData[] = [];

    try {
      const jsonData = typeof data === 'string' ? JSON.parse(data) : data;

      if (!Array.isArray(jsonData)) {
        console.warn(`⚠️ ${sourceName}: Invalid JSON format`);
        return [];
      }

      for (const item of jsonData) {
        if (item.proxy && item.protocol) {
          // Skip HTTP/HTTPS protocols
          if (['http', 'https'].includes(item.protocol.toLowerCase())) {
            continue;
          }

          proxies.push({
            proxyUrl: item.proxy,
            protocol: item.protocol,
            anonymity: item.anonymity,
            country: item.geolocation?.country || 'Unknown',
            score: item.score,
            source: sourceName,
            lastTested: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ ${sourceName}: JSON parsing error:`,
        (error as Error).message,
      );
    }

    return proxies;
  }

  private parseProxiflyTxt(data: string, sourceName: string): ProxyData[] {
    const proxies: ProxyData[] = [];
    const lines = data.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (this.isValidProxyUrl(trimmed)) {
        proxies.push({
          proxyUrl: trimmed,
          source: sourceName,
          lastTested: new Date().toISOString(),
        });
      }
    }

    return proxies;
  }

  private parseSimpleTxt(data: string, sourceName: string): ProxyData[] {
    const proxies: ProxyData[] = [];
    const lines = data.split('\n');

    let defaultProtocol = 'socks5';
    if (sourceName.toLowerCase().includes('socks4')) defaultProtocol = 'socks4';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      let proxyUrl = trimmed;

      if (!proxyUrl.includes('://')) {
        const parts = trimmed.split(':');
        if (
          parts.length === 2 &&
          this.isValidIP(parts[0]) &&
          this.isValidPort(parts[1])
        ) {
          proxyUrl = `${defaultProtocol}://${trimmed}`;
        }
      }

      if (this.isValidProxyUrl(proxyUrl)) {
        proxies.push({
          proxyUrl,
          protocol: defaultProtocol,
          source: sourceName,
          lastTested: new Date().toISOString(),
        });
      }
    }

    return proxies;
  }

  /**
   * Advanced parser for mixed format proxy lists
   */
  private parseAdvancedTxt(data: string, sourceName: string): ProxyData[] {
    const proxies: ProxyData[] = [];
    const lines = data.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//'))
        continue;

      // Handle various formats: IP:PORT, SOCKS5://IP:PORT, etc.
      let proxyUrl = trimmed;
      let protocol = 'socks5'; // Default to SOCKS5

      // Extract protocol if present
      if (trimmed.includes('://')) {
        const [proto, rest] = trimmed.split('://');
        if (['socks4', 'socks5'].includes(proto.toLowerCase())) {
          protocol = proto.toLowerCase();
          proxyUrl = `${protocol}://${rest}`;
        }
      } else {
        // Plain IP:PORT format
        const parts = trimmed.split(':');
        if (
          parts.length === 2 &&
          this.isValidIP(parts[0]) &&
          this.isValidPort(parts[1])
        ) {
          proxyUrl = `${protocol}://${trimmed}`;
        }
      }

      // Validate the final proxy URL
      if (this.isValidProxyUrl(proxyUrl)) {
        proxies.push({
          proxyUrl,
          protocol,
          source: sourceName,
          lastTested: new Date().toISOString(),
        });
      }
    }

    return proxies;
  }

  // Keep all existing utility methods...
  private removeDuplicates(proxies: ProxyData[]): ProxyData[] {
    const seen = new Set<string>();
    return proxies.filter(proxy => {
      const key = proxy.proxyUrl.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async loadExistingProxies(): Promise<ProxyData[]> {
    try {
      if (!fs.existsSync(this.config.proxyFilePath)) {
        return [];
      }

      const data = fs.readFileSync(this.config.proxyFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed)) {
        return parsed
          .map(item => {
            if (typeof item === 'string') {
              return {proxyUrl: item};
            } else if (item.proxyUrl) {
              return item;
            } else {
              return null;
            }
          })
          .filter(Boolean) as ProxyData[];
      }

      return [];
    } catch (error) {
      console.warn('Error loading existing proxies:', error);
      return [];
    }
  }

  private async saveProxyList(proxies: ProxyData[]): Promise<void> {
    try {
      const dir = path.dirname(this.config.proxyFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }

      fs.writeFileSync(
        this.config.proxyFilePath,
        JSON.stringify(proxies, null, 2),
      );
      console.log(
        `💾 Saved ${proxies.length} proxies to ${this.config.proxyFilePath}`,
      );
    } catch (error) {
      console.error('Error saving proxy list:', error);
      throw error;
    }
  }

  private async createBackup(): Promise<void> {
    try {
      if (fs.existsSync(this.config.proxyFilePath)) {
        fs.copyFileSync(this.config.proxyFilePath, this.config.backupFilePath);
        console.log(`📦 Created backup: ${this.config.backupFilePath}`);
      }
    } catch (error) {
      console.warn('Could not create backup:', error);
    }
  }

  private async restoreBackup(): Promise<void> {
    try {
      if (fs.existsSync(this.config.backupFilePath)) {
        fs.copyFileSync(this.config.backupFilePath, this.config.proxyFilePath);
        console.log('🔄 Restored proxy list from backup');
      }
    } catch (error) {
      console.error('Could not restore from backup:', error);
    }
  }

  private isValidIP(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  }

  private isValidPort(port: string): boolean {
    const portNum = parseInt(port);
    return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
  }

  private isValidProxyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['socks5', 'socks4'].includes(parsed.protocol.slice(0, -1));
    } catch {
      return false;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  public async fetchAndTestAll(): Promise<void> {
    console.log('Starting fetch and test cycle...');
    try {
      await this.fetchProxiesOnly();
      await this.testAllProxiesSystematic();
      console.log('Fetch and test cycle completed successfully!');
    } catch (error) {
      console.error('Error in fetch and test cycle:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Proxy Manager is already running');
      return;
    }

    console.log('Starting Enhanced Proxy Manager...');
    this.isRunning = true;

    await this.fetchAndTestAll();

    this.fetchTimer = setInterval(async () => {
      try {
        await this.fetchAndTestAll();
      } catch (error) {
        console.error('Error in periodic proxy management:', error);
      }
    }, this.config.fetchInterval);

    console.log(
      `Enhanced Proxy Manager started - Running every ${this.config.fetchInterval / 60000} minutes`,
    );
  }

  public stop(): void {
    if (!this.isRunning) return;

    console.log('Stopping Enhanced Proxy Manager...');

    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = undefined;
    }

    if (this.testTimer) {
      clearInterval(this.testTimer);
      this.testTimer = undefined;
    }

    this.closeBrowser();
    this.isRunning = false;
    console.log('Enhanced Proxy Manager stopped');
  }
}

export const enhancedProxyManager = new EnhancedProxyManager();

process.on('SIGINT', () => {
  console.log('\nShutting down Enhanced Proxy Manager...');
  enhancedProxyManager.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Enhanced Proxy Manager...');
  enhancedProxyManager.stop();
  process.exit(0);
});
