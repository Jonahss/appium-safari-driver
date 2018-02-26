import { BaseDriver, JWProxy } from 'appium-base-driver';
import log from './logger';
import { retryInterval } from 'asyncbox';
import SafariDriverProc, { DEFAULT_PORT } from './safari';

class SafariDriver extends BaseDriver {

  constructor (opts = {}) {
    super(opts, false);
    this.safari = null;
    this.jwproxy = null;
    this.proxyReqRes = null;
    this.jwpProxyActive = false;
  }

  async createSession (...args) {
    let [sessionId, caps] = await super.createSession(...args);
    try {
      this.safari = new SafariDriverProc();
      await this.safari.start();

      const proxyOpts = {
        server: "localhost",
        port: DEFAULT_PORT,
        base: '',
        timeout: 300000,
      };
      this.jwproxy = new JWProxy(proxyOpts);
      await this.waitForSafariOnline();

      await this.jwproxy.command('/session', 'POST', {desiredCapabilities: caps});
      this.proxyReqRes = this.jwproxy.proxyReqRes.bind(this.jwproxy);
      this.jwpProxyActive = true;
      return [sessionId, caps];
    } catch (e) {
      await this.deleteSession();
      throw e;
    }
  }

  async waitForSafariOnline () {
    await retryInterval(10, 500, async () => {
      try {
        await this.jwproxy.command('/sessions', 'GET');
      } catch (e) {
        // safaridriver doesn't support GET /sessions, but we can still use the
        // fact that it will give us an error response to determine that it is
        // alive
        if (e.message.indexOf("command 'GET /sessions' was not found") === -1) {
          throw e;
        }
      }
    });
  }

  async unexpectedExitHandler () {
    await this.deleteSession();
  }

  async deleteSession () {
    log.info("Ending Safari session");
    await super.deleteSession();
    try {
      await this.safari.stop();
    } catch (e) {
      log.warn(`Encountered and ignored error trying to end session: ${e}`);
    }
    this.jwpProxyActive = false;
    this.safari = null;
    this.jwproxy = null;
    this.proxyReqRes = null;
  }


  proxyActive () {
    return this.jwpProxyActive;
  }

  getProxyAvoidList () {
    return [];
  }

  canProxy () {
    return true;
  }
}

export default SafariDriver;