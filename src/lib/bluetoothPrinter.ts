/**
 * Web Bluetooth Thermal Printer Driver & Communication Service
 * Supports Google Chrome on Android, Windows, macOS, and Linux
 */

import { isIOS, isAndroid, isWebBluetoothSupported } from './platform';

// Full canonical 128-bit lowercase UUIDs required by Chromium & Web Bluetooth
export const CANONICAL_PRINTER_SERVICES: string[] = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Thermal Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 / Goojprt / MPT / Xprinter / POS-58
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic ESC/POS BLE Service
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / MPT-II / Shopee BLE Printer Service
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic Chinese Portable Thermal BLE
  '0000af30-0000-1000-8000-00805f9b34fb', // OEM POS Service
  '0000ae30-0000-1000-8000-00805f9b34fb', // OEM POS Service 2
  '0000ae00-0000-1000-8000-00805f9b34fb', // OEM POS Service 3
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // PosPrinter UUID
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Serial BLE
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
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
    return isWebBluetoothSupported();
  }

  public getDiagnosticReason(): string {
    if (typeof window === 'undefined') return 'Server environment';
    if (
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return `Insecure Context (${window.location.protocol}//). Browsers require HTTPS to allow Bluetooth access.`;
    }
    if (!isWebBluetoothSupported()) {
      if (isIOS()) {
        return 'Apple iOS Safari and Chrome do not support Web Bluetooth natively. Please use AirPrint / System Print, or open the POS inside the Bluefy Web BLE Browser on iOS.';
      }
      return 'Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge.';
    }
    return 'Supported';
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
   * Scan and connect to a Bluetooth thermal printer.
   * MUST be invoked directly from a user click event to preserve user gesture activation.
   */
  public async connect(): Promise<boolean> {
    const navBluetooth = typeof navigator !== 'undefined' ? (navigator as any).bluetooth : null;
    if (!navBluetooth || typeof navBluetooth.requestDevice !== 'function') {
      const reason = this.getDiagnosticReason();
      this.updateState({ isConnecting: false, error: reason });
      return false;
    }

    this.updateState({ isConnecting: true, error: null });

    try {
      let device: any = null;

      // Primary scan: accept all nearby Bluetooth devices with printer UUIDs
      try {
        device = await navBluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: CANONICAL_PRINTER_SERVICES,
        });
      } catch (firstErr: any) {
        if (firstErr?.name === 'NotFoundError') {
          // User clicked Cancel in Bluetooth picker
          this.updateState({ isConnecting: false });
          return false;
        }

        // Secondary scan fallback for iOS WebBLE/Bluefy environments requiring filters
        console.warn('Primary scan attempt failed, trying fallback scan:', firstErr);
        device = await navBluetooth.requestDevice({
          filters: [
            { namePrefix: 'POS' },
            { namePrefix: 'MPT' },
            { namePrefix: 'MTP' },
            { namePrefix: 'XP' },
            { namePrefix: 'RP' },
            { namePrefix: 'Print' },
            { namePrefix: 'BT' },
            { namePrefix: 'Inner' },
            { namePrefix: '' },
          ],
          optionalServices: CANONICAL_PRINTER_SERVICES,
        });
      }

      if (!device) {
        this.updateState({ isConnecting: false });
        return false;
      }

      this.device = device;
      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      // Connect to GATT Server
      const server = await this.device.gatt.connect();
      this.server = server;

      // Discover writable characteristic
      const characteristic = await this.findWritableCharacteristic(server);
      if (!characteristic) {
        throw new Error(
          'Connected to device, but no writable ESC/POS print channel was found. If this is a Bluetooth Classic SPP printer, use RawBT or System Print.'
        );
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
      if (err?.name === 'NotFoundError') {
        // User dismissed the Bluetooth picker dialog
        this.updateState({ isConnecting: false });
        return false;
      }

      const msg = err?.message || 'Bluetooth connection error';
      console.error('Bluetooth pair error:', err);
      this.updateState({
        isConnected: false,
        isConnecting: false,
        error: msg,
      });
      return false;
    }
  }

  /**
   * Find a writable characteristic across known printer services
   */
  private async findWritableCharacteristic(server: any): Promise<any> {
    for (const serviceUuid of CANONICAL_PRINTER_SERVICES) {
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
        // Continue searching
      }
    }

    // Fallback: search all primary services
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
          // Ignore
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

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

  public async printBytes(bytes: Uint8Array, chunkSize = 100): Promise<void> {
    if (!this.state.isConnected || !this.writeCharacteristic) {
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
