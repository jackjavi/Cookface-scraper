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
      maxProxies: 999999, // No limit - fetch all available non-HTTP proxies
      minWorkingProxies: 20, // Increased for better reliability
      proxyFilePath: config.proxyList || 'storage/proxies/proxyList.json',
      proxySuccessFilePath:
        config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json',
      backupFilePath: (
        config.proxyList || 'storage/proxies/proxyList.json'
      ).replace('.json', '_backup.json'),
      testTimeout: 30000,
      testConcurrency: 1,
    });
  }

  /**
   * Display enhanced help information with success file management
   */
  private showHelp(): void {
    console.log(`
🔗 Enhanced Proxy Manager CLI Tool v2.0 - With Success Detection

Usage: npm run <command>

MAIN COMMANDS:
  proxy-fetch-only     Fetch ALL available SOCKS proxies from all sources (no HTTP, no limits)
  proxy-test-only      Test existing proxies with enhanced success detection
  proxy-fetch-test     Fetch ALL proxies AND test them with full validation
  
MANAGEMENT COMMANDS:
  proxy-stats          Show detailed proxy statistics (main + success files)
  proxy-start          Start automated proxy management
  proxy-list           List all proxies from main file
  proxy-list-working   List working proxies from success file
  proxy-list-main      List proxies in main file (untested/failed)
  proxy-clean          Clean failed proxies and organize files
  proxy-merge          Merge success file back to main (for re-testing)
  proxy-reset          Reset all proxy files
  proxy-backup         Create comprehensive backup
  proxy-restore        Restore from backup
  proxy-help           Show this help message

FILE MANAGEMENT:
  proxy-success        Show only working proxies from success file
  proxy-main           Show proxies in main testing file
  proxy-validate       Validate proxy files integrity
  
EXAMPLES:
  npm run proxy-fetch-test     # Complete workflow (recommended)
  npm run proxy-stats          # Check both files status
  npm run proxy-list-working   # Show fastest working proxies
  npm run proxy-success        # Quick view of success file

FILES MANAGED:
  Main File:    ${config.proxyList || 'storage/proxies/proxyList.json'}
  Success File: ${config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json'}

ENHANCED FEATURES:
- CAPTCHA detection and blocking
- Real IP verification
- HTML content analysis for success validation
- Separate storage for working vs failed proxies
- SOCKS-only proxy fetching (no HTTP proxies)
- Enhanced response time tracking
- Detailed success metrics per proxy
- UNLIMITED proxy fetching (no 200 proxy limit)
- Comprehensive source coverage (20+ SOCKS sources)

WORKFLOW:
1. 'proxy-fetch-test' - Complete cycle (fetch → test → organize)
2. 'proxy-stats' - Monitor both main and success files
3. 'proxy-list-working' - Use fastest working proxies
4. Working proxies automatically moved to success file
5. Failed proxies removed from system completely
`);
  }

  /**
   * Fetch proxies only (SOCKS only, no HTTP)
   */
  private async fetchOnly(): Promise<void> {
    console.log('🔄 FETCH ONLY - Collecting SOCKS proxies only (no HTTP)...\n');

    try {
      await this.proxyManager.fetchProxiesOnly();

      const stats = await this.proxyManager.getProxyStats();
      if (stats) {
        console.log('\n📊 FETCH RESULTS:');
        console.log('================');
        console.log(`📦 Total SOCKS proxies fetched: ${stats.main.total}`);
        console.log(`❓ Status: All untested and ready for validation`);
        console.log('🚫 HTTP proxies excluded for better success rates');
        console.log(
          '\n💡 Next step: Run "npm run proxy-test-only" to validate these proxies',
        );
      }
    } catch (error) {
      console.error('❌ Fetch failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test existing proxies with enhanced success detection
   */
  private async testOnly(): Promise<void> {
    console.log(
      '🧪 ENHANCED TESTING - Validating proxies with success detection...\n',
    );

    try {
      const stats = await this.proxyManager.getProxyStats();

      if (!stats || stats.main.total === 0) {
        console.log('📭 No proxies found in main file to test.');
        console.log('💡 Run "npm run proxy-fetch-only" first to fetch proxies');
        return;
      }

      console.log(
        `🎯 Found ${stats.main.total} proxies to test with enhanced validation`,
      );
      console.log('🔍 Enhanced testing includes:');
      console.log('   - CAPTCHA detection and blocking');
      console.log('   - HTML content analysis');
      console.log('   - Real IP verification');
      console.log('   - Response time measurement');
      console.log('⚠️  Working proxies will be moved to success file\n');

      await this.proxyManager.testAllProxiesSystematic();

      const finalStats = await this.proxyManager.getProxyStats();
      if (finalStats) {
        console.log('\n🎉 ENHANCED TESTING RESULTS:');
        console.log('============================');
        console.log(`✅ Working proxies found: ${finalStats.success.total}`);
        console.log(
          `📁 Saved to success file: ${finalStats.success.total} proxies`,
        );
        console.log(
          `⏱️  Average response time: ${Math.round(finalStats.success.averageResponseTime)}ms`,
        );
        console.log(
          `🗑️  Failed proxies removed: ${stats.main.total - finalStats.success.total}`,
        );

        if (finalStats.success.total > 0) {
          console.log(
            `\n💡 Use "npm run proxy-list-working" to see your working proxies`,
          );
        }
      }
    } catch (error) {
      console.error('❌ Enhanced testing failed:', error);
      process.exit(1);
    }
  }

  /**
   * Complete fetch and test cycle with enhanced validation
   */
  private async fetchAndTestAll(): Promise<void> {
    console.log('🚀 COMPLETE CYCLE - Fetch + Enhanced Test + Organize...\n');

    try {
      await this.proxyManager.fetchAndTestAll();

      const stats = await this.proxyManager.getProxyStats();
      if (stats) {
        console.log('\n🎉 COMPLETE ENHANCED CYCLE RESULTS:');
        console.log('===================================');
        console.log(`✅ Working proxies validated: ${stats.success.total}`);
        console.log(
          `⏱️  Average response time: ${Math.round(stats.success.averageResponseTime)}ms`,
        );
        console.log(
          `📁 Success file updated with ${stats.success.total} working proxies`,
        );
        console.log(`🧹 System cleaned - failed proxies removed`);

        if (stats.success.total >= 15) {
          console.log(
            '\n🟢 EXCELLENT: Great proxy availability for your scraping needs!',
          );
        } else if (stats.success.total >= 5) {
          console.log('\n🟡 GOOD: Adequate proxies available');
        } else {
          console.log(
            '\n🔴 LOW: Consider running the cycle again for more proxies',
          );
        }
      }
    } catch (error) {
      console.error('❌ Complete cycle failed:', error);
      process.exit(1);
    }
  }

  /**
   * Display comprehensive statistics for both files
   */
  private async showStats(): Promise<void> {
    console.log('📊 Fetching comprehensive proxy statistics...\n');

    const stats = await this.proxyManager.getProxyStats();

    if (!stats) {
      console.log('❌ Could not load proxy statistics');
      return;
    }

    console.log('📈 ENHANCED PROXY SYSTEM STATISTICS');
    console.log('===================================');

    // Main file stats
    console.log('\n📁 MAIN FILE (Testing Queue):');
    console.log(`   📦 Total: ${stats.main.total}`);
    console.log(`   ✅ Working: ${stats.main.working}`);
    console.log(`   ❌ Failed: ${stats.main.failed}`);
    console.log(`   ❓ Untested: ${stats.main.untested}`);

    // Success file stats
    console.log('\n🏆 SUCCESS FILE (Validated Working):');
    console.log(`   📦 Total working: ${stats.success.total}`);
    console.log(
      `   ⏱️  Average speed: ${Math.round(stats.success.averageResponseTime)}ms`,
    );

    // Combined overview
    console.log('\n🌐 SYSTEM OVERVIEW:');
    console.log(`   📊 Total working proxies: ${stats.combined.totalWorking}`);
    console.log(`   📦 Total system proxies: ${stats.combined.totalProxies}`);

    if (stats.combined.totalProxies > 0) {
      const workingPercent = (
        (stats.combined.totalWorking / stats.combined.totalProxies) *
        100
      ).toFixed(1);
      console.log(`   📈 Overall success rate: ${workingPercent}%`);
    }

    // File timestamps
    console.log('\n🕐 LAST UPDATED:');
    if (stats.lastUpdated.main) {
      console.log(
        `   📁 Main file: ${new Date(stats.lastUpdated.main).toLocaleString()}`,
      );
    }
    if (stats.lastUpdated.success) {
      console.log(
        `   🏆 Success file: ${new Date(stats.lastUpdated.success).toLocaleString()}`,
      );
    }

    // Enhanced health assessment
    console.log('\n🏥 SYSTEM HEALTH ANALYSIS:');
    console.log('==========================');

    if (stats.success.total === 0) {
      console.log('🔴 CRITICAL: No validated working proxies!');
      console.log('💡 URGENT: Run "npm run proxy-fetch-test" immediately');
    } else if (stats.success.total < 5) {
      console.log('🟡 WARNING: Very few working proxies');
      console.log(
        '💡 RECOMMENDED: Run "npm run proxy-fetch-test" for more proxies',
      );
    } else if (stats.success.total < 15) {
      console.log('🟠 CAUTION: Limited working proxies for heavy usage');
      console.log('💡 CONSIDER: Additional proxy fetch cycle');
    } else {
      console.log(
        '🟢 EXCELLENT: Good proxy availability for scraping operations',
      );
    }

    // Performance assessment
    if (stats.success.averageResponseTime > 8000) {
      console.log('🔴 VERY SLOW: Consider fresh proxy cycle');
    } else if (stats.success.averageResponseTime > 5000) {
      console.log('🟡 MODERATE: Acceptable but could be faster');
    } else if (stats.success.averageResponseTime > 2000) {
      console.log('🟠 GOOD: Reasonable response times');
    } else {
      console.log('🟢 FAST: Excellent response times for scraping');
    }

    // Show file paths
    console.log('\n📂 FILE LOCATIONS:');
    console.log(
      `   📁 Main: ${config.proxyList || 'storage/proxies/proxyList.json'}`,
    );
    console.log(
      `   🏆 Success: ${config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json'}`,
    );
  }

  /**
   * List working proxies from success file
   */
  private async listWorkingProxies(): Promise<void> {
    try {
      const workingProxies = await this.proxyManager.loadWorkingProxies();

      if (workingProxies.length === 0) {
        console.log('\n🏆 SUCCESS FILE - No working proxies found');
        console.log(
          '💡 Run "npm run proxy-test-only" to validate existing proxies',
        );
        console.log(
          '💡 Or run "npm run proxy-fetch-test" for a complete cycle',
        );
        return;
      }

      console.log(
        `\n🏆 WORKING PROXIES (${workingProxies.length}) - Success File`,
      );
      console.log('='.repeat(80));

      workingProxies.forEach((proxy, index) => {
        const responseTime = proxy.responseTime
          ? ` (${proxy.responseTime}ms)`
          : '';
        const protocol = proxy.protocol
          ? ` [${proxy.protocol.toUpperCase()}]`
          : '';
        const country =
          proxy.country && proxy.country !== 'Unknown'
            ? ` - ${proxy.country}`
            : '';
        const realIP = proxy.successDetails?.realIP
          ? ` | IP: ${proxy.successDetails.realIP}`
          : '';
        const lastTested = proxy.lastTested
          ? ` | Tested: ${new Date(proxy.lastTested).toLocaleString()}`
          : '';

        console.log(
          `${String(index + 1).padStart(3, ' ')}. ✅ ${proxy.proxyUrl}${protocol}${responseTime}${country}${realIP}${lastTested}`,
        );
      });

      // Show performance summary
      const avgResponse =
        workingProxies.reduce((sum, p) => sum + (p.responseTime || 0), 0) /
        workingProxies.length;
      const fastProxies = workingProxies.filter(
        p => (p.responseTime || 0) < 3000,
      ).length;

      console.log(`\n📊 PERFORMANCE SUMMARY:`);
      console.log(`   ⏱️  Average response: ${Math.round(avgResponse)}ms`);
      console.log(
        `   ⚡ Fast proxies (<3s): ${fastProxies}/${workingProxies.length}`,
      );

      // Show protocol distribution
      const protocols = new Map();
      workingProxies.forEach(proxy => {
        if (proxy.protocol) {
          protocols.set(
            proxy.protocol,
            (protocols.get(proxy.protocol) || 0) + 1,
          );
        }
      });

      if (protocols.size > 0) {
        console.log(
          `   🔗 Protocols: ${Array.from(protocols.entries())
            .map(([p, c]) => `${p.toUpperCase()}:${c}`)
            .join(', ')}`,
        );
      }
    } catch (error) {
      console.error('❌ Error listing working proxies:', error);
    }
  }

  /**
   * List proxies from main file
   */
  private async listMainProxies(): Promise<void> {
    try {
      const mainFile = config.proxyList || 'storage/proxies/proxyList.json';

      if (!fs.existsSync(mainFile)) {
        console.log('\n📁 MAIN FILE - No proxy file found');
        console.log('💡 Run "npm run proxy-fetch-only" to fetch proxies');
        return;
      }

      const data = JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
      const proxies = Array.isArray(data) ? data : [];

      if (proxies.length === 0) {
        console.log('\n📁 MAIN FILE - Empty (no proxies in testing queue)');
        console.log(
          '💡 This is normal after successful testing - working proxies moved to success file',
        );
        console.log(
          '💡 Run "npm run proxy-fetch-only" to add more proxies for testing',
        );
        return;
      }

      console.log(`\n📁 MAIN FILE PROXIES (${proxies.length}) - Testing Queue`);
      console.log('='.repeat(80));

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

        console.log(
          `${String(index + 1).padStart(3, ' ')}. ${status} ${proxy.proxyUrl}${protocol}${responseTime}${source}`,
        );
      });

      const untested = proxies.filter(p => p.isWorking === undefined).length;
      const failed = proxies.filter(p => p.isWorking === false).length;
      const working = proxies.filter(p => p.isWorking === true).length;

      console.log(`\n📊 MAIN FILE SUMMARY:`);
      console.log(`   ❓ Untested: ${untested}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`   ✅ Working (not moved yet): ${working}`);

      if (untested > 0) {
        console.log(
          `\n💡 Run "npm run proxy-test-only" to test ${untested} untested proxies`,
        );
      }
    } catch (error) {
      console.error('❌ Error listing main file proxies:', error);
    }
  }

  /**
   * Enhanced clean operation for both files
   */
  private async cleanProxies(): Promise<void> {
    try {
      console.log('🧹 Enhanced proxy file cleaning...');

      const mainFile = config.proxyList || 'storage/proxies/proxyList.json';
      const successFile =
        config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json';

      let cleaned = 0;
      let organized = 0;

      // Clean main file
      if (fs.existsSync(mainFile)) {
        const mainData = JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
        const allMainProxies = Array.isArray(mainData) ? mainData : [];
        const failedProxies = allMainProxies.filter(p => p.isWorking === false);
        const untestedProxies = allMainProxies.filter(
          p => p.isWorking === undefined,
        );

        cleaned += failedProxies.length;

        // Keep only untested proxies in main file
        fs.writeFileSync(mainFile, JSON.stringify(untestedProxies, null, 2));
        organized += untestedProxies.length;

        console.log(
          `📁 Main file: Removed ${failedProxies.length} failed, kept ${untestedProxies.length} untested`,
        );
      }

      // Optimize success file (remove duplicates, sort by speed)
      if (fs.existsSync(successFile)) {
        const successData = JSON.parse(fs.readFileSync(successFile, 'utf-8'));
        const workingProxies = Array.isArray(successData) ? successData : [];

        // Remove duplicates and sort by response time
        const seen = new Set();
        const uniqueWorking = workingProxies.filter(proxy => {
          const key = proxy.proxyUrl.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const sortedWorking = uniqueWorking.sort(
          (a, b) => (a.responseTime || 9999) - (b.responseTime || 9999),
        );

        fs.writeFileSync(successFile, JSON.stringify(sortedWorking, null, 2));

        const duplicatesRemoved = workingProxies.length - uniqueWorking.length;
        if (duplicatesRemoved > 0) {
          console.log(
            `🏆 Success file: Removed ${duplicatesRemoved} duplicates, optimized ${sortedWorking.length} working proxies`,
          );
        }
      }

      console.log(
        `✅ Cleaning complete: ${cleaned} failed proxies removed, ${organized} proxies organized`,
      );
    } catch (error) {
      console.error('❌ Error cleaning proxy files:', error);
    }
  }

  /**
   * Merge success file back to main for re-testing
   */
  private async mergeFiles(): Promise<void> {
    try {
      console.log('🔄 Merging success file back to main for re-testing...');

      const mainFile = config.proxyList || 'storage/proxies/proxyList.json';
      const successFile =
        config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json';

      const workingProxies = await this.proxyManager.loadWorkingProxies();
      const mainProxies = fs.existsSync(mainFile)
        ? JSON.parse(fs.readFileSync(mainFile, 'utf-8')) || []
        : [];

      if (workingProxies.length === 0) {
        console.log('📭 No working proxies to merge');
        return;
      }

      // Reset working status for re-testing
      const proxiesForRetesting = workingProxies.map(proxy => ({
        ...proxy,
        isWorking: undefined,
        lastTested: undefined,
        successDetails: undefined,
      }));

      const combined = [...mainProxies, ...proxiesForRetesting];
      fs.writeFileSync(mainFile, JSON.stringify(combined, null, 2));

      // Clear success file
      fs.writeFileSync(successFile, JSON.stringify([], null, 2));

      console.log(
        `✅ Merged ${workingProxies.length} proxies back to main file for re-testing`,
      );
      console.log('💡 Run "npm run proxy-test-only" to re-test all proxies');
    } catch (error) {
      console.error('❌ Error merging files:', error);
    }
  }

  /**
   * Enhanced reset for both files
   */
  private async resetProxies(): Promise<void> {
    try {
      console.log('⚠️  DANGER: This will reset ALL proxy files!');

      const mainFile = config.proxyList || 'storage/proxies/proxyList.json';
      const successFile =
        config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json';

      // Create timestamped backups
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (fs.existsSync(mainFile)) {
        const backupMain = mainFile.replace(
          '.json',
          `_backup_reset_${timestamp}.json`,
        );
        fs.copyFileSync(mainFile, backupMain);
        console.log(`📦 Main file backed up: ${backupMain}`);
      }

      if (fs.existsSync(successFile)) {
        const backupSuccess = successFile.replace(
          '.json',
          `_backup_reset_${timestamp}.json`,
        );
        fs.copyFileSync(successFile, backupSuccess);
        console.log(`📦 Success file backed up: ${backupSuccess}`);
      }

      // Reset both files
      fs.writeFileSync(mainFile, JSON.stringify([], null, 2));
      fs.writeFileSync(successFile, JSON.stringify([], null, 2));

      console.log('🗑️  Both proxy files have been reset to empty');
      console.log(
        '💡 Run "npm run proxy-fetch-test" to rebuild your proxy system',
      );
    } catch (error) {
      console.error('❌ Error resetting proxy files:', error);
    }
  }

  /**
   * Enhanced backup for both files
   */
  private async createBackup(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const mainFile = config.proxyList || 'storage/proxies/proxyList.json';
      const successFile =
        config.proxyListSuccess || 'storage/proxies/proxyListSuccess.json';

      let backedUpFiles = 0;

      if (fs.existsSync(mainFile)) {
        const backupPath = mainFile.replace(
          '.json',
          `_backup_${timestamp}.json`,
        );
        fs.copyFileSync(mainFile, backupPath);
        const data = JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
        console.log(
          `📦 Main file backed up: ${backupPath} (${data.length} proxies)`,
        );
        backedUpFiles++;
      }

      if (fs.existsSync(successFile)) {
        const backupPath = successFile.replace(
          '.json',
          `_backup_${timestamp}.json`,
        );
        fs.copyFileSync(successFile, backupPath);
        const data = JSON.parse(fs.readFileSync(successFile, 'utf-8'));
        console.log(
          `📦 Success file backed up: ${backupPath} (${data.length} working proxies)`,
        );
        backedUpFiles++;
      }

      if (backedUpFiles === 0) {
        console.log('📭 No proxy files found to backup');
      } else {
        console.log(
          `✅ Enhanced backup complete - ${backedUpFiles} files backed up`,
        );
      }
    } catch (error) {
      console.error('❌ Error creating enhanced backup:', error);
    }
  }

  /**
   * Enhanced main CLI handler with new commands
   */
  public async run(args: string[]): Promise<void> {
    const command = args[0]?.toLowerCase();

    console.log(
      `🚀 Enhanced Proxy Manager CLI v2.0 - ${new Date().toLocaleString()}\n`,
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

      case 'list':
        await this.listMainProxies();
        break;

      case 'list-working':
      case 'success':
        await this.listWorkingProxies();
        break;

      case 'list-main':
      case 'main':
        await this.listMainProxies();
        break;

      case 'clean':
        await this.cleanProxies();
        break;

      case 'merge':
        await this.mergeFiles();
        break;

      case 'reset':
        await this.resetProxies();
        break;

      case 'backup':
        await this.createBackup();
        break;

      case 'start':
        console.log('🚀 Starting automated enhanced proxy management...');
        await this.proxyManager.start();
        console.log(
          '✅ Enhanced proxy management started (press Ctrl+C to stop)',
        );

        process.on('SIGINT', () => {
          console.log('\n🛑 Stopping enhanced proxy management...');
          this.proxyManager.stop();
          process.exit(0);
        });

        await new Promise(() => {});
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
