
declare global {
  interface SerialPort {
    open(options?: { baudRate?: number }): Promise<void>;
    close(): Promise<void>;
    readable: {
      getReader(): {
        read(): Promise<{ value?: Uint8Array; done?: boolean }>;
        releaseLock(): void;
      };
    } | null;
    writable: {
      getWriter(): {
        write(data: Uint8Array): Promise<void>;
        releaseLock(): void;
      };
    } | null;
  }

  interface Navigator {
    serial?: {
      requestPort(options?: any): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
    };
  }
}

export {};
