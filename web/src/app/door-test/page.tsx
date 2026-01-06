'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  connectDoorSerial,
  disconnectDoorSerial,
  isConnected,
  testDoorCommand,
  openDoor,
} from '@/lib/door/doorController';

export default function DoorTestPage() {
  const [connected, setConnected] = useState(false);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      await connectDoorSerial();
      const conn = await isConnected();
      setConnected(conn);
      setOutput('Connected to serial device');
    } catch (err: unknown) {
      setOutput('Failed to connect: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await disconnectDoorSerial();
      setConnected(false);
      setOutput('Disconnected');
    } catch (err: unknown) {
      setOutput('Failed to disconnect: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setLoading(true);
    try {
      const result = await testDoorCommand();
      setOutput(result);
    } catch (err: unknown) {
      setOutput('Test failed: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen() {
    setLoading(true);
    try {
      await openDoor();
      setOutput('Door open command sent successfully');
    } catch (err: unknown) {
      setOutput('Open failed: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-4xl font-bold mb-8">Door Control Test Panel</h1>

      <Card className="max-w-2xl px-10 py-8">
        <p className="text-sm text-gray-600 mb-6">
          Admin tool to connect to the cabinet lock controller via WebSerial and test the open door command.
          <br />
          Requires HTTPS or localhost and user permission.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button onClick={handleConnect} disabled={connected || loading}>
              Connect Serial
            </Button>
            <Button onClick={handleDisconnect} disabled={!connected || loading} variant="secondary">
              Disconnect
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleTest} disabled={!connected || loading}>
              Test Command
            </Button>
            <Button onClick={handleOpen} disabled={!connected || loading} variant="primary">
              Open Door
            </Button>
          </div>

          <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm font-mono whitespace-pre-wrap min-h-[80px]">
            {output || '(No output yet)'}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

