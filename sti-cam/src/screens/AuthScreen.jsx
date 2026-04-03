import { useState, useEffect } from 'react';
import { colors, font, spacing, radius, globalStyles } from '../styles/theme';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

import logoImg from '../assets/camera.png';
import cloudImg from '../assets/cloud.png';
import lensImg from '../assets/lens.png';
import imagesImg from '../assets/images.png';
import Footer from '../components/Footer';

const FEATURES = [
  { text: 'Fotos directo a Google Drive', icon: cloudImg },
  { text: 'Captura instantánea — sin confirmación', icon: lensImg },
  { text: 'Modo continuo — tap, tap, tap', icon: imagesImg },
];

export default function AuthScreen({ onSignIn }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <div style={styles.container}>
      <style>{globalStyles}</style>
      <div style={{
        ...styles.inner,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease',
      }}>
        <div style={styles.logoWrap}>
          <img src={logoImg} alt="STI Cam Logo" style={styles.logoImg} />
          <h1 style={styles.title}>STI Cam</h1>
          <p style={styles.subtitle}>Registro fotográfico de obra</p>
        </div>

        <div style={styles.features}>
          {FEATURES.map((f, i) => (
            <div key={i} style={styles.featureRow}>
              <img src={f.icon} alt="" style={styles.featureIcon} />
              <span style={styles.featureText}>{f.text}</span>
            </div>
          ))}
        </div>

        <button onClick={onSignIn} style={styles.btn}>
          <GoogleIcon />
          <span>Iniciar sesión con Google</span>
        </button>

        <p style={styles.note}>Se requiere acceso a Google Drive para guardar y organizar tus fotos.</p>
      </div>
      <Footer />
    </div>
  );
}

const styles = {
  container: {
    fontFamily: font.family, background: '#19181e',
    minHeight: '100dvh', color: colors.text,
    maxWidth: 480, margin: '0 auto',
    display: 'flex', flexDirection: 'column',
  },
  inner: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1,
    padding: `${spacing.xxxl}px ${spacing.xxl}px`, gap: spacing.xxxl,
  },
  logoWrap: { textAlign: 'center' },
  logoImg: {
    width: 104, height: 104, objectFit: 'contain',
    margin: '0 auto 16px', display: 'block',
  },
  title: {
    fontSize: font.title, fontWeight: 700, color: colors.textWhite,
    margin: 0, letterSpacing: '-0.02em',
  },
  subtitle: { fontSize: font.base, color: colors.textMuted, marginTop: 4 },
  features: {
    display: 'flex', flexDirection: 'column', gap: spacing.md,
    width: '100%', maxWidth: 280,
  },
  featureRow: { display: 'flex', alignItems: 'center', gap: spacing.sm + 2 },
  featureIcon: { width: 22, height: 22, objectFit: 'contain' },
  featureText: { fontSize: font.base, color: colors.text },
  btn: {
    display: 'flex', alignItems: 'center', gap: spacing.sm + 2,
    padding: `${spacing.md}px ${spacing.xxl}px`, borderRadius: radius.md,
    border: `1px solid ${colors.borderLight}`, background: colors.bgInput,
    color: colors.textWhite, fontSize: font.lg, fontWeight: 500,
    cursor: 'pointer', width: '100%', maxWidth: 280, justifyContent: 'center',
  },
  note: { fontSize: font.sm, color: colors.textDim, textAlign: 'center' },
};
