/**
 * Szerepkorok es kepessegek. Ez a fajl a Fitron app lib/roles.ts-enek a PARJA.
 *
 * HA AZ EGYIKET MODOSITOD, A MASIKAT IS KELL. Ket kulon projektben el, mert az app
 * es ez az admin felulet kulon repoban van.
 *
 * FONTOS: ez CSAK a feluletet rejti el. A valodi hatar a firestore.rules-ban es a
 * manageContent Cloud Function-ben van, mert a bongeszot meg lehet kerulni.
 */
const KEPESSEGEK = {
  user: [],
  support: ['view_user_billing', 'grant_access'],
  moderator: ['moderate_reports'],
  admin: ['moderate_reports', 'view_user_billing', 'grant_access', 'manage_content', 'manage_partners', 'view_payouts', 'manage_users'],
};

export function roleOf(profil) {
  const r = profil && profil.role;
  return (r === 'admin' || r === 'moderator' || r === 'support' || r === 'user') ? r : 'user';
}

export function can(profil, kepesseg) {
  return KEPESSEGEK[roleOf(profil)].includes(kepesseg);
}

export function hasStaffAccess(profil) {
  return KEPESSEGEK[roleOf(profil)].length > 0;
}

export const SZEREP_NEVEK = {
  user: 'felhasználó',
  support: 'ügyfélszolgálat',
  moderator: 'moderátor',
  admin: 'admin',
};
