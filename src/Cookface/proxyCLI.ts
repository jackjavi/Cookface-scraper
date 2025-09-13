#!/usr/bin/env node

import {ProxyManager} from './services/proxies/proxyManager';
import * as fs from 'fs';
import config from './config/index';

class ProxyCLI {
  private proxyManager: ProxyManager;

  constructor() {
    this.proxyManager = new ProxyManager({
      fetchInterval: 10 * 60 * 1000, // 10 minutes
      testInterval: 30 * 60 * 1000, // 30 minutes
      maxProxies: 100, // Higher limit for CLI
      minWorkingProxies: 5,
      proxyFilePath: config.proxyList,
      backupFilePath: config.proxyList.replace('.json', '_backup.json'),
    });
  }

  /**
   * Display help information
   */
  private showHelp(): void {
    console.log(`
🔗 Proxy Manager CLI Tool

Usage: npm run proxy-cli <command> [options]

Commands:
  fetch              Fetch fresh proxies and update the list
  test               Test existing proxies
  stats              Show proxy statistics
  start              Start automated proxy management
  stop               Stop automated proxy management
  list               List all proxies with status
  list-working       List only working proxies
  list-failed        List only failed proxies
  clean              Remove failed proxies from the list
  reset              Reset proxy list (remove all proxies)
  backup             Create backup of current proxy list
  restore            Restore from backup
  help, -h, --help   Show this help message

Examples:
  npm run proxy-cli fetch        # Fetch and update proxies once
  npm run proxy-cli test         # Test all existing proxies
  npm run proxy-cli stats        # Show detailed statistics
  npm run proxy-cli start        # Start continuous management
  npm run proxy-cli clean        # Remove non-working proxies
`);
  }

  /**
   * Display proxy statistics
   */
  private async showStats(): Promise<void> {
    console.log('📊 Fetching proxy statistics...\n');

    const stats = await this.proxyManager.getProxyStats();

    if (!stats) {
      console.log('❌ Could not load proxy statistics');
      return;
    }

    console.log('📈 PROXY STATISTICS');
    console.log('==================');
    console.log(`📊 Total Proxies:     ${stats.total}`);
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

    // Health assessment
    console.log('\n🏥 HEALTH ASSESSMENT');
    console.log('==================');

    if (stats.working === 0) {
      console.log('🔴 CRITICAL: No working proxies available!');
    } else if (stats.working < 5) {
      console.log('🟡 WARNING: Very few working proxies');
    } else if (stats.working < 10) {
      console.log('🟠 CAUTION: Limited working proxies');
    } else {
      console.log('🟢 GOOD: Sufficient working proxies');
    }

    if (stats.averageResponseTime > 5000) {
      console.log('🔴 SLOW: High average response time');
    } else if (stats.averageResponseTime > 3000) {
      console.log('🟡 MODERATE: Moderate response times');
    } else {
      console.log('🟢 FAST: Good response times');
    }
  }

  /**
   * List proxies with optional filtering
   */
  private async listProxies(
    filter: 'all' | 'working' | 'failed' = 'all',
  ): Promise<void> {
    try {
      if (!fs.existsSync(config.proxyList)) {
        console.log('📭 No proxy file found');
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

      console.log('='.repeat(60));

      if (proxies.length === 0) {
        console.log('📭 No proxies match the filter criteria');
        return;
      }

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
        const lastTested = proxy.lastTested
          ? ` | Last tested: ${new Date(proxy.lastTested).toLocaleString()}`
          : '';

        console.log(
          `${String(index + 1).padStart(3, ' ')}. ${status} ${proxy.proxyUrl}${responseTime}${lastTested}`,
        );
      });
    } catch (error) {
      console.error('❌ Error listing proxies:', error);
    }
  }

  /**
   * Clean failed proxies from the list
   */
  private async cleanProxies(): Promise<void> {
    try {
      console.log('🧹 Cleaning failed proxies...');

      if (!fs.existsSync(config.proxyList)) {
        console.log('📭 No proxy file found');
        return;
      }

      const data = JSON.parse(fs.readFileSync(config.proxyList, 'utf-8'));
      const allProxies = Array.isArray(data) ? data : [];
      const failedCount = allProxies.filter(p => p.isWorking === false).length;

      if (failedCount === 0) {
        console.log('✨ No failed proxies to clean');
        return;
      }

      // Keep only working and untested proxies
      const cleanedProxies = allProxies.filter(p => p.isWorking !== false);

      // Create backup first
      const backupPath = config.proxyList.replace(
        '.json',
        '_backup_clean.json',
      );
      fs.writeFileSync(backupPath, JSON.stringify(allProxies, null, 2));

      // Save cleaned list
      fs.writeFileSync(
        config.proxyList,
        JSON.stringify(cleanedProxies, null, 2),
      );

      console.log(`✅ Cleaned ${failedCount} failed proxies`);
      console.log(`📦 Backup created: ${backupPath}`);
      console.log(`🔗 Remaining proxies: ${cleanedProxies.length}`);
    } catch (error) {
      console.error('❌ Error cleaning proxies:', error);
    }
  }

  /**
   * Reset proxy list
   */
  private async resetProxies(): Promise<void> {
    try {
      console.log('⚠️  This will remove ALL proxies from the list!');

      // In a real CLI, you'd want to add confirmation prompt
      // For now, create backup first
      if (fs.existsSync(config.proxyList)) {
        const backupPath = config.proxyList.replace(
          '.json',
          '_backup_reset.json',
        );
        fs.copyFileSync(config.proxyList, backupPath);
        console.log(`📦 Backup created: ${backupPath}`);
      }

      fs.writeFileSync(config.proxyList, JSON.stringify([], null, 2));
      console.log('🗑️  Proxy list has been reset');
    } catch (error) {
      console.error('❌ Error resetting proxies:', error);
    }
  }

  /**
   * Create backup
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
      console.log(`📦 Backup created: ${backupPath}`);
    } catch (error) {
      console.error('❌ Error creating backup:', error);
    }
  }

  /**
   * Restore from backup
   */
  private async restoreBackup(): Promise<void> {
    try {
      const backupPath = config.proxyList.replace('.json', '_backup.json');

      if (!fs.existsSync(backupPath)) {
        console.log('❌ No backup file found');
        return;
      }

      fs.copyFileSync(backupPath, config.proxyList);
      console.log('✅ Proxy list restored from backup');
    } catch (error) {
      console.error('❌ Error restoring backup:', error);
    }
  }

  /**
   * Main CLI handler
   */
  public async run(args: string[]): Promise<void> {
    const command = args[0]?.toLowerCase();

    switch (command) {
      case 'fetch':
        console.log('🔄 Fetching fresh proxies...');
        await this.proxyManager.fetchAndUpdateProxies();
        break;

      /** case 'test':
        console.log('🧪 Testing existing proxies...');
        await this.proxyManager.testAllProxies();
        break; */

      case 'stats':
        await this.showStats();
        break;

      case 'start':
        console.log('🚀 Starting automated proxy management...');
        await this.proxyManager.start();
        console.log('✅ Proxy management started (press Ctrl+C to stop)');

        // Keep the process alive
        process.on('SIGINT', () => {
          console.log('\n🛑 Stopping proxy management...');
          this.proxyManager.stop();
          process.exit(0);
        });

        // Keep running
        await new Promise(() => {}); // Wait indefinitely
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
  const cli = new ProxyCLI();
  const args = process.argv.slice(2);

  cli.run(args).catch(error => {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  });
}

export {ProxyCLI};
