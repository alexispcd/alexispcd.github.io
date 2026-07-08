// Helpers purs sur le brouillon du wizard (hors composants pour le fast-refresh).

/** Distance résolue en mètres depuis le brouillon (0 si indéfinie). */
export const resolveDistanceM = (d) =>
  d.distancePreset === 'custom'
    ? Number(d.distanceCustomM) || 0
    : (d.distancePreset ?? 0)
