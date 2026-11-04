// Données communes à l'accueil Renfo et à la composition d'une séance.
import {
  getBands, getDoneSessions, getExerciseBases, getPendingSession, getProfile,
} from '../../../lib/renfo'

/** Profil, élastiques, séances faites, séance à faire et bases des exercices. */
export const chargerDonnees = async () => {
  const [profile, bands, done, pending, bases] = await Promise.all([
    getProfile(), getBands(), getDoneSessions(), getPendingSession(), getExerciseBases(),
  ])
  return { profile, bands, done, pending, bases }
}
