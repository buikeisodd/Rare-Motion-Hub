const { findAccessibleTrack } = require('../src/utils/helpers');

describe('media access policy', () => {
  const db = {
    users: [],
    folders: [],
    projects: [
      { id: 'public-project', userId: 'owner', visibility: 'public', folderId: null },
      { id: 'private-project', userId: 'owner', visibility: 'private', allowedUserIds: [], folderId: null }
    ],
    tracks: [
      { id: 'public-track', userId: 'owner', projectId: 'public-project' },
      { id: 'private-track', userId: 'owner', projectId: 'private-project' }
    ]
  };

  test('allows public media without treating a query parameter as identity', () => {
    expect(findAccessibleTrack(db, 'public-track', undefined)?.id).toBe('public-track');
    expect(findAccessibleTrack(db, 'private-track', undefined)).toBeNull();
  });

  test('allows private media only to the owner or explicit grant', () => {
    expect(findAccessibleTrack(db, 'private-track', 'other-user')).toBeNull();
    db.projects[1].allowedUserIds = ['granted-user'];
    expect(findAccessibleTrack(db, 'private-track', 'granted-user')?.id).toBe('private-track');
  });
});
