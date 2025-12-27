import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';

export const NetworkStatusIndicator = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [visible, setVisible] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    try {
      const unsubscribe = NetInfo.addEventListener(state => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        setIsOffline(offline);

        if (offline) {
          setVisible(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setVisible(false));
        }
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("NetInfo not available yet. Rebuild the app.");
    }
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <WifiOff size={14} color="#fff" />
      <Text style={styles.text}>オフラインモード</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // iOS安全圏を考慮（実際にはLayoutで制御が望ましいがここでは簡易的に）
    left: '50%',
    transform: [{ translateX: -75 }],
    backgroundColor: '#64748b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 9999,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
