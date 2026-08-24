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
      const msg = 'Web Bluetooth API is not available in this browser. Please ensure you are opening via HTTPS in Bluefy on iOS or Chrome on Android.';
      alert(msg);
      return false;
    }

    try {
      let device: any = null;

      // Scan attempt 1: acceptAllDevices with full canonical printer UUIDs
      try {
        device = await navBluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: CANONICAL_PRINTER_SERVICES,
        });
      } catch (err1: any) {
        console.warn('Scan 1 (acceptAllDevices) failed, trying Scan 2 (namePrefix filter):', err1);
        
        // Scan attempt 2: Filter by empty namePrefix (matches any named Bluetooth device in Bluefy)
        try {
          device = await navBluetooth.requestDevice({
            filters: [{ namePrefix: '' }],
            optionalServices: CANONICAL_PRINTER_SERVICES,
          });
        } catch (err2: any) {
          console.warn('Scan 2 (namePrefix) failed, trying Scan 3 (service UUID filter):', err2);

          // Scan attempt 3: Filter by primary printer service UUIDs
          device = await navBluetooth.requestDevice({
            filters: [
              { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] },
              { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
              { services: ['0000fee7-0000-1000-8000-00805f9b34fb'] },
              { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
            ],
            optionalServices: CANONICAL_PRINTER_SERVICES,
          });
        }
      }

      if (!device) {
        this.updateState({ isConnecting: false });
        return false;
      }

      this.updateState({ isConnecting: true, error: null });

      this.device = device;
      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      // Connect to GATT Server
      const server = await this.device.gatt.connect();
      this.server = server;

      // Discover writable characteristic
      const characteristic = await this.findWritableCharacteristic(server);
      if (!characteristic) {
        throw new Error(
          'Connected to ' + (device.name || 'Printer') + ', but no writable ESC/POS print channel was found. Please check printer mode.'
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
      const msg = err?.message || err?.name || 'Bluetooth connection error';
      console.error('Bluetooth pair error:', err);
      this.updateState({
        isConnected: false,
        isConnecting: false,
        error: msg,
      });

      // Show clear helpful popup if pairing failed
      if (!/cancelled|cancel|dismiss/i.test(msg)) {
        alert(`Bluetooth Error: ${msg}\n\nTroubleshooting:\n1. Make sure RP21UB printer is turned ON (blue light on).\n2. Unpair it from iPhone Settings > Bluetooth (if paired there).\n3. Keep printer within 2 meters of iPhone.`);
      }
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

  public async printBytes(bytes: Uint8Array, chunkSize = 20): Promise<void> {
    if (!this.writeCharacteristic) {
      const ok = await this.reconnect();
      if (!ok || !this.writeCharacteristic) {
        throw new Error('Printer is not connected via Bluetooth. Please tap Pair & Connect.');
      }
    }

    this.updateState({ isPrinting: true });

    try {
      const totalLen = bytes.length;
      const char = this.writeCharacteristic;

      for (let offset = 0; offset < totalLen; offset += chunkSize) {
        const chunk = bytes.slice(offset, Math.min(offset + chunkSize, totalLen));

        // Use the most compatible write strategy for Bluefy & Chrome
        if (typeof char.writeValueWithoutResponse === 'function' && char.properties?.writeWithoutResponse) {
          try {
            await char.writeValueWithoutResponse(chunk);
          } catch {
            if (typeof char.writeValue === 'function') {
              await char.writeValue(chunk);
            }
          }
        } else if (typeof char.writeValue === 'function') {
          await char.writeValue(chunk);
        } else if (typeof char.writeValueWithResponse === 'function') {
          await char.writeValueWithResponse(chunk);
        }

        // 25ms delay between BLE packets to prevent printer buffer overrun on 58mm
        if (offset + chunkSize < totalLen) {
          await new Promise((res) => setTimeout(res, 25));
        }
      }
    } catch (err: any) {
      console.error('Error writing bytes to printer:', err);
      throw new Error(`Print communication error: ${err?.message || err}`);
    } finally {
      this.updateState({ isPrinting: false });
    }
  }
}

export const bluetoothPrinterService = new BluetoothPrinterService();
