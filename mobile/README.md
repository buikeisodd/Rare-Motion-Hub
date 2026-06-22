# Rare Motion Hub Mobile

Expo mobile app for iOS and Android, connected to the existing Rare Motion Hub backend.

## Run locally

```bash
cd mobile
npm install
npm run ios
```

For Android emulator, use:

```bash
npm run android
```

Set `EXPO_PUBLIC_API_URL` when testing against a non-production backend:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:3001 npm start
```

Use your computer's LAN IP for physical phones. Android emulators can usually reach the backend at `http://10.0.2.2:3001`.
