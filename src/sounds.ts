import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getSetting } from './db';

/* Sonidos de papel sintetizados para la app (assets/sounds) */
const SOURCES = {
  hoja1: require('../assets/sounds/hoja1.wav'),
  hoja2: require('../assets/sounds/hoja2.wav'),
  tapa: require('../assets/sounds/tapa.wav'),
};

const players: Partial<Record<keyof typeof SOURCES, AudioPlayer>> = {};
let ready = false;

/** Prepara el audio sin cortar la música que esté sonando en la tablet */
export async function initSounds() {
  try {
    await setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false });
    for (const k of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) {
      players[k] = createAudioPlayer(SOURCES[k]);
    }
    ready = true;
  } catch (e) {
    console.warn('Sonidos no disponibles', e);
  }
}

export const VOLUMES: [string, string][] = [['0.35', 'Bajo'], ['0.65', 'Medio'], ['1', 'Alto']];

function play(k: keyof typeof SOURCES) {
  if (!ready || getSetting('pageSound', '1') !== '1') return;
  const p = players[k];
  if (!p) return;
  try {
    p.volume = Number(getSetting('pageVolume', '0.65'));
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

let last = 0;
/** Ruido de la hoja al pasar (alterna dos grabaciones para que no suene siempre igual) */
export function playPageTurn() {
  last = last === 1 ? 2 : 1;
  play(last === 1 ? 'hoja1' : 'hoja2');
}

export function playCover() {
  play('tapa');
}
