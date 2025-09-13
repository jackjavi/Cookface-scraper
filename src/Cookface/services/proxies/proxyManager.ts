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
}

interface ProxyManagerConfig {
  fetchInterval: number; // in milliseconds
  testInterval: number; // in milliseconds
  maxProxies: number;
  minWorkingProxies: number;
  proxyFilePath: string;
  backupFilePath: string;
}

export class ProxyManager {
  private config: ProxyManagerConfig;
  private fetchTimer?: NodeJS.Timeout;
  private testTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(customConfig?: Partial<ProxyManagerConfig>) {
    this.config = {
      fetchInterval: 10 * 60 * 1000, // 10 minutes
      testInterval: 30 * 60 * 1000, // 30 minutes
      maxProxies: 50,
      minWorkingProxies: 5,
      proxyFilePath: config.proxyList,
      backupFilePath: config.proxyList.replace('.json', '_backup.json'),
      ...customConfig,
    };
  }

  /**
   * Start the automated proxy management
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Proxy Manager is already running');
      return;
    }

    console.log('🚀 Starting Proxy Manager...');
    this.isRunning = true;

    // Initial fetch and test
    await this.fetchAndUpdateProxies();

    // Set up periodic fetching
    this.fetchTimer = setInterval(async () => {
      try {
        await this.fetchAndUpdateProxies();
      } catch (error) {
        console.error('❌ Error in periodic proxy fetch:', error);
      }
    }, this.config.fetchInterval);

    // Set up periodic testing
    this.testTimer = setInterval(async () => {
      try {
        await this.testExistingProxies();
      } catch (error) {
        console.error('❌ Error in periodic proxy testing:', error);
      }
    }, this.config.testInterval);

    console.log(
      `✅ Proxy Manager started - Fetching every ${this.config.fetchInterval / 60000} minutes`,
    );
  }

  /**
   * Stop the automated proxy management
   */
  public stop(): void {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Proxy Manager...');

    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = undefined;
    }

    if (this.testTimer) {
      clearInterval(this.testTimer);
      this.testTimer = undefined;
    }

    this.isRunning = false;
    console.log('✅ Proxy Manager stopped');
  }

  /**
   * Fetch fresh proxies from the source and update the list
   */
  public async fetchAndUpdateProxies(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🔄 Fetching fresh proxies...`,
    );

    try {
      // Create backup of current proxy list
      await this.createBackup();

      // Fetch fresh proxies
      const freshProxies = await this.fetchProxiesFromSource();
      console.log(`📥 Fetched ${freshProxies.length} fresh proxies`);

      // Load existing proxies
      const existingProxies = await this.loadExistingProxies();
      console.log(`📋 Found ${existingProxies.length} existing proxies`);

      // Merge and deduplicate
      const mergedProxies = this.mergeAndDeduplicateProxies(
        existingProxies,
        freshProxies,
      );
      console.log(`🔗 Merged to ${mergedProxies.length} unique proxies`);

      // Limit the number of proxies
      const limitedProxies = mergedProxies.slice(0, this.config.maxProxies);

      // Test a sample of new proxies
      const testedProxies = await this.testProxySample(limitedProxies);

      // Save updated proxy list
      await this.saveProxyList(testedProxies);

      // Get working proxy count
      const workingCount = testedProxies.filter(p => p.isWorking).length;

      console.log(`✅ Proxy update complete:`);
      console.log(`   📊 Total proxies: ${testedProxies.length}`);
      console.log(`   ✅ Working proxies: ${workingCount}`);
      console.log(
        `   ❌ Failed/Untested: ${testedProxies.length - workingCount}`,
      );

      // Alert if working proxies are low
      if (workingCount < this.config.minWorkingProxies) {
        console.warn(
          `⚠️  LOW PROXY COUNT: Only ${workingCount} working proxies (minimum: ${this.config.minWorkingProxies})`,
        );
      }
    } catch (error) {
      console.error('❌ Error updating proxies:', error);
      await this.restoreBackup();
    }
  }

  /**
   * Fetch proxies from the online source
   */
  private async fetchProxiesFromSource(): Promise<ProxyData[]> {
    const sources = [
      'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt',
      'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
      // Add more sources as backup
    ];

    for (const source of sources) {
      try {
        console.log(`🌐 Fetching from: ${source}`);

        const response = await axios.get(source, {
          timeout: 30000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        const proxies = this.parseProxyData(response.data);

        if (proxies.length > 0) {
          console.log(
            `✅ Successfully fetched ${proxies.length} proxies from ${source}`,
          );
          return proxies;
        }
      } catch (error) {
        console.warn(
          `⚠️  Failed to fetch from ${source}:`,
          (error as Error).message,
        );
        continue; // Try next source
      }
    }

    throw new Error('Failed to fetch proxies from all sources');
  }

  /**
   * Parse raw proxy data into structured format
   */
  private parseProxyData(rawData: string): ProxyData[] {
    const lines = rawData.split('\n');
    const proxies: ProxyData[] = [];
    const currentTime = new Date().toISOString();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle different formats
      let proxyUrl = '';

      if (trimmed.includes('://')) {
        // Already has protocol
        proxyUrl = trimmed;
      } else {
        // Assume IP:PORT format, add socks5 protocol
        const parts = trimmed.split(':');
        if (parts.length === 2) {
          const [ip, port] = parts;
          if (this.isValidIP(ip) && this.isValidPort(port)) {
            proxyUrl = `socks5://${ip}:${port}`;
          }
        }
      }

      if (proxyUrl && this.isValidProxyUrl(proxyUrl)) {
        proxies.push({
          proxyUrl,
          lastTested: currentTime,
          isWorking: undefined, // Will be tested later
          responseTime: undefined,
        });
      }
    }

    return proxies;
  }

  /**
   * Load existing proxy list
   */
  private async loadExistingProxies(): Promise<ProxyData[]> {
    try {
      if (!fs.existsSync(this.config.proxyFilePath)) {
        return [];
      }

      const data = fs.readFileSync(this.config.proxyFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Handle both old and new formats
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
      console.warn('⚠️  Error loading existing proxies:', error);
      return [];
    }
  }

  /**
   * Merge and deduplicate proxy lists
   */
  private mergeAndDeduplicateProxies(
    existing: ProxyData[],
    fresh: ProxyData[],
  ): ProxyData[] {
    const proxyMap = new Map<string, ProxyData>();

    // Add existing proxies (keep their test results)
    for (const proxy of existing) {
      proxyMap.set(proxy.proxyUrl, proxy);
    }

    // Add fresh proxies (don't overwrite existing test results)
    for (const proxy of fresh) {
      if (!proxyMap.has(proxy.proxyUrl)) {
        proxyMap.set(proxy.proxyUrl, proxy);
      }
    }

    return Array.from(proxyMap.values());
  }

  /**
   * Test a sample of proxies to verify they're working
   */
  private async testProxySample(
    proxies: ProxyData[],
    sampleSize = 10,
  ): Promise<ProxyData[]> {
    console.log(
      `🧪 Testing sample of ${Math.min(sampleSize, proxies.length)} proxies...`,
    );

    // Separate untested and previously working proxies
    const untested = proxies.filter(p => p.isWorking === undefined);
    const previouslyWorking = proxies.filter(p => p.isWorking === true);
    const previouslyFailed = proxies.filter(p => p.isWorking === false);

    // Test some untested proxies first
    const toTest = [
      ...untested.slice(0, Math.floor(sampleSize * 0.7)),
      ...previouslyWorking.slice(0, Math.floor(sampleSize * 0.2)),
      ...previouslyFailed.slice(0, Math.floor(sampleSize * 0.1)),
    ];

    const testPromises = toTest.map(proxy => this.testSingleProxy(proxy));
    const results = await Promise.allSettled(testPromises);

    // Update test results
    results.forEach((result, index) => {
      const proxy = toTest[index];
      if (result.status === 'fulfilled') {
        Object.assign(proxy, result.value);
      } else {
        proxy.isWorking = false;
        proxy.lastTested = new Date().toISOString();
      }
    });

    return proxies;
  }

  /**
   * Test a single proxy
   */
  private async testSingleProxy(
    proxyData: ProxyData,
  ): Promise<Partial<ProxyData>> {
    const startTime = Date.now();

    try {
      // Create a temporary proxy list file for testing
      const tempProxyFile = path.join(
        path.dirname(this.config.proxyFilePath),
        'temp_proxy_test.json',
      );
      fs.writeFileSync(
        tempProxyFile,
        JSON.stringify([{proxyUrl: proxyData.proxyUrl}]),
      );

      try {
        const {browser} = await createProxyBrowser();
        const page = await browser.newPage();

        await page.goto('https://www.google.com', {
          waitUntil: 'networkidle2',
          timeout: 15000,
        });

        const responseTime = Date.now() - startTime;

        await browser.close();
        fs.unlinkSync(tempProxyFile); // Clean up temp file

        return {
          isWorking: true,
          lastTested: new Date().toISOString(),
          responseTime,
        };
      } catch (testError) {
        fs.unlinkSync(tempProxyFile); // Clean up temp file
        throw testError;
      }
    } catch (error) {
      return {
        isWorking: false,
        lastTested: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Test existing proxies periodically
   */
  private async testExistingProxies(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🔍 Testing existing proxies...`,
    );

    try {
      const proxies = await this.loadExistingProxies();

      if (proxies.length === 0) {
        console.log('📭 No proxies to test');
        return;
      }

      // Test all working proxies and some random others
      const workingProxies = proxies.filter(p => p.isWorking === true);
      const otherProxies = proxies.filter(p => p.isWorking !== true);

      const toTest = [
        ...workingProxies, // Test all previously working
        ...this.shuffleArray(otherProxies).slice(0, 5), // Test 5 random others
      ];

      console.log(`🧪 Testing ${toTest.length} proxies...`);

      const updatedProxies = await this.testProxySample(proxies, toTest.length);
      await this.saveProxyList(updatedProxies);

      const workingCount = updatedProxies.filter(
        p => p.isWorking === true,
      ).length;
      console.log(
        `✅ Proxy testing complete: ${workingCount}/${updatedProxies.length} working`,
      );
    } catch (error) {
      console.error('❌ Error testing existing proxies:', error);
    }
  }

  /**
   * Save proxy list to file
   */
  private async saveProxyList(proxies: ProxyData[]): Promise<void> {
    try {
      // Ensure directory exists
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

  /**
   * Create backup of current proxy file
   */
  private async createBackup(): Promise<void> {
    try {
      if (fs.existsSync(this.config.proxyFilePath)) {
        fs.copyFileSync(this.config.proxyFilePath, this.config.backupFilePath);
      }
    } catch (error) {
      console.warn('⚠️  Could not create backup:', error);
    }
  }

  /**
   * Restore from backup
   */
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

  /**
   * Get proxy statistics
   */
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

  // Utility methods
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
}

// Export singleton instance
export const proxyManager = new ProxyManager();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Proxy Manager...');
  proxyManager.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Proxy Manager...');
  proxyManager.stop();
  process.exit(0);
});
