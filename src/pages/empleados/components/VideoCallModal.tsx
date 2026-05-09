import { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import Modal from '@/components/base/Modal';

interface Props {
  employeeName: string;
  onClose: () => void;
}

export default function VideoCallModal({ employeeName, onClose }: Props) {
  const [platform, setPlatform] = useState<'meet' | 'teams'>('meet');

  const createMeeting = () => {
    const url = platform === 'meet'
      ? 'https://meet.google.com/new'
      : 'https://teams.microsoft.com/_#/scheduling-form/?opener=1&navCtx=multi-tab-navigation';
    window.open(url, '_blank');
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Videollamada con ${employeeName}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">Selecciona la plataforma para crear la reunión:</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPlatform('meet')}
            className={`p-4 rounded-xl border text-center transition-all ${
              platform === 'meet'
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-green-50 flex items-center justify-center">
              <i className="ri-google-fill text-green-600 text-xl" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Google Meet</span>
          </button>
          <button
            onClick={() => setPlatform('teams')}
            className={`p-4 rounded-xl border text-center transition-all ${
              platform === 'teams'
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-blue-50 flex items-center justify-center">
              <i className="ri-microsoft-fill text-blue-600 text-xl" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Microsoft Teams</span>
          </button>
        </div>
        <button
          onClick={createMeeting}
          className="w-full py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-2"
        >
          <i className="ri-video-chat-line" />
          Crear reunión
        </button>
      </div>
    </Modal>
  );
}
