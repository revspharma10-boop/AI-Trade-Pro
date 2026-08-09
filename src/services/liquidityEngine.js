// AI TRADE PRO
// Liquidity Engine

const LIQUIDITY_CONFIG = Object.freeze({
  minimumVolume: 100000,
  minimumAverageVolume: 100000,
  minimumVolumeRatio: 0.75
});

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function evaluateLiquidity({
  quote = {},
  technicalAnalysis = {}
} = {}) {
  const currentVolume =
    toNumber(
      quote.volume ??
      technicalAnalysis?.volume?.currentVolume
    );

  const averageVolume =
    toNumber(
      technicalAnalysis?.volume?.averageVolume
    );

  const volumeRatio =
    toNumber(
      technicalAnalysis?.volume?.ratio
    );

  const volumeAvailable =
    currentVolume !== null;

  const averageVolumeAvailable =
    averageVolume !== null;

  const ratioAvailable =
    volumeRatio !== null;

  const minimumVolumePassed =
    volumeAvailable &&
    currentVolume >=
      LIQUIDITY_CONFIG.minimumVolume;

  const averageVolumePassed =
    averageVolumeAvailable &&
    averageVolume >=
      LIQUIDITY_CONFIG.minimumAverageVolume;

  const volumeRatioPassed =
    ratioAvailable &&
    volumeRatio >=
      LIQUIDITY_CONFIG.minimumVolumeRatio;

  const acceptable =
    minimumVolumePassed &&
    averageVolumePassed &&
    volumeRatioPassed;

  return {
    valid:
      volumeAvailable ||
      averageVolumeAvailable ||
      ratioAvailable,

    acceptable,

    currentVolume,

    averageVolume,

    volumeRatio,

    checks: {
      minimumVolumePassed,
      averageVolumePassed,
      volumeRatioPassed
    }
  };
}

export function getLiquidityConfig() {
  return {
    ...LIQUIDITY_CONFIG
  };
}

console.log(
  'AI TRADE PRO — liquidity engine loaded'
);