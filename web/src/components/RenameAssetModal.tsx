'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface RenameAssetModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
  isSaving?: boolean;
}

// Apple-style Alert Dialog
function AppleAlert({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Title */}
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-lg font-semibold text-black dark:text-white text-center">{title}</h3>
        </div>

        {/* Message */}
        <div className="px-6 py-3 pb-6">
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm leading-relaxed">{message}</p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200 dark:bg-gray-700" />

        {/* Buttons */}
        <div className="flex">
          {/* Cancel Button */}
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 text-center font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
          >
            取消
          </button>

          {/* Divider */}
          <div className="w-px bg-gray-200 dark:bg-gray-700" />

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 text-center font-semibold text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

export function RenameAssetModal({
  isOpen,
  currentName,
  onClose,
  onSave,
  isSaving = false,
}: RenameAssetModalProps) {
  const [newName, setNewName] = useState(currentName);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingName, setPendingName] = useState('');

  const handleSaveClick = async () => {
    if (!newName.trim()) {
      // Apple-style alert for empty input
      setShowConfirm(true);
      setPendingName('');
      return;
    }
    
    // Show confirmation dialog
    setPendingName(newName.trim());
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    try {
      setShowConfirm(false);
      await onSave(pendingName);
      setNewName(currentName);
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingName('');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-black dark:text-white">重命名资产</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">修改资产的名称和描述</p>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            <div className="flex items-center gap-6">
              {/* Current Name */}
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  当前名字
                </label>
                <input
                  type="text"
                  value={currentName}
                  disabled
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl border border-gray-300 dark:border-gray-700 cursor-not-allowed text-sm"
                />
              </div>

              {/* Arrow */}
              <div className="text-3xl font-light text-gray-400 dark:text-gray-600 self-end mb-8">
                →
              </div>

              {/* New Name */}
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  新名字
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入新的资产名字"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl border-2 border-gray-300 dark:border-gray-700 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveClick();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className="px-6 py-2.5 font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {/* Apple-style Confirmation Alert */}
      <AppleAlert
        isOpen={showConfirm}
        title="确认重命名"
        message={
          pendingName
            ? `是否将资产名字改为 "${pendingName}"？`
            : '请输入新的资产名字'
        }
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
