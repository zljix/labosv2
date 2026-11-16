let serial = 0;
export class Session {
  constructor(factory, machine, code, config = {}, observe = (_event) => {}, files = {}) {
    this.id = ++serial;
    this.events = [];
    this.listeners = new Set();
    this.text = '';
    this.status = 'loading';
    this.worker = factory();
    this.stopped = false;
    this.worker.onmessage = ({ data }) => {
      if (this.stopped || data.session !== this.id) return;
      if (this.events.length >= 400) this.events.shift();
      this.events.push(data);
      if (data.type === 'console') this.text = (this.text + data.text).slice(-64000);
      if (data.type === 'ready') this.status = 'running';
      if (data.type === 'done' || data.type === 'error') this.status = data.type;
      observe(data);
      for (const fn of this.listeners) fn();
    };
    this.worker.onerror = (error) => {
      if (this.stopped) return;
      this.status = 'error';
      const data = { type: 'error', message: String(error.message ?? error) };
      this.events.push(data);
      observe(data);
      for (const fn of this.listeners) fn();
    };
    this.worker.postMessage({ type: 'run', session: this.id, machine, code, config, files });
  }
  input(data) { if (!this.stopped) this.worker.postMessage({ type: 'input', ...data }); }
  wait(predicate, timeout = 6000) {
    if (predicate(this)) return Promise.resolve(this);
    return new Promise((resolve, reject) => {
      const finish = () => {
        if (!predicate(this)) return;
        clearTimeout(timer);
        this.listeners.delete(finish);
        resolve(this);
      };
      const timer = setTimeout(() => {
        this.listeners.delete(finish);
        reject(new Error(`Timeout (${timeout} ms), status=${this.status}; ${this.text.slice(-600)}`));
      }, timeout);
      this.listeners.add(finish);
    });
  }
  async stop() {
    if (this.stopped) return 0;
    this.stopped = true;
    const start = performance.now();
    await this.worker.terminate();
    this.listeners.clear();
    return performance.now() - start;
  }
}
