// ============================================================
// stealth/index.ts
// Mirrors TikTokApi/stealth/stealth.py + all JS scripts
//
// Injects anti-bot JavaScript into Playwright pages to make
// headless Chromium look like a real browser.
// ============================================================

import type { Page } from "playwright";

import { chrome_app } from './js/chrome_app';
import { chrome_csi } from './js/chrome_csi';
import { chrome_hairline } from './js/chrome_hairline';
import { chrome_load_times } from './js/chrome_load_times';
import { generate_magic_arrays } from './js/generate_magic_arrays';
import { iframe_contentWindow } from './js/iframe_contentWindow';
import { media_codecs } from './js/media_codecs';
import { navigator_hardwareConcurrency } from './js/navigator_hardwareConcurrency';
import { navigator_languages } from './js/navigator_languages';
import { navigator_permissions } from './js/navigator_permissions';
import { navigator_platform } from './js/navigator_platform';
import { navigator_plugins_script } from './js/navigator_plugins_script';
import { navigator_userAgent_script } from './js/navigator_userAgent_script';
import { navigator_vendor_script } from './js/navigator_vendor_script';
import { webgl_vendor_script } from './js/webgl_vendor_script';
import { window_outerdimensions } from './js/window_outerdimensions';
import { utils_script } from './js/utils_script';
import { chrome_runtime_script } from './js/chrome_runtime_script';

// ---------------------------------------------------------------------------
// All JS snippet strings (ported from Python string literals in stealth/js/*.py)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// StealthConfig interface + class (mirrors Python dataclass)
// ---------------------------------------------------------------------------

export interface StealthConfigOptions {
  webdriver?: boolean;
  webglVendor?: boolean;
  chromeApp?: boolean;
  chromeCsi?: boolean;
  chromeLoadTimes?: boolean;
  chromeRuntime?: boolean;
  iframeContentWindow?: boolean;
  mediaCodecs?: boolean;
  navigatorHardwareConcurrency?: number;
  navigatorLanguages?: boolean;
  navigatorPermissions?: boolean;
  navigatorPlatform?: boolean;
  navigatorPlugins?: boolean;
  navigatorUserAgent?: boolean;
  navigatorVendor?: boolean;
  outerdimensions?: boolean;
  hairline?: boolean;

  // Values
  vendor?: string;
  renderer?: string;
  navVendor?: string;
  navUserAgent?: string | null;
  navPlatform?: string | null;
  languages?: string[];
  runOnInsecureOrigins?: boolean | null;
}

export class StealthConfig {
  webdriver: boolean;
  webglVendor: boolean;
  chromeApp: boolean;
  chromeCsi: boolean;
  chromeLoadTimes: boolean;
  chromeRuntime: boolean;
  iframeContentWindow: boolean;
  mediaCodecs: boolean;
  navigatorHardwareConcurrency: number;
  navigatorLanguages: boolean;
  navigatorPermissions: boolean;
  navigatorPlatform: boolean;
  navigatorPlugins: boolean;
  navigatorUserAgent: boolean;
  navigatorVendor: boolean;
  outerdimensions: boolean;
  hairline: boolean;

  vendor: string;
  renderer: string;
  navVendor: string;
  navUserAgent: string | null;
  navPlatform: string | null;
  languages: string[];
  runOnInsecureOrigins: boolean | null;

  constructor(opts: StealthConfigOptions = {}) {
    this.webdriver = opts.webdriver ?? true;
    this.webglVendor = opts.webglVendor ?? true;
    this.chromeApp = opts.chromeApp ?? true;
    this.chromeCsi = opts.chromeCsi ?? true;
    this.chromeLoadTimes = opts.chromeLoadTimes ?? true;
    this.chromeRuntime = opts.chromeRuntime ?? true;
    this.iframeContentWindow = opts.iframeContentWindow ?? true;
    this.mediaCodecs = opts.mediaCodecs ?? true;
    this.navigatorHardwareConcurrency = opts.navigatorHardwareConcurrency ?? 4;
    this.navigatorLanguages = opts.navigatorLanguages ?? false;
    this.navigatorPermissions = opts.navigatorPermissions ?? true;
    this.navigatorPlatform = opts.navigatorPlatform ?? true;
    this.navigatorPlugins = opts.navigatorPlugins ?? true;
    this.navigatorUserAgent = opts.navigatorUserAgent ?? false;
    this.navigatorVendor = opts.navigatorVendor ?? false;
    this.outerdimensions = opts.outerdimensions ?? true;
    this.hairline = opts.hairline ?? true;

    this.vendor = opts.vendor ?? "Intel Inc.";
    this.renderer = opts.renderer ?? "Intel Iris OpenGL Engine";
    this.navVendor = opts.navVendor ?? "Google Inc.";
    this.navUserAgent = opts.navUserAgent ?? null;
    this.navPlatform = opts.navPlatform ?? null;
    this.languages = opts.languages ?? ["en-US", "en"];
    this.runOnInsecureOrigins = opts.runOnInsecureOrigins ?? null;
  }

  /**
   * Yields all enabled stealth script strings in the correct order.
   * Mirrors Python's `enabled_scripts` generator property.
   */
  *enabledScripts(): Generator<string> {
    const opts = JSON.stringify({
      webgl_vendor: this.vendor,
      webgl_renderer: this.renderer,
      navigator_vendor: this.navVendor,
      navigator_platform: this.navPlatform,
      navigator_user_agent: this.navUserAgent,
      languages: this.languages,
      runOnInsecureOrigins: this.runOnInsecureOrigins,
      navigator_hardware_concurrency: this.navigatorHardwareConcurrency,
    });

    yield `const opts = ${opts}`;
    yield utils_script;          // utils must come first
    yield generate_magic_arrays; // needed by navigator_plugins

    if (this.chromeApp) yield chrome_app;
    if (this.chromeCsi) yield chrome_csi;
    if (this.hairline) yield chrome_hairline;
    if (this.chromeLoadTimes) yield chrome_load_times;
    // chrome_runtime is defined inline below (it's long and uses opts)
    if (this.chromeRuntime) yield chrome_runtime_script;
    if (this.iframeContentWindow) yield iframe_contentWindow;
    if (this.mediaCodecs) yield media_codecs;
    if (this.navigatorLanguages) yield navigator_languages;
    if (this.navigatorPermissions) yield navigator_permissions;
    if (this.navigatorPlatform) yield navigator_platform;
    if (this.navigatorPlugins) yield navigator_plugins_script;
    if (this.navigatorUserAgent) yield navigator_userAgent_script;
    if (this.navigatorVendor) yield navigator_vendor_script;
    if (this.webdriver) yield `delete Object.getPrototypeOf(navigator).webdriver`;
    if (this.outerdimensions) yield window_outerdimensions;
    if (this.webglVendor) yield webgl_vendor_script;
  }
}

// ---------------------------------------------------------------------------
// stealth_async — main export (mirrors Python's stealth_async function)
// ---------------------------------------------------------------------------

/**
 * Inject stealth scripts into a Playwright page to evade bot detection.
 * Mirrors Python's `stealth_async(page, config)`.
 *
 * @example
 * ```ts
 * import { stealthAsync } from './stealth';
 * await stealthAsync(page);
 * ```
 */
export async function stealthAsync(
  page: Page,
  config?: StealthConfig
): Promise<void> {
  const cfg = config ?? new StealthConfig();
  for (const script of cfg.enabledScripts()) {
    await page.addInitScript(script);
  }
}
