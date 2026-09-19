import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, Platform } from 'react-native';
import { useMap } from 'react-native-maps';
import { useLocation } from '@react-native-community/geolocation';

export default function App() {
  const [reports, setReports] = useState([]);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);

  // Simple mock fetch of reports from backend (replace with real URL)
  useEffect(() => {
    // In a real app, fetch('/api/signalements') etc.
    setReports([
      { id: 1, type: 'fuite', description: 'Fuite robinet', lat: 5.3696, lon: -4.0057, photo: null, created_at: new Date() },
      { id: 2, type: 'qualite', description: 'Couleur anormale', lat: 5.37, lon: -4.01, photo: null, created_at: new Date() },
    ]);
  }, []);

  // Get current location once
  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      useLocation.getCurrentPosition(
        pos => {
          setLat(pos.coords.latitude);
          setLon(pos.coords.longitude);
        },
        err => console.error(err),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
  }, []);

  const submitReport = () => {
    if (lat === null || lon === null) {
      Alert.alert('Localisation', 'Impossible d\'obtenir la position. Veuillez activer le GPS.');
      return;
    }
    const report = {
      type: 'fuite', // would be selected by user
      description: 'Signalement rapide',
      lat,
      lon,
      photo: null,
      user_id: 'guest',
    };
    // Mock POST – in real app use fetch with method POST
    alert('Signalement envoyé !');
    setReports([...reports, report]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CitizenWater Guard</Text>
      <Button title="Signaler une anomalie" onPress={submitReport} />
      <Text style={statusTxt}>Statut : En attente</Text>
      {lat !== null && <Text style={styles.coords}>Votre position : {lat.toFixed(5)}, {lon.toFixed(5)}</Text>}
      <Text style={styles.instruction}>Appuyez sur “Signaler” pour envoyer un signalement.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    color: '#2c3e50',
  },
  statusTxt: {
    marginVertical: 10,
    fontSize: 16,
  },
  coords: {
    fontSize: 14,
    color: '#555',
  },
  instruction: {
    marginTop: 20,
    fontSize: 14,
    color: '#777',
  },
});