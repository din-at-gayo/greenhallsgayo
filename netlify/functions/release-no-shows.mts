import { releaseNoShows } from '../../src/server/checkin.server.js'

// Runs every 5 minutes. Release also happens on demand before availability
// reads and booking writes, so a room frees up on time even between runs.
export default async () => {
  const released = await releaseNoShows()
  if (released.length > 0) {
    console.log(`[release-no-shows] released ${released.length} booking(s)`, {
      ids: released.map((b) => b.id),
    })
  }
}

export const config = {
  schedule: '*/5 * * * *',
}
