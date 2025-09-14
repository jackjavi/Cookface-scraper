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
   * Fetch fresh proxies from the source and REPLACE the existing list completely
   */
  public async fetchAndUpdateProxies(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🔄 Fetching fresh proxies (clearing old ones)...`,
    );

    try {
      // Create backup of current proxy list
      await this.createBackup();

      // Fetch fresh proxies
      const freshProxies = await this.fetchProxiesFromSource();
      console.log(`📥 Fetched ${freshProxies.length} fresh proxies`);

      if (freshProxies.length === 0) {
        console.warn('⚠️  No fresh proxies fetched, keeping existing list');
        return;
      }

      // IMPORTANT: Clear old proxies and use only fresh ones
      console.log('🧹 Clearing old proxies and using only fresh ones');

      // Limit the number of proxies
      const limitedProxies = freshProxies.slice(0, this.config.maxProxies);

      // Test a sample of new proxies to verify they work
      const testedProxies = await this.testProxySample(limitedProxies);

      // Save the completely new proxy list
      await this.saveProxyList(testedProxies);

      // Get working proxy count
      const workingCount = testedProxies.filter(p => p.isWorking).length;

      console.log(`✅ Proxy update complete (old proxies cleared):`);
      console.log(`   📊 Total fresh proxies: ${testedProxies.length}`);
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
   * Fetch a completely fresh list of proxies and clear all existing ones
   */
  public async fetchFreshProxiesOnly(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🆕 Fetching completely fresh proxy list...`,
    );

    try {
      // Create backup of current proxy list
      await this.createBackup();

      // Fetch fresh proxies
      const freshProxies = await this.fetchProxiesFromSource();
      console.log(`📥 Fetched ${freshProxies.length} completely fresh proxies`);

      if (freshProxies.length === 0) {
        throw new Error('No fresh proxies could be fetched from any source');
      }

      // Take only the freshest proxies up to the limit
      const limitedProxies = freshProxies.slice(0, this.config.maxProxies);
      console.log(
        `🎯 Using ${limitedProxies.length} fresh proxies (old list completely cleared)`,
      );

      // Test a good sample of the fresh proxies
      const sampleSize = Math.min(15, Math.ceil(limitedProxies.length * 0.3));
      const testedProxies = await this.testProxySample(
        limitedProxies,
        sampleSize,
      );

      // Save the completely new proxy list
      await this.saveProxyList(testedProxies);

      // Get working proxy count
      const workingCount = testedProxies.filter(
        p => p.isWorking === true,
      ).length;

      console.log(`✅ Fresh proxy list created:`);
      console.log(`   📊 Total fresh proxies: ${testedProxies.length}`);
      console.log(`   ✅ Working proxies: ${workingCount}`);
      console.log(
        `   🧪 Tested: ${testedProxies.filter(p => p.isWorking !== undefined).length}`,
      );
      console.log(
        `   ❓ Untested: ${testedProxies.filter(p => p.isWorking === undefined).length}`,
      );
    } catch (error) {
      console.error('❌ Error fetching fresh proxies:', error);
      await this.restoreBackup();
      throw error;
    }
  }

  /**
   * Test all existing proxies (not just a sample)
   */
  public async testAllProxies(): Promise<void> {
    console.log(
      `[${new Date().toLocaleTimeString()}] 🔍 Testing ALL existing proxies...`,
    );

    try {
      const proxies = await this.loadExistingProxies();

      if (proxies.length === 0) {
        console.log('📭 No proxies to test');
        return;
      }

      console.log(`🧪 Testing all ${proxies.length} proxies...`);

      // Test all proxies sequentially to avoid overwhelming the system
      const updatedProxies = [...proxies];

      for (let i = 0; i < updatedProxies.length; i++) {
        const proxy = updatedProxies[i];
        console.log(
          `Testing proxy ${i + 1}/${updatedProxies.length}: ${proxy.proxyUrl}`,
        );

        try {
          const testResult = await this.testSingleProxy(proxy);
          Object.assign(proxy, testResult);

          // Save progress every 10 proxies in case of interruption
          if ((i + 1) % 10 === 0) {
            await this.saveProxyList(updatedProxies);
            console.log(`💾 Saved progress after ${i + 1} proxies`);
          }
        } catch (error) {
          console.warn(`⚠️ Error testing proxy ${proxy.proxyUrl}:`, error);
          proxy.isWorking = false;
          proxy.lastTested = new Date().toISOString();
        }

        // Add a small delay between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Final save
      await this.saveProxyList(updatedProxies);

      const workingCount = updatedProxies.filter(
        p => p.isWorking === true,
      ).length;
      console.log(
        `✅ Complete proxy testing: ${workingCount}/${updatedProxies.length} working`,
      );
    } catch (error) {
      console.error('❌ Error testing all proxies:', error);
      throw error;
    }
  }

  /**
   * Fetch proxies from the online source
   */
  private async fetchProxiesFromSource(): Promise<ProxyData[]> {
    const sources = [
      'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt',
      'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
      'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt',
      'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
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
   * Test a sample of proxies to verify they're working
   */
  private async testProxySample(
    proxies: ProxyData[],
    sampleSize = 10,
  ): Promise<ProxyData[]> {
    console.log(
      `🧪 Testing sample of ${Math.min(sampleSize, proxies.length)} proxies...`,
    );

    // Take a random sample of proxies to test
    const shuffled = this.shuffleArray([...proxies]);
    const toTest = shuffled.slice(0, Math.min(sampleSize, proxies.length));

    console.log(`🎯 Testing ${toTest.length} randomly selected proxies`);

    // Test proxies sequentially to avoid overwhelming the system
    for (let i = 0; i < toTest.length; i++) {
      const proxy = toTest[i];
      console.log(`Testing ${i + 1}/${toTest.length}: ${proxy.proxyUrl}`);

      try {
        const testResult = await this.testSingleProxy(proxy);
        Object.assign(proxy, testResult);

        const status = proxy.isWorking ? '✅' : '❌';
        const time = proxy.responseTime ? ` (${proxy.responseTime}ms)` : '';
        console.log(`${status} ${proxy.proxyUrl}${time}`);
      } catch (error) {
        proxy.isWorking = false;
        proxy.lastTested = new Date().toISOString();
        console.log(`❌ ${proxy.proxyUrl} - Failed`);
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

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
          timeout: 30000,
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
        console.log(`📦 Created backup: ${this.config.backupFilePath}`);
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
