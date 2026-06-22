import { StatusBar } from 'expo-status-bar';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { api } from './src/api';
import { clearUser, getLastEmail, getStoredUser, storeLastEmail, storeUser } from './src/storage';
import { colors, gradientFor } from './src/theme';

function IconButton({ name, onPress, label, tone = 'dark' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        tone === 'light' && styles.iconButtonLight,
        pressed && styles.pressed
      ]}
    >
      <Ionicons name={name} size={20} color={tone === 'light' ? colors.bg : colors.ink} />
    </Pressable>
  );
}

function LogoMark({ small = false }) {
  return (
    <View style={[styles.logoWrap, small && styles.logoWrapSmall]}>
      <Text style={[styles.logoText, small && styles.logoTextSmall]}>Starlight</Text>
      <Text style={[styles.logoSubText, small && styles.logoSubTextSmall]}>Station</Text>
    </View>
  );
}

function Artwork({ item, size = 'large', children }) {
  const boxStyle = size === 'small' ? styles.artSmall : styles.art;
  if (item?.coverArt) {
    return (
      <View style={boxStyle}>
        <Image source={{ uri: item.coverArt }} style={styles.artImage} />
        {children}
      </View>
    );
  }
  return (
    <LinearGradient colors={gradientFor(item?.id)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={boxStyle}>
      {children || <Ionicons name="disc" size={size === 'small' ? 28 : 52} color="rgba(5,5,5,0.58)" />}
    </LinearGradient>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLastEmail().then(setEmail).catch(() => {});
  }, []);

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setLoading(true);
    try {
      const data = await api('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail })
      });
      await storeLastEmail(cleanEmail);
      await storeUser(data.user);
      onLogin(data.user);
    } catch (error) {
      Alert.alert('Could not sign in', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.loginHero}>
          <LogoMark />
          <Text style={styles.loginTitle}>A sacred place for your work-in-progress music.</Text>
          <Text style={styles.loginCopy}>Projects, folders, playback, and collaboration stay synced with your Starlight Station account.</Text>
        </View>
        <View style={styles.loginPanel}>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={20} color={colors.muted} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={submit}
              style={styles.input}
            />
          </View>
          <Pressable onPress={submit} disabled={loading} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryButtonText}>Continue</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
      <StatusBar style="light" />
    </KeyboardAvoidingView>
  );
}

function LibraryHeader({ user, title, subtitle, onBack, onLogout, onRefresh }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {onBack ? <IconButton name="chevron-back" label="Back" onPress={onBack} /> : <LogoMark small />}
        <View style={styles.headerActions}>
          {onRefresh && <IconButton name="refresh" label="Refresh" onPress={onRefresh} />}
          {onLogout && <IconButton name="log-out-outline" label="Log out" onPress={onLogout} />}
        </View>
      </View>
      <Text style={styles.kicker}>Starlight Station</Text>
      <Text style={styles.pageTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function ProjectCard({ project, tracks, onOpen, onMove, onPlay }) {
  const projectTracks = tracks.filter((track) => track.projectId === project.id);
  const title = project.title || project.name || 'Untitled project';
  const artist = project.artist || projectTracks[0]?.artist || 'Unknown artist';

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Artwork item={project}>
        <Pressable onPress={projectTracks.length ? onPlay : undefined} style={styles.playBubble}>
          <Ionicons name="play" size={18} color={colors.bg} style={{ marginLeft: 2 }} />
        </Pressable>
      </Artwork>
      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.cardTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.cardMeta}>{artist}</Text>
          <Text style={styles.cardTiny}>{projectTracks.length} track{projectTracks.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={onMove} style={styles.cardMore} accessibilityLabel="Move project">
          <Ionicons name="folder-open-outline" size={18} color={colors.ink} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function FolderCard({ folder, projects, tracks, onOpen }) {
  const title = folder.title || folder.name || 'Untitled folder';
  const folderTracks = projects.flatMap((project) => tracks.filter((track) => track.projectId === project.id));
  const preview = projects.slice(0, 4);

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <LinearGradient colors={gradientFor(folder.id)} style={styles.art}>
        {preview.length ? (
          <View style={styles.previewGrid}>
            {preview.map((project) => (
              <Artwork key={project.id} item={project} size="small" />
            ))}
          </View>
        ) : (
          <Ionicons name="folder" size={58} color="rgba(5,5,5,0.58)" />
        )}
      </LinearGradient>
      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.cardTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.cardMeta}>{folder.artist || 'Folder'}</Text>
          <Text style={styles.cardTiny}>{projects.length} project{projects.length === 1 ? '' : 's'} · {folderTracks.length} track{folderTracks.length === 1 ? '' : 's'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function EmptyState({ icon, title, copy }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={42} color={colors.muted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

function CreateBar({ onCreateProject, onCreateFolder }) {
  return (
    <View style={styles.createBar}>
      <Pressable onPress={onCreateProject} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
        <Ionicons name="add" size={19} color={colors.bg} />
        <Text style={styles.createButtonText}>Project</Text>
      </Pressable>
      <Pressable onPress={onCreateFolder} style={({ pressed }) => [styles.createButtonSecondary, pressed && styles.pressed]}>
        <Ionicons name="folder-open" size={18} color={colors.ink} />
        <Text style={styles.createButtonSecondaryText}>Folder</Text>
      </Pressable>
    </View>
  );
}

function MoveSheet({ visible, project, folders, onClose, onMove }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalShade} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Move project</Text>
        <Text numberOfLines={1} style={styles.sheetCopy}>{project?.title || project?.name || 'Untitled project'}</Text>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => onMove(null)} style={styles.sheetRow}>
            <Ionicons name="albums-outline" size={20} color={colors.ink} />
            <Text style={styles.sheetRowText}>Library root</Text>
          </Pressable>
          {folders.map((folder) => (
            <Pressable key={folder.id} onPress={() => onMove(folder.id)} style={styles.sheetRow}>
              <Ionicons name="folder-outline" size={20} color={colors.ink} />
              <Text numberOfLines={1} style={styles.sheetRowText}>{folder.title || folder.name || 'Untitled folder'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function MiniPlayer({ playback, onToggle, onClose }) {
  if (!playback.track) return null;
  return (
    <View style={styles.miniPlayer}>
      <Artwork item={playback.project || playback.track} size="small" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.miniTitle}>{playback.track.title || 'Untitled track'}</Text>
        <Text numberOfLines={1} style={styles.miniMeta}>{playback.project?.title || playback.project?.name || 'Now playing'}</Text>
      </View>
      <IconButton name={playback.playing ? 'pause' : 'play'} label="Play or pause" onPress={onToggle} tone="light" />
      <IconButton name="close" label="Close player" onPress={onClose} />
    </View>
  );
}

function LibraryScreen({ user, workspace, loading, refreshing, onRefresh, onLogout, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onPlayProject }) {
  const rootProjects = workspace.projects.filter((project) => !project.folderId);
  const rootFolders = workspace.folders;
  const data = [
    ...rootFolders.map((folder) => ({ type: 'folder', item: folder })),
    ...rootProjects.map((project) => ({ type: 'project', item: project }))
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <LibraryHeader user={user} title="Library" subtitle="Keep every idea close, sorted, and ready to play." onLogout={onLogout} onRefresh={onRefresh} />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(entry) => `${entry.type}:${entry.item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl tintColor={colors.accent} refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="disc-outline" title="No projects yet" copy="Start with a project or folder and build from there." />}
          renderItem={({ item }) => item.type === 'folder' ? (
            <FolderCard
              folder={item.item}
              projects={workspace.projects.filter((project) => project.folderId === item.item.id)}
              tracks={workspace.tracks}
              onOpen={() => onOpenFolder(item.item.id)}
            />
          ) : (
            <ProjectCard
              project={item.item}
              tracks={workspace.tracks}
              onOpen={() => onOpenProject(item.item.id)}
              onMove={() => onMoveProject(item.item)}
              onPlay={() => onPlayProject(item.item)}
            />
          )}
        />
      )}
      <CreateBar onCreateProject={onCreateProject} onCreateFolder={onCreateFolder} />
    </SafeAreaView>
  );
}

function FolderScreen({ user, folderData, loading, onBack, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onPlayProject }) {
  const folder = folderData?.folder;
  const folders = folderData?.folders || [];
  const projects = folderData?.projects || [];
  const tracks = folderData?.tracks || [];
  const data = [
    ...folders.map((item) => ({ type: 'folder', item })),
    ...projects.map((item) => ({ type: 'project', item }))
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <LibraryHeader
        user={user}
        title={folder?.title || folder?.name || 'Folder'}
        subtitle={folder?.artist || 'Projects inside this folder'}
        onBack={onBack}
      />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(entry) => `${entry.type}:${entry.item.id}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState icon="folder-open-outline" title="This folder is empty" copy="Create something here or move projects into this folder." />}
          renderItem={({ item }) => item.type === 'folder' ? (
            <FolderCard folder={item.item} projects={[]} tracks={tracks} onOpen={() => onOpenFolder(item.item.id)} />
          ) : (
            <ProjectCard
              project={item.item}
              tracks={tracks}
              onOpen={() => onOpenProject(item.item.id)}
              onMove={() => onMoveProject(item.item)}
              onPlay={() => onPlayProject(item.item, tracks)}
            />
          )}
        />
      )}
      <CreateBar onCreateProject={onCreateProject} onCreateFolder={onCreateFolder} />
    </SafeAreaView>
  );
}

function ProjectScreen({ projectData, loading, onBack, onPlayTrack }) {
  const project = projectData?.project;
  const tracks = projectData?.tracks || [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.projectContent}>
        <View style={styles.projectNav}>
          <IconButton name="chevron-back" label="Back" onPress={onBack} />
        </View>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
        ) : (
          <>
            <Artwork item={project} />
            <Text style={styles.projectTitle}>{project?.title || project?.name || 'Untitled project'}</Text>
            <Text style={styles.projectArtist}>{project?.artist || 'Unknown artist'}</Text>
            <View style={styles.trackList}>
              {tracks.length === 0 ? (
                <EmptyState icon="musical-notes-outline" title="No tracks yet" copy="Tracks added on desktop will appear here." />
              ) : tracks.map((track, index) => (
                <Pressable key={track.id} onPress={() => onPlayTrack(track, project, tracks)} style={({ pressed }) => [styles.trackRow, pressed && styles.pressed]}>
                  <Text style={styles.trackIndex}>{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.trackTitle}>{track.title || 'Untitled track'}</Text>
                    <Text numberOfLines={1} style={styles.trackMeta}>{track.artist || track.producer || project?.artist || 'Track'}</Text>
                  </View>
                  <Ionicons name="play-circle" size={28} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [workspace, setWorkspace] = useState({ folders: [], projects: [], tracks: [], notifications: [] });
  const [folderData, setFolderData] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [route, setRoute] = useState({ name: 'library' });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [moveProject, setMoveProject] = useState(null);
  const [playback, setPlayback] = useState({ player: null, track: null, project: null, tracks: [], playing: false });
  const playerRef = useRef(null);

  const allFolders = useMemo(() => {
    const byId = new Map();
    workspace.folders.forEach((folder) => byId.set(folder.id, folder));
    if (folderData?.folder) byId.set(folderData.folder.id, folderData.folder);
    (folderData?.folders || []).forEach((folder) => byId.set(folder.id, folder));
    return Array.from(byId.values());
  }, [workspace.folders, folderData]);

  useEffect(() => {
    getStoredUser()
      .then((stored) => {
        if (stored) setUser(stored);
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (user) refreshWorkspace();
  }, [user?.id]);

  useEffect(() => () => {
    playerRef.current?.remove?.();
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix'
    }).catch(() => {});
  }, []);

  const refreshWorkspace = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      const data = await api(`/api/workspace?userId=${encodeURIComponent(user.id)}&_t=${Date.now()}`);
      setWorkspace({
        folders: data.folders || [],
        projects: data.projects || [],
        tracks: data.tracks || [],
        notifications: data.notifications || []
      });
    } catch (error) {
      Alert.alert('Could not load library', error.message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const openFolder = async (folderId) => {
    setRoute({ name: 'folder', id: folderId });
    setLoading(true);
    try {
      const data = await api(`/api/folders/${folderId}?userId=${encodeURIComponent(user.id)}`);
      setFolderData(data);
    } catch (error) {
      Alert.alert('Could not open folder', error.message);
      setRoute({ name: 'library' });
    } finally {
      setLoading(false);
    }
  };

  const openProject = async (projectId) => {
    setRoute({ name: 'project', id: projectId });
    setLoading(true);
    try {
      const data = await api(`/api/projects/${projectId}?userId=${encodeURIComponent(user.id)}`);
      setProjectData(data);
    } catch (error) {
      Alert.alert('Could not open project', error.message);
      setRoute({ name: 'library' });
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    try {
      const folderId = route.name === 'folder' ? route.id : null;
      const project = await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          title: 'Untitled project',
          artist: user.name,
          folderId
        })
      });
      await refreshWorkspace();
      openProject(project.id);
    } catch (error) {
      Alert.alert('Could not create project', error.message);
    }
  };

  const createFolder = async () => {
    try {
      const parentFolderId = route.name === 'folder' ? route.id : null;
      await api('/api/folders', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          title: 'Untitled folder',
          artist: user.name,
          parentFolderId
        })
      });
      if (route.name === 'folder') await openFolder(route.id);
      await refreshWorkspace();
    } catch (error) {
      Alert.alert('Could not create folder', error.message);
    }
  };

  const moveSelectedProject = async (folderId) => {
    const project = moveProject;
    setMoveProject(null);
    if (!project) return;
    try {
      const moved = await api(`/api/projects/${project.id}/move`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, folderId })
      });
      setWorkspace((prev) => ({
        ...prev,
        projects: prev.projects.map((item) => item.id === project.id ? { ...item, ...moved } : item)
      }));
      if (route.name === 'folder') await openFolder(route.id);
    } catch (error) {
      Alert.alert('Could not move project', error.message);
    }
  };

  const playTrack = async (track, project, tracks) => {
    try {
      if (!track?.url) {
        Alert.alert('Track unavailable', 'This track does not have a playable URL yet.');
        return;
      }
      playerRef.current?.remove?.();
      const player = createAudioPlayer(track.url);
      playerRef.current = player;
      player.play();
      player.setActiveForLockScreen?.(true, {
        title: track.title || 'Untitled track',
        artist: project?.artist || track.artist || 'Starlight Station',
        albumTitle: project?.title || project?.name || 'Project',
        artworkUrl: project?.coverArt
      });
      setPlayback({ player, track, project, tracks, playing: true });
    } catch (error) {
      Alert.alert('Could not play track', error.message);
    }
  };

  const playProject = (project, tracksOverride) => {
    const tracks = tracksOverride || workspace.tracks.filter((track) => track.projectId === project.id);
    if (!tracks.length) {
      Alert.alert('No tracks', 'This project has no tracks to play yet.');
      return;
    }
    playTrack(tracks[0], project, tracks);
  };

  const togglePlayback = async () => {
    if (!playerRef.current) return;
    if (playback.playing) {
      playerRef.current.pause();
      setPlayback((prev) => ({ ...prev, playing: false }));
    } else {
      playerRef.current.play();
      setPlayback((prev) => ({ ...prev, playing: true }));
    }
  };

  const closePlayer = async () => {
    playerRef.current?.clearLockScreenControls?.();
    playerRef.current?.remove?.();
    playerRef.current = null;
    setPlayback({ player: null, track: null, project: null, tracks: [], playing: false });
  };

  const logout = async () => {
    await closePlayer();
    await clearUser();
    setUser(null);
    setRoute({ name: 'library' });
  };

  if (booting) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
        <StatusBar style="light" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  const currentScreen = route.name === 'project' ? (
    <ProjectScreen
      projectData={projectData}
      loading={loading}
      onBack={() => {
        if (projectData?.project?.folderId) openFolder(projectData.project.folderId);
        else setRoute({ name: 'library' });
      }}
      onPlayTrack={playTrack}
    />
  ) : route.name === 'folder' ? (
    <FolderScreen
      user={user}
      folderData={folderData}
      loading={loading}
      onBack={() => setRoute({ name: 'library' })}
      onOpenFolder={openFolder}
      onOpenProject={openProject}
      onCreateProject={createProject}
      onCreateFolder={createFolder}
      onMoveProject={setMoveProject}
      onPlayProject={playProject}
    />
  ) : (
    <LibraryScreen
      user={user}
      workspace={workspace}
      loading={loading}
      refreshing={refreshing}
      onRefresh={refreshWorkspace}
      onLogout={logout}
      onOpenFolder={openFolder}
      onOpenProject={openProject}
      onCreateProject={createProject}
      onCreateFolder={createFolder}
      onMoveProject={setMoveProject}
      onPlayProject={playProject}
    />
  );

  return (
    <View style={styles.app}>
      {currentScreen}
      <MiniPlayer playback={playback} onToggle={togglePlayback} onClose={closePlayer} />
      <MoveSheet
        visible={!!moveProject}
        project={moveProject}
        folders={allFolders.filter((folder) => folder.id !== moveProject?.folderId)}
        onClose={() => setMoveProject(null)}
        onMove={moveSelectedProject}
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.bg
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  safe: {
    flex: 1,
    paddingHorizontal: 22
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }]
  },
  logoWrap: {
    alignItems: 'center',
    gap: 0,
  },
  logoWrapSmall: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 0,
  },
  logoText: {
    color: colors.ink,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(215,255,101,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  logoTextSmall: {
    fontSize: 18,
    lineHeight: 21,
    textAlign: 'left',
  },
  logoSubText: {
    color: colors.ink,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(215,255,101,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  logoSubTextSmall: {
    fontSize: 18,
    lineHeight: 21,
    textAlign: 'left',
  },
  loginHero: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 42
  },
  loginTitle: {
    marginTop: 36,
    color: colors.ink,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0
  },
  loginCopy: {
    marginTop: 16,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center'
  },
  loginPanel: {
    gap: 12,
    paddingBottom: 28
  },
  inputRow: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 12
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700'
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '900'
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14
  },
  headerTop: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  iconButtonLight: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  kicker: {
    marginTop: 18,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0
  },
  pageTitle: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: 0
  },
  pageSubtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 150,
    gap: 16
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: 'hidden'
  },
  art: {
    aspectRatio: 1.45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  artSmall: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  artImage: {
    width: '100%',
    height: '100%'
  },
  previewGrid: {
    width: '76%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center'
  },
  playBubble: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0
  },
  cardMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700'
  },
  cardTiny: {
    marginTop: 7,
    color: '#6E6A65',
    fontSize: 12,
    fontWeight: '800'
  },
  cardMore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 20
  },
  emptyTitle: {
    marginTop: 18,
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  emptyCopy: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center'
  },
  createBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 24,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 28,
    backgroundColor: 'rgba(18,18,18,0.94)',
    borderWidth: 1,
    borderColor: colors.border
  },
  createButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  createButtonText: {
    color: colors.bg,
    fontWeight: '900',
    fontSize: 15
  },
  createButtonSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  createButtonSecondaryText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 15
  },
  projectContent: {
    padding: 18,
    paddingBottom: 140
  },
  projectNav: {
    marginBottom: 20
  },
  projectTitle: {
    marginTop: 24,
    color: colors.ink,
    fontSize: 35,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: 0
  },
  projectArtist: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 17,
    fontWeight: '700'
  },
  trackList: {
    marginTop: 28,
    gap: 10
  },
  trackRow: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 14
  },
  trackIndex: {
    width: 24,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900'
  },
  trackTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  trackMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  miniPlayer: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 96,
    minHeight: 74,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0E0E0E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10
  },
  miniTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  miniMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  modalShade: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)'
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 36
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 18
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0
  },
  sheetCopy: {
    marginTop: 5,
    marginBottom: 14,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700'
  },
  sheetRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: colors.panelSoft
  },
  sheetRowText: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  }
});
