import { StatusBar } from 'expo-status-bar';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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

function IconButton({ name, onPress, label, tone = 'dark', badge = 0 }) {
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
      {badge > 0 && <View style={styles.badge} />}
    </Pressable>
  );
}

function LogoMark({ small = false }) {
  const pulse = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.72, duration: 1400, useNativeDriver: true })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.logoWrap, small && styles.logoWrapSmall, { opacity: pulse }]}>
      <Text style={[styles.logoText, small && styles.logoTextSmall]}>Starlight</Text>
      <Text style={[styles.logoSubText, small && styles.logoSubTextSmall]}>Station</Text>
    </Animated.View>
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

function ProfileAvatar({ user, size = 44 }) {
  if (user?.avatarUrl) {
    const separator = user.avatarUrl.includes('?') ? '&' : '?';
    const src = `${user.avatarUrl}${separator}v=${encodeURIComponent(user.updatedAt || user.avatarUpdatedAt || '')}`;
    return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="person" size={Math.max(18, size * 0.44)} color={colors.ink} />
    </View>
  );
}

function LibraryHeader({ user, title, subtitle, onBack, onNotifications, onProfile, onSettings, notificationCount = 0 }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {onBack ? <IconButton name="chevron-back" label="Back" onPress={onBack} /> : <LogoMark small />}
        <View style={styles.headerActions}>
          <IconButton name="notifications" label="Notifications" onPress={onNotifications} tone={notificationCount > 0 ? 'light' : 'dark'} badge={notificationCount} />
          <IconButton name="person" label="Profile" onPress={onProfile} />
          <IconButton name="settings" label="Settings" onPress={onSettings} />
        </View>
      </View>
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
          <Ionicons name="play" size={18} color={colors.ink} style={{ marginLeft: 2 }} />
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
  const [open, setOpen] = useState(false);

  return (
    <View pointerEvents="box-none" style={styles.createWrap}>
      {open && (
        <View style={styles.addMenu}>
          <Pressable onPress={() => Alert.alert('Import', 'Audio import is coming next.')} style={styles.addMenuRow}>
            <Ionicons name="pulse" size={20} color={colors.ink} />
            <Text style={styles.addMenuText}>Import</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Convert', 'Video conversion is available on desktop for now.')} style={styles.addMenuRow}>
            <Ionicons name="play-square-outline" size={20} color={colors.ink} />
            <Text style={styles.addMenuText}>Convert</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Record', 'Mobile recording is coming next.')} style={styles.addMenuRow}>
            <Ionicons name="radio-button-on" size={20} color="#ff0a54" />
            <Text style={styles.addMenuText}>Record</Text>
          </Pressable>
          <View style={styles.addMenuDivider} />
          <Pressable onPress={() => { setOpen(false); onCreateProject(); }} style={styles.addMenuRow}>
            <Ionicons name="duplicate-outline" size={20} color={colors.ink} />
            <Text style={styles.addMenuText}>Project</Text>
          </Pressable>
          <Pressable onPress={() => { setOpen(false); onCreateFolder(); }} style={styles.addMenuRow}>
            <Ionicons name="file-tray-stacked-outline" size={20} color={colors.ink} />
            <Text style={styles.addMenuText}>Folder</Text>
          </Pressable>
        </View>
      )}
      <Pressable onPress={() => setOpen((value) => !value)} style={({ pressed }) => [styles.addPill, pressed && styles.pressed]}>
        <Ionicons name={open ? 'close' : 'add'} size={22} color={colors.ink} />
        <Text style={styles.addPillText}>{open ? 'Close' : 'Add'}</Text>
      </Pressable>
    </View>
  );
}

function NotificationsSheet({ visible, notifications, onClose, onMarkRead }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalShade} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTitleRow}>
          <Text style={styles.sheetTitle}>Notifications</Text>
          <Pressable onPress={onMarkRead}><Text style={styles.sheetAction}>Mark read</Text></Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {notifications.length === 0 ? (
            <Text style={styles.sheetCopy}>No notifications yet.</Text>
          ) : notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationRow}>
              <ProfileAvatar user={notification.actor} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.notificationText}>{notification.message || `${notification.actor?.name || 'Someone'} listened to your work`}</Text>
                <Text style={styles.notificationTime}>{new Date(notification.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ProfileSheet({ visible, user, saving, onClose, onSave }) {
  const [name, setName] = useState(user?.name || '');

  useEffect(() => setName(user?.name || ''), [user?.name, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalShade} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.profileHero}>
          <ProfileAvatar user={user} size={76} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Profile</Text>
            <Text numberOfLines={1} style={styles.sheetCopy}>{user?.email}</Text>
          </View>
        </View>
        <View style={styles.inputRow}>
          <Ionicons name="person-outline" size={20} color={colors.muted} />
          <TextInput value={name} onChangeText={setName} placeholder="Username" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <Pressable disabled={saving} onPress={() => onSave(name.trim())} style={({ pressed }) => [styles.primaryButton, styles.sheetButton, pressed && styles.pressed]}>
          {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryButtonText}>Save profile</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

function SettingsSheet({ visible, theme, onThemeChange, onLogout, onDeleteAccount, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalShade} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Settings</Text>
        <Text style={styles.sheetCopy}>Theme</Text>
        <View style={styles.segment}>
          {['dark', 'light'].map((mode) => (
            <Pressable key={mode} onPress={() => onThemeChange(mode)} style={[styles.segmentButton, theme === mode && styles.segmentButtonActive]}>
              <Text style={[styles.segmentText, theme === mode && styles.segmentTextActive]}>{mode}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onLogout} style={styles.sheetRow}>
          <Ionicons name="log-out-outline" size={20} color={colors.ink} />
          <Text style={styles.sheetRowText}>Sign out</Text>
        </Pressable>
        <Pressable onPress={onDeleteAccount} style={styles.sheetRowDanger}>
          <Ionicons name="trash-outline" size={20} color={colors.red} />
          <Text style={styles.sheetRowDangerText}>Delete account</Text>
        </Pressable>
      </View>
    </Modal>
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

function LibraryScreen({ user, workspace, loading, refreshing, onRefresh, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onPlayProject, onNotifications, onProfile, onSettings }) {
  const rootProjects = workspace.projects.filter((project) => !project.folderId);
  const rootFolders = workspace.folders;
  const data = [
    ...rootFolders.map((folder) => ({ type: 'folder', item: folder })),
    ...rootProjects.map((project) => ({ type: 'project', item: project }))
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <LibraryHeader
        user={user}
        title="[untitled]"
        onNotifications={onNotifications}
        onProfile={onProfile}
        onSettings={onSettings}
        notificationCount={workspace.notifications.filter((notification) => !notification.read).length}
      />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={data}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
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

function FolderScreen({ user, folderData, loading, onBack, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onPlayProject, onNotifications, onProfile, onSettings, notificationCount }) {
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
        onBack={onBack}
        onNotifications={onNotifications}
        onProfile={onProfile}
        onSettings={onSettings}
        notificationCount={notificationCount}
      />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={data}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [theme, setTheme] = useState('dark');
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

  const markNotificationsRead = async () => {
    try {
      await api(`/api/notifications/read?userId=${encodeURIComponent(user.id)}`, { method: 'POST' });
      setWorkspace((prev) => ({
        ...prev,
        notifications: prev.notifications.map((notification) => ({ ...notification, read: true }))
      }));
    } catch (error) {
      Alert.alert('Could not update notifications', error.message);
    }
  };

  const saveProfile = async (name) => {
    if (!name) return;
    setProfileSaving(true);
    try {
      const data = await api(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
      });
      await storeUser(data.user);
      setUser(data.user);
      setIsProfileOpen(false);
    } catch (error) {
      Alert.alert('Could not save profile', error.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This deletes your account and all of its projects, tracks, folders, and cover art.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/users/${user.id}`, { method: 'DELETE' });
              await logout();
            } catch (error) {
              Alert.alert('Could not delete account', error.message);
            }
          }
        }
      ]
    );
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
      onNotifications={() => setIsNotificationsOpen(true)}
      onProfile={() => setIsProfileOpen(true)}
      onSettings={() => setIsSettingsOpen(true)}
      notificationCount={workspace.notifications.filter((notification) => !notification.read).length}
    />
  ) : (
    <LibraryScreen
      user={user}
      workspace={workspace}
      loading={loading}
      refreshing={refreshing}
      onRefresh={refreshWorkspace}
      onOpenFolder={openFolder}
      onOpenProject={openProject}
      onCreateProject={createProject}
      onCreateFolder={createFolder}
      onMoveProject={setMoveProject}
      onPlayProject={playProject}
      onNotifications={() => setIsNotificationsOpen(true)}
      onProfile={() => setIsProfileOpen(true)}
      onSettings={() => setIsSettingsOpen(true)}
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
      <NotificationsSheet
        visible={isNotificationsOpen}
        notifications={workspace.notifications}
        onClose={() => setIsNotificationsOpen(false)}
        onMarkRead={markNotificationsRead}
      />
      <ProfileSheet
        visible={isProfileOpen}
        user={user}
        saving={profileSaving}
        onClose={() => setIsProfileOpen(false)}
        onSave={saveProfile}
      />
      <SettingsSheet
        visible={isSettingsOpen}
        theme={theme}
        onThemeChange={setTheme}
        onLogout={logout}
        onDeleteAccount={deleteAccount}
        onClose={() => setIsSettingsOpen(false)}
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
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  iconButtonLight: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  badge: {
    position: 'absolute',
    right: 16,
    top: 15,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0A84FF'
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft
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
    marginTop: 28,
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
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
    paddingHorizontal: 32,
    paddingBottom: 150,
    gap: 22
  },
  gridRow: {
    gap: 28,
    marginBottom: 28
  },
  card: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: 'transparent',
    overflow: 'visible'
  },
  art: {
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.panelSoft
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
    width: '88%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center'
  },
  playBubble: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(65,65,65,0.94)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 12
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0
  },
  cardMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700'
  },
  cardTiny: {
    marginTop: 0,
    color: '#6E6A65',
    fontSize: 0,
    fontWeight: '800'
  },
  cardMore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
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
  createWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: 'center'
  },
  addPill: {
    minWidth: 218,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#303030',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10
  },
  addPillText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 20
  },
  addMenu: {
    width: 320,
    borderRadius: 34,
    backgroundColor: '#303030',
    paddingVertical: 18,
    marginBottom: 18,
    overflow: 'hidden'
  },
  addMenuRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 28
  },
  addMenuText: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '500'
  },
  addMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10
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
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  sheetAction: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900'
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
  sheetRowDanger: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginTop: 8,
    backgroundColor: 'rgba(255,92,108,0.08)'
  },
  sheetRowText: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  sheetRowDangerText: {
    flex: 1,
    color: colors.red,
    fontSize: 16,
    fontWeight: '900'
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18
  },
  sheetButton: {
    marginTop: 14
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: colors.panelSoft
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentButtonActive: {
    backgroundColor: colors.ink
  },
  segmentText: {
    color: colors.muted,
    textTransform: 'capitalize',
    fontWeight: '900'
  },
  segmentTextActive: {
    color: colors.bg
  },
  notificationRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  notificationText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800'
  },
  notificationTime: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  }
});
