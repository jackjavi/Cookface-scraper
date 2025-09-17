#!/usr/bin/env node

import {EnhancedProxyManager} from './services/proxies/enhancedProxyManager';
import * as fs from 'fs';
import config from './config/index';

class EnhancedProxyCLI {
  private proxyManager: EnhancedProxyManager;

  constructor() {
    this.proxyManager = new EnhancedProxyManager({
      fetchInterval: 10 * 60 * 1000, // 10 minutes
      testInterval: 30 * 60 * 1000, // 30 minutes
      maxProxies: 200, // Higher limit for CLI
      minWorkingProxies: 10,
      proxyFilePath: config.proxyList,
      backupFilePath: config.proxyList.replace('.json', '_backup.json'),
      testTimeout: 30000, // 30 seconds per proxy
      testConcurrency: 1, // Test one at a time
    });
  }

  /**
   * Display help information
   */
  private showHelp(): void {
    console.log(`
🔗 Enhanced Proxy Manager CLI Tool

Usage: npm run <command>

MAIN COMMANDS:
  proxy-fetch-only     Fetch fresh proxies from all sources (no testing)
  proxy-test-only      Test existing proxies systematically  
  proxy-fetch-test     Fetch fresh proxies AND test them all
  
MANAGEMENT COMMANDS:
  proxy-stats          Show detailed proxy statistics
  proxy-start          Start automated proxy management
  proxy-list           List all proxies with status
  proxy-list-working   List only working proxies
  proxy-list-failed    List only failed proxies
  proxy-clean          Remove failed proxies from the list
  proxy-reset          Reset proxy list (remove all proxies)
  proxy-backup         Create backup of current proxy list
  proxy-restore        Restore from backup
  proxy-help           Show this help message

EXAMPLES:
  npm run proxy-fetch-only     # Just fetch, don't test
  npm run proxy-test-only      # Test existing proxies
  npm run proxy-fetch-test     # Complete refresh cycle
  npm run proxy-stats          # Check current status
  npm run proxy-start          # Start continuous mode

WORKFLOW:
1. Use 'proxy-fetch-only' to collect fresh proxies
2. Use 'proxy-test-only' to test them systematically
3. Or use 'proxy-fetch-test' to do both in one command
4. Use 'proxy-stats' to monitor results

The enhanced manager will:
- Fetch from 10+ reliable proxy sources including Proxifly
- Parse both JSON and TXT formats
- Test each proxy individually with browser automation
- Remove failed proxies automatically
- Keep only working proxies in the final list
`);
  }

  /**
   * Fetch proxies only (no testing)
   */
  private async fetchOnly(): Promise<void> {
    console.log(
      '🔄 FETCH ONLY - Collecting fresh proxies from all sources...\n',
    );

    try {
      await this.proxyManager.fetchProxiesOnly();

      // Show immediate stats
      const stats = await this.proxyManager.getProxyStats();
      if (stats) {
        console.log('\n📊 FETCH RESULTS:');
        console.log('================');
        console.log(`📦 Total proxies fetched: ${stats.total}`);
        console.log(`❓ Status: All untested (ready for testing)`);
        console.log(
          '\n💡 Next step: Run "npm run proxy-test-only" to test these proxies',
        );
      }
    } catch (error) {
      console.error('❌ Fetch failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test existing proxies only
   */
  private async testOnly(): Promise<void> {
    console.log('🧪 TEST ONLY - Testing existing proxies systematically...\n');

    try {
      const stats = await this.proxyManager.getProxyStats();

      if (!stats || stats.total === 0) {
        console.log('📭 No proxies found to test.');
        console.log('💡 Run "npm run proxy-fetch-only" first to fetch proxies');
        return;
      }

      console.log(`🎯 Found ${stats.total} proxies to test`);
      console.log(
        '⚠️  WARNING: This will test each proxy individually and remove failed ones\n',
      );

      await this.proxyManager.testAllProxiesSystematic();

      // Show final results
      const finalStats = await this.proxyManager.getProxyStats();
      if (finalStats) {
        console.log('\n📊 TESTING RESULTS:');
        console.log('===================');
        console.log(`✅ Working proxies: ${finalStats.working}`);
        console.log(
          `📊 Success rate: ${((finalStats.working / stats.total) * 100).toFixed(1)}%`,
        );
        console.log(
          `⏱️  Average response time: ${Math.round(finalStats.averageResponseTime)}ms`,
        );
      }
    } catch (error) {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    }
  }

  /**
   * Fetch and test all (combined operation)
   */
  private async fetchAndTestAll(): Promise<void> {
    console.log('🚀 FETCH & TEST - Complete proxy refresh cycle...\n');

    try {
      await this.proxyManager.fetchAndTestAll();

      // Show comprehensive results
      const stats = await this.proxyManager.getProxyStats();
      if (stats) {
        console.log('\n🎉 COMPLETE CYCLE RESULTS:');
        console.log('==========================');
        console.log(`✅ Working proxies found: ${stats.working}`);
        console.log(
          `⏱️  Average response time: ${Math.round(stats.averageResponseTime)}ms`,
        );
        console.log(`💾 Clean list ready for use`);

        if (stats.working < 10) {
          console.log(
            '\n⚠️  Consider running again if you need more working proxies',
          );
        }
      }
    } catch (error) {
      console.error('❌ Fetch and test cycle failed:', error);
      process.exit(1);
    }
  }

  /**
   * Display comprehensive proxy statistics
   */
  private async showStats(): Promise<void> {
    console.log('📊 Fetching detailed proxy statistics...\n');

    const stats = await this.proxyManager.getProxyStats();

    if (!stats) {
      console.log('❌ Could not load proxy statistics');
      return;
    }

    console.log('📈 ENHANCED PROXY STATISTICS');
    console.log('============================');
    console.log(`📦 Total Proxies:     ${stats.total}`);
    console.log(
      `✅ Working Proxies:   ${stats.working} (${((stats.working / stats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `❌ Failed Proxies:    ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `❓ Untested Proxies:  ${stats.untested} (${((stats.untested / stats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `⏱️  Average Response:  ${Math.round(stats.averageResponseTime)}ms`,
    );

    if (stats.lastUpdated) {
      console.log(
        `🕐 Last Updated:      ${new Date(stats.lastUpdated).toLocaleString()}`,
      );
    }

    // Enhanced health assessment
    console.log('\n🏥 SYSTEM HEALTH');
    console.log('================');

    if (stats.working === 0) {
      console.log('🔴 CRITICAL: No working proxies available!');
      console.log('💡 Recommended: Run "npm run proxy-fetch-test"');
    } else if (stats.working < 5) {
      console.log('🟡 WARNING: Very few working proxies');
      console.log(
        '💡 Recommended: Run "npm run proxy-fetch-test" for more proxies',
      );
    } else if (stats.working < 15) {
      console.log('🟠 CAUTION: Limited working proxies');
      console.log(
        '💡 Consider: Running "npm run proxy-fetch-only" then "npm run proxy-test-only"',
      );
    } else {
      console.log('🟢 EXCELLENT: Good proxy availability');
    }

    // Response time assessment
    if (stats.averageResponseTime > 8000) {
      console.log('🔴 VERY SLOW: Consider testing fresh proxies');
    } else if (stats.averageResponseTime > 5000) {
      console.log('🟡 SLOW: Moderate response times');
    } else if (stats.averageResponseTime > 2000) {
      console.log('🟠 ACCEPTABLE: Reasonable response times');
    } else {
      console.log('🟢 FAST: Excellent response times');
    }

    // Data freshness
    if (stats.lastUpdated) {
      const hoursSinceUpdate =
        (Date.now() - new Date(stats.lastUpdated).getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate > 24) {
        console.log('🔴 STALE: Data is over 24 hours old');
        console.log('💡 Recommended: Run "npm run proxy-fetch-test"');
      } else if (hoursSinceUpdate > 6) {
        console.log('🟡 AGING: Data is getting old');
        console.log('💡 Consider: Fresh proxy fetch');
      }
    }

    // Show breakdown by sources if available
    if (fs.existsSync(config.proxyList)) {
      try {
        const data = JSON.parse(fs.readFileSync(config.proxyList, 'utf-8'));
        const sources = new Map();
        const protocols = new Map();

        data.forEach((proxy: any) => {
          if (proxy.source) {
            sources.set(proxy.source, (sources.get(proxy.source) || 0) + 1);
          }
          if (proxy.protocol) {
            protocols.set(
              proxy.protocol,
              (protocols.get(proxy.protocol) || 0) + 1,
            );
          }
        });

        if (sources.size > 0) {
          console.log('\n📡 SOURCES BREAKDOWN');
          console.log('==================');
          sources.forEach((count, source) => {
            console.log(`${source}: ${count} proxies`);
          });
        }

        if (protocols.size > 0) {
          console.log('\n🔗 PROTOCOLS BREAKDOWN');
          console.log('====================');
          protocols.forEach((count, protocol) => {
            console.log(`${protocol.toUpperCase()}: ${count} proxies`);
          });
        }
      } catch (error) {
        // Ignore parsing errors for breakdown
      }
    }
  }

  /**
   * List proxies with enhanced filtering and information
   */
  private async listProxies(
    filter: 'all' | 'working' | 'failed' = 'all',
  ): Promise<void> {
    try {
      if (!fs.existsSync(config.proxyList)) {
        console.log('📭 No proxy file found');
        console.log('💡 Run "npm run proxy-fetch-only" first');
        return;
      }

      const data = JSON.parse(fs.readFileSync(config.proxyList, 'utf-8'));
      let proxies = Array.isArray(data) ? data : [];

      // Apply filter
      switch (filter) {
        case 'working':
          proxies = proxies.filter(p => p.isWorking === true);
          console.log(`\n✅ WORKING PROXIES (${proxies.length})`);
          break;
        case 'failed':
          proxies = proxies.filter(p => p.isWorking === false);
          console.log(`\n❌ FAILED PROXIES (${proxies.length})`);
          break;
        default:
          console.log(`\n🔗 ALL PROXIES (${proxies.length})`);
      }

      console.log('='.repeat(80));

      if (proxies.length === 0) {
        console.log('📭 No proxies match the filter criteria');
        if (filter === 'working') {
          console.log(
            '💡 Run "npm run proxy-test-only" to test existing proxies',
          );
        }
        return;
      }

      // Show enhanced proxy information
      proxies.forEach((proxy, index) => {
        const status =
          proxy.isWorking === true
            ? '✅'
            : proxy.isWorking === false
              ? '❌'
              : '❓';
        const responseTime = proxy.responseTime
          ? ` (${proxy.responseTime}ms)`
          : '';
        const protocol = proxy.protocol
          ? ` [${proxy.protocol.toUpperCase()}]`
          : '';
        const source = proxy.source ? ` from ${proxy.source}` : '';
        const country =
          proxy.country && proxy.country !== 'Unknown'
            ? ` - ${proxy.country}`
            : '';
        const lastTested = proxy.lastTested
          ? ` | Tested: ${new Date(proxy.lastTested).toLocaleString()}`
          : '';

        console.log(
          `${String(index + 1).padStart(3, ' ')}. ${status} ${proxy.proxyUrl}${protocol}${responseTime}${country}${source}${lastTested}`,
        );
      });

      // Show summary for working proxies
      if (filter === 'working' && proxies.length > 0) {
        const avgResponse =
          proxies.reduce((sum, p) => sum + (p.responseTime || 0), 0) /
          proxies.length;
        console.log(`\n📊 Average response time: ${Math.round(avgResponse)}ms`);
      }
    } catch (error) {
      console.error('❌ Error listing proxies:', error);
    }
  }

  /**
   * Enhanced clean operation
   */
  private async cleanProxies(): Promise<void> {
    try {
      console.log('🧹 Enhanced proxy cleaning...');

      if (!fs.existsSync(config.proxyList)) {
        console.log('📭 No proxy file found');
        return;
      }

      const data = JSON.parse(fs.readFileSync(config.proxyList, 'utf-8'));
      const allProxies = Array.isArray(data) ? data : [];

      const failed = allProxies.filter(p => p.isWorking === false);
      const working = allProxies.filter(p => p.isWorking === true);
      const untested = allProxies.filter(p => p.isWorking === undefined);

      console.log(
        `📊 Current state: ${working.length} working, ${failed.length} failed, ${untested.length} untested`,
      );

      if (failed.length === 0) {
        console.log('✨ No failed proxies to clean');
        return;
      }

      // Create backup
      const backupPath = config.proxyList.replace(
        '.json',
        '_backup_clean.json',
      );
      fs.writeFileSync(backupPath, JSON.stringify(allProxies, null, 2));

      // Keep working and untested proxies
      const cleanedProxies = [...working, ...untested];
      fs.writeFileSync(
        config.proxyList,
        JSON.stringify(cleanedProxies, null, 2),
      );

      console.log(`✅ Cleaned ${failed.length} failed proxies`);
      console.log(`📦 Backup created: ${backupPath}`);
      console.log(
        `🔗 Remaining: ${working.length} working + ${untested.length} untested = ${cleanedProxies.length} total`,
      );
    } catch (error) {
      console.error('❌ Error cleaning proxies:', error);
    }
  }

  /**
   * Enhanced reset with confirmation simulation
   */
  private async resetProxies(): Promise<void> {
    try {
      console.log('⚠️  DANGER: This will remove ALL proxies from the list!');
      console.log('📦 Creating backup before reset...');

      if (fs.existsSync(config.proxyList)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = config.proxyList.replace(
          '.json',
          `_backup_reset_${timestamp}.json`,
        );
        fs.copyFileSync(config.proxyList, backupPath);
        console.log(`📦 Backup created: ${backupPath}`);
      }

      fs.writeFileSync(config.proxyList, JSON.stringify([], null, 2));
      console.log('🗑️  Proxy list has been reset to empty');
      console.log(
        '💡 Run "npm run proxy-fetch-test" to rebuild your proxy list',
      );
    } catch (error) {
      console.error('❌ Error resetting proxies:', error);
    }
  }

  /**
   * Create enhanced backup
   */
  private async createBackup(): Promise<void> {
    try {
      if (!fs.existsSync(config.proxyList)) {
        console.log('📭 No proxy file to backup');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = config.proxyList.replace(
        '.json',
        `_backup_${timestamp}.json`,
      );

      fs.copyFileSync(config.proxyList, backupPath);
      console.log(`📦 Enhanced backup created: ${backupPath}`);

      // Show backup contents summary
      const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      const working = data.filter((p: any) => p.isWorking === true).length;
      console.log(
        `📊 Backed up: ${data.length} total proxies (${working} working)`,
      );
    } catch (error) {
      console.error('❌ Error creating backup:', error);
    }
  }

  /**
   * Enhanced restore
   */
  private async restoreBackup(): Promise<void> {
    try {
      const backupPath = config.proxyList.replace('.json', '_backup.json');

      if (!fs.existsSync(backupPath)) {
        console.log('❌ No standard backup file found');
        console.log('💡 Look for timestamped backups in your proxy directory');
        return;
      }

      // Show what will be restored
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      const workingInBackup = backupData.filter(
        (p: any) => p.isWorking === true,
      ).length;

      console.log(
        `📊 Restoring ${backupData.length} proxies (${workingInBackup} were working)`,
      );

      fs.copyFileSync(backupPath, config.proxyList);
      console.log('✅ Proxy list restored from backup');
      console.log('💡 Run "npm run proxy-stats" to see current status');
    } catch (error) {
      console.error('❌ Error restoring backup:', error);
    }
  }

  /**
   * Enhanced main CLI handler
   */
  public async run(args: string[]): Promise<void> {
    const command = args[0]?.toLowerCase();

    console.log(
      `🚀 Enhanced Proxy Manager CLI - ${new Date().toLocaleString()}\n`,
    );

    switch (command) {
      case 'fetch-only':
        await this.fetchOnly();
        break;

      case 'test-only':
        await this.testOnly();
        break;

      case 'fetch-test':
        await this.fetchAndTestAll();
        break;

      case 'stats':
        await this.showStats();
        break;

      case 'start':
        console.log('🚀 Starting automated enhanced proxy management...');
        await this.proxyManager.start();
        console.log(
          '✅ Enhanced proxy management started (press Ctrl+C to stop)',
        );

        // Keep the process alive
        process.on('SIGINT', () => {
          console.log('\n🛑 Stopping enhanced proxy management...');
          this.proxyManager.stop();
          process.exit(0);
        });

        // Wait indefinitely
        await new Promise(() => {});
        break;

      case 'list':
        await this.listProxies('all');
        break;

      case 'list-working':
        await this.listProxies('working');
        break;

      case 'list-failed':
        await this.listProxies('failed');
        break;

      case 'clean':
        await this.cleanProxies();
        break;

      case 'reset':
        await this.resetProxies();
        break;

      case 'backup':
        await this.createBackup();
        break;

      case 'restore':
        await this.restoreBackup();
        break;

      case 'help':
      case '-h':
      case '--help':
      default:
        this.showHelp();
        break;
    }
  }
}

// Main execution
if (require.main === module) {
  const cli = new EnhancedProxyCLI();
  const args = process.argv.slice(2);

  cli.run(args).catch(error => {
    console.error('❌ Enhanced CLI Error:', error);
    process.exit(1);
  });
}

export {EnhancedProxyCLI};
