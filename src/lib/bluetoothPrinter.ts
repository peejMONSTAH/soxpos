/**
 * Web Bluetooth Thermal Printer Driver & Communication Service
 * Supports Google Chrome on Android, Windows, macOS, and Linux
 */

// Common Bluetooth GATT Service UUIDs for thermal ESC/POS printers
export const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Thermal Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 / Goojprt / MPT / Xprinter
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // PosPrinter UUID
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Serial BLE
  '0000ff00-0000-1000-8000-00805f9b34fb', // ESC/POS Generic BLE Service
  '0000af30-0000-1000-8000-00805f9b34fb', // Additional Chinese OEM BLE Service
];

export interface BluetoothPrinterState {
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  deviceName: string | null;
  deviceId: string | null;
  error: string | null;
}

class BluetoothPrinterService {
  private device: any = null;
  private server: any = null;
  private writeCharacteristic: any = null;
  private listeners: Set<(state: BluetoothPrinterState) => void> = new Set();

  private state: BluetoothPrinterState = {
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
    deviceName: null,
    deviceId: null,
    error: null,
  };

  /**
   * Check if Web Bluetooth is supported in the current environment
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'bluetooth' in navigator &&
      typeof (navigator as any).bluetooth?.requestDevice === 'function'
    );
  }

  public getState(): BluetoothPrinterState {
    return { ...this.state };
  }

  public subscribe(callback: (state: BluetoothPrinterState) => void): () => void {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  private updateState(partial: Partial<BluetoothPrinterState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((cb) => cb(this.getState()));
  }

  /**
   * Scan and connect to a Bluetooth thermal printer
   */
  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      const errMsg = 'Web Bluetooth is not supported in this browser. Please use Google Chrome.';
      this.updateState({ error: errMsg, isConnecting: false });
      throw new Error(errMsg);
    }

    try {
      this.updateState({ isConnecting: true, error: null });

      const navBluetooth = (navigator as any).bluetooth;

      // Request device from user pairing dialog
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS,
      });

      if (!device) {
        throw new Error('No device selected');
      }

      this.device = device;
      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      // Connect to GATT Server
      const server = await this.device.gatt.connect();
      this.server = server;

      // Discover writable characteristic
      const characteristic = await this.findWritableCharacteristic(server);
      if (!characteristic) {
        throw new Error('Could not find a writable printer channel on this device');
      }

      this.writeCharacteristic = characteristic;

      this.updateState({
        isConnected: true,
        isConnecting: false,
        deviceName: device.name || 'Bluetooth Thermal Printer',
        deviceId: device.id,
        error: null,
      });

      return true;
    } catch (err: any) {
      // User cancelled picker or connection failed
      const msg = err?.name === 'NotFoundError' ? 'Pairing cancelled' : (err?.message || 'Failed to connect');
      this.updateState({
        isConnected: false,
        isConnecting: false,
        error: msg,
      });
      if (err?.name !== 'NotFoundError') {
        throw err;
      }
      return false;
    }
  }

  /**
   * Find a writable characteristic across known printer services
   */
  private async findWritableCharacteristic(server: any): Promise<any> {
    for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();

        for (const char of characteristics) {
          const props = char.properties;
          if (props.write || props.writeWithoutResponse) {
            return char;
          }
        }
      } catch {
        // Continue searching other services
      }
    }

    // Fallback: search all available primary services
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            const props = char.properties;
            if (props.write || props.writeWithoutResponse) {
              return char;
            }
          }
        } catch {
          // Ignore service errors
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Reconnect to the currently paired device if available
   */
  public async reconnect(): Promise<boolean> {
    if (!this.device || !this.device.gatt) return false;
    if (this.device.gatt.connected && this.writeCharacteristic) return true;

    try {
      this.updateState({ isConnecting: true });
      const server = await this.device.gatt.connect();
      this.server = server;
      const char = await this.findWritableCharacteristic(server);
      if (!char) throw new Error('Printer channel not found');
      this.writeCharacteristic = char;
      this.updateState({ isConnected: true, isConnecting: false, error: null });
      return true;
    } catch (err: any) {
      this.updateState({ isConnected: false, isConnecting: false, error: err?.message || 'Reconnect failed' });
      return false;
    }
  }

  /**
   * Disconnect from the Bluetooth printer
   */
  public disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.onDisconnected();
  }

  private onDisconnected() {
    this.writeCharacteristic = null;
    this.server = null;
    this.updateState({
      isConnected: false,
      isConnecting: false,
      isPrinting: false,
    });
  }

  /**
   * Send raw ESC/POS binary data to the printer in small chunked batches
   * with throttle delay to prevent buffer overflows on Bluetooth thermal printers.
   */
  public async printBytes(bytes: Uint8Array, chunkSize = 100): Promise<void> {
    if (!this.state.isConnected || !this.writeCharacteristic) {
      // Try to reconnect once
      const ok = await this.reconnect();
      if (!ok) {
        throw new Error('Printer is not connected via Bluetooth');
      }
    }

    this.updateState({ isPrinting: true });

    try {
      const totalLen = bytes.length;
      const char = this.writeCharacteristic;

      for (let offset = 0; offset < totalLen; offset += chunkSize) {
        const chunk = bytes.slice(offset, Math.min(offset + chunkSize, totalLen));

        if (char.properties.writeWithoutResponse) {
          await char.writeValueWithoutResponse(chunk);
        } else {
          await char.writeValue(chunk);
        }

        // 15ms breathing delay between packets for budget thermal printer hardware
        if (offset + chunkSize < totalLen) {
          await new Promise((res) => setTimeout(res, 15));
        }
      }
    } finally {
      this.updateState({ isPrinting: false });
    }
  }
}

export const bluetoothPrinterService = new BluetoothPrinterService();
