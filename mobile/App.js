import { StatusBar } from 'expo-status-bar';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
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
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { API_URL, api, resolveMediaUrl } from './src/api';
import { clearUser, getLastEmail, getOfflineTracks, getStoredUser, storeLastEmail, storeOfflineTracks, storeUser } from './src/storage';
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
      <Ionicons name={name} size={18} color={tone === 'light' ? colors.bg : colors.ink} />
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
  const boxStyle = size === 'small' ? styles.artSmall : size === 'hero' ? styles.projectHeroArt : size === 'record' ? styles.recordArt : styles.art;
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

function formatDuration(seconds = 0) {
  const clean = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(clean / 60)}:${String(clean % 60).padStart(2, '0')}`;
}

function Waveform({ progress = 0.34, compact = false, onSeek }) {
  const [width, setWidth] = useState(0);
  const bars = Array.from({ length: compact ? 34 : 58 }, (_, index) => {
    const value = Math.sin(index * 0.78) + Math.cos(index * 0.31);
    return 10 + Math.abs(value) * (compact ? 13 : 24);
  });
  const cursor = `${Math.max(4, Math.min(96, progress * 100))}%`;

  const seekResponder = useMemo(() => {
    if (!onSeek) return null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (!width) return;
        const x = e.nativeEvent.locationX;
        onSeek(Math.max(0, Math.min(1, x / width)));
      },
      onPanResponderMove: (e) => {
        if (!width) return;
        const x = e.nativeEvent.locationX;
        onSeek(Math.max(0, Math.min(1, x / width)));
      }
    });
  }, [onSeek, width]);

  return (
    <View
      style={[styles.waveform, compact && styles.waveformCompact]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...(seekResponder ? seekResponder.panHandlers : {})}
    >
      {bars.map((height, index) => {
        const barProgress = index / bars.length;
        const played = barProgress < progress;
        return (
          <View
            key={index}
            style={[
              styles.waveBar,
              compact && styles.waveBarCompact,
              { height, backgroundColor: played ? colors.accent : (compact ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.72)') }
            ]}
          />
        );
      })}
      <View style={[styles.waveCursor, { left: cursor }]} />
    </View>
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

function ProjectCard({ project, tracks, onOpen, onMove, onPlay, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
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
        <Pressable onPress={() => setMenuOpen((value) => !value)} style={styles.cardMore} accessibilityLabel="Project options">
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.ink} />
        </Pressable>
      </View>
      {menuOpen && (
        <View style={styles.cardMenu}>
          <Pressable onPress={() => { setMenuOpen(false); onMove(); }} style={styles.cardMenuRow}>
            <Ionicons name="folder-open-outline" size={17} color={colors.ink} />
            <Text style={styles.cardMenuText}>Move</Text>
          </Pressable>
          <Pressable onPress={() => { setMenuOpen(false); onDelete(); }} style={styles.cardMenuRow}>
            <Ionicons name="trash-outline" size={17} color="#FF6961" />
            <Text style={[styles.cardMenuText, styles.cardMenuDanger]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

function FolderCard({ folder, projects, tracks, onOpen, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
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
        <Pressable onPress={() => setMenuOpen((value) => !value)} style={styles.cardMore} accessibilityLabel="Folder options">
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.ink} />
        </Pressable>
      </View>
      {menuOpen && (
        <View style={styles.cardMenu}>
          <Pressable onPress={() => { setMenuOpen(false); onDelete(); }} style={styles.cardMenuRow}>
            <Ionicons name="trash-outline" size={17} color="#FF6961" />
            <Text style={[styles.cardMenuText, styles.cardMenuDanger]}>Delete</Text>
          </Pressable>
        </View>
      )}
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

function CreateBar({ onCreateProject, onCreateFolder, hasPlayback }) {
  const [open, setOpen] = useState(false);

  return (
    <View pointerEvents="box-none" style={hasPlayback ? styles.createWrapPlayback : styles.createWrap}>
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
      <Pressable onPress={() => setOpen((value) => !value)} style={({ pressed }) => [hasPlayback ? styles.addFabSmall : styles.addPill, pressed && styles.pressed]}>
        <Ionicons name={open ? 'close' : 'add'} size={22} color={colors.ink} />
        {!hasPlayback && <Text style={styles.addPillText}>{open ? 'Close' : 'Add'}</Text>}
      </Pressable>
    </View>
  );
}

function PlayingBars({ playing }) {
  const b0 = useRef(new Animated.Value(0.3)).current;
  const b1 = useRef(new Animated.Value(0.6)).current;
  const b2 = useRef(new Animated.Value(0.4)).current;
  const bars = [b0, b1, b2];
  useEffect(() => {
    if (!playing) { bars.forEach(b => b.setValue(0.3)); return; }
    const anims = bars.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 300 + i * 120, useNativeDriver: true }),
        Animated.timing(bar, { toValue: 0.2, duration: 300 + i * 120, useNativeDriver: true }),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [playing]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, width: 18, height: 18 }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{ width: 4, backgroundColor: colors.accent, borderRadius: 2, flex: 1, transform: [{ scaleY: bar }] }} />
      ))}
    </View>
  );
}

<<<<<<< HEAD
=======
function MarqueeText({ text, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    if (!containerWidth || !textWidth || textWidth <= containerWidth) {
      anim.setValue(0);
      return;
    }
    const distance = textWidth - containerWidth + 16;
    const run = () => {
      anim.setValue(0);
      animRef.current = Animated.sequence([
        Animated.delay(2000),
        Animated.timing(anim, { toValue: -distance, duration: distance * 18, useNativeDriver: true }),
        Animated.delay(2000),
      ]);
      animRef.current.start(({ finished }) => { if (finished) run(); });
    };
    run();
    return () => animRef.current?.stop();
  }, [containerWidth, textWidth, text]);

  return (
    <View
      style={{ overflow: 'hidden', flex: 1 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text
        numberOfLines={1}
        style={[style, { transform: [{ translateX: anim }] }]}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

>>>>>>> 5be370b7c38ab20154ec8b23256a4f20ee1cf485
function MiniPlayer({ playback, onToggle, onOpen, onShare }) {
  if (!playback.track) return null;
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.miniPlayer, pressed && styles.pressed]}>
      <Artwork item={playback.project || playback.track} size="small">
        <Pressable onPress={onToggle} style={styles.miniArtButton}>
          <Ionicons name={playback.playing ? 'pause' : 'play'} size={18} color={colors.ink} />
        </Pressable>
      </Artwork>
      <View style={styles.miniCopy}>
        <MarqueeText text={playback.track.title || 'Untitled track'} style={styles.miniTitle} />
        <Text numberOfLines={1} style={styles.miniMeta}>{playback.track.artist || playback.project?.artist || playback.project?.title || 'Now playing'}</Text>
      </View>
      <Waveform compact progress={playback.progress || 0.36} />
      <Pressable onPress={onShare} style={styles.miniShareButton}>
        <Ionicons name="share-outline" size={22} color={colors.ink} />
      </Pressable>
    </Pressable>
  );
}

function NowPlayingPage({ playback, settings, onBack, onToggle, onEdit, onShare, onSeekPrevious, onSeekNext, onToggleRepeat, onSeek }) {
  const track = playback.track;
  const project = playback.project;
  if (!track) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.pageHeader}>
          <IconButton name="chevron-back" label="Back" onPress={onBack} />
          <Text style={styles.pageHeaderTitle}>Now playing</Text>
        </View>
      </SafeAreaView>
    );
  }
  const duration = Number(track.duration) || 123;
  const elapsed = Math.max(0, Math.round(duration * (playback.progress || 0)));
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.playerPage}>
        <View style={styles.nowPlayingCard}>
          <MarqueeText text={track.title || 'Untitled track'} style={styles.nowTitle} />
          <Text numberOfLines={1} style={styles.nowMeta}>{track.artist || project?.artist || 'Unknown artist'} - {track.producer || project?.title || project?.name || 'Project'}</Text>
          <Artwork item={project || track} size="record" />
          <Waveform progress={playback.progress || 0} onSeek={onSeek} />
          <Text style={styles.playerTime}>{formatDuration(elapsed)} / {formatDuration(duration)}</Text>
          <View style={styles.transportRow}>
            <Pressable onPress={onShare} style={styles.transportButtonPlain}>
              <Ionicons name="share-outline" size={30} color={colors.ink} />
            </Pressable>
            <Pressable onPress={onSeekPrevious} style={styles.transportButtonPlain}>
              <Ionicons name="play-back" size={32} color={colors.ink} />
            </Pressable>
            <Pressable onPress={onToggle} style={styles.transportButtonPlain}>
              <Ionicons name={playback.playing ? 'pause' : 'play'} size={46} color={colors.ink} />
            </Pressable>
            <Pressable onPress={onSeekNext} style={styles.transportButtonPlain}>
              <Ionicons name="play-forward" size={32} color={colors.ink} />
            </Pressable>
            <Pressable onPress={onToggleRepeat} style={styles.transportButtonPlain}>
              <Ionicons name="repeat" size={28} color={playback.repeat ? colors.accent : colors.ink} />
            </Pressable>
          </View>
        </View>
        <View style={styles.playerFooterActions}>
          <Pressable style={styles.playerFooterAction}>
            <Ionicons name="document-text-outline" size={31} color={colors.ink} />
            <Text style={styles.playerFooterText}>notes</Text>
          </Pressable>
          <View style={styles.playerFooterDivider} />
          <Pressable onPress={onEdit} style={styles.playerFooterAction}>
            <Ionicons name="options-outline" size={32} color={colors.ink} />
            <Text style={styles.playerFooterText}>edit</Text>
          </Pressable>
        </View>
        <Text style={styles.playerSettingHint}>Speed {Math.round(settings.speed * 100)}% - Pitch {settings.pitch} st</Text>
      </View>
    </SafeAreaView>
  );
}

function PlayerEditPage({ playback, settings, onBack, onSave, onCancel, onToggle, onChangeSpeed, onChangePitch, onSeek }) {
  const track = playback.track;
  const project = playback.project;
  const duration = Number(track?.duration) || 123;
<<<<<<< HEAD
  const elapsed = Math.max(28, Math.round(duration * (playback.progress || 0.23)));
=======
  const elapsed = Math.max(0, Math.round(duration * (playback.progress || 0)));
>>>>>>> 5be370b7c38ab20154ec8b23256a4f20ee1cf485

  // Attach the swipe responder only to the drag handle at the top so the
  // ScrollView beneath it never competes for the gesture.
  const dragHandleResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      gesture.dy > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.8,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 48) onCancel();
    }
  }), [onCancel]);

  return (
    <SafeAreaView style={styles.screen}>
      {/* Dedicated drag handle — touch area is generous and isolated from ScrollView */}
      <View
        {...dragHandleResponder.panHandlers}
        accessibilityLabel="Swipe down to dismiss"
        style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6, cursor: 'grab' }}
      >
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />
      </View>
      <ScrollView contentContainerStyle={styles.editorPage}>
        <View style={styles.editorTop}>
          <Pressable onPress={onCancel} style={styles.editorPill}><Text style={styles.editorPillText}>Cancel</Text></Pressable>
          <Pressable onPress={onSave} style={[styles.editorPill, styles.editorPillDim]}><Text style={styles.editorPillText}>Save</Text></Pressable>
        </View>
        <Text numberOfLines={1} style={styles.editorTitle}>{track?.title || 'Untitled track'}</Text>
        <Text numberOfLines={1} style={styles.editorMeta}>{track?.artist || project?.artist || 'Unknown artist'} - {track?.producer || project?.title || project?.name || 'Project'}</Text>
        <View style={styles.editorChips}>
          <Text style={styles.editorChip}>G Min</Text>
          <Text style={styles.editorChip}>Tempo pending</Text>
          <Text style={styles.editorChip}>Settings</Text>
        </View>
        <Waveform progress={playback.progress || 0} onSeek={onSeek} />
        <Text style={styles.playerTime}>{formatDuration(elapsed)} / {formatDuration(duration)}</Text>
        <View style={styles.editorTransport}>
          <Pressable style={styles.editorTransportButton}><Ionicons name="play-skip-back" size={31} color={colors.ink} /></Pressable>
          <Pressable style={styles.loopButton}><Text style={styles.loopButtonText}>Hold to loop</Text></Pressable>
          <Pressable onPress={onToggle} style={styles.editorTransportButton}><Ionicons name={playback.playing ? 'pause' : 'play'} size={31} color={colors.ink} /></Pressable>
        </View>
        <View style={styles.modeRow}>
          <Text style={styles.modeActive}>VARISPEED</Text>
          <Text style={styles.modeInactive}>GAIN</Text>
        </View>
        <StepperControl label="Speed" value={`${Math.round(settings.speed * 100)}%`} onMinus={() => onChangeSpeed(-0.05)} onPlus={() => onChangeSpeed(0.05)} />
        <StepperControl label="Pitch" value={`${settings.pitch} st`} onMinus={() => onChangePitch(-1)} onPlus={() => onChangePitch(1)} />
        <Waveform compact progress={playback.progress || 0.23} />
        <View style={styles.editorTabs}>
          <Text style={styles.editorTabActive}>Adjust</Text>
          <Text style={styles.editorTab}>Stems</Text>
          <Text style={styles.editorTab}>EQ</Text>
          <Pressable style={styles.recordDot}><View style={styles.recordDotInner} /></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepperControl({ label, value, onMinus, onPlus }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable onPress={onMinus} style={styles.stepperButton}><Ionicons name="remove" size={20} color={colors.muted} /></Pressable>
      <View style={styles.stepperTicks}>
        {Array.from({ length: 9 }, (_, index) => <View key={index} style={styles.stepperTick} />)}
      </View>
      <Pressable onPress={onPlus} style={styles.stepperButton}><Ionicons name="add" size={20} color={colors.muted} /></Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
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

function LibraryScreen({ user, workspace, loading, refreshing, onRefresh, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onDeleteProject, onDeleteFolder, onPlayProject, onNotifications, onProfile, onMessages, playback }) {
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
              onDelete={() => onDeleteFolder(item.item)}
            />
          ) : (
            <ProjectCard
              project={item.item}
              tracks={workspace.tracks}
              onOpen={() => onOpenProject(item.item.id)}
              onMove={() => onMoveProject(item.item)}
              onDelete={() => onDeleteProject(item.item)}
              onPlay={() => onPlayProject(item.item)}
            />
          )}
        />
      )}
      <CreateBar onCreateProject={onCreateProject} onCreateFolder={onCreateFolder} hasPlayback={!!playback?.track} />
    </SafeAreaView>
  );
}

function FolderScreen({ user, folderData, loading, onBack, onOpenFolder, onOpenProject, onCreateProject, onCreateFolder, onMoveProject, onDeleteProject, onDeleteFolder, onPlayProject, onNotifications, onProfile, onMessages, notificationCount, playback }) {
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
            <FolderCard folder={item.item} projects={[]} tracks={tracks} onOpen={() => onOpenFolder(item.item.id)} onDelete={() => onDeleteFolder(item.item)} />
          ) : (
            <ProjectCard
              project={item.item}
              tracks={tracks}
              onOpen={() => onOpenProject(item.item.id)}
              onMove={() => onMoveProject(item.item)}
              onDelete={() => onDeleteProject(item.item)}
              onPlay={() => onPlayProject(item.item, tracks)}
            />
          )}
        />
      )}
      <CreateBar onCreateProject={onCreateProject} onCreateFolder={onCreateFolder} hasPlayback={!!playback?.track} />
    </SafeAreaView>
  );
}

function formatTrackDate(track) {
  const raw = track.uploadedAt || track.createdAt;
  if (!raw) return '';
  return new Date(raw).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function ProjectScreen({
  projectData,
  loading,
  uploadingTrack,
  offlineTracks,
  onBack,
  onPlayTrack,
  onShare,
  onPickCover,
  onDeleteCover,
  onAddTrack,
  onToggleOffline,
  playingTrackId,
  playback
}) {
  const project = projectData?.project;
  const tracks = projectData?.tracks || [];
  const totalSeconds = tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
  const durationText = totalSeconds
    ? `${Math.floor(totalSeconds / 60)}m ${Math.round(totalSeconds % 60)}s`
    : `${tracks.length} track${tracks.length === 1 ? '' : 's'}`;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.projectContent}>
        <View style={styles.projectTopBar}>
          <IconButton name="chevron-back" label="Back" onPress={onBack} />
          <View style={styles.projectTopActions}>
            <IconButton name="link" label="Share project" onPress={onShare} />
            <IconButton name="ellipsis-horizontal" label="Project options" onPress={onDeleteCover} />
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
        ) : (
          <>
            <Pressable onPress={onPickCover}>
              <Artwork item={project} size="hero" />
            </Pressable>
            <View style={styles.projectInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectTitle}>{project?.title || project?.name || 'Untitled project'}</Text>
                <Text style={styles.projectArtist}>
                  {project?.artist || 'Unknown artist'} - {tracks.length} track{tracks.length === 1 ? '' : 's'} - {durationText}
                </Text>
              </View>
              <Pressable
                onPress={() => tracks[0] && onPlayTrack(tracks[0], project, tracks)}
                style={({ pressed }) => [styles.projectPlayButton, pressed && styles.pressed]}
              >
                <Ionicons name="play" size={28} color={colors.bg} style={{ marginLeft: 3 }} />
              </Pressable>
            </View>
            <Pressable onPress={onAddTrack} disabled={uploadingTrack} style={({ pressed }) => [styles.addTracksButton, pressed && styles.pressed]}>
              {uploadingTrack ? <ActivityIndicator color={colors.ink} /> : <Ionicons name="add" size={22} color={colors.ink} />}
              <Text style={styles.addTracksText}>{uploadingTrack ? 'Uploading...' : 'Add tracks'}</Text>
            </Pressable>
            <View style={styles.trackList}>
              {tracks.length === 0 ? (
                <EmptyState icon="musical-notes-outline" title="No tracks yet" copy="Tracks added on desktop will appear here." />
              ) : tracks.map((track, index) => (
                <Pressable key={track.id} onPress={() => onPlayTrack(track, project, tracks)} style={({ pressed }) => [styles.trackRow, pressed && styles.pressed]}>
                  {playingTrackId === track.id
                    ? <PlayingBars playing={playback?.playing ?? false} />
                    : <Text style={styles.trackIndex}>{index + 1}</Text>}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.trackTitle}>{track.title || 'Untitled track'}</Text>
                    <Text numberOfLines={1} style={styles.trackMeta}>
                      {track.artist || track.producer || project?.artist || 'Track'}{formatTrackDate(track) ? ` - ${formatTrackDate(track)}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => onToggleOffline(track)} style={styles.trackIconButton}>
                    <Ionicons name={offlineTracks[track.id] ? 'checkmark-circle' : 'download-outline'} size={20} color={offlineTracks[track.id] ? colors.accent : colors.muted} />
                  </Pressable>
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.ink} />
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
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [offlineTracks, setOfflineTracks] = useState({});
  const [playbackSettings, setPlaybackSettings] = useState({ speed: 1, pitch: 0 });
  const [playback, setPlayback] = useState({ player: null, track: null, project: null, tracks: [], playing: false, progress: 0.12, repeat: false });
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
    if (route.name === 'player-edit') return setRoute({ name: 'now-playing', from: route.from || { name: 'library' } });
    if (route.name === 'now-playing') return setRoute(route.from || { name: 'library' });
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
      // Widened edge zone (48px) and lower dx threshold for easier activation
      const startsAtEdge = startX < 48 || startX > screenWidth - 48;
      return startsAtEdge && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1;
    },
    onPanResponderRelease: (_event, gesture) => {
      // Lower release threshold from 70 to 50 for easier completion
      if (Math.abs(gesture.dx) > 50) {
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

  useEffect(() => {
    getOfflineTracks().then(setOfflineTracks).catch(() => {});
  }, []);

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

  useEffect(() => {
    if (!playback.playing || !playback.track) return undefined;
    const timer = setInterval(() => {
      setPlayback((prev) => {
        if (!prev.playing || !prev.track) return prev;
        const duration = Number(prev.track.duration) || 123;
        const next = (prev.progress || 0) + (1 / duration);
        if (next >= 1 && prev.repeat) {
          playerRef.current?.seekTo?.(0);
          return { ...prev, progress: 0.01 };
        }
        if (next >= 1) {
          playerRef.current?.pause?.();
          return { ...prev, progress: 1, playing: false };
        }
        return { ...prev, progress: next };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playback.playing, playback.track?.id, playback.repeat]);

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

  const deleteProject = (project) => {
    if (!project) return;
    Alert.alert('Delete project?', `${project.title || project.name || 'This project'} and its tracks will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/projects/${project.id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
            if (projectData?.project?.id === project.id) setProjectData(null);
            if (route.name === 'folder') await openFolder(route.id);
            await refreshWorkspace();
          } catch (error) {
            Alert.alert('Could not delete project', error.message);
          }
        }
      }
    ]);
  };

  const deleteFolder = (folder) => {
    if (!folder) return;
    Alert.alert('Delete folder?', 'Projects inside this folder will move back to the library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/folders/${folder.id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
            if (route.name === 'folder' && route.id === folder.id) goLibrary();
            else if (route.name === 'folder') await openFolder(route.id);
            await refreshWorkspace();
          } catch (error) {
            Alert.alert('Could not delete folder', error.message);
          }
        }
      }
    ]);
  };

  const refreshProject = async (projectId = projectData?.project?.id) => {
    if (!projectId || !user?.id) return;
    const data = await api(`/api/projects/${projectId}?userId=${encodeURIComponent(user.id)}`);
    setProjectData(data);
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
      const source = offlineTracks[track.id] || resolveMediaUrl(track.url);
      if (!source) {
        Alert.alert('Track unavailable', 'This track does not have a playable URL yet.');
        return;
      }
      // Tear down previous player before creating a new one
      try { playerRef.current?.remove?.(); } catch (_) {}
      playerRef.current = null;

      const player = createAudioPlayer(source);
      playerRef.current = player;

      // setPlaybackRate signature varies across expo-audio versions; guard both forms
      try {
        if (typeof player.setPlaybackRate === 'function') {
          player.setPlaybackRate(playbackSettings.speed);
        }
      } catch (_) {}

      player.play();

      // Lock-screen metadata — only available in some expo-audio builds
      try {
        if (typeof player.setActiveForLockScreen === 'function') {
          player.setActiveForLockScreen(true, {
            title: track.title || 'Untitled track',
            artist: project?.artist || track.artist || 'Starlight Station',
            albumTitle: project?.title || project?.name || 'Project',
            artworkUrl: project?.coverArt
          });
        }
      } catch (_) {}

      setPlayback((prev) => ({ player, track, project, tracks, playing: true, progress: 0.01, repeat: prev.repeat }));
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

  const applySpeedAndPitch = (speed, pitch) => {
    const player = playerRef.current;
    if (!player) return;
    // Same formula as desktop: rate = speed × 2^(semitones/12)
    const combined = Math.max(0.25, Math.min(3, speed * Math.pow(2, pitch / 12)));
    try {
      if (typeof player.setPlaybackRate === 'function') {
        player.setPlaybackRate(combined);
      }
    } catch (_) {}
    // Disable browser pitch correction so we get real pitch shift (same as desktop preservesPitch=false)
    try {
      const audio = player._nativeAudio || player._audio || player.audioNode;
      if (audio) {
        audio.preservesPitch = false;
        audio.mozPreservesPitch = false;
        audio.webkitPreservesPitch = false;
      }
    } catch (_) {}
  };

  const adjustPlaybackSpeed = (delta) => {
    const speed = Math.max(0.5, Math.min(2, Number((playbackSettings.speed + delta).toFixed(2))));
    setPlaybackSettings((prev) => ({ ...prev, speed }));
<<<<<<< HEAD
    try {
      if (typeof playerRef.current?.setPlaybackRate === 'function') {
        playerRef.current.setPlaybackRate(speed);
      }
    } catch (_) {}
=======
    applySpeedAndPitch(speed, playbackSettings.pitch);
>>>>>>> 5be370b7c38ab20154ec8b23256a4f20ee1cf485
  };

  const adjustPlaybackPitch = (delta) => {
    const pitch = Math.max(-12, Math.min(12, playbackSettings.pitch + delta));
    setPlaybackSettings((prev) => ({ ...prev, pitch }));
    applySpeedAndPitch(playbackSettings.speed, pitch);
  };

  const seekRelative = async (seconds) => {
    if (!playerRef.current || !playback.track) return;
    const duration = Number(playback.track.duration) || 123;
    const current = Math.max(0, Math.min(duration, duration * (playback.progress || 0.12) + seconds));
    await playerRef.current.seekTo?.(current);
    setPlayback((prev) => ({ ...prev, progress: duration ? current / duration : prev.progress }));
  };

  const toggleRepeat = () => {
    setPlayback((prev) => ({ ...prev, repeat: !prev.repeat }));
  };

  const closePlayer = async () => {
    playerRef.current?.clearLockScreenControls?.();
    playerRef.current?.remove?.();
    playerRef.current = null;
    setPlayback((prev) => ({ player: null, track: null, project: null, tracks: [], playing: false, progress: 0.12, repeat: prev.repeat }));
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

  const pickProjectCover = async () => {
    const project = projectData?.project;
    if (!project) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access to update cover art.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const extension = asset.uri.split('.').pop() || 'jpg';
      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('projectId', project.id);
      formData.append('cover', {
        uri: asset.uri,
        name: `cover.${extension}`,
        type: asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`
      });
      const uploadRes = await fetch(`${API_URL}/api/upload-cover`, { method: 'POST', body: formData });
      const cover = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(cover.error || 'Could not upload cover art.');
      await api(`/api/projects/${project.id}/cover`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, coverUrl: cover.url })
      });
      setProjectData((prev) => ({ ...prev, project: { ...prev.project, coverArt: cover.url } }));
      await refreshWorkspace();
    } catch (error) {
      Alert.alert('Could not update cover art', error.message);
    }
  };

  const deleteProjectCover = () => {
    const project = projectData?.project;
    if (!project?.coverArt) {
      Alert.alert('Cover art', 'This project does not have cover art yet.');
      return;
    }
    Alert.alert('Remove cover art?', 'The project will return to its generated artwork.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/projects/${project.id}/cover`, {
              method: 'PUT',
              body: JSON.stringify({ userId: user.id, coverUrl: null })
            });
            setProjectData((prev) => ({ ...prev, project: { ...prev.project, coverArt: null } }));
            await refreshWorkspace();
          } catch (error) {
            Alert.alert('Could not remove cover art', error.message);
          }
        }
      }
    ]);
  };

  const addTrackFromDevice = async () => {
    const project = projectData?.project;
    if (!project) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingTrack(true);
      const title = asset.name?.replace(/\.[^/.]+$/, '') || 'Untitled track';
      const formData = new FormData();
      formData.append('track', {
        uri: asset.uri,
        name: asset.name || `${title}.mp3`,
        type: asset.mimeType || 'audio/mpeg'
      });
      formData.append('title', title);
      formData.append('artist', project.artist || user.name || '');
      formData.append('producer', '');
      formData.append('userId', user.id);
      formData.append('projectId', project.id);
      const response = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not upload track.');
      await refreshProject(project.id);
      await refreshWorkspace();
    } catch (error) {
      Alert.alert('Could not add track', error.message);
    } finally {
      setUploadingTrack(false);
    }
  };

  const toggleTrackOffline = async (track) => {
    try {
      if (offlineTracks[track.id]) {
        await FileSystem.deleteAsync(offlineTracks[track.id], { idempotent: true });
        const next = { ...offlineTracks };
        delete next[track.id];
        setOfflineTracks(next);
        await storeOfflineTracks(next);
        return;
      }
      const remoteUrl = resolveMediaUrl(track.url);
      if (!remoteUrl) {
        Alert.alert('Track unavailable', 'This track does not have a downloadable URL yet.');
        return;
      }
      const destination = `${FileSystem.documentDirectory}${track.id}.audio`;
      await FileSystem.downloadAsync(remoteUrl, destination);
      const next = { ...offlineTracks, [track.id]: destination };
      setOfflineTracks(next);
      await storeOfflineTracks(next);
      Alert.alert('Available offline', `${track.title || 'Track'} was saved on this device.`);
    } catch (error) {
      Alert.alert('Could not save offline', error.message);
    }
  };

  const shareProject = async () => {
    const project = projectData?.project;
    if (!project) return;
    try {
      const data = await api('/api/share/generate', {
        method: 'POST',
        body: JSON.stringify({ type: 'project', targetId: project.id })
      });
      const link = `${API_URL.replace(/\/$/, '')}/shared/link/${data.token}`;
      await Share.share({ message: link, url: link });
    } catch (error) {
      Alert.alert('Could not share project', error.message);
    }
  };

  const shareCurrentTrack = async () => {
    const track = playback.track;
    const url = resolveMediaUrl(track?.url);
    if (!url) {
      Alert.alert('Track unavailable', 'This track does not have a shareable URL yet.');
      return;
    }
    await Share.share({ message: url, url });
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

  const currentScreen = route.name === 'now-playing' ? (
    <NowPlayingPage
      playback={playback}
      settings={playbackSettings}
      onBack={() => setRoute(route.from || { name: 'library' })}
      onToggle={togglePlayback}
      onEdit={() => setRoute({ name: 'player-edit', from: route.from || { name: 'library' } })}
      onShare={shareCurrentTrack}
      onSeekPrevious={() => seekRelative(-15)}
      onSeekNext={() => seekRelative(15)}
      onToggleRepeat={toggleRepeat}
      onSeek={(ratio) => {
        const duration = Number(playback.track?.duration) || 123;
        const target = duration * ratio;
        playerRef.current?.seekTo?.(target);
        setPlayback((prev) => ({ ...prev, progress: ratio }));
      }}
    />
  ) : route.name === 'player-edit' ? (
    <PlayerEditPage
      playback={playback}
      settings={playbackSettings}
      onBack={() => setRoute({ name: 'now-playing', from: route.from || { name: 'library' } })}
      onCancel={() => setRoute({ name: 'now-playing', from: route.from || { name: 'library' } })}
      onSave={() => setRoute({ name: 'now-playing', from: route.from || { name: 'library' } })}
      onToggle={togglePlayback}
      onChangeSpeed={adjustPlaybackSpeed}
      onChangePitch={adjustPlaybackPitch}
      onSeek={(ratio) => {
        const duration = Number(playback.track?.duration) || 123;
        const target = duration * ratio;
        playerRef.current?.seekTo?.(target);
        setPlayback((prev) => ({ ...prev, progress: ratio }));
      }}
    />
  ) : route.name === 'notifications' ? (
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
      uploadingTrack={uploadingTrack}
      offlineTracks={offlineTracks}
      onBack={() => {
        if (projectData?.project?.folderId) openFolder(projectData.project.folderId);
        else setRoute({ name: 'library' });
      }}
      onPlayTrack={playTrack}
      onShare={shareProject}
      onPickCover={pickProjectCover}
      onDeleteCover={deleteProjectCover}
      onAddTrack={addTrackFromDevice}
      onToggleOffline={toggleTrackOffline}
      playingTrackId={playback.track?.id}
      playback={playback}
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
      onDeleteProject={deleteProject}
      onDeleteFolder={deleteFolder}
      onPlayProject={playProject}
      onNotifications={() => setRoute({ name: 'notifications', from: route })}
      onProfile={() => setRoute({ name: 'account', from: route })}
      onMessages={openMessages}
      notificationCount={workspace.notifications.filter((notification) => !notification.read).length}
      playback={playback}
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
      onDeleteProject={deleteProject}
      onDeleteFolder={deleteFolder}
      onPlayProject={playProject}
      onNotifications={() => setRoute({ name: 'notifications', from: route })}
      onProfile={() => setRoute({ name: 'account', from: route })}
      onMessages={openMessages}
      playback={playback}
    />
  );

  return (
    <View style={styles.app} {...edgeSwipeResponder.panHandlers}>
      {currentScreen}
      {route.name !== 'now-playing' && route.name !== 'player-edit' && (
        <MiniPlayer
          playback={playback}
          onToggle={togglePlayback}
          onOpen={() => setRoute({ name: 'now-playing', from: route })}
          onShare={shareCurrentTrack}
        />
      )}
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12
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
    width: 46,
    height: 46,
    borderRadius: 15,
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
    right: 13,
    top: 12,
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
    paddingHorizontal: 24,
    paddingBottom: 150,
    gap: 20
  },
  gridRow: {
    gap: 22,
    marginBottom: 24
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
  projectHeroArt: {
    width: '100%',
    maxWidth: 350,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.panelSoft
  },
  recordArt: {
    width: 216,
    height: 216,
    borderRadius: 108,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.panelSoft
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
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0
  },
  cardMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700'
  },
  cardTiny: {
    marginTop: 0,
    color: '#6E6A65',
    fontSize: 0,
    fontWeight: '800'
  },
  cardMore: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  cardMenu: {
    position: 'absolute',
    right: 0,
    bottom: 34,
    minWidth: 132,
    borderRadius: 14,
    backgroundColor: '#2D2D2D',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    zIndex: 10
  },
  cardMenuRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14
  },
  cardMenuText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800'
  },
  cardMenuDanger: {
    color: '#FF6961'
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
  createWrapPlayback: {
    position: 'absolute',
    right: 14,
    bottom: 40,
    alignItems: 'flex-end',
    justifyContent: 'flex-end'
  },
  addFabSmall: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#303030',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 140
  },
  projectTopBar: {
    minHeight: 64,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  projectTopActions: {
    flexDirection: 'row',
    gap: 10
  },
  projectInfoRow: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18
  },
  projectTitle: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: 0
  },
  projectArtist: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700'
  },
  projectPlayButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink
  },
  addTracksButton: {
    minHeight: 55,
    marginTop: 22,
    borderRadius: 13,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9
  },
  addTracksText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900'
  },
  trackList: {
    marginTop: 24,
    gap: 4
  },
  trackRow: {
    minHeight: 64,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    gap: 16
  },
  trackIndex: {
    width: 32,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 16,
    fontWeight: '500'
  },
  trackTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900'
  },
  trackMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700'
  },
  trackIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  waveform: {
    position: 'relative',
    height: 104,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden'
  },
  waveformCompact: {
    height: 50,
    flex: 0.74
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.72)'
  },
  waveBarCompact: {
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.62)'
  },
  waveCursor: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent
  },
  miniPlayer: {
    position: 'absolute',
    left: 14,
<<<<<<< HEAD
    right: 100,
=======
    right: 14,
>>>>>>> 5be370b7c38ab20154ec8b23256a4f20ee1cf485
    bottom: 40,
    height: 74,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10
  },
  miniArtButton: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)'
  },
  miniCopy: {
    flex: 1,
    minWidth: 0
  },
  miniShareButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
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
  playerPage: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 32,
    justifyContent: 'center'
  },
  nowPlayingCard: {
    width: '100%',
    borderRadius: 26,
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center'
  },
  nowTitle: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '500',
    letterSpacing: 0
  },
  nowMeta: {
    marginTop: 5,
    marginBottom: 30,
    color: colors.muted,
    fontSize: 16,
    fontWeight: '500'
  },
  playerTime: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  transportRow: {
    width: '100%',
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  transportButtonPlain: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playerFooterActions: {
    marginTop: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  playerFooterAction: {
    width: 128,
    alignItems: 'center',
    gap: 12
  },
  playerFooterText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '500'
  },
  playerFooterDivider: {
    width: 1,
    height: 82,
    backgroundColor: colors.border
  },
  playerSettingHint: {
    marginTop: 22,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700'
  },
  editorPage: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 48
  },
  editorTop: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  editorPill: {
    minWidth: 90,
    minHeight: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel
  },
  editorPillDim: {
    opacity: 0.62
  },
  editorPillText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700'
  },
  editorTitle: {
    marginTop: 10,
    color: colors.ink,
    textAlign: 'center',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '500'
  },
  editorMeta: {
    marginTop: 4,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500'
  },
  editorChips: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12
  },
  editorChip: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.panel,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600'
  },
  editorTransport: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  editorTransportButton: {
    width: 78,
    height: 66,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel
  },
  loopButton: {
    minWidth: 146,
    height: 66,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel
  },
  loopButtonText: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '500'
  },
  modeRow: {
    marginTop: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modeActive: {
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.accent,
    color: colors.bg,
    fontSize: 16,
    fontWeight: '900'
  },
  modeInactive: {
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.panel,
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700'
  },
  stepper: {
    marginTop: 16,
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: '#191919',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16
  },
  stepperLabel: {
    width: 62,
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700'
  },
  stepperButton: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperTicks: {
    flex: 1,
    minWidth: 76,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  stepperTick: {
    width: 3,
    height: 24,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  stepperValue: {
    width: 58,
    textAlign: 'right',
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700'
  },
  editorTabs: {
    marginTop: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  editorTabActive: {
    overflow: 'hidden',
    minWidth: 112,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: colors.panel,
    color: colors.ink,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700'
  },
  editorTab: {
    flex: 1,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700'
  },
  recordDot: {
    width: 76,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#191919'
  },
  recordDotInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF2D55'
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
