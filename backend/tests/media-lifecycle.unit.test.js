const { normalizeTrack } = require('../src/utils/helpers');

describe('media lifecycle compatibility', () => {
  test('normalizes legacy versions with durable identity and playback URL', () => {
    const track = normalizeTrack({
      id: 'track-1', filename: 'current.mp3', url: 'https://res.cloudinary.com/demo/video/upload/v1/current.mp3',
      versions: [{ id: 'version-1', url: 'https://res.cloudinary.com/demo/video/upload/v1/old.mp3', publicId: 'tracks/old', resourceType: 'video' }]
    });
    expect(track.playbackUrl).toContain('/api/media/tracks/track-1');
    expect(track.versions[0].id).toBe('version-1');
    expect(track.versions[0].publicId).toBe('tracks/old');
    expect(track.versions[0].playbackUrl).toContain('cloudinary.com');
  });
});
