import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ERROR_LOG_KEY = 'fria.crashLog';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

async function persistError(error: Error) {
  try {
    const prev = await SecureStore.getItemAsync(ERROR_LOG_KEY);
    const entry = JSON.stringify({
      msg: error.message,
      stack: error.stack,
      time: Date.now(),
    });
    const next = prev ? prev + '\n---\n' + entry : entry;
    await SecureStore.setItemAsync(ERROR_LOG_KEY, next.slice(-5000));
  } catch {
    // Storage not available – swallow
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    persistError(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.subtitle}>{
          this.state.error?.message ?? 'Error desconocido'
        }</Text>
        <TouchableOpacity style={styles.btn} onPress={this.handleRetry}>
          <Text style={styles.btnLabel}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
  },
  btnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
