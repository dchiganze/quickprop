import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';

export function SplashScreenView() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/splash.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator
        size="small"
        color="#1F956B"
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  spinner: {
    marginTop: 40,
  },
});
