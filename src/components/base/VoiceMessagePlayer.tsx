import { useRef, useState, useEffect, useCallback } from 'react';

interface Props {
  src: string;
  mine?: boolean;
  /** Duración conocida en segundos (evita esperar a que cargue el audio) */
  knownDuration?: number;
}

const SPEEDS = [1, 1.5, 2];

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Reproductor de nota de voz estilo WhatsApp: botón circular play/pause,
 * barra de progreso "de barritas" que se puede tocar para saltar, tiempo
 * transcurrido/total, y control de velocidad (1x / 1.5x / 2x).
 */
export default function VoiceMessagePlayer({ src, mine = false, knownDuration }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(knownDuration || 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setLoadError(false);
    setLoaded(false);

    const onLoaded = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
      setLoaded(true);
      setLoadError(false);
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    const onError = () => { setLoadError(true); setLoaded(false); setPlaying(false); };
    const onStalled = () => { setLoadError(true); };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);

    // Si en 10s no ha cargado metadata ni ha dado error, mostramos el aviso
    // igualmente — mejor un mensaje claro que una rueda de carga infinita.
    const timeout = setTimeout(() => {
      if (!audio.duration || !isFinite(audio.duration)) onStalled();
    }, 10000);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
      clearTimeout(timeout);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setLoadError(false)).catch(() => setLoadError(true));
      setPlaying(true);
    }
  }, [playing]);

  const retry = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setLoadError(false);
    setLoaded(false);
    audio.load();
  }, []);

  const cycleSpeed = useCallback(() => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }, [speedIdx]);

  const seekTo = useCallback((clientX: number) => {
    const bar = barsRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const BAR_COUNT = 28;
  const heights = useRef(
    Array.from({ length: BAR_COUNT }, (_, i) => 30 + ((i * 37) % 70))
  ).current;

  const accent = mine ? 'bg-white' : 'bg-orange-500';
  const dim = mine ? 'bg-white/30' : 'bg-gray-300 dark:bg-slate-600';
  const textColor = mine ? 'text-orange-50' : 'text-gray-500 dark:text-slate-400';

  if (loadError) {
    return (
      <div className="flex items-center gap-2 min-w-[220px]">
        <audio ref={audioRef} src={src} preload="metadata" />
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${mine ? 'bg-white/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <i className={`ri-error-warning-line text-base ${mine ? 'text-white' : 'text-red-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs ${mine ? 'text-orange-50' : 'text-red-500'}`}>No se pudo cargar el audio</p>
          <button onClick={retry} className={`text-[11px] underline ${mine ? 'text-orange-100' : 'text-gray-500 dark:text-slate-400'}`}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[220px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all
          ${mine ? 'bg-white/25 hover:bg-white/35 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
      >
        <i className={`${playing ? 'ri-pause-fill' : 'ri-play-fill'} text-base`} />
      </button>

      <div className="flex-1 min-w-0">
        <div
          ref={barsRef}
          onClick={(e) => seekTo(e.clientX)}
          className="flex items-center gap-[2px] h-6 cursor-pointer"
        >
          {heights.map((h, i) => {
            const filled = i / BAR_COUNT <= progress;
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full transition-colors ${filled ? accent : dim}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className={`flex items-center justify-between text-[10px] mt-0.5 ${textColor}`}>
          <span>{fmt(playing || currentTime > 0 ? currentTime : duration)}</span>
          {!loaded && <span className="italic">cargando…</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={cycleSpeed}
        title="Velocidad de reproducción"
        className={`text-[10px] font-bold px-1.5 py-1 rounded-md flex-shrink-0 transition-all
          ${mine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-300'}`}
      >
        {SPEEDS[speedIdx]}x
      </button>
    </div>
  );
}
