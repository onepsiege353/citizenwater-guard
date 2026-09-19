import React, { useState, useEffect } from 'react';
import {
  NavigationContainer,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Button, Alert, StyleSheet, Platform, StatusBar, AsyncStorage } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Helper to get user role from async storage (mocked for demo)
async function getUserRole() {
  try {
    const stored = await AsyncStorage.getItem('userRole');
    return stored; // 'citizen' | 'inspector' | 'admin' | null
  } catch (e) {
    return null;
  }
}

// Screens
function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>Accueil – CitizenWater Guard</Text>
      <Text style={styles.description}>
        Bienvenue. Utilisez le menu du bas pour signaler une anomalie, consulter le tableau de bord ou votre profil.
      </Text>
      <Button title="Signaler une anomalie" onPress={() => navigation.navigate('Report')} />
      <Button title="Tableau de bord" onPress={() => navigation.navigate('Dashboard')} />
      {/* Admin tab is conditionally rendered; we always add it but hide if not admin */}
      <Button title="Espace admin" onPress={() => navigation.navigate('Admin')} />
    </View>
  );
}

function ReportScreen({ navigation }) {
  const [type, setType] = useState('fuite');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);

  // Simple geolocation (mock for demo)
  useEffect(() => {
    // In real app, request location permission and get current position
    // Here we set a fixed position for Abidjan
    setLat(5.3696);
    setLon(-4.0057);
  }, []);

  const types = ['fuite', 'qualité', 'orpaillage', 'autre'];

  const submit = async () => {
    if (!lat || !lon) {
      Alert.alert('Position', 'Impossible d\'obtenir la position.');
      return;
    }
    const userId = 1; // placeholder; in real app would come from auth
    try {
      const response = await fetch('https://api.example.com/api/signalements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Authorization: `Bearer ${token}` // if auth
        },
        body: JSON.stringify({
          type,
          description,
          lat,
          lon,
          photo_url: null,
          user_id: userId,
        }),
      });
      if (response.ok) {
        Alert.alert('Succès', 'Signalement envoyé !');
        navigation.goBack();
      } else {
        const err = await response.json();
        Alert.alert('Erreur', err.error || 'Échec de l\'envoi');
      }
    } catch (e) {
      Alert.alert('Erreur', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Type de signalement</Text>
        <View style={styles.radioGroup}>
          {types.map((t) => (
            <View key={t} style={styles.radioGroup}>
              <Icon name={t} size={24} color={type === t ? '#3b82f6' : '#64748b'} />
              <Text style={styles.radioLabel} onPress={() => setType(t)}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description (optionnelle)</Text>
        <Text style={styles.input}>{description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Votre position</Text>
        <Text style={styles.coords}>
          {lat !== null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Non disponible'}
        </Text>
      </View>

      <Button title="Envoyer le signalement" onPress={submit} color="#10b981" />
    </View>
  );
}

function DashboardScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tableau de bord</Text>
      <Text style={styles.description}>
        Ici s'afficheraient les indicateurs clés (nombre de signalements, temps de réponse, cartes, etc.).
      </Text>
      <Button title="Retour" onPress={() => navigation.goBack()} />
    </View>
  );
}

// Admin screen – only visible for users with role 'admin'
async function AdminScreen({ navigation }) {
  const role = await getUserRole();
  // If not admin, redirect home (simple demo)
  if (role !== 'admin') {
    navigation.navigate('Home');
    return null;
  }
  return (
    <View style={styles.adminContainer}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.adminTitle}>Espace Administrateur</Text>
      <Text style={styles.adminDesc}>
        Bienvenue {role}. Vous pouvez gérer les signalements et exporter les données.
      </Text>
      <Button title="Voir les statistiques" onPress={() => alert('Stats en développement')} />
      <Button title="Exporter CSV" onPress={() => alert('Fonctionnalité CSV à venir')} />
      <Button title="Déconnexion" onPress={() => {
        AsyncStorage.removeItem('userRole').then(() => navigation.navigate('Home'));
      }} />
    </View>
  );
}

// -----------------------------------------------------
// Tab navigator setup
// -----------------------------------------------------
const Tab = createBottomTabs();

export default function App() {
  // Initialize role once
  useEffect(() => {
    // In a real app, you'd decode the JWT and store the role.
    // Here we just mock a role for demo purposes.
    // async () => { const r = await getUserRole(); if (r) setRole(r); }();
  }, []);

  const [role, setRole] = useState('citizen'); // default

  // Conditionally show Admin tab: only if role is admin
  const showAdmin = role === 'admin';

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') iconName = 'map';
            if (route.name === 'Report') iconName = 'send';
            if (route.name === 'Dashboard') iconName = 'grid';
            if (route.name === 'Admin' && showAdmin) iconName = 'shield';
            return <Icon name={iconName} size={size} color={color} />;
          },
        })}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Report" component={ReportScreen} />
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        {/* Admin tab appears only when user is admin */}
        {showAdmin && <Tab.Screen name="Admin" component={AdminScreen} />}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: Platform.OS === 'android' ? 20 : 10,
    marginBottom: 20,
  },
  description: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  adminContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  adminTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  adminDesc: { fontSize: 16, color: '#4a5568', marginBottom: 20, textAlign: 'center' },
  section: { padding: 12, backgroundColor: '#fff', marginBottom: 12, borderRadius: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  radioGroup: { flexDirection: 'row', marginBottom: 8 },
  radio: { width: 40, height: 40, borderWidth: 2, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  radioLabel: { fontSize: 12, textAlign: 'center', marginTop: 2 },
  input: { height: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, marginBottom: 8 },
  coords: { fontSize: 14, marginTop: 4, color: '#64748b' },
});
