import { StatusBar } from 'expo-status-bar';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PanResponder,
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
import { API_URL, api } from './src/api';
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

function LibraryHeader({ user, title, subtitle, onBack, onNotifications, onProfile, onMessages, notificationCount = 0 }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {onBack ? <IconButton name="chevron-back" label="Back" onPress={onBack} /> : <LogoMark small />}
        <View style={styles.headerActions}>
          <IconButton name="notifications" label="Notifications" onPress={onNotifications} tone={notificationCount > 0 ? 'light' : 'dark'} badge={notificationCount} />
          <IconButton name="person" label="Profile" onPress={onProfile} />
          <IconButton name="chatbubble-ellipses" label="Messages" onPress={onMessages} />
        </View>
      </View>
      {!!title && <Text style={styles.pageTitle}>{title}</Text>}
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

function NotificationsPage({ notifications, onBack, onMarkRead }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageHeader}>
        <IconButton name="chevron-back" label="Back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageHeaderTitle}>Notifications</Text>
          <Text style={styles.pageHeaderSubtitle}>Recent activity around your music.</Text>
        </View>
        <Pressable onPress={onMarkRead} style={styles.textPill}>
          <Text style={styles.textPillText}>Read</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        {notifications.length === 0 ? (
          <EmptyState icon="notifications-outline" title="No notifications yet" copy="Listens, messages, and updates will appear here." />
        ) : notifications.map((notification) => (
          <View key={notification.id} style={styles.fullRow}>
            <ProfileAvatar user={notification.actor} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fullRowTitle}>{notification.message || `${notification.actor?.name || 'Someone'} listened to your work`}</Text>
              <Text style={styles.fullRowMeta}>{new Date(notification.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {!notification.read && <View style={styles.rowDot} />}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function AccountPage({ user, theme, saving, onBack, onSave, onPickAvatar, onThemeChange, onLogout, onDeleteAccount, onContact }) {
  const [name, setName] = useState(user?.name || '');

  useEffect(() => setName(user?.name || ''), [user?.name]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageHeader}>
        <IconButton name="chevron-back" label="Back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageHeaderTitle}>Account</Text>
          <Text style={styles.pageHeaderSubtitle}>Profile, theme, and account controls.</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.accountHero}>
          <Pressable onPress={onPickAvatar} style={({ pressed }) => [styles.avatarEdit, pressed && styles.pressed]}>
            <ProfileAvatar user={user} size={92} />
            <View style={styles.avatarCamera}>
              <Ionicons name="camera" size={16} color={colors.bg} />
            </View>
          </Pressable>
          <Text style={styles.accountName}>{user?.name}</Text>
          <Text style={styles.accountEmail}>{user?.email}</Text>
        </View>

        <Text style={styles.formLabel}>Username</Text>
        <View style={styles.inputRow}>
          <Ionicons name="person-outline" size={20} color={colors.muted} />
          <TextInput value={name} onChangeText={setName} placeholder="Username" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <Pressable disabled={saving} onPress={() => onSave(name.trim())} style={({ pressed }) => [styles.primaryButton, styles.accountButton, pressed && styles.pressed]}>
          {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryButtonText}>Save profile</Text>}
        </Pressable>

        <Text style={styles.formLabel}>Theme</Text>
        <View style={styles.segment}>
          {['dark', 'light'].map((mode) => (
            <Pressable key={mode} onPress={() => onThemeChange(mode)} style={[styles.segmentButton, theme === mode && styles.segmentButtonActive]}>
              <Text style={[styles.segmentText, theme === mode && styles.segmentTextActive]}>{mode}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={onContact} style={styles.settingsRow}>
          <Ionicons name="mail-outline" size={21} color={colors.ink} />
          <Text style={styles.settingsRowText}>Contact us</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Pressable onPress={onLogout} style={styles.settingsRow}>
          <Ionicons name="log-out-outline" size={21} color={colors.ink} />
          <Text style={styles.settingsRowText}>Sign out</Text>
        </Pressable>
        <Pressable onPress={onDeleteAccount} style={styles.settingsRowDanger}>
          <Ionicons name="trash-outline" size={21} color={colors.red} />
          <Text style={styles.settingsRowDangerText}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactPage({ onBack }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageHeader}>
        <IconButton name="chevron-back" label="Back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageHeaderTitle}>Contact us</Text>
          <Text style={styles.pageHeaderSubtitle}>Reach the Starlight Station team.</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.contactCard}>
          <Ionicons name="mail" size={30} color={colors.accent} />
          <Text style={styles.contactTitle}>Need help?</Text>
          <Text style={styles.contactCopy}>Send questions, bug reports, release ideas, or account requests to the support inbox.</Text>
          <Text selectable style={styles.contactEmail}>support@raremotionhub.com</Text>
        </View>
        <View style={styles.contactCard}>
          <Ionicons name="chatbubble-ellipses" size={30} color={colors.blue} />
          <Text style={styles.contactTitle}>Collaborator support</Text>
          <Text style={styles.contactCopy}>For urgent project access or upload issues, include your account email and the project name.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MessagesPage({ conversations, loading, onBack }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageHeader}>
        <IconButton name="chevron-back" label="Back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageHeaderTitle}>Messages</Text>
          <Text style={styles.pageHeaderSubtitle}>Collaborator conversations.</Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.pageContent}>
          {conversations.length === 0 ? (
            <EmptyState icon="chatbubble-ellipses-outline" title="No messages yet" copy="Your chats will appear here when collaborators message you." />
          ) : conversations.map((conversation) => (
            <View key={conversation.id} style={styles.fullRow}>
              <ProfileAvatar user={conversation.partner || { name: 'Group' }} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fullRowTitle}>{conversation.name || conversation.partner?.name || 'Group Chat'}</Text>
                <Text numberOfLines={1} style={styles.fullRowMeta}>{conversation.lastMessage?.text || 'No messages yet'}</Text>
              </View>
              {conversation.unreadCount > 0 && <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MoveProjectPage({ project, folders, onBack, onMove }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageHeader}>
        <IconButton name="chevron-back" label="Back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageHeaderTitle}>Move project</Text>
          <Text numberOfLines={1} style={styles.pageHeaderSubtitle}>{project?.title || project?.name || 'Untitled project'}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Pressable onPress={() => onMove(null)} style={styles.settingsRow}>
          <Ionicons name="albums-outline" size={21} color={colors.ink} />
          <Text style={styles.settingsRowText}>Library root</Text>
        </Pressable>
        {folders.map((folder) => (
          <Pressable key={folder.id} onPress={() => onMove(folder.id)} style={styles.settingsRow}>
            <Ionicons name="folder-outline" size={21} color={colors.ink} />
            <Text numberOfLines={1} style={styles.settingsRowText}>{folder.title || folder.name || 'Untitled folder'}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LibraryScreen({ user, workspace, loading, refreshing, onRefresh, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onPlayProject, onNotifications, onProfile, onMessages }) {
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
        onNotifications={onNotifications}
        onProfile={onProfile}
        onMessages={onMessages}
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

function FolderScreen({ user, folderData, loading, onBack, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onPlayProject, onNotifications, onProfile, onMessages, notificationCount }) {
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
        onMessages={onMessages}
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
  const [profileSaving, setProfileSaving] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [conversations, setConversations] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [playback, setPlayback] = useState({ player: null, track: null, project: null, tracks: [], playing: false });
  const playerRef = useRef(null);

  const allFolders = useMemo(() => {
    const byId = new Map();
    workspace.folders.forEach((folder) => byId.set(folder.id, folder));
    if (folderData?.folder) byId.set(folderData.folder.id, folderData.folder);
    (folderData?.folders || []).forEach((folder) => byId.set(folder.id, folder));
    return Array.from(byId.values());
  }, [workspace.folders, folderData]);

  const goLibrary = () => setRoute({ name: 'library' });

  const goBack = () => {
    if (route.name === 'library') return;
    if (route.name === 'contact') return setRoute(route.from || { name: 'account' });
    if (route.name === 'messages') return setRoute(route.from || { name: 'library' });
    if (route.name === 'move-project') return setRoute(route.from || { name: 'library' });
    if (route.name === 'notifications' || route.name === 'account') return setRoute(route.from || { name: 'library' });
    if (route.name === 'project') {
      if (projectData?.project?.folderId) return openFolder(projectData.project.folderId);
      return goLibrary();
    }
    return goLibrary();
  };

  const edgeSwipeResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) => {
      if (route.name === 'library') return false;
      const screenWidth = Dimensions.get('window').width;
      const startX = event.nativeEvent.pageX;
      const startsAtEdge = startX < 28 || startX > screenWidth - 28;
      return startsAtEdge && Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4;
    },
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) > 70) {
        goBack();
      }
    }
  });

  const openMoveProject = (project) => {
    setRoute({ name: 'move-project', project, from: route });
  };

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
    const project = route.project;
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
      const previousRoute = route.from;
      if (previousRoute?.name === 'folder') await openFolder(previousRoute.id);
      else goLibrary();
    } catch (error) {
      Alert.alert('Could not move project', error.message);
    }
  };

  const openMessages = async () => {
    setRoute({ name: 'messages', from: route });
    setMessagesLoading(true);
    try {
      const data = await api(`/api/conversations?userId=${encodeURIComponent(user.id)}`);
      setConversations(data.conversations || []);
    } catch (error) {
      Alert.alert('Could not load messages', error.message);
    } finally {
      setMessagesLoading(false);
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
    } catch (error) {
      Alert.alert('Could not save profile', error.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const pickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access to update your profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const extension = asset.uri.split('.').pop() || 'jpg';
      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri,
        name: `avatar.${extension}`,
        type: asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`
      });

      const response = await fetch(`${API_URL}/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update profile picture.');
      await storeUser(data.user);
      setUser(data.user);
    } catch (error) {
      Alert.alert('Could not update profile picture', error.message);
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

  const currentScreen = route.name === 'notifications' ? (
    <NotificationsPage
      notifications={workspace.notifications}
      onBack={goBack}
      onMarkRead={markNotificationsRead}
    />
  ) : route.name === 'account' ? (
    <AccountPage
      user={user}
      theme={theme}
      saving={profileSaving}
      onBack={goBack}
      onSave={saveProfile}
      onPickAvatar={pickAvatar}
      onThemeChange={setTheme}
      onLogout={logout}
      onDeleteAccount={deleteAccount}
      onContact={() => setRoute({ name: 'contact', from: { name: 'account' } })}
    />
  ) : route.name === 'contact' ? (
    <ContactPage onBack={() => setRoute(route.from || { name: 'account' })} />
  ) : route.name === 'messages' ? (
    <MessagesPage
      conversations={conversations}
      loading={messagesLoading}
      onBack={() => setRoute(route.from || { name: 'library' })}
    />
  ) : route.name === 'move-project' ? (
    <MoveProjectPage
      project={route.project}
      folders={allFolders.filter((folder) => folder.id !== route.project?.folderId)}
      onBack={() => setRoute(route.from || { name: 'library' })}
      onMove={moveSelectedProject}
    />
  ) : route.name === 'project' ? (
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
      onBack={goBack}
      onOpenFolder={openFolder}
      onOpenProject={openProject}
      onCreateProject={createProject}
      onCreateFolder={createFolder}
      onMoveProject={openMoveProject}
      onPlayProject={playProject}
      onNotifications={() => setRoute({ name: 'notifications', from: route })}
      onProfile={() => setRoute({ name: 'account', from: route })}
      onMessages={openMessages}
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
      onMoveProject={openMoveProject}
      onPlayProject={playProject}
      onNotifications={() => setRoute({ name: 'notifications', from: route })}
      onProfile={() => setRoute({ name: 'account', from: route })}
      onMessages={openMessages}
    />
  );

  return (
    <View style={styles.app} {...edgeSwipeResponder.panHandlers}>
      {currentScreen}
      <MiniPlayer playback={playback} onToggle={togglePlayback} onClose={closePlayer} />
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
    fontSize: 22,
    lineHeight: 25,
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
    fontSize: 22,
    lineHeight: 25,
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
    minWidth: 190,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#303030',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10
  },
  addPillText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 18
  },
  addMenu: {
    width: '76%',
    maxWidth: 310,
    borderRadius: 28,
    backgroundColor: '#303030',
    paddingVertical: 12,
    marginBottom: 14,
    overflow: 'hidden'
  },
  addMenuRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24
  },
  addMenuText: {
    color: colors.ink,
    fontSize: 19,
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
  pageHeader: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16
  },
  pageHeaderTitle: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: 0
  },
  pageHeaderSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700'
  },
  pageContent: {
    paddingHorizontal: 18,
    paddingBottom: 140,
    gap: 12
  },
  textPill: {
    minWidth: 58,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft
  },
  textPillText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900'
  },
  fullRow: {
    minHeight: 76,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border
  },
  fullRowTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900'
  },
  fullRowMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  rowDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#0A84FF'
  },
  unreadCount: {
    minWidth: 26,
    overflow: 'hidden',
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: colors.bg,
    backgroundColor: colors.accent,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900'
  },
  accountHero: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 6
  },
  avatarEdit: {
    position: 'relative',
    marginBottom: 12
  },
  avatarCamera: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.bg
  },
  accountName: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900'
  },
  accountEmail: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700'
  },
  formLabel: {
    marginTop: 12,
    marginBottom: 8,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  accountButton: {
    marginTop: 12,
    marginBottom: 8
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
  settingsRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border
  },
  settingsRowText: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  settingsRowDanger: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,92,108,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,108,0.18)'
  },
  settingsRowDangerText: {
    flex: 1,
    color: colors.red,
    fontSize: 16,
    fontWeight: '900'
  },
  contactCard: {
    borderRadius: 26,
    padding: 22,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border
  },
  contactTitle: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900'
  },
  contactCopy: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700'
  },
  contactEmail: {
    marginTop: 16,
    color: colors.accent,
    fontSize: 16,
    fontWeight: '900'
  }
});
