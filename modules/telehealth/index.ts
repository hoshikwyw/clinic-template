/**
 * telehealth module — video consultations.
 *
 * MVP uses Jitsi Meet's public instance: a room is just a URL, so there's no
 * API key or external setup. The room id is derived from the appointment id
 * (a UUID), so the link is stable and effectively unguessable.
 *
 * Vendor-wrapping: swapping to a paid provider (Daily, Zoom, authenticated
 * Jitsi w/ JWT) = change meetingUrl(), nothing else.
 *
 * NOTE: the public Jitsi instance is open to anyone with the link — fine for a
 * template/MVP. Production should use an authenticated provider.
 * Toggleable via ClinicConfig.modules.telehealth. See docs/02-architecture.md.
 */

const JITSI_BASE = "https://meet.jit.si";

/** Minutes before the start time that the room becomes joinable. */
const JOIN_LEAD_MINUTES = 10;

export function meetingUrl(opts: {
  appointmentId: string;
  clinicSlug: string;
}): string {
  const room = `${opts.clinicSlug}-${opts.appointmentId}`.replace(
    /[^a-zA-Z0-9-]/g,
    ""
  );
  return `${JITSI_BASE}/${room}`;
}

/** Is the room joinable now? (from JOIN_LEAD_MINUTES before start until end). */
export function isJoinable(
  startIso: string,
  durationMinutes: number,
  now: number = Date.now()
): boolean {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return false;
  const opensAt = start - JOIN_LEAD_MINUTES * 60_000;
  const endsAt = start + durationMinutes * 60_000;
  return now >= opensAt && now <= endsAt;
}
