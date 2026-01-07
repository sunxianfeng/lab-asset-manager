/**
 * WebSerial Door Controller
 * Connects to a USB serial device (e.g. relay controller)
 * and sends an OPEN command to trigger the cabinet lock.
 *
 * Works only in secure contexts (HTTPS or localhost) and requires user permission.
 */

let port: SerialPort | null = null;

export async function connectDoorSerial(): Promise<void> {
  if (!('serial' in navigator)) {
    throw new Error('WebSerial API is not supported in this browser');
  }

  // Request user to pick a serial device
  port = await navigator.serial!.requestPort();
  await port.open({ baudRate: 9600 });
}

export async function disconnectDoorSerial(): Promise<void> {
  if (port) {
    await port.close();
    port = null;
  }
}

export async function isConnected(): Promise<boolean> {
  return port !== null && port.readable !== null;
}

export async function openDoor(): Promise<void> {
  if (!port || !port.writable) {
    throw new Error('Serial port not connected. Please connect first.');
  }

  const writer = port.writable.getWriter();
  try {
    // Send OPEN command (adjust protocol as needed)
    const data = new TextEncoder().encode('OPEN\n');
    await writer.write(data);
    console.log('Door open command sent');
  } finally {
    writer.releaseLock();
  }
}

export async function testDoorCommand(): Promise<string> {
  if (!port || !port.writable) {
    throw new Error('Serial port not connected');
  }

  const writer = port.writable.getWriter();
  try {
    const data = new TextEncoder().encode('TEST\n');
    await writer.write(data);

    // Optionally read ACK response
    if (port.readable) {
      const reader = port.readable.getReader();
      const timeout = setTimeout(() => reader.releaseLock(), 2000);
      try {
        const { value } = await reader.read();
        clearTimeout(timeout);
        if (value) {
          const ack = new TextDecoder().decode(value);
          return `ACK: ${ack}`;
        }
        return 'No response';
      } catch {
        clearTimeout(timeout);
        return 'Read timeout';
      } finally {
        reader.releaseLock();
      }
    }
    return 'Command sent (no reader)';
  } finally {
    writer.releaseLock();
  }
}

