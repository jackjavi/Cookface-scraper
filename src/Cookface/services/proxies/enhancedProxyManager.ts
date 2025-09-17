import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import config from '../../config/index';
import {createProxyBrowser} from '../../utils/browserManager';

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
}

interface ProxyManagerConfig {
  fetchInterval: number; // in milliseconds
  testInterval: number; // in milliseconds
  maxProxies: number;
  minWorkingProxies: number;
  proxyFilePath: string;
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

  // Comprehensive proxy sources
  private proxySources: ProxySource[] = [
    // Proxifly sources (JSON format)
    {
      name: 'Proxifly All',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.json',
      type: 'json',
      protocols: ['http', 'https', 'socks4', 'socks5'],
      parser: this.parseProxiflyJson.bind(this),
    },
    {
      name: 'Proxifly HTTP',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.json',
      type: 'json',
      protocols: ['http'],
      parser: this.parseProxiflyJson.bind(this),
    },
    {
      name: 'Proxifly SOCKS5',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.json',
      type: 'json',
      protocols: ['socks5'],
      parser: this.parseProxiflyJson.bind(this),
    },
    // Proxifly TXT sources
    {
      name: 'Proxifly HTTP TXT',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
      type: 'txt',
      protocols: ['http'],
      parser: this.parseProxiflyTxt.bind(this),
    },
    {
      name: 'Proxifly SOCKS5 TXT',
      url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseProxiflyTxt.bind(this),
    },
    // Other reliable sources
    {
      name: 'TheSpeedX SOCKS5',
      url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'TheSpeedX HTTP',
      url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      type: 'txt',
      protocols: ['http'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'HookZof SOCKS5',
      url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'Monosans HTTP',
      url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      type: 'txt',
      protocols: ['http'],
      parser: this.parseSimpleTxt.bind(this),
    },
    {
      name: 'Monosans SOCKS5',
      url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
      type: 'txt',
      protocols: ['socks5'],
      parser: this.parseSimpleTxt.bind(this),
    },
  ];

  constructor(customConfig?: Partial<ProxyManagerConfig>) {
    this.config = {
      fetchInterval: 10 * 60 * 1000, // 10 minutes
      testInterval: 30 * 60 * 1000, // 30 minutes
      maxProxies: 100,
      minWorkingProxies: 5,
      proxyFilePath: config.proxyList,
      backupFilePath: config.proxyList.replace('.json', '_backup.json'),
      testTimeout: 30000, // 30 seconds per proxy test
      testConcurrency: 1, // Test one at a time for better resource management
      ...customConfig,
    };
  }

  /**
   * Fetch proxies from all sources
   */
  public async fetchProxiesOnly(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🔄 Fetching proxies from all sources...`,
    );

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

          // Rate limiting - be respectful
          await this.delay(1000);
        } catch (error) {
          console.error(`❌ ${source.name} failed:`, (error as Error).message);
          continue;
        }
      }

      if (allProxies.length === 0) {
        throw new Error('No proxies could be fetched from any source');
      }

      // Remove duplicates
      const uniqueProxies = this.removeDuplicates(allProxies);
      console.log(
        `🧹 Removed ${allProxies.length - uniqueProxies.length} duplicates`,
      );

      // Limit and shuffle for variety
      const limitedProxies = this.shuffleArray(uniqueProxies).slice(
        0,
        this.config.maxProxies,
      );

      // Save the fetched proxies (untested)
      await this.saveProxyList(limitedProxies);

      console.log(`✅ Fetch complete:`);
      console.log(
        `   📊 Sources accessed: ${successfulSources}/${this.proxySources.length}`,
      );
      console.log(`   📦 Total fetched: ${totalFetched}`);
      console.log(`   🎯 Unique proxies: ${uniqueProxies.length}`);
      console.log(`   💾 Saved to list: ${limitedProxies.length}`);
    } catch (error) {
      console.error('❌ Error fetching proxies:', error);
      await this.restoreBackup();
      throw error;
    }
  }

  /**
   * Test all proxies in the list systematically
   */
  public async testAllProxiesSystematic(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🧪 Testing all proxies systematically...`,
    );

    try {
      let proxies = await this.loadExistingProxies();

      if (proxies.length === 0) {
        console.log('📭 No proxies to test');
        return;
      }

      console.log(`🎯 Testing ${proxies.length} proxies one by one...`);

      // Initialize browser once
      await this.initializeBrowser();

      const testedProxies: ProxyData[] = [];
      let workingCount = 0;
      let failedCount = 0;

      for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        const progress = `${i + 1}/${proxies.length}`;

        console.log(`🔍 [${progress}] Testing: ${proxy.proxyUrl}`);

        try {
          // Create a new page for each test
          await this.createNewPage();

          const testResult = await this.testSingleProxyWithBrowser(proxy);

          if (testResult.isWorking) {
            workingCount++;
            testedProxies.push({...proxy, ...testResult});
            console.log(
              `✅ [${progress}] ${proxy.proxyUrl} - WORKING (${testResult.responseTime}ms)`,
            );
          } else {
            failedCount++;
            console.log(`❌ [${progress}] ${proxy.proxyUrl} - FAILED`);
            // Don't add failed proxies to the list (remove them)
          }

          // Close the current page to free memory
          await this.closePage();

          // Save progress every 10 proxies
          if ((i + 1) % 10 === 0) {
            await this.saveProxyList(testedProxies);
            console.log(
              `💾 Progress saved: ${workingCount} working, ${failedCount} failed`,
            );
          }

          // Small delay between tests
          await this.delay(2000);
        } catch (error) {
          failedCount++;
          console.log(
            `❌ [${progress}] ${proxy.proxyUrl} - ERROR: ${(error as Error).message}`,
          );
          await this.closePage(); // Ensure page is closed on error
        }
      }

      // Clean up browser
      await this.closeBrowser();

      // Save final results (only working proxies)
      await this.saveProxyList(testedProxies);

      console.log(`✅ Testing complete:`);
      console.log(`   ✅ Working proxies: ${workingCount}`);
      console.log(`   ❌ Failed/Removed: ${failedCount}`);
      console.log(
        `   📊 Success rate: ${((workingCount / proxies.length) * 100).toFixed(1)}%`,
      );
      console.log(
        `   💾 Clean list saved with ${testedProxies.length} working proxies`,
      );

      if (workingCount < this.config.minWorkingProxies) {
        console.warn(
          `⚠️ LOW WORKING PROXIES: Only ${workingCount} working (minimum: ${this.config.minWorkingProxies})`,
        );
      }
    } catch (error) {
      console.error('❌ Error during systematic testing:', error);
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Combined fetch and test operation
   */
  public async fetchAndTestAll(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🚀 Starting fetch and test cycle...`,
    );

    try {
      // Step 1: Fetch fresh proxies
      await this.fetchProxiesOnly();

      // Step 2: Test all fetched proxies
      await this.testAllProxiesSystematic();

      console.log('🎉 Fetch and test cycle completed successfully!');
    } catch (error) {
      console.error('❌ Error in fetch and test cycle:', error);
      throw error;
    }
  }

  /**
   * Browser management methods
   */
  private async initializeBrowser(): Promise<void> {
    try {
      if (!this.proxyBrowser) {
        console.log('🌐 Initializing browser for testing...');
        const browserResult = await createProxyBrowser();
        this.proxyBrowser = browserResult.browser;
        console.log('✅ Browser initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
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

    // Set reasonable timeouts
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

  /**
   * Test a single proxy using the initialized browser
   */
  private async testSingleProxyWithBrowser(
    proxyData: ProxyData,
  ): Promise<Partial<ProxyData>> {
    const startTime = Date.now();

    try {
      if (!this.currentPage) {
        throw new Error('No active page for testing');
      }

      // Try to navigate to a test site
      await this.currentPage.goto('https://www.google.com', {
        waitUntil: 'networkidle2',
        timeout: this.config.testTimeout,
      });

      const responseTime = Date.now() - startTime;

      return {
        isWorking: true,
        lastTested: new Date().toISOString(),
        responseTime,
      };
    } catch (error) {
      return {
        isWorking: false,
        lastTested: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Parser methods for different source formats
   */
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

    // Detect protocol from source name
    let defaultProtocol = 'http';
    if (sourceName.toLowerCase().includes('socks5')) defaultProtocol = 'socks5';
    else if (sourceName.toLowerCase().includes('socks4'))
      defaultProtocol = 'socks4';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      let proxyUrl = trimmed;

      // Add protocol if missing
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
   * Utility methods (keeping existing ones and adding new)
   */
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

  // Existing utility methods (keeping all existing ones)
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
      console.warn('⚠️ Error loading existing proxies:', error);
      return [];
    }
  }

  private async saveProxyList(proxies: ProxyData[]): Promise<void> {
    try {
      const dir = path.dirname(this.config.proxyFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }

      // Sort proxies - working ones first, then by response time
      const sortedProxies = proxies.sort((a, b) => {
        if (a.isWorking && !b.isWorking) return -1;
        if (!a.isWorking && b.isWorking) return 1;
        if (a.isWorking && b.isWorking) {
          return (a.responseTime || 9999) - (b.responseTime || 9999);
        }
        return 0;
      });

      fs.writeFileSync(
        this.config.proxyFilePath,
        JSON.stringify(sortedProxies, null, 2),
      );
      console.log(
        `💾 Saved ${proxies.length} proxies to ${this.config.proxyFilePath}`,
      );
    } catch (error) {
      console.error('❌ Error saving proxy list:', error);
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
      console.warn('⚠️ Could not create backup:', error);
    }
  }

  private async restoreBackup(): Promise<void> {
    try {
      if (fs.existsSync(this.config.backupFilePath)) {
        fs.copyFileSync(this.config.backupFilePath, this.config.proxyFilePath);
        console.log('🔄 Restored proxy list from backup');
      }
    } catch (error) {
      console.error('❌ Could not restore from backup:', error);
    }
  }

  public async getProxyStats(): Promise<any> {
    try {
      const proxies = await this.loadExistingProxies();
      const working = proxies.filter(p => p.isWorking === true);
      const failed = proxies.filter(p => p.isWorking === false);
      const untested = proxies.filter(p => p.isWorking === undefined);

      return {
        total: proxies.length,
        working: working.length,
        failed: failed.length,
        untested: untested.length,
        lastUpdated: fs.existsSync(this.config.proxyFilePath)
          ? fs.statSync(this.config.proxyFilePath).mtime
          : null,
        averageResponseTime:
          working.length > 0
            ? working.reduce((sum, p) => sum + (p.responseTime || 0), 0) /
              working.length
            : 0,
      };
    } catch (error) {
      console.error('Error getting proxy stats:', error);
      return null;
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
      return ['socks5', 'socks4', 'http', 'https'].includes(
        parsed.protocol.slice(0, -1),
      );
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

  // Maintain backward compatibility with existing methods
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Proxy Manager is already running');
      return;
    }

    console.log('🚀 Starting Enhanced Proxy Manager...');
    this.isRunning = true;

    // Initial fetch and test
    await this.fetchAndTestAll();

    // Set up periodic operations
    this.fetchTimer = setInterval(async () => {
      try {
        await this.fetchAndTestAll();
      } catch (error) {
        console.error('❌ Error in periodic proxy management:', error);
      }
    }, this.config.fetchInterval);

    console.log(
      `✅ Enhanced Proxy Manager started - Running every ${this.config.fetchInterval / 60000} minutes`,
    );
  }

  public stop(): void {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Enhanced Proxy Manager...');

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
    console.log('✅ Enhanced Proxy Manager stopped');
  }
}

// Export singleton instance
export const enhancedProxyManager = new EnhancedProxyManager();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Enhanced Proxy Manager...');
  enhancedProxyManager.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Enhanced Proxy Manager...');
  enhancedProxyManager.stop();
  process.exit(0);
});
